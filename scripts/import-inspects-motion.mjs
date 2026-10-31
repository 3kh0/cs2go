// Import native locomotion and action clips from the CS2 Inspects manifest.
// bun scripts/import-inspects-motion.mjs
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const origin = "https://cs2.cs2inspects.com/";
const cache = "artifacts/cs2inspects";
const output = "packages/assets/public/models/animations/agents";
await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });
const inputs = [];
let pinned = [];
try {
  pinned = JSON.parse(await readFile(`${output}/source.json`, "utf8")).inputs;
} catch {}

async function download(path) {
  const response = await fetch(origin + path);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const expected = pinned.find((input) => input.url === origin + path)?.sha256;
  if (expected && expected !== sha256 && !process.argv.includes("--refresh"))
    throw new Error(`Upstream changed: ${path}. Review before regenerating with --refresh.`);
  inputs.push({ url: origin + path, sha256, bytes: bytes.length });
  await writeFile(`${cache}/${path.split("/").at(-1)}`, bytes);
  return bytes;
}
function pack(doc, bin) {
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const header = Buffer.alloc(20),
    bh = Buffer.alloc(8);
  [0x46546c67, 2, 28 + json.length + bin.length, json.length, 0x4e4f534a].forEach((v, i) =>
    header.writeUInt32LE(v, i * 4),
  );
  bh.writeUInt32LE(bin.length);
  bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, json, bh, bin]);
}
async function load(bytes) {
  const n = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + n)),
    bin = bytes.subarray(28 + n);
  for (const node of doc.nodes) {
    delete node.mesh;
    delete node.skin;
  }
  for (const key of ["meshes", "skins", "materials", "textures", "images"]) delete doc[key];
  const raw = pack(doc, bin);
  return new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), "");
}
const manifest = JSON.parse(await download("data/agentanims/manifest.json"));
const packs = [
  "world/rifle/_default_rifle",
  "world/pistol/_default_pistol",
  "world/rifle/rifle_ak",
  "world/rifle/rifle_m4a1_silencer",
  "world/rifle/rifle_awp",
  "world/pistol/pistol_usp",
  "world/equipment/c4",
];
const sources = [];
for (const name of packs) sources.push(await load(await download(manifest.packs[name].url)));
const source = sources[0];
const clips = sources
  .flatMap((s) => s.animations)
  .filter((c) =>
    /^(idle_(?:crouch_)?(?:rifle|pistol)|(?:walk|run|crouch)_[nsew]_(?:rifle|pistol)|jump_n_(?:rifle|pistol)|inair_stand_(?:rifle|pistol)|draw_(?:ak|m4a1s|usp|awp)|shoot_(?:ak|m4a1s|usp|awp)\.vnmclip\+non_additive|planting)$/.test(
      c.name,
    ),
  );
const map = {
  Pelvis: "pelvis",
  Spine: "spine_0",
  Spine1: "spine_1",
  Spine2: "spine_2",
  Spine4: "spine_3",
  Neck1: "neck_0",
  Head1: "head_0",
};
for (const side of ["L", "R"]) {
  for (const [a, b] of [
    ["Thigh", "leg_upper"],
    ["Calf", "leg_lower"],
    ["Foot", "ankle"],
    ["Toe0", "ball"],
    ["Clavicle", "clavicle"],
    ["UpperArm", "arm_upper"],
    ["Forearm", "arm_lower"],
    ["Hand", "hand"],
  ])
    map[`${side}_${a}`] = `${b}_${side}`;
  for (const [num, finger] of [
    [0, "thumb"],
    [1, "index"],
    [2, "middle"],
  ])
    for (let i = 0; i < (num ? 3 : 2); i++)
      map[`${side}_Finger${num}${i || ""}`] = `finger_${finger}_${i}_${side}`;
}
const sourceMixer = new T.AnimationMixer(source.scene);
const ref = sourceMixer.clipAction(source.animations.find((c) => c.name === "idle_rifle"));
ref.play();
sourceMixer.update(0);
source.scene.updateMatrixWorld(true);
const sourceReference = new Map();
source.scene.traverse((n) =>
  sourceReference.set(n.name, {
    position: n.getWorldPosition(new T.Vector3()),
    rotation: n.getWorldQuaternion(new T.Quaternion()),
  }),
);
sourceMixer.stopAllAction();
for (const team of ["t", "ct"]) {
  const path = `packages/assets/public/models/agents/${team === "t" ? "ground-rebel-native" : "idf"}.glb`;
  const bytes = await readFile(path);
  inputs.push({ target: path, sha256: createHash("sha256").update(bytes).digest("hex") });
  const target = await load(bytes);
  const mix = new T.AnimationMixer(target.scene);
  mix.clipAction(target.animations.find((c) => c.name === "idle_rifle")).play();
  mix.update(0);
  target.scene.updateMatrixWorld(true);
  const bindings = [];
  target.scene.traverse((node) => {
    const name = team === "t" ? node.name : map[node.name.replace("ValveBipedBip01_", "")];
    const from = source.scene.getObjectByName(name ?? "");
    if (!from || name === "root_motion") return;
    bindings.push({
      node,
      from,
      name,
      reference: sourceReference.get(name),
      rotation: node.getWorldQuaternion(new T.Quaternion()),
      position: node.getWorldPosition(new T.Vector3()),
      local: node.position.clone(),
      scale: node.scale.clone(),
    });
  });
  mix.stopAllAction();
  const pelvis = bindings.find((b) => b.name === "pelvis"),
    ratio = pelvis.position.y / pelvis.reference.position.y;
  const q = new T.Quaternion(),
    parent = new T.Quaternion(),
    pos = new T.Vector3();
  const baked = [];
  for (const clip of clips) {
    const action = sourceMixer.clipAction(clip);
    action.reset().setLoop(T.LoopOnce, 1).play();
    action.clampWhenFinished = true;
    action.paused = true;
    const count = Math.max(1, Math.ceil(clip.duration * 30));
    const times = [];
    const data = bindings.map(() => ({ q: [], p: [] }));
    for (let f = 0; f <= count; f++) {
      const time = (f / count) * clip.duration;
      times.push(time);
      action.time = time;
      sourceMixer.update(0);
      source.scene.updateMatrixWorld(true);
      for (let i = 0; i < bindings.length; i++) {
        const b = bindings[i];
        b.node.position.copy(b.local);
        b.node.scale.copy(b.scale);
        b.node.parent.updateWorldMatrix(true, false);
        q.copy(b.from.getWorldQuaternion(q))
          .multiply(b.reference.rotation.clone().invert())
          .multiply(b.rotation);
        b.node.parent.getWorldQuaternion(parent).invert();
        b.node.quaternion.copy(parent.multiply(q));
        if (b.name === "pelvis") {
          b.from
            .getWorldPosition(pos)
            .sub(b.reference.position)
            .multiplyScalar(ratio)
            .add(b.position);
          b.node.position.copy(b.node.parent.worldToLocal(pos));
        }
        b.node.updateWorldMatrix(false, false);
        data[i].q.push(...b.node.quaternion);
        data[i].p.push(...b.node.position);
      }
    }
    const tracks = bindings.flatMap((b, i) => [
      new T.QuaternionKeyframeTrack(
        `${b.node.name}.quaternion`,
        times,
        data[i].q.map((v) => Math.round(v * 1e5) / 1e5),
      ),
      new T.VectorKeyframeTrack(
        `${b.node.name}.position`,
        times,
        data[i].p.map((v) => Math.round(v * 1e5) / 1e5),
      ),
    ]);
    baked.push(
      T.AnimationClip.toJSON(new T.AnimationClip(clip.name, clip.duration, tracks).optimize()),
    );
    sourceMixer.stopAllAction();
  }
  await writeFile(`${output}/${team}.json.gz`, gzipSync(JSON.stringify(baked), { level: 9 }));
  console.log(team, baked.length, "clips", bindings.length, "bones");
}
await writeFile(
  `${output}/source.json`,
  JSON.stringify(
    {
      source: "Valve Source 2 animations served by CS2 Inspects",
      reference: "https://cs2inspects.com/3d-viewer",
      generator: "bun scripts/import-inspects-motion.mjs",
      inputs,
      clips: clips.map((c) => c.name),
      processing:
        "30 Hz, 5-decimal quantized world-space rotation retargeting calibrated to each existing agent rifle stance; target bone lengths retained; pelvis displacement transferred; root motion stripped by upstream. Gzipped animation-only JSON.",
      limitations:
        "IDF Source 1 rig retargeting is approximate. World weapon meshes remain rigid. First-person gun/knife clips retain their existing native sources.",
    },
    null,
    2,
  ) + "\n",
);
