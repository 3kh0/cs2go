"""Exercise publishing without credentials, network, or a real bucket."""
import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from botocore.exceptions import ClientError
from sync import publish, seed_cache, RetryingClient


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
        self.objects[kwargs['Key']] = kwargs
        self.uploads.append(kwargs['Key'])

    def copy_object(self, Bucket, Key, CopySource):
        self.objects[Key] = dict(self.objects[CopySource['Key']])
        self.copies.append(Key)


class PublishTests(unittest.TestCase):
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
