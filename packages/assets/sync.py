"""Publish an immutable R2 snapshot; boto3 is a CI-only dependency."""
import hashlib
import json
import mimetypes
import os
import random
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

ROOT = Path(__file__).resolve().parent


def missing(error):
    return error.response['Error']['Code'] in ('404', 'NoSuchKey', 'NotFound')


class RetryingClient:
    """R2 can return a numeric 429 that botocore does not classify as throttling."""
    def __init__(self, client, pause=time.sleep):
        self.client = client
        self.pause = pause

    def __getattr__(self, operation):
        method = getattr(self.client, operation)

        def request(**kwargs):
            for attempt in range(8):
                try:
                    return method(**kwargs)
                except ClientError as error:
                    response = error.response
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
                    print(f'R2 {operation} throttled; retry {attempt + 1}/7 in {delay:.1f}s', flush=True)
                    self.pause(delay)
        return request


def publish(client, bucket, manifest, root=ROOT, pause=time.sleep):
    client = RetryingClient(client, pause)
    # The exact checked-in bytes are the completion marker.
    body = (root / 'manifest.json').read_bytes()
    prefix = f"releases/{manifest['release']}/"
    try:
        published = client.get_object(Bucket=bucket, Key=prefix + 'manifest.json')['Body'].read()
        if published != body:
            raise ValueError('Published release manifest differs; refusing to overwrite it')
        print('Release already complete; no uploads needed')
        return
    except ClientError as error:
        if not missing(error):
            raise
    try:
        previous = json.loads(client.get_object(Bucket=bucket, Key='latest.json')['Body'].read())
    except ClientError as error:
        if not missing(error):
            raise
        previous = {'files': {}}

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
        old_by_hash[(entry['sha256'], Path(path).suffix)] = path

    def transfer(item):
        path, entry = item
        target = prefix + path
        expected = entry['sha256']
        if target in existing:
            head = client.head_object(Bucket=bucket, Key=target)
            if head.get('Metadata', {}).get('sha256') == expected and head['ContentLength'] == entry['bytes']:
                return 'skipped'
            raise ValueError(f'Existing immutable object differs: {target}')
        old_path = old_by_hash.get((expected, Path(path).suffix))
        if old_path is not None:
            source = f"releases/{previous['release']}/{old_path}"
            # Copy preserves source metadata; the destination HEAD below verifies
            # that same SHA-256 and size, avoiding a redundant source HEAD.
            client.copy_object(Bucket=bucket, Key=target, CopySource={'Bucket': bucket, 'Key': source})
            result = 'copied'
        else:
            source = root / 'public' / path
            if 'input' in entry:
                source = root / '.cache' / f"{entry['inputSha256']}.glb.gz"
            payload = source.read_bytes()
            if hashlib.sha256(payload).hexdigest() != expected or len(payload) != entry['bytes']:
                raise ValueError(f'Local asset changed after verification: {source}')
            # .gz siblings are decoded explicitly in the game; do NOT set Content-Encoding.
            mime = 'application/octet-stream' if path.endswith('.gz') else mimetypes.guess_type(path)[0]
            mime = {'.wgsl': 'text/plain', '.hdr': 'application/octet-stream', '.ktx2': 'image/ktx2'}.get(Path(path).suffix, mime)
            client.put_object(Bucket=bucket, Key=target, Body=payload,
                              ContentType=mime or 'application/octet-stream',
                              CacheControl='public, max-age=31536000, immutable', Metadata={'sha256': expected})
            result = 'uploaded'
        head = client.head_object(Bucket=bucket, Key=target)
        if head.get('Metadata', {}).get('sha256') != expected or head['ContentLength'] != entry['bytes']:
            raise ValueError(f'Uploaded object failed metadata verification: {target}')
        return result

    counts = {'uploaded': 0, 'copied': 0, 'skipped': 0}
    with ThreadPoolExecutor(max_workers=4) as pool:
        for completed, result in enumerate(pool.map(transfer, manifest['files'].items()), 1):
            counts[result] += 1
            if completed % 250 == 0:
                print(f"Synced {completed}/{len(manifest['files'])}: {counts}", flush=True)
    # Commit marker is written only after ALL transfers succeed. Failed runs are resumable.
    client.put_object(Bucket=bucket, Key=prefix + 'manifest.json', Body=body,
                      ContentType='application/json', CacheControl='public, max-age=31536000, immutable')
    client.put_object(Bucket=bucket, Key='latest.json', Body=body,
                      ContentType='application/json', CacheControl='no-store')
    print(f"Release {manifest['release']}: {counts}")


if __name__ == '__main__':
    client = boto3.client('s3', endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
                          aws_access_key_id=os.environ['R2_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['R2_SECRET_ACCESS_KEY'], region_name='auto',
                          config=Config(retries={'max_attempts': 5, 'mode': 'adaptive'}, max_pool_connections=4))
    publish(client, os.environ['R2_BUCKET'], json.loads((ROOT / 'manifest.json').read_text()))
