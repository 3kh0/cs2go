import { test } from "vitest";
import { createServer } from "node:http";
import { once } from "node:events";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  gzipSync,
  gunzipSync,
  brotliCompressSync,
  brotliDecompressSync,
  constants,
} from "node:zlib";
import { prepare, releaseId, transportPath, sha256, BROTLI_QUALITY } from "./pipeline.mjs";
import { assetBase, startupHints } from "../../scripts/build-assets.mjs";

test("asset releases are deterministic, hash content, and cache lossless compression", async () => {
  const root = await mkdtemp(join(tmpdir(), "cs2go-assets-"));
  try {
    await mkdir(join(root, "public"));
    await writeFile(join(root, "public", "model.glb"), "model bytes");
    await writeFile(join(root, "public", "icon.svg"), "icon");
    const first = await prepare(root);
    assert.equal(first.release, releaseId(first.files));
    assert.ok(!first.files["model.glb"]);
    const model = first.files["model.glb.gz"];
    assert.equal((await readFile(join(root, ".cache", `${model.inputSha256}.glb.gz`)))[9], 255);
    assert.equal(
      gunzipSync(await readFile(join(root, ".cache", `${model.inputSha256}.glb.gz`))).toString(),
      "model bytes",
    );
    assert.deepEqual(await prepare(root), first);
    await writeFile(join(root, "public", "icon.svg"), "changed");
    const second = await prepare(root);
    assert.notEqual(second.release, first.release);
    assert.deepEqual(second.files["model.glb.gz"], model);
    // A corrupt cache must be regenerated, never published under a trusted hash.
    await writeFile(join(root, ".cache", `${model.inputSha256}.glb.gz`), "bad");
    assert.deepEqual(await prepare(root), second);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("CDN bases require HTTPS and pin the complete release", () => {
  assert.equal(
    assetBase("https://cdn.example/game/", "abc"),
    "https://cdn.example/game/releases/abc",
  );
  assert.throws(() => assetBase("http://cdn.example", "abc"));
  assert.throws(() => assetBase("https://user:secret@cdn.example", "abc"));
  assert.throws(() => assetBase("https://cdn.example?token=x", "abc"));
});

test("all asset formats are tried at Brotli quality 11 without changing logical bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "cs2go-brotli-"));
  try {
    await mkdir(join(root, "public"));
    const text = Buffer.from("deterministic repeated game asset data\n".repeat(1000));
    await writeFile(join(root, "public", "data.json"), text);
    await writeFile(join(root, "public", "texture.ktx2"), text);
    const gzipped = gzipSync(text);
    await writeFile(join(root, "public", "source.bin.gz"), gzipped);
    await writeFile(join(root, "public", "tiny.bin"), Buffer.from([1]));
    const manifest = await prepare(root);
    assert.equal(BROTLI_QUALITY, 11);
    for (const path of ["data.json", "texture.ktx2"]) {
      const entry = manifest.files[path];
      const encoded = await readFile(transportPath(root, entry.sha256));
      const expected = brotliCompressSync(text, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_SIZE_HINT]: text.length,
        },
      });
      assert.deepEqual(encoded, expected);
      assert.deepEqual(brotliDecompressSync(encoded), text);
      assert.equal(entry.sha256, sha256(text));
      assert.deepEqual(entry.transport, {
        encoding: "br",
        quality: 11,
        sha256: sha256(encoded),
        bytes: encoded.length,
      });
      assert.ok(entry.transport.bytes < entry.bytes);
    }
    const gzipEntry = manifest.files["source.bin.gz"];
    assert.equal(gzipEntry.sha256, sha256(gzipped));
    assert.equal(gzipEntry.decodedSha256, sha256(text));
    const gzipTransport = await readFile(transportPath(root, gzipEntry.sha256));
    assert.deepEqual(brotliDecompressSync(gzipTransport), gzipped);
    assert.deepEqual(gunzipSync(brotliDecompressSync(gzipTransport)), text);
    // Maximum-quality compression can grow tiny/already compressed inputs.
    assert.equal(manifest.files["tiny.bin"].transport, undefined);
    const entry = manifest.files["data.json"];
    await writeFile(transportPath(root, entry.sha256), "corrupt");
    assert.deepEqual(await prepare(root), manifest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("HTTP Brotli decoding preserves gzip payloads and browser integrity hashes", async () => {
  const logical = gzipSync(Buffer.from("Native game payload\n".repeat(1000)));
  const transport = brotliCompressSync(logical, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  });
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "br",
      "Content-Length": transport.length,
    });
    response.end(transport);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/asset.bin.gz`);
    assert.equal(response.headers.get("content-encoding"), "br");
    const decoded = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(decoded, logical);
    assert.equal(sha256(decoded), sha256(logical));
    assert.equal(gunzipSync(decoded).toString(), "Native game payload\n".repeat(1000));
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("verification reuses unchanged no-transport decisions but generation and changed content still test q11", async () => {
  const root = await mkdtemp(join(tmpdir(), "cs2go-verify-"));
  try {
    await mkdir(join(root, "public"));
    await writeFile(join(root, "public", "tiny.bin"), Buffer.from([1]));
    const original = await prepare(root);
    const entry = original.files["tiny.bin"];
    assert.equal(entry.transport, undefined);
    const cached = transportPath(root, entry.sha256);
    await rm(cached);
    assert.deepEqual(await prepare(root, original.files), original);
    await assert.rejects(readFile(cached), { code: "ENOENT" });
    // Verify still regenerates size/source fields, exposing stale metadata.
    const stale = { ...original.files, "tiny.bin": { ...entry, bytes: 999 } };
    assert.notDeepEqual((await prepare(root, stale)).files, stale);
    // Ordinary generation has no verification hint and must encode every input.
    assert.deepEqual(await prepare(root), original);
    assert.ok((await readFile(cached)).length > 0);
    await writeFile(join(root, "public", "tiny.bin"), "changed compressible data\n".repeat(1000));
    const changed = await prepare(root, original.files);
    assert.notEqual(changed.release, original.release);
    assert.equal(changed.files["tiny.bin"].transport.quality, 11);
    assert.ok((await readFile(transportPath(root, changed.files["tiny.bin"].sha256))).length > 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("startup hints warm the CDN and preload the exact CORS map URL only in production", () => {
  assert.deepEqual(startupHints(""), []);
  const base = assetBase("https://cdn.example/game", "abc");
  const [connection, map] = startupHints(base);
  assert.equal(connection.attrs.href, "https://cdn.example");
  assert.equal(connection.attrs.rel, "preconnect");
  assert.equal(map.attrs.href, `${base}/models/maps/dust2.glb.gz`);
  assert.equal(map.attrs.rel, "preload");
  assert.equal(map.attrs.as, "fetch");
  assert.equal(map.attrs.crossorigin, "anonymous");
  assert.equal(map.attrs.fetchpriority, "high");
});
