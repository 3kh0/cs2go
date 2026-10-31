import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { prepare, releaseId } from "./pipeline.mjs";
import { assetBase } from "../../scripts/build-assets.mjs";

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
