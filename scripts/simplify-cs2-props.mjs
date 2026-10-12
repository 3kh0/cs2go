// Keep architecture untouched; reduce detailed static props before material batching.
import fs from "node:fs";
import path from "node:path";
import { MeshoptSimplifier } from "meshoptimizer";
await MeshoptSimplifier.ready;
const input = process.argv[2],
  output = process.argv[3];
const doc = JSON.parse(fs.readFileSync(input, "utf8"));
const buffers = doc.buffers.map((b) => fs.readFileSync(path.resolve(path.dirname(input), b.uri)));
function read(index) {
  const a = doc.accessors[index],
    v = doc.bufferViews[a.bufferView],
    b = buffers[v.buffer || 0];
  const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 },
    width = widths[a.type];
  const size = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[a.componentType];
  const result =
    a.componentType === 5126 ? new Float32Array(a.count * width) : new Uint32Array(a.count * width);
  for (let i = 0; i < a.count; i++)
    for (let j = 0; j < width; j++) {
      const at =
        (v.byteOffset || 0) + (a.byteOffset || 0) + i * (v.byteStride || size * width) + j * size;
      result[i * width + j] =
        a.componentType === 5126
          ? b.readFloatLE(at)
          : size === 4
            ? b.readUInt32LE(at)
            : size === 2
              ? b.readUInt16LE(at)
              : b.readUInt8(at);
    }
  return result;
}
let before = 0,
  after = 0,
  bytes = 0;
const parts = [];
for (const mesh of doc.meshes)
  for (const p of mesh.primitives) {
    const indices = read(p.indices);
    before += indices.length / 3;
    if (!mesh.name.includes("_agg_merge_") || indices.length < 900) {
      after += indices.length / 3;
      continue;
    }
    const positions = read(p.attributes.POSITION);
    const [result] = MeshoptSimplifier.simplify(
      indices,
      positions,
      3,
      Math.floor((indices.length * 0.3) / 3) * 3,
      0.005,
      ["LockBorder"],
    );
    after += result.length / 3;
    p.indices = doc.accessors.length;
    doc.accessors.push({
      bufferView: doc.bufferViews.length,
      componentType: 5125,
      count: result.length,
      type: "SCALAR",
    });
    doc.bufferViews.push({
      buffer: doc.buffers.length,
      byteOffset: bytes,
      byteLength: result.byteLength,
    });
    parts.push(Buffer.from(result.buffer, result.byteOffset, result.byteLength));
    bytes += result.byteLength;
  }
const bin = path.basename(output).replace(".gltf", ".bin");
fs.writeFileSync(path.join(path.dirname(output), bin), Buffer.concat(parts));
for (const b of doc.buffers)
  b.uri = path.relative(path.dirname(output), path.resolve(path.dirname(input), b.uri));
for (const image of doc.images || [])
  if (image.uri)
    image.uri = path.relative(path.dirname(output), path.resolve(path.dirname(input), image.uri));
doc.buffers.push({ uri: bin, byteLength: bytes });
fs.writeFileSync(output, JSON.stringify(doc));
console.log(
  JSON.stringify({
    trianglesBefore: before,
    trianglesAfter: after,
    propTarget: 0.3,
    maxRelativeError: 0.005,
  }),
);
