globalThis.ProgressEvent = class ProgressEvent {
  constructor(type, init) {
    Object.assign(this, init);
    this.type = type;
  }
};
import fs from "node:fs";
import { createHash } from "node:crypto";
import zlib from "node:zlib";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const mapPath = process.argv[2] ?? "packages/assets/public/models/maps/dust2.glb.gz";
const b = zlib.gunzipSync(fs.readFileSync(mapPath));
const jl = b.readUInt32LE(12),
  j = JSON.parse(b.subarray(20, 20 + jl));
const bin = b.subarray(28 + jl);
j.images = [];
j.textures = [];
j.materials = [];
for (const m of j.meshes) for (const p of m.primitives) delete p.material;
j.buffers[0].uri = "data:application/octet-stream;base64," + bin.toString("base64");
const gltf = await new GLTFLoader()
  .setMeshoptDecoder(MeshoptDecoder)
  .parseAsync(JSON.stringify(j), "");
gltf.scene.updateMatrixWorld(true);
const parts = [],
  meshes = [],
  indices = [];
let bytes = 0,
  indexOffset = 0;
gltf.scene.traverse((o) => {
  if (!o.isMesh) return;
  const p = o.geometry.attributes.position,
    n = o.geometry.attributes.normal;
  const a = new Float32Array(p.count * 6),
    v = new T.Vector3(),
    nm = new T.Matrix3().getNormalMatrix(o.matrixWorld);
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
    a.set(v.toArray(), i * 6);
    v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
    a.set(v.toArray(), i * 6 + 3);
  }
  const idx = o.geometry.index;
  const ix = new Uint32Array(idx ? idx.count : p.count);
  for (let k = 0; k < ix.length; k++) ix[k] = (idx ? idx.getX(k) : k) + bytes / 24;
  indices.push(Buffer.from(ix.buffer));
  parts.push(Buffer.from(a.buffer));
  meshes.push({
    count: p.count,
    name: o.name,
    offset: bytes / 24,
    indexOffset,
    indexCount: ix.length,
  });
  indexOffset += ix.length;
  bytes += a.byteLength;
});
fs.writeFileSync("artifacts/parity-lighting/runtime-vertices.bin", Buffer.concat(parts));
fs.writeFileSync("artifacts/parity-lighting/runtime-meshes.json", JSON.stringify(meshes));
console.log(meshes.length, bytes / 24);

fs.writeFileSync("artifacts/parity-lighting/runtime-indices.bin", Buffer.concat(indices));

fs.writeFileSync(
  "artifacts/parity-lighting/runtime-geometry.sha256",
  createHash("sha256").update(fs.readFileSync(mapPath)).digest("hex"),
);
