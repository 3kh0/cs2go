import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

export const root = fileURLToPath(new URL("./", import.meta.url));
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export async function files(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(path)));
    else if (entry.isFile()) found.push(path);
    else throw new Error(`Unsupported asset: ${path}`);
  }
  return found.sort();
}
export const releaseId = (entries) => sha256(JSON.stringify(entries));
export async function prepare(directory = root) {
  const publicDir = join(directory, "public");
  const cache = join(directory, ".cache");
  await mkdir(cache, { recursive: true });
  const entries = {};
  for (const file of await files(publicDir)) {
    const path = relative(publicDir, file).replaceAll("\\", "/");
    let bytes = await readFile(file);
    const raw = bytes;
    const input = sha256(bytes);
    let target = path;
    const entry = { sha256: input, bytes: bytes.length };
    if (path.endsWith(".glb")) {
      target += ".gz";
      const packed = join(cache, `${input}.glb.gz`);
      try {
        bytes = await readFile(packed);
        if (sha256(gunzipSync(bytes)) !== input) throw new Error("Invalid cached compression");
      } catch {
        bytes = gzipSync(raw, { level: 9 });
        await writeFile(packed, bytes);
      }
      // RFC 1952 OS byte is informational. Bun emits 19 on macOS and 3 on Linux;
      // normalize it so identical compressed content has one portable wire hash.
      if (bytes[9] !== 255) {
        bytes[9] = 255;
        await writeFile(packed, bytes);
      }
      entry.sha256 = sha256(bytes);
      entry.bytes = bytes.length;
      entry.decodedSha256 = input;
      entry.input = path;
      entry.inputSha256 = input;
    } else if (path.endsWith(".gz")) entry.decodedSha256 = sha256(gunzipSync(bytes));
    if (entries[target]) throw new Error(`Duplicate generated asset: ${target}`);
    entries[target] = entry;
  }
  // Filesystem enumeration order never affects the release identity.
  const ordered = Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, "en")),
  );
  return { version: 1, release: releaseId(ordered), files: ordered };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = await prepare();
  const bytes = JSON.stringify(manifest, null, 2) + "\n";
  const destination = join(root, "manifest.json");
  if (process.argv[2] === "verify") {
    const expectedBytes = await readFile(destination, "utf8");
    const expected = JSON.parse(expectedBytes);
    if (expectedBytes !== bytes) {
      const changed = Object.keys({ ...expected.files, ...manifest.files }).filter(
        (path) => JSON.stringify(expected.files[path]) !== JSON.stringify(manifest.files[path]),
      );
      console.error(
        "Mismatched assets:",
        changed
          .slice(0, 3)
          .map((path) => ({ path, expected: expected.files[path], actual: manifest.files[path] })),
      );
      throw new Error(
        "Asset manifest is stale. Run bun run assets:prepare and commit manifest.json.",
      );
    }
  } else await writeFile(destination, bytes);
  console.log(`${Object.keys(manifest.files).length} assets; release ${manifest.release}`);
}
