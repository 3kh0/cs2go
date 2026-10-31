// Geometry-only Source2Viewer export retains native per-corner lightmap UVs.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { createHash } from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
globalThis.ProgressEvent = class {
  constructor(type, options) {
    Object.assign(this, options);
    this.type = type;
  }
};
const input = process.argv[2] ?? "artifacts/map-geometry/native.gltf";
const output = process.argv[3] ?? "artifacts/parity-lighting";
const mapPath = process.argv[4] ?? "packages/assets/public/models/maps/dust2.glb.gz";
const json = JSON.parse(fs.readFileSync(input));
const hashes = {};
const hash = (file) =>
  (hashes[file] = createHash("sha256").update(fs.readFileSync(file)).digest("hex"));
hash(input);
hash(mapPath);
for (const buffer of json.buffers) {
  const file = path.join(path.dirname(input), buffer.uri);
  hash(file);
  buffer.uri = "data:application/octet-stream;base64," + fs.readFileSync(file).toString("base64");
}
const runtime = zlib.gunzipSync(fs.readFileSync(mapPath));
const runtimeJson = JSON.parse(runtime.subarray(20, 20 + runtime.readUInt32LE(12)));
const names = [...new Set(runtimeJson.materials.map((m) => m.name))].sort(
  (a, b) => b.length - a.length,
);
const scene = (await new GLTFLoader().parseAsync(JSON.stringify(json), "")).scene;
scene.rotation.y = Math.PI / 2;
scene.updateMatrixWorld(true);
const vertices = [],
  indices = [],
  layouts = [];
let offset = 0,
  indexOffset = 0;
scene.traverse((object) => {
  if (!object.isMesh || !object.geometry.attributes.uv1) return;
  const name = names.find((n) => object.name.includes("_agg_merge_" + n + "_"));
  if (!name) return;
  const p = object.geometry.attributes.position,
    uv = object.geometry.attributes.uv1;
  const ix = object.geometry.index;
  const used = ix ? [...new Set(ix.array)] : Array.from({ length: p.count }, (_, i) => i);
  const remap = new Map(used.map((id, i) => [id, i]));
  const values = new Float32Array(used.length * 5),
    v = new T.Vector3();
  for (let i = 0; i < used.length; i++) {
    const id = used[i];
    v.fromBufferAttribute(p, id).applyMatrix4(object.matrixWorld);
    values.set([v.x, v.y, v.z, uv.getX(id), uv.getY(id)], i * 5);
  }
  const ids = new Uint32Array(ix ? ix.count : p.count);
  for (let i = 0; i < ids.length; i++) ids[i] = remap.get(ix ? ix.getX(i) : i) + offset;
  vertices.push(Buffer.from(values.buffer));
  indices.push(Buffer.from(ids.buffer));
  layouts.push({ material: name, offset, count: used.length, indexOffset, indexCount: ids.length });
  offset += used.length;
  indexOffset += ids.length;
});
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "native-lightmap-vertices.bin"), Buffer.concat(vertices));
fs.writeFileSync(path.join(output, "native-lightmap-indices.bin"), Buffer.concat(indices));
hash(path.join(output, "native-lightmap-vertices.bin"));
hash(path.join(output, "native-lightmap-indices.bin"));
fs.writeFileSync(
  path.join(output, "native-lightmap-layout.json"),
  JSON.stringify(
    {
      hashes,
      meshes: layouts,
      runtimeMaterials: runtimeJson.meshes.flatMap((m) =>
        m.primitives.map((p) => runtimeJson.materials[p.material]?.name),
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log({ meshes: layouts.length, vertices: offset, triangles: indexOffset / 3 });
