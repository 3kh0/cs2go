import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile, mkdir, rename, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
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
export async function readManifest(directory = root) {
  try {
    const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
    if (manifest.version !== 2 || manifest.release !== releaseId(manifest.files))
      throw new Error("Invalid asset manifest");
    return manifest;
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}
// Include media type and HTTP encoding in the identity: equal bytes can need
// different response headers. Filenames and releases do not affect reuse.
export const objectKey = (path, entry) => {
  const wire = entry.transport ?? entry;
  return `objects/${wire.sha256}${extname(path)}${wire.encoding ? `.${wire.encoding}` : ""}`;
};
const RACY_NS = 2_000_000_000n;
// Like Git's index, reuse content identities only while size, mtime, ctime and
// inode are unchanged. Userland cannot set ctime, so any rewrite invalidates an
// entry; files changed within the last two seconds are always rehashed.
async function identities(directory, reuse) {
  const path = join(directory, ".cache", "identities.json");
  let saved = {};
  if (reuse)
    try {
      const memo = JSON.parse(await readFile(path, "utf8"));
      if (memo.version === 1) saved = memo.entries;
    } catch {}
  const next = {};
  const now = BigInt(Date.now()) * 1_000_000n;
  return {
    async lookup(file) {
      const name = relative(directory, file).replaceAll("\\", "/");
      let info;
      try {
        info = await stat(file, { bigint: true });
      } catch {
        return { remember: (value) => value };
      }
      const key = `${info.size}:${info.mtimeNs}:${info.ctimeNs}:${info.ino}`;
      const stable = now - info.ctimeNs > RACY_NS;
      return {
        value: stable && saved[name]?.key === key ? saved[name].value : undefined,
        remember(value) {
          if (stable) next[name] = { key, value };
          return value;
        },
      };
    },
    // `keep` retains unvisited entries for passes that only read some files.
    async save(keep = false) {
      const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
      const entries = keep ? { ...saved, ...next } : next;
      await writeFile(temporary, JSON.stringify({ version: 1, entries }));
      await rename(temporary, path);
    },
  };
}
export async function prepare(
  directory = root,
  expectedEntries,
  onProgress,
  reuseTransport = false,
  { reuseIdentities = true } = {},
) {
  const publicDir = join(directory, "public");
  const cache = join(directory, ".cache");
  await mkdir(cache, { recursive: true });
  const memo = await identities(directory, reuseIdentities);
  const entries = {};
  let writeId = 0;
  let processed = 0;
  const compressions = new Map();
  const processFile = async (file) => {
    const path = relative(publicDir, file).replaceAll("\\", "/");
    const source = await memo.lookup(file);
    const known = source.value;
    let raw;
    const readRaw = async () => (raw ??= await readFile(file));
    const input = known?.sha256 ?? sha256(await readRaw());
    const size = known?.bytes ?? raw.length;
    let target = path;
    let readWire = readRaw;
    const entry = { sha256: input, bytes: size };
    if (path.endsWith(".glb")) {
      target += ".gz";
      const packed = join(cache, `${input}.glb.gz`);
      const cached = await memo.lookup(packed);
      let gz;
      readWire = async () => (gz ??= await readFile(packed));
      let wire = cached.value?.decodedSha256 === input ? cached.value : undefined;
      if (!wire) {
        try {
          gz = await readFile(packed);
          if (sha256(gunzipSync(gz)) !== input) throw new Error("Invalid cached compression");
        } catch {
          gz = gzipSync(await readRaw(), { level: 9 });
          await writeFile(packed, gz);
        }
        // RFC 1952 OS byte is informational. Bun emits 19 on macOS and 3 on Linux;
        // normalize it so identical compressed content has one portable wire hash.
        if (gz[9] !== 255) {
          gz[9] = 255;
          await writeFile(packed, gz);
        }
        // A rewritten file gets a new ctime, so a stale key here never matches.
        wire = cached.remember({ sha256: sha256(gz), bytes: gz.length, decodedSha256: input });
      }
      entry.sha256 = wire.sha256;
      entry.bytes = wire.bytes;
      entry.decodedSha256 = input;
      entry.input = path;
      entry.inputSha256 = input;
    } else if (path.endsWith(".gz"))
      entry.decodedSha256 = known?.decodedSha256 ?? sha256(gunzipSync(await readRaw()));
    source.remember(
      entry.decodedSha256 && !entry.input
        ? { sha256: input, bytes: size, decodedSha256: entry.decodedSha256 }
        : { sha256: input, bytes: size },
    );
    // Reuse a prior no-benefit compression decision only for identical bytes.
    // Changed/new files are compressed; logical/source metadata still regenerates.
    const expected = expectedEntries?.[target];
    // Music loops seek by codec byte offsets. HTTP content encoding would make
    // Range requests address a different representation (and often force a full
    // download), so kit MP3/FLAC/Opus objects must retain their original wire bytes.
    const streamedMusic = path.startsWith("audio/music-kits/") && /\.(mp3|flac|opus)$/.test(path);
    // Local builds and manifest generation need identities, not encoded copies
    // of unchanged assets. Publishing still materializes and verifies wire bytes.
    const reusable =
      reuseTransport &&
      !streamedMusic &&
      expected?.sha256 === entry.sha256 &&
      expected.bytes === entry.bytes &&
      expected.transport?.encoding === "br" &&
      expected.transport.quality === BROTLI_QUALITY;
    if (reusable) entry.transport = { ...expected.transport };
    else if (
      !streamedMusic &&
      (!expected || expected.transport || expected.sha256 !== entry.sha256)
    ) {
      // HTTP transport compression is independent of the file format. A .gz
      // response still decodes to the exact gzip bytes expected by game loaders.
      let work = compressions.get(entry.sha256);
      if (!work) {
        work = (async () => {
          const packed = transportPath(directory, entry.sha256);
          const cached = await memo.lookup(packed);
          if (cached.value?.decodedSha256 === entry.sha256) return cached.value;
          const identity = (encoded) => ({
            sha256: sha256(encoded),
            bytes: encoded.length,
            decodedSha256: entry.sha256,
          });
          try {
            const encoded = await readFile(packed);
            if (sha256(brotliDecompressSync(encoded)) !== entry.sha256)
              throw new Error("Invalid cached Brotli compression");
            return cached.remember(identity(encoded));
          } catch {
            const bytes = await readWire();
            const encoded = await compressBrotli(bytes, {
              params: {
                [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY,
                [constants.BROTLI_PARAM_SIZE_HINT]: bytes.length,
              },
            });
            const temporary = `${packed}.tmp-${process.pid}-${writeId++}`;
            await writeFile(temporary, encoded);
            await rename(temporary, packed);
            return identity(encoded);
          }
        })();
        compressions.set(entry.sha256, work);
      }
      const encoded = await work;
      compressions.delete(entry.sha256);
      // Already compressed media occasionally grows; never increase wire size.
      // Non-streaming candidates use quality 11, including gzip and KTX2 payloads.
      if (encoded.bytes < entry.bytes)
        entry.transport = {
          encoding: "br",
          quality: BROTLI_QUALITY,
          sha256: encoded.sha256,
          bytes: encoded.bytes,
        };
    }
    entry.object = objectKey(target, entry);
    if (entries[target]) throw new Error(`Duplicate generated asset: ${target}`);
    entries[target] = entry;
    if (process.argv[1] === fileURLToPath(import.meta.url) && ++processed % 250 === 0)
      console.log(
        `${expectedEntries ? "Verified" : "Compressed"} ${processed} assets (Brotli quality ${BROTLI_QUALITY})`,
      );
  };
  const inputs = await files(publicDir);
  let cursor = 0,
    completed = 0;
  onProgress?.({ completed, total: inputs.length });
  // Bound CPU and peak buffers while preserving a deterministic sorted manifest.
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (cursor < inputs.length) {
        const file = inputs[cursor++];
        await processFile(file);
        onProgress?.({ completed: ++completed, total: inputs.length });
      }
    }),
  );
  await memo.save();
  // Filesystem enumeration order never affects the release identity.
  const ordered = Object.fromEntries(
    Object.entries(entries).sort(([a], [b]) => a.localeCompare(b, "en")),
  );
  return { version: 2, release: releaseId(ordered), files: ordered };
}
const hashBlob = (directory, path) =>
  new Promise((resolve, reject) => {
    const git = spawn("git", ["cat-file", "blob", `HEAD:./${path}`], {
      cwd: directory,
      stdio: ["ignore", "pipe", "inherit"],
    });
    const hash = createHash("sha256");
    let bytes = 0;
    git.stdout.on("data", (chunk) => {
      hash.update(chunk);
      bytes += chunk.length;
    });
    git.on("error", reject);
    git.on("close", (code) =>
      code === 0
        ? resolve({ sha256: hash.digest("hex"), bytes })
        : reject(new Error(`git cat-file failed for ${path}`)),
    );
  });
// Compare source paths and bytes with the manifest without compressing
// anything, so a stale manifest fails in seconds rather than on the server.
// `verify` remains the full wire-byte check. With `base`, read Git's HEAD tree:
// every path is checked, and contents changed since `base` are hashed from
// blobs, which suits a blobless CI checkout.
export async function staleSources(manifest, { directory = root, base } = {}) {
  const expected = new Map(
    Object.entries(manifest.files).map(([path, entry]) => [entry.input ?? path, entry]),
  );
  const publicDir = join(directory, "public");
  const git = (...args) =>
    execFileSync("git", args, { cwd: directory, encoding: "utf8", maxBuffer: 1 << 30 })
      .split("\0")
      .filter((path) => path && !path.split("/").some((part) => part.startsWith(".")));
  const inputs = base
    ? git("ls-tree", "-r", "-z", "--name-only", "HEAD", "--", "public")
    : (await files(publicDir)).map((file) => relative(directory, file).replaceAll("\\", "/"));
  const changed = base
    ? new Set(
        git(
          "diff",
          "-z",
          "--name-only",
          "--relative",
          "--no-renames",
          base,
          "HEAD",
          "--",
          "public",
        ),
      )
    : undefined;
  const memo = base ? undefined : await identities(directory, true);
  const problems = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (cursor < inputs.length) {
        const input = inputs[cursor++];
        const path = input.slice("public/".length);
        const entry = expected.get(path);
        expected.delete(path);
        if (!entry) {
          problems.push(`unlisted: ${path}`);
          continue;
        }
        let actual;
        if (changed) {
          if (!changed.has(input)) continue;
          actual = await hashBlob(directory, input);
        } else {
          const source = await memo.lookup(join(directory, input));
          if (source.value) actual = source.value;
          else {
            const raw = await readFile(join(directory, input));
            actual = { sha256: sha256(raw), bytes: raw.length };
          }
          source.remember(actual);
        }
        // A .glb entry describes its gzip wire file; only its input hash is raw.
        if (
          actual.sha256 !== (entry.inputSha256 ?? entry.sha256) ||
          (!entry.input && actual.bytes !== entry.bytes)
        )
          problems.push(`changed: ${path}`);
      }
    }),
  );
  await memo?.save(true);
  for (const path of expected.keys()) problems.push(`missing: ${path}`);
  return problems.sort();
}
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] === "check") {
  const manifest = await readManifest();
  if (!manifest) throw new Error("Missing asset manifest");
  const since = process.argv.indexOf("--since");
  const problems = await staleSources(manifest, {
    base: since > 0 ? process.argv[since + 1] : undefined,
  });
  if (problems.length) {
    console.error(problems.slice(0, 20).join("\n"));
    console.error(
      `Asset manifest is stale for ${problems.length} source file(s). Run bun run assets:prepare and commit packages/assets/manifest.json.`,
    );
    process.exit(1);
  }
  console.log(`Asset manifest matches ${Object.keys(manifest.files).length} source files`);
}
if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv[2] !== "check") {
  const destination = join(root, "manifest.json");
  const verifying = process.argv[2] === "verify";
  const expected = await readManifest();
  const expectedBytes = verifying ? await readFile(destination, "utf8") : undefined;
  if (verifying && expected) {
    // Fail before hashing when files were added or removed without regenerating.
    const publicDir = join(root, "public");
    const present = new Set(
      (await files(publicDir)).map((file) => {
        const path = relative(publicDir, file).replaceAll("\\", "/");
        return path.endsWith(".glb") ? `${path}.gz` : path;
      }),
    );
    const missing = Object.keys(expected.files).filter((path) => !present.delete(path));
    if (missing.length || present.size)
      throw new Error(
        `Asset manifest is stale (missing: ${JSON.stringify(missing.slice(0, 5))}, unlisted: ${JSON.stringify([...present].slice(0, 5))}). Run bun run assets:prepare and commit manifest.json.`,
      );
  }
  // --full ignores remembered identities and rehashes every source and cache file.
  const manifest = await prepare(root, expected?.files, undefined, !verifying, {
    reuseIdentities: !process.argv.includes("--full"),
  });
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
