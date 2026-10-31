import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync, gunzipSync, brotliCompress, brotliDecompressSync, constants } from "node:zlib";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

export const BROTLI_QUALITY = 11;
const compressBrotli = promisify(brotliCompress);
export const transportPath = (directory, hash) =>
  join(directory, ".cache", `${hash}.q${BROTLI_QUALITY}.br`);

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
export async function prepare(directory = root, expectedEntries) {
  const publicDir = join(directory, "public");
  const cache = join(directory, ".cache");
  await mkdir(cache, { recursive: true });
  const entries = {};
  let writeId = 0;
  const compressions = new Map();
  const processFile = async (file) => {
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
    // Verification need not re-prove that unchanged bytes did not benefit from
    // Brotli. Generation always tests every candidate; logical/source metadata
    // still regenerates here and the CLI compares the complete manifest below.
    const expected = expectedEntries?.[target];
    if (!expected || expected.transport || expected.sha256 !== entry.sha256) {
      // HTTP transport compression is independent of the file format. A .gz
      // response still decodes to the exact gzip bytes expected by game loaders.
      let work = compressions.get(entry.sha256);
      if (!work) {
        work = (async () => {
          const packed = transportPath(directory, entry.sha256);
          try {
            const encoded = await readFile(packed);
            if (sha256(brotliDecompressSync(encoded)) !== entry.sha256)
              throw new Error("Invalid cached Brotli compression");
            return encoded;
          } catch {
            const encoded = await compressBrotli(bytes, {
              params: {
                [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
                [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
              },
            });
            const temporary = `${packed}.tmp-${process.pid}-${writeId++}`;
            await writeFile(temporary, encoded);
            await rename(temporary, packed);
            return encoded;
          }
        })();
        compressions.set(entry.sha256, work);
      }
      const encoded = await work;
      compressions.delete(entry.sha256);
      // Already compressed media occasionally grows; never increase wire size.
      // Every candidate is tested at quality 11, including gzip and KTX2 payloads.
      if (encoded.length < bytes.length)
        entry.transport = {
          encoding: "br",
          quality: BROTLI_QUALITY,
          sha256: sha256(encoded),
          bytes: encoded.length,
        };
    }
    if (entries[target]) throw new Error(`Duplicate generated asset: ${target}`);
    entries[target] = entry;
    if (
      process.argv[1] === fileURLToPath(import.meta.url) &&
      Object.keys(entries).length % 250 === 0
    )
      console.log(
        `${expectedEntries ? "Verified" : "Compressed"} ${Object.keys(entries).length} assets (Brotli quality ${BROTLI_QUALITY})`,
      );
  };
  const inputs = await files(publicDir);
  let cursor = 0;
  // Bound CPU and peak buffers while preserving a deterministic sorted manifest.
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (cursor < inputs.length) await processFile(inputs[cursor++]);
    }),
  );
  // Filesystem enumeration order never affects the release identity.
  const ordered = Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, "en")),
  );
  return { version: 1, release: releaseId(ordered), files: ordered };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const destination = join(root, "manifest.json");
  const verifying = process.argv[2] === "verify";
  const expectedBytes = verifying ? await readFile(destination, "utf8") : undefined;
  const expected = expectedBytes ? JSON.parse(expectedBytes) : undefined;
  const manifest = await prepare(root, expected?.files);
  const bytes = JSON.stringify(manifest, null, 2) + "\n";
  if (verifying) {
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
  } else {
    const temporary = `${destination}.tmp-${process.pid}`;
    await writeFile(temporary, bytes);
    await rename(temporary, destination);
  }
  console.log(`${Object.keys(manifest.files).length} assets; release ${manifest.release}`);
}
