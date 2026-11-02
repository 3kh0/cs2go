"""Publish an immutable R2 snapshot; boto3 is a CI-only dependency."""
import hashlib
import json
import mimetypes
import os
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import BoundedSemaphore, Lock

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parent
TRANSFER_WORKERS = 32
UPLOAD_WORKERS = 4


def missing(error):
    return error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')


class RetryingClient:
    """R2 can return a numeric 429 that botocore does not classify as throttling."""
    def __init__(self, client, pause=time.sleep):
        self.client = client
        self.pause = pause
        self.lock = Lock()
        self.operations = {}
        self.throttle_retries = 0

    def record(self, operation, started, response):
        with self.lock:
            stats = self.operations.setdefault(operation, {'calls': 0, 'seconds': 0, 'sdk_retries': 0})
            stats['calls'] += 1
            stats['seconds'] += time.monotonic() - started
            stats['sdk_retries'] += response.get('ResponseMetadata', {}).get('RetryAttempts', 0)

    def summary(self):
        with self.lock:
            operations = '; '.join(
                f"{name}: {stats['calls']} calls, {stats['seconds'] / stats['calls']:.3f}s average, "
                f"{stats['sdk_retries']} SDK retries" for name, stats in sorted(self.operations.items()))
            return f'R2 requests: {operations}; {self.throttle_retries} outer throttle retries'

    def __getattr__(self, operation):
        method = getattr(self.client, operation)

        def request(**kwargs):
            for attempt in range(8):
                started = time.monotonic()
                try:
                    result = method(**kwargs)
                    self.record(operation, started, result or {})
                    return result
                except ClientError as error:
                    response = error.response
                    self.record(operation, started, response)
                    status = response.get('ResponseMetadata', {}).get('HTTPStatusCode')
                    code = response.get('Error', {}).get('Code')
                    retryable = status in (429, 503) or code in (
                        '429', 'SlowDown', 'TooManyRequests', 'TooManyRequestsException',
                        'Throttling', 'ThrottlingException', 'ServiceUnavailable')
                    if not retryable or attempt == 7:
                        raise
                    headers = response.get('ResponseMetadata', {}).get('HTTPHeaders', {})
                    try:
                        retry_after = min(30, max(0, float(headers.get('retry-after', 0))))
                    except (TypeError, ValueError):
                        retry_after = 0
                    delay = max(retry_after, min(30, 2 ** attempt + random.random()))
                    with self.lock:
                        self.throttle_retries += 1
                    print(f'R2 {operation} throttled; retry {attempt + 1}/7 in {delay:.1f}s', flush=True)
                    self.pause(delay)
        return request


def guard_copy_destination(params, **kwargs):
    # R2's destination condition is checked at commit, unlike CopySourceIfNoneMatch.
    params['headers']['cf-copy-destination-if-none-match'] = '*'


def published_status(client, bucket, manifest, root=ROOT, tree=None):
    """Read-only fast path requires a receipt from verification of this exact Git tree."""
    body = (root / 'manifest.json').read_bytes()
    prefix = f"releases/{manifest['release']}/"
    keys = [prefix + 'manifest.json']
    if tree:
        if len(tree) not in (40, 64) or any(c not in '0123456789abcdef' for c in tree):
            raise ValueError('Invalid asset Git tree identity')
        keys.append(prefix + f'verified/{tree}.json')
    for key in keys:
        try:
            published = client.get_object(Bucket=bucket, Key=key)['Body'].read()
        except ClientError as error:
            if not missing(error):
                raise
            return False
        if published != body:
            raise ValueError(f'Published verification differs; refusing to overwrite {key}')
    return bool(tree)


def create_once(client, **kwargs):
    """Only accept an existing exact marker; never overwrite immutable release data."""
    try:
        client.put_object(IfNoneMatch='*', **kwargs)
    except ClientError as error:
        if error.response['Error']['Code'] not in ('412', 'PreconditionFailed'):
            raise
        stored = client.get_object(Bucket=kwargs['Bucket'], Key=kwargs['Key'])['Body'].read()
        if stored != kwargs['Body']:
            raise ValueError(f"Existing immutable object differs: {kwargs['Key']}") from error


def verification_receipt(client, bucket, manifest, root, tree):
    if tree:
        # The workflow supplies this only after verifying the checked-out asset tree.
        if len(tree) not in (40, 64) or any(c not in '0123456789abcdef' for c in tree):
            raise ValueError('Invalid asset Git tree identity')
        create_once(client, Bucket=bucket,
                    Key=f"releases/{manifest['release']}/verified/{tree}.json",
                    Body=(root / 'manifest.json').read_bytes(), ContentType='application/json',
                    CacheControl='public, max-age=31536000, immutable')


def seed_cache(client, bucket, manifest, root=ROOT, pause=time.sleep):
    """Reuse a complete immutable release's verified wire bytes before CI encoding."""
    client = RetryingClient(client, pause)
    prefix = f"releases/{manifest['release']}/"
    try:
        marker = client.get_object(Bucket=bucket, Key=prefix + 'manifest.json')['Body'].read()
    except ClientError as error:
        if not missing(error):
            raise
        print('Release not published yet; verification will generate compression locally')
        return
    if marker != (root / 'manifest.json').read_bytes():
        raise ValueError('Published release manifest differs; refusing cache seeding')
    cache = root / '.cache'
    cache.mkdir(exist_ok=True)
    # Repeated logical payloads share one compression result.
    entries = {entry['sha256']: (path, entry) for path, entry in manifest['files'].items()
               if entry.get('transport', {}).get('encoding') == 'br'}

    def seed(item):
        path, entry = item
        wire = entry['transport']
        target = cache / f"{entry['sha256']}.q11.br"
        if target.exists():
            payload = target.read_bytes()
            if len(payload) == wire['bytes'] and hashlib.sha256(payload).hexdigest() == wire['sha256']:
                return
        payload = client.get_object(Bucket=bucket, Key=prefix + path)['Body'].read()
        if len(payload) != wire['bytes'] or hashlib.sha256(payload).hexdigest() != wire['sha256']:
            raise ValueError(f'Published Brotli payload differs: {path}')
        temporary = target.with_suffix(f'.tmp-{os.getpid()}')
        temporary.write_bytes(payload)
        temporary.replace(target)

    with ThreadPoolExecutor(max_workers=4) as pool:
        for completed, _ in enumerate(pool.map(seed, entries.values()), 1):
            if completed % 250 == 0:
                print(f'Seeded {completed}/{len(entries)} Brotli cache payloads', flush=True)
    print(f'Verified {len(entries)} immutable Brotli cache payloads; local round-trip verification follows')


def publish(client, bucket, manifest, root=ROOT, pause=time.sleep, tree=None,
            workers=TRANSFER_WORKERS, upload_workers=UPLOAD_WORKERS):
    if workers < 1 or upload_workers < 1:
        raise ValueError('Transfer and upload concurrency must be positive')
    client = RetryingClient(client, pause)
    # The exact checked-in bytes are the completion marker.
    body = (root / 'manifest.json').read_bytes()
    prefix = f"releases/{manifest['release']}/"
    try:
        published = client.get_object(Bucket=bucket, Key=prefix + 'manifest.json')['Body'].read()
        if published != body:
            raise ValueError('Published release manifest differs; refusing to overwrite it')
        verification_receipt(client, bucket, manifest, root, tree)
        print('Release already complete; no uploads needed')
        return
    except ClientError as error:
        if not missing(error):
            raise
    try:
        previous_body = client.get_object(Bucket=bucket, Key='latest.json')['Body'].read()
        previous = json.loads(previous_body)
    except ClientError as error:
        if not missing(error):
            raise
        previous = {'files': {}}
        previous_body = None

    # List once to avoid one doomed HEAD per missing key in a new snapshot.
    # Existing keys still require SHA-256 metadata verification before reuse.
    existing = set()
    continuation = None
    while True:
        args = {'Bucket': bucket, 'Prefix': prefix}
        if continuation:
            args['ContinuationToken'] = continuation
        page = client.list_objects_v2(**args)
        existing.update(item['Key'] for item in page.get('Contents', []))
        if not page.get('IsTruncated'):
            break
        next_token = page.get('NextContinuationToken')
        if not next_token or next_token == continuation:
            raise ValueError('Invalid R2 listing continuation')
        continuation = next_token

    # Never use ETags as content hashes: multipart uploads have different ETag semantics.
    old_by_hash = {}
    for path, entry in previous['files'].items():
        wire = entry.get('transport', entry)
        old_by_hash[(wire['sha256'], Path(path).suffix, wire.get('encoding'))] = path

    # Copy/HEAD requests wait on remote latency without buffering payloads.
    # Keep the smaller upload budget separate so large assets cannot exhaust RAM.
    upload_slots = BoundedSemaphore(upload_workers)

    def upload(path, entry, wire, target):
        source = root / 'public' / path
        if 'input' in entry:
            source = root / '.cache' / f"{entry['inputSha256']}.glb.gz"
        encoding = wire.get('encoding')
        if encoding == 'br':
            source = root / '.cache' / f"{entry['sha256']}.q11.br"
        payload = source.read_bytes()
        if hashlib.sha256(payload).hexdigest() != wire['sha256'] or len(payload) != wire['bytes']:
            raise ValueError(f'Local asset changed after verification: {source}')
        # Brotli is an HTTP wrapper; browser decoding yields the logical file bytes.
        # A .gz logical file remains gzip and is then decoded by the game.
        mime = 'application/octet-stream' if path.endswith('.gz') else mimetypes.guess_type(path)[0]
        mime = {'.wgsl': 'text/plain', '.hdr': 'application/octet-stream', '.ktx2': 'image/ktx2'}.get(Path(path).suffix, mime)
        headers = {'ContentEncoding': encoding} if encoding else {}
        create_once(client, Bucket=bucket, Key=target, Body=payload,
                    ContentType=mime or 'application/octet-stream',
                    CacheControl='public, max-age=31536000, immutable', Metadata={'sha256': wire['sha256']}, **headers)

    def transfer(item):
        path, entry = item
        target = prefix + path
        wire = entry.get('transport', entry)
        expected = wire['sha256']
        encoding = wire.get('encoding')
        if target in existing:
            head = client.head_object(Bucket=bucket, Key=target)
            if head.get('Metadata', {}).get('sha256') == expected and head['ContentLength'] == wire['bytes'] and head.get('ContentEncoding') == encoding:
                return 'skipped'
            raise ValueError(f'Existing immutable object differs: {target}')
        old_path = old_by_hash.get((expected, Path(path).suffix, encoding))
        if old_path is not None:
            source = f"releases/{previous['release']}/{old_path}"
            # Copy preserves source metadata; the destination HEAD below verifies
            # that same SHA-256 and size, avoiding a redundant source HEAD.
            try:
                client.copy_object(Bucket=bucket, Key=target, CopySource={'Bucket': bucket, 'Key': source})
                result = 'copied'
            except ClientError as error:
                if error.response['Error']['Code'] not in ('412', 'PreconditionFailed'):
                    raise
                # A competing writer won; the same metadata verification below
                # accepts identical content and rejects a different immutable key.
                result = 'skipped'
        else:
            with upload_slots:
                upload(path, entry, wire, target)
            result = 'uploaded'
        head = client.head_object(Bucket=bucket, Key=target)
        if head.get('Metadata', {}).get('sha256') != expected or head['ContentLength'] != wire['bytes'] or head.get('ContentEncoding') != encoding:
            raise ValueError(f'Uploaded object failed metadata verification: {target}')
        return result

    counts = {'uploaded': 0, 'copied': 0, 'skipped': 0}
    started = time.monotonic()
    print(f"Syncing {len(manifest['files'])} assets with {workers} transfer workers "
          f'and at most {upload_workers} buffered uploads', flush=True)
    try:
        with ThreadPoolExecutor(max_workers=workers) as pool:
            pending = [pool.submit(transfer, item) for item in manifest['files'].items()]
            try:
                # Report actual completions, rather than waiting for earlier slow files.
                for completed, future in enumerate(as_completed(pending), 1):
                    counts[future.result()] += 1
                    if completed % 250 == 0:
                        elapsed = time.monotonic() - started
                        print(f"Synced {completed}/{len(manifest['files'])}: {counts}; "
                              f'{completed / elapsed:.1f} assets/s, {elapsed:.1f}s elapsed', flush=True)
            except BaseException:
                for future in pending:
                    future.cancel()
                raise
    finally:
        print(client.summary(), flush=True)
    # Commit marker is written only after ALL transfers succeed. Failed runs are resumable.
    create_once(client, Bucket=bucket, Key=prefix + 'manifest.json', Body=body,
                      ContentType='application/json', CacheControl='public, max-age=31536000, immutable')
    verification_receipt(client, bucket, manifest, root, tree)
    if previous_body != body:
        client.put_object(Bucket=bucket, Key='latest.json', Body=body,
                          ContentType='application/json', CacheControl='no-store')
    print(f"Release {manifest['release']}: {counts}")


if __name__ == '__main__':
    client = boto3.client('s3', endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                          aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'], region_name='auto',
                          config=Config(retries={'max_attempts': 5, 'mode': 'adaptive'}, max_pool_connections=TRANSFER_WORKERS))
    client.meta.events.register('before-call.s3.CopyObject', guard_copy_destination)
    mode = sys.argv[1] if len(sys.argv) > 1 else 'publish'
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    tree = os.environ.get('ASSET_TREE')
    if mode == 'status':
        complete = published_status(RetryingClient(client), os.environ['R2_BUCKET'], manifest, tree=tree)
        print(f'Exact asset tree already verified and published: {complete}')
        if os.environ.get('GITHUB_OUTPUT'):
            with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
                output.write(f'complete={str(complete).lower()}\n')
    elif mode == 'seed':
        seed_cache(client, os.environ['R2_BUCKET'], manifest)
    elif mode == 'publish':
        publish(client, os.environ['R2_BUCKET'], manifest, tree=tree)
    else:
        raise ValueError(f'Unknown operation: {mode}')
