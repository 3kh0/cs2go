// Repair pinned Source2Viewer 20.0 overlay units without touching texture bytes,
// mesh order, indices, or non-overlay geometry. Run only on the original export.
// Usage: bun scripts/repair-cs2-overlays.mjs input.glb.gz native-flags.json output.glb.gz
import fs from "node:fs";
import zlib from "node:zlib";
import crypto from "node:crypto";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const [input, manifestPath, output] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const inputBytes = fs.readFileSync(input);
const hash = crypto.createHash("sha256").update(inputBytes).digest("hex");
if (hash !== manifest.inputSha256) throw new Error("Expected the pinned, uncorrected map");
const bytes = zlib.gunzipSync(inputBytes);
const jsonLength = bytes.readUInt32LE(12);
const document = JSON.parse(bytes.subarray(20, 20 + jsonLength));
const binary = bytes.subarray(28 + jsonLength, 28 + jsonLength + document.buffers[0].byteLength);
const geometryDocument = structuredClone(document);
geometryDocument.images = [];
geometryDocument.textures = [];
geometryDocument.materials = [];
for (const mesh of geometryDocument.meshes)
  for (const primitive of mesh.primitives) delete primitive.material;
geometryDocument.buffers[0].uri = `data:application/octet-stream;base64,${binary.toString("base64")}`;
globalThis.ProgressEvent ??= class ProgressEvent {
  constructor(type, init) {
    this.type = type;
    Object.assign(this, init);
  }
};
const gltf = await new GLTFLoader()
  .setMeshoptDecoder(MeshoptDecoder)
  .parseAsync(JSON.stringify(geometryDocument), "");
gltf.scene.updateMatrixWorld(true);
const overlayNames = new Set(manifest.materials.map((entry) => entry.name));
for (const material of document.materials) {
  const native = manifest.materials.find((entry) => entry.name === material.name);
  if (native?.shader.endsWith("static_overlay.vfx") && native.flags.F_BLEND_MODE === 1)
    material.alphaMode = "BLEND";
}
const parts = [binary];
let byteLength = binary.byteLength;
const corrections = [];
gltf.scene.traverse((object) => {
  if (!object.isMesh) return;
  const association = gltf.parser.associations.get(object);
  const primitive = document.meshes[association.meshes].primitives[association.primitives];
  const material = document.materials[primitive.material];
  if (!overlayNames.has(material.name)) return;
  const position = object.geometry.attributes.position;
  const normal = object.geometry.attributes.normal;
  const values = new Float32Array(position.count * 3);
  const point = new T.Vector3(),
    direction = new T.Vector3();
  const inverse = object.matrixWorld.clone().invert();
  const normalMatrix = new T.Matrix3().getNormalMatrix(object.matrixWorld);
  const bounds = new T.Box3();
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
    direction.fromBufferAttribute(normal, i).applyMatrix3(normalMatrix).normalize();
    point.addScaledVector(
      direction,
      -(manifest.exportedOffsetMeters - manifest.correctedOffsetMeters),
    );
    point.applyMatrix4(inverse);
    bounds.expandByPoint(point);
    values.set(point.toArray(), i * 3);
  }
  const padding = Buffer.alloc((4 - (byteLength % 4)) % 4);
  parts.push(padding);
  byteLength += padding.byteLength;
  document.bufferViews.push({ buffer: 0, byteOffset: byteLength, byteLength: values.byteLength });
  document.accessors.push({
    bufferView: document.bufferViews.length - 1,
    componentType: 5126,
    count: position.count,
    type: "VEC3",
    min: bounds.min.toArray(),
    max: bounds.max.toArray(),
  });
  primitive.attributes.POSITION = document.accessors.length - 1;
  parts.push(Buffer.from(values.buffer));
  byteLength += values.byteLength;
  corrections.push({ material: material.name, vertices: position.count });
});
if (!corrections.length) throw new Error("No native overlay materials matched");
document.buffers[0].byteLength = byteLength;
let json = Buffer.from(JSON.stringify(document));
json = Buffer.concat([json, Buffer.alloc((4 - (json.byteLength % 4)) % 4, 0x20)]);
const data = Buffer.concat([...parts, Buffer.alloc((4 - (byteLength % 4)) % 4)]);
const header = Buffer.alloc(20),
  binHeader = Buffer.alloc(8);
header.write("glTF");
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.byteLength + data.byteLength, 8);
header.writeUInt32LE(json.byteLength, 12);
header.write("JSON", 16);
binHeader.writeUInt32LE(data.byteLength);
binHeader.write("BIN\0", 4);
fs.writeFileSync(
  output,
  zlib.gzipSync(Buffer.concat([header, json, binHeader, data]), { level: 9 }),
);
console.log(JSON.stringify({ corrections, outputBytes: fs.statSync(output).size }));
