// Bake the existing local Ground Rebel movement clips onto a supplied Source 2 rig.
// Usage: bun scripts/retarget-agent-motion.mjs source.glb target.glb output.glb
import { readFile, writeFile } from "node:fs/promises";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const [sourcePath, targetPath, outputPath] = process.argv.slice(2);
function unpack(raw) {
  const n = raw.readUInt32LE(12);
  return { doc: JSON.parse(raw.subarray(20, 20 + n)), blob: raw.subarray(28 + n) };
}
function pack(doc, blob) {
  doc.buffers = [{ byteLength: blob.length }];
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  blob = Buffer.concat([blob, Buffer.alloc((4 - (blob.length % 4)) % 4)]);
  const head = Buffer.alloc(20),
    bin = Buffer.alloc(8);
  [0x46546c67, 2, 28 + json.length + blob.length, json.length, 0x4e4f534a].forEach((v, i) =>
    head.writeUInt32LE(v, i * 4),
  );
  bin.writeUInt32LE(blob.length);
  bin.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, json, bin, blob]);
}
async function skeleton(doc, blob) {
  const copy = structuredClone(doc);
  for (const node of copy.nodes) {
    delete node.mesh;
    delete node.skin;
  }
  delete copy.meshes;
  delete copy.skins;
  delete copy.materials;
  delete copy.textures;
  delete copy.images;
  const raw = pack(copy, blob);
  return new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), "");
}
const sourceData = unpack(await readFile(sourcePath)),
  targetData = unpack(await readFile(targetPath));
const source = await skeleton(sourceData.doc, sourceData.blob),
  target = await skeleton(targetData.doc, targetData.blob);
const { doc } = targetData;
let blob = targetData.blob;
doc.animations = [];
const bindings = [];
target.scene.traverse((node) => {
  const from = source.scene.getObjectByName(node.name),
    index = doc.nodes.findIndex((n) => n.name === node.name);
  if (from && index >= 0 && node.name !== "root_motion" && node.parent !== target.scene)
    bindings.push({ node, from, index });
});
const matrix = new T.Matrix4(),
  sourceWorld = new T.Matrix4();
// The imported rig stores inches under a 0.0254 root. Preserve that basis
// scale (including for unanimated helper bones), while copying meter positions.
const sourceUnits = new T.Vector3(0.0254, 0.0254, 0.0254);
function accessor(values, type) {
  const data = Float32Array.from(values),
    bytes = Buffer.from(data.buffer);
  blob = Buffer.concat([blob, Buffer.alloc((4 - (blob.length % 4)) % 4)]);
  const view = doc.bufferViews.length;
  doc.bufferViews.push({ buffer: 0, byteOffset: blob.length, byteLength: bytes.length });
  blob = Buffer.concat([blob, bytes]);
  const a = {
    bufferView: view,
    componentType: 5126,
    count: values.length / { SCALAR: 1, VEC3: 3, VEC4: 4 }[type],
    type,
  };
  if (type === "SCALAR") {
    a.min = [values[0]];
    a.max = [values.at(-1)];
  }
  doc.accessors.push(a);
  return doc.accessors.length - 1;
}
for (const clip of source.animations) {
  const mixer = new T.AnimationMixer(source.scene),
    action = mixer.clipAction(clip);
  action.setLoop(T.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  action.paused = true;
  const frames = Math.ceil(clip.duration * 30),
    times = [],
    tracks = bindings.map(() => ({ translation: [], rotation: [], scale: [] }));
  for (let f = 0; f <= frames; f++) {
    const time = (clip.duration * f) / frames;
    times.push(time);
    action.time = time;
    mixer.update(0);
    source.scene.updateMatrixWorld(true);
    target.scene.updateMatrixWorld(true);
    for (let i = 0; i < bindings.length; i++) {
      const { node, from } = bindings[i];
      node.parent.updateWorldMatrix(true, false);
      sourceWorld.copy(from.matrixWorld).scale(sourceUnits);
      matrix.copy(node.parent.matrixWorld).invert().multiply(sourceWorld);
      matrix.decompose(node.position, node.quaternion, node.scale);
      node.updateWorldMatrix(false, false);
      tracks[i].translation.push(...node.position);
      tracks[i].rotation.push(...node.quaternion);
      tracks[i].scale.push(...node.scale);
    }
  }
  const animation = { name: clip.name, samplers: [], channels: [] },
    input = accessor(times, "SCALAR");
  for (let i = 0; i < bindings.length; i++)
    for (const path of ["translation", "rotation", "scale"]) {
      const sampler = animation.samplers.length;
      animation.samplers.push({
        input,
        output: accessor(tracks[i][path], path === "rotation" ? "VEC4" : "VEC3"),
        interpolation: "LINEAR",
      });
      animation.channels.push({ sampler, target: { node: bindings[i].index, path } });
    }
  doc.animations.push(animation);
  mixer.stopAllAction();
  mixer.uncacheRoot(source.scene);
}
await writeFile(outputPath, pack(doc, blob));
console.log(
  `Retargeted ${doc.animations.length} clips onto ${bindings.length} joints: ${outputPath}`,
);
