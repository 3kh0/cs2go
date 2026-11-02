"""Exercise publishing without credentials, network, or a real bucket."""
import hashlib
import io
import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Event, Lock
from botocore.exceptions import ClientError
from sync import publish, seed_cache, published_status, create_once, guard_copy_destination, RetryingClient


class Bucket:
    def __init__(self):
        self.objects = {}
        self.uploads = []
        self.copies = []
        self.fail = False
        self.heads = []
        self.listings = 0

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            raise ClientError({'Error': {'Code': 'NoSuchKey'}}, 'GetObject')
        return {'Body': io.BytesIO(self.objects[Key]['Body'])}

    def head_object(self, Bucket, Key):
        self.heads.append(Key)
        self.get_object(Bucket=Bucket, Key=Key)
        item = self.objects[Key]
        return {'ContentLength': len(item['Body']), 'Metadata': item.get('Metadata', {}),
                'ContentEncoding': item.get('ContentEncoding')}

    def list_objects_v2(self, Bucket, Prefix, ContinuationToken=None):
        self.listings += 1
        keys = sorted(key for key in self.objects if key.startswith(Prefix))
        offset = int(ContinuationToken or 0)
        page = keys[offset:offset + 1]
        more = offset + 1 < len(keys)
        return {'Contents': [{'Key': key} for key in page], 'IsTruncated': more,
                'NextContinuationToken': str(offset + 1) if more else None}

    def put_object(self, **kwargs):
        if self.fail and kwargs['Key'].endswith('.bin'):
            raise RuntimeError('transfer failed')
        if kwargs.get('IfNoneMatch') == '*' and kwargs['Key'] in self.objects:
            raise ClientError({'Error': {'Code': 'PreconditionFailed'}}, 'PutObject')
        self.objects[kwargs['Key']] = kwargs
        self.uploads.append(kwargs['Key'])

    def copy_object(self, Bucket, Key, CopySource):
        self.objects[Key] = dict(self.objects[CopySource['Key']])
        self.copies.append(Key)


class PublishTests(unittest.TestCase):
    def test_parallel_transfers_bound_uploads_and_wait_for_all_verifications(self):
        for copying, limit, total in [(True, 32, 40), (False, 4, 12)]:
            with self.subTest(copying=copying), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / 'public').mkdir()
                entry = {'sha256': hashlib.sha256(b'one').hexdigest(), 'bytes': 3}
                entries = {f'{index}.bin': entry for index in range(total)}
                manifest = {'release': 'parallel', 'files': entries}
                body = json.dumps(manifest).encode()
                (root / 'manifest.json').write_bytes(body)
                for path in entries:
                    (root / 'public' / path).write_bytes(b'one')

                class BlockingBucket(Bucket):
                    def __init__(self):
                        super().__init__()
                        self.lock = Lock()
                        self.release = Event()
                        self.at_capacity = Event()
                        self.over_budget = Event()
                        self.active = 0
                        self.peak = 0
                        self.verified = set()

                    def block_transfer(self):
                        with self.lock:
                            self.active += 1
                            self.peak = max(self.peak, self.active)
                            if self.active == limit:
                                self.at_capacity.set()
                            if self.active > limit:
                                self.over_budget.set()
                        if not self.release.wait(5):
                            raise RuntimeError('Test transfer gate timed out')
                        with self.lock:
                            self.active -= 1

                    def copy_object(self, **kwargs):
                        self.block_transfer()
                        return super().copy_object(**kwargs)

                    def put_object(inner, **kwargs):
                        if kwargs['Key'].endswith('.bin'):
                            inner.block_transfer()
                        else:
                            self.assertEqual(len(inner.verified), total)
                        return super(BlockingBucket, inner).put_object(**kwargs)

                    def head_object(self, **kwargs):
                        result = super().head_object(**kwargs)
                        with self.lock:
                            self.verified.add(kwargs['Key'])
                        return result

                bucket = BlockingBucket()
                if copying:
                    bucket.objects['latest.json'] = {'Body': json.dumps({
                        'release': 'old', 'files': {'source.bin': entry}}).encode()}
                    bucket.objects['releases/old/source.bin'] = {
                        'Body': b'one', 'Metadata': {'sha256': entry['sha256']}}
                with ThreadPoolExecutor(max_workers=1) as pool:
                    work = pool.submit(publish, bucket, 'test', manifest, root)
                    try:
                        self.assertTrue(bucket.at_capacity.wait(5))
                        self.assertFalse(bucket.over_budget.wait(0.1))
                        self.assertNotIn('releases/parallel/manifest.json', bucket.objects)
                    finally:
                        bucket.release.set()
                    work.result(timeout=5)
                self.assertEqual(bucket.peak, limit)
                self.assertEqual(bucket.objects['releases/parallel/manifest.json']['Body'], body)

    def test_preflight_requires_receipt_for_exact_asset_tree(self):
        bucket = Bucket()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = {'release': 'release', 'files': {}}
            body = json.dumps(manifest).encode()
            (root / 'manifest.json').write_bytes(body)
            tree = 'a' * 40
            self.assertFalse(published_status(bucket, 'test', manifest, root, tree))
            bucket.objects['releases/release/manifest.json'] = {'Body': body}
            self.assertFalse(published_status(bucket, 'test', manifest, root, tree))
            publish(bucket, 'test', manifest, root, tree=tree)
            self.assertEqual(bucket.uploads, [f'releases/release/verified/{tree}.json'])
            self.assertTrue(published_status(bucket, 'test', manifest, root, tree))
            # A changed public file with a stale manifest changes Git's tree:
            # no receipt means normal verification must run, never a false skip.
            self.assertFalse(published_status(bucket, 'test', manifest, root, 'b' * 40))
            self.assertFalse(published_status(bucket, 'test', manifest, root))
            publish(bucket, 'test', manifest, root, tree=tree)
            self.assertEqual(len(bucket.uploads), 1)
            bucket.objects[f'releases/release/verified/{tree}.json']['Body'] = b'corrupt'
            with self.assertRaises(ValueError):
                published_status(bucket, 'test', manifest, root, tree)
            self.assertNotIn('latest.json', bucket.objects)

    def test_create_once_handles_racing_identical_writes_and_rejects_conflicts(self):
        bucket = Bucket()
        create_once(bucket, Bucket='test', Key='immutable', Body=b'first')
        create_once(bucket, Bucket='test', Key='immutable', Body=b'first')
        with self.assertRaises(ValueError):
            create_once(bucket, Bucket='test', Key='immutable', Body=b'changed')
        self.assertEqual(bucket.objects['immutable']['Body'], b'first')
        self.assertEqual(bucket.uploads, ['immutable'])

    def test_copy_guard_sets_destination_condition_before_signing(self):
        import boto3
        client = boto3.client('s3', endpoint_url='https://example.invalid',
                              aws_access_key_id='fixture', aws_secret_access_key='fixture', region_name='auto')
        client.meta.events.register('before-call.s3.CopyObject', guard_copy_destination)
        class RequestCaptured(Exception):
            pass
        def capture(request, **kwargs):
            self.assertEqual(request.headers['cf-copy-destination-if-none-match'], b'*')
            self.assertIn('cf-copy-destination-if-none-match', request.headers['Authorization'].decode())
            raise RequestCaptured()
        client.meta.events.register('before-send.s3.CopyObject', capture)
        with self.assertRaises(RequestCaptured):
            client.copy_object(Bucket='fixture', Key='target', CopySource={'Bucket': 'fixture', 'Key': 'source'})
        def capture_upload(request, **kwargs):
            self.assertEqual(request.headers['If-None-Match'], b'*')
            raise RequestCaptured()
        client.meta.events.register('before-send.s3.PutObject', capture_upload)
        with self.assertRaises(RequestCaptured):
            create_once(client, Bucket='fixture', Key='target', Body=b'payload')

    def test_copy_race_verifies_winner_without_overwriting(self):
        class RacingBucket(Bucket):
            winner = b'one'
            def copy_object(self, Bucket, Key, CopySource):
                self.objects[Key] = {'Body': self.winner, 'Metadata': {
                    'sha256': hashlib.sha256(self.winner).hexdigest()}}
                raise ClientError({'Error': {'Code': 'PreconditionFailed'}}, 'CopyObject')
        for winner, succeeds in [(b'one', True), (b'conflict', False)]:
            with self.subTest(winner=winner), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                entry = {'sha256': hashlib.sha256(b'one').hexdigest(), 'bytes': 3}
                manifest = {'release': 'new', 'files': {'a.bin': entry}}
                (root / 'manifest.json').write_text(json.dumps(manifest))
                bucket = RacingBucket()
                bucket.winner = winner
                bucket.objects['latest.json'] = {'Body': json.dumps({
                    'release': 'old', 'files': {'a.bin': entry}}).encode()}
                if succeeds:
                    publish(bucket, 'test', manifest, root)
                    self.assertIn('releases/new/manifest.json', bucket.objects)
                else:
                    with self.assertRaises(ValueError):
                        publish(bucket, 'test', manifest, root)
                    self.assertNotIn('releases/new/manifest.json', bucket.objects)
                self.assertEqual(bucket.objects['releases/new/a.bin']['Body'], winner)
                self.assertEqual(bucket.copies, [])

    def test_latest_pointer_is_not_rewritten_when_identical(self):
        bucket = Bucket()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = {'release': 'empty', 'files': {}}
            body = json.dumps(manifest).encode()
            (root / 'manifest.json').write_bytes(body)
            bucket.objects['latest.json'] = {'Body': body}
            publish(bucket, 'test', manifest, root)
            self.assertEqual(bucket.uploads, ['releases/empty/manifest.json'])
            self.assertEqual(bucket.objects['latest.json']['Body'], body)

    def test_preflight_permission_errors_fail_closed(self):
        class DeniedBucket(Bucket):
            def get_object(self, **kwargs):
                raise ClientError({'Error': {'Code': 'AccessDenied'}}, 'GetObject')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = {'release': 'blocked', 'files': {}}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaises(ClientError):
                published_status(DeniedBucket(), 'test', manifest, root, 'a' * 40)

    def test_incremental_immutable_release_and_failure(self):
        bucket = Bucket()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'public').mkdir()

            def manifest(release, content):
                entries = {}
                for name, data in content.items():
                    (root / 'public' / name).write_bytes(data)
                    entries[name] = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
                result = {'release': release, 'files': entries}
                (root / 'manifest.json').write_text(json.dumps(result))
                return result

            first = manifest('first', {'a.bin': b'one', 'b.bin': b'two'})
            publish(bucket, 'test', first, root)
            self.assertEqual(len(bucket.uploads), 4)  # two payloads + two markers
            publish(bucket, 'test', first, root)
            self.assertEqual(len(bucket.uploads), 4)
            second = manifest('second', {'a.bin': b'one', 'b.bin': b'changed'})
            publish(bucket, 'test', second, root)
            self.assertEqual(bucket.copies, ['releases/second/a.bin'])
            self.assertIn('releases/first/b.bin', bucket.objects)  # rollback retained
            third = manifest('third', {'a.bin': b'new'})
            bucket.fail = True
            with self.assertRaises(RuntimeError):
                publish(bucket, 'test', third, root)
            self.assertNotIn('releases/third/manifest.json', bucket.objects)
            self.assertEqual(json.loads(bucket.objects['latest.json']['Body'])['release'], 'second')

    def test_brotli_wire_hash_encoding_copy_and_resume(self):
        bucket = Bucket()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / '.cache').mkdir()
            logical = b'logical gzip bytes are unchanged'
            wire = b'opaque Brotli payload (fixture)'
            logical_hash = hashlib.sha256(logical).hexdigest()
            entry = {'sha256': logical_hash, 'bytes': len(logical), 'transport': {
                'encoding': 'br', 'quality': 11, 'sha256': hashlib.sha256(wire).hexdigest(), 'bytes': len(wire)}}
            (root / '.cache' / f'{logical_hash}.q11.br').write_bytes(wire)
            def manifest(release):
                data = {'release': release, 'files': {'asset.bin.gz': entry}}
                (root / 'manifest.json').write_text(json.dumps(data))
                return data
            publish(bucket, 'test', manifest('first'), root)
            stored = bucket.objects['releases/first/asset.bin.gz']
            self.assertEqual(stored['Body'], wire)
            self.assertEqual(stored['ContentEncoding'], 'br')
            self.assertEqual(stored['ContentType'], 'application/octet-stream')
            self.assertEqual(stored['Metadata']['sha256'], entry['transport']['sha256'])
            publish(bucket, 'test', manifest('second'), root)
            self.assertIn('releases/second/asset.bin.gz', bucket.copies)
            self.assertEqual(bucket.objects['releases/second/asset.bin.gz']['ContentEncoding'], 'br')
            # Valid wire bytes with a lost encoding header would make clients see
            # compressed data; retries must refuse that immutable object.
            third = manifest('third')
            bucket.objects['releases/third/asset.bin.gz'] = dict(stored)
            bucket.objects['releases/third/asset.bin.gz'].pop('ContentEncoding')
            with self.assertRaises(ValueError):
                publish(bucket, 'test', third, root)
            self.assertNotIn('releases/third/manifest.json', bucket.objects)

    def test_cache_seeding_requires_complete_release_and_verified_wire_bytes(self):
        bucket = Bucket()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            wire = b'compressed fixture'
            entry = {'sha256': 'a' * 64, 'bytes': 200, 'transport': {
                'encoding': 'br', 'quality': 11, 'sha256': hashlib.sha256(wire).hexdigest(), 'bytes': len(wire)}}
            manifest = {'release': 'seed', 'files': {'asset.bin': entry, 'same.bin': entry}}
            body = json.dumps(manifest).encode()
            (root / 'manifest.json').write_bytes(body)
            seed_cache(bucket, 'test', manifest, root)
            self.assertFalse((root / '.cache').exists())
            bucket.objects['releases/seed/manifest.json'] = {'Body': body}
            bucket.objects['releases/seed/same.bin'] = {'Body': wire}
            seed_cache(bucket, 'test', manifest, root)
            target = root / '.cache' / f"{entry['sha256']}.q11.br"
            self.assertEqual(target.read_bytes(), wire)
            target.write_bytes(b'corrupt cache')
            bucket.objects['releases/seed/same.bin'] = {'Body': b'wrong wire bytes'}
            with self.assertRaises(ValueError):
                seed_cache(bucket, 'test', manifest, root)
            self.assertEqual(target.read_bytes(), b'corrupt cache')
            bucket.objects['releases/seed/manifest.json'] = {'Body': b'other manifest'}
            with self.assertRaises(ValueError):
                seed_cache(bucket, 'test', manifest, root)

    def test_hash_mismatch_never_publishes_marker(self):
        bucket = Bucket()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'public').mkdir()
            (root / 'public/a.bin').write_bytes(b'tampered')
            manifest = {'release': 'bad', 'files': {'a.bin': {'sha256': '0' * 64, 'bytes': 8}}}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            with self.assertRaises(ValueError):
                publish(bucket, 'test', manifest, root)
            self.assertEqual(bucket.objects, {})


    def test_listing_resumes_without_negative_or_source_heads(self):
        bucket = Bucket()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'public').mkdir()
            content = b'one'
            entry = {'sha256': hashlib.sha256(content).hexdigest(), 'bytes': 3}
            manifest = {'release': 'resume', 'files': {'a.bin': entry, 'b.bin': entry, 'c.bin': entry}}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            for name in ('a.bin', 'b.bin'):
                bucket.objects['releases/resume/' + name] = {'Body': content, 'Metadata': {'sha256': entry['sha256']}}
            previous = {'release': 'old', 'files': {'source.bin': entry}}
            bucket.objects['latest.json'] = {'Body': json.dumps(previous).encode()}
            bucket.objects['releases/old/source.bin'] = {'Body': content, 'Metadata': {'sha256': entry['sha256']}}
            publish(bucket, 'test', manifest, root)
            self.assertEqual(bucket.listings, 2)
            self.assertCountEqual(bucket.heads, ['releases/resume/a.bin', 'releases/resume/b.bin', 'releases/resume/c.bin'])
            self.assertEqual(bucket.copies, ['releases/resume/c.bin'])
            self.assertIn('releases/resume/manifest.json', bucket.objects)

    def test_bad_copied_metadata_still_blocks_publication(self):
        bucket = Bucket()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            entry = {'sha256': hashlib.sha256(b'one').hexdigest(), 'bytes': 3}
            manifest = {'release': 'new', 'files': {'a.bin': entry}}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            bucket.objects['latest.json'] = {'Body': json.dumps({'release':'old', 'files':{'a.bin':entry}}).encode()}
            bucket.objects['releases/old/a.bin'] = {'Body': b'one', 'Metadata': {'sha256':'wrong'}}
            with self.assertRaises(ValueError):
                publish(bucket, 'test', manifest, root)
            self.assertNotIn('releases/new/manifest.json', bucket.objects)


class RetryTests(unittest.TestCase):
    def test_sdk_retries_are_visible_even_when_request_succeeds(self):
        class Retried:
            def head_object(self, **kwargs):
                return {'ResponseMetadata': {'RetryAttempts': 3}}
        client = RetryingClient(Retried())
        client.head_object(Bucket='test', Key='asset')
        self.assertIn('head_object: 1 calls', client.summary())
        self.assertIn('3 SDK retries', client.summary())
        self.assertIn('0 outer throttle retries', client.summary())

    def test_numeric_r2_throttle_retries_and_respects_retry_after(self):
        class Throttled:
            attempts = 0
            def head_object(self, **kwargs):
                self.attempts += 1
                if self.attempts < 3:
                    raise ClientError({'Error': {'Code': '429'}, 'ResponseMetadata': {
                        'HTTPStatusCode': 429, 'HTTPHeaders': {'retry-after': '3'}}}, 'HeadObject')
                return {'Metadata': {'sha256': 'verified'}}
        original = Throttled()
        delays = []
        result = RetryingClient(original, delays.append).head_object(Bucket='test', Key='asset')
        self.assertEqual(result['Metadata']['sha256'], 'verified')
        self.assertEqual(original.attempts, 3)
        self.assertEqual(delays, [3, 3])

    def test_auth_errors_fail_immediately_and_throttle_exhaustion_stays_bounded(self):
        class Failing:
            def __init__(self, code):
                self.code = code
                self.attempts = 0
            def head_object(self, **kwargs):
                self.attempts += 1
                raise ClientError({'Error': {'Code': self.code}}, 'HeadObject')
        for code, attempts in [('AccessDenied', 1), ('429', 8)]:
            client = Failing(code)
            delays = []
            with self.assertRaises(ClientError):
                RetryingClient(client, delays.append).head_object(Bucket='test', Key='asset')
            self.assertEqual(client.attempts, attempts)
            self.assertEqual(len(delays), attempts - 1)

    def test_exhausted_throttle_does_not_publish_completion_marker(self):
        class ThrottledBucket(Bucket):
            def head_object(self, **kwargs):
                raise ClientError({'Error': {'Code': '429'}}, 'HeadObject')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'public').mkdir()
            (root / 'public/a.bin').write_bytes(b'one')
            manifest = {'release': 'retry', 'files': {'a.bin': {
                'sha256': hashlib.sha256(b'one').hexdigest(), 'bytes': 3}}}
            (root / 'manifest.json').write_text(json.dumps(manifest))
            bucket = ThrottledBucket()
            with self.assertRaises(ClientError):
                publish(bucket, 'test', manifest, root, pause=lambda delay: None)
            self.assertNotIn('releases/retry/manifest.json', bucket.objects)
            self.assertNotIn('latest.json', bucket.objects)


if __name__ == '__main__':
    unittest.main()
