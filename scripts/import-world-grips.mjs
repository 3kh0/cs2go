// Retarget verified native gameplay grip poses over the existing locomotion rigs.
// bun scripts/import-world-grips.mjs path/to/native-gameplay-export [--refresh]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const origin = "https://cs2.cs2inspects.com/";
const cache = "artifacts/buy-poses";
const output = "packages/assets/public/models/animations/grips";
const nativeDirectory =
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "artifacts/gameplay-poses/native";
await mkdir(cache, { recursive: true });
await mkdir(output, { recursive: true });
let pinned = [];
try {
  pinned = JSON.parse(await readFile(`${output}/source.json`, "utf8")).inputs;
} catch {}
const existing = JSON.parse(
  await readFile("packages/assets/public/models/animations/agents/source.json", "utf8"),
).inputs;
const inputs = [];
async function download(path) {
  const file = `${cache}/${path.replaceAll("/", "_")}`;
  let bytes;
  try {
    bytes = await readFile(file);
  } catch {
    const response = await fetch(origin + path);
    if (!response.ok) throw new Error(`${path}: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(file, bytes);
  }
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const record =
    pinned.find((i) => i.url === origin + path) ?? existing.find((i) => i.url === origin + path);
  if (record && record.sha256 !== sha256 && !process.argv.includes("--refresh"))
    throw new Error(`Source changed: ${path}`);
  inputs.push({ url: origin + path, sha256, bytes: bytes.length });
  return bytes;
}
async function load(bytes) {
  const n = bytes.readUInt32LE(12),
    doc = JSON.parse(bytes.subarray(20, 20 + n));
  const bin = bytes.subarray(28 + n);
  for (const node of doc.nodes) {
    delete node.mesh;
    delete node.skin;
  }
  for (const key of ["meshes", "skins", "materials", "textures", "images"]) delete doc[key];
  let json = Buffer.from(JSON.stringify(doc));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const header = Buffer.alloc(20),
    tail = Buffer.alloc(8);
  [0x46546c67, 2, 28 + json.length + bin.length, json.length, 0x4e4f534a].forEach((v, i) =>
    header.writeUInt32LE(v, i * 4),
  );
  tail.writeUInt32LE(bin.length);
  tail.writeUInt32LE(0x004e4942, 4);
  const raw = Buffer.concat([header, json, tail, bin]);
  return new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength), "");
}
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
    [3, "ring"],
    [4, "pinky"],
  ])
    for (let i = 0; i < (num ? 3 : 2); i++)
      map[`${side}_Finger${num}${i || ""}`] = `finger_${finger}_${i}_${side}`;
}
const ref = await load(await download("data/agentanims/world/rifle/_default_rifle.glb"));
new T.AnimationMixer(ref.scene)
  .clipAction(ref.animations.find((c) => c.name === "idle_rifle"))
  .play()
  .getMixer()
  .update(0);
ref.scene.updateMatrixWorld(true);
const sourceReference = new Map();
ref.scene.traverse((node) =>
  sourceReference.set(node.name, {
    rotation: node.getWorldQuaternion(new T.Quaternion()),
    position: node.getWorldPosition(new T.Vector3()),
  }),
);
const targets = {};
for (const team of ["t", "ct"]) {
  const path = `packages/assets/public/models/agents/${team === "t" ? "ground-rebel-native" : "idf"}.glb`;
  const bytes = await readFile(path);
  inputs.push({ target: path, sha256: createHash("sha256").update(bytes).digest("hex") });
  const model = await load(bytes);
  new T.AnimationMixer(model.scene)
    .clipAction(model.animations.find((c) => c.name === "idle_rifle"))
    .play()
    .getMixer()
    .update(0);
  model.scene.updateMatrixWorld(true);
  const bindings = [];
  model.scene.traverse((node) => {
    const sourceName = team === "t" ? node.name : map[node.name.replace("ValveBipedBip01_", "")];
    const reference = sourceReference.get(sourceName);
    if (!reference || sourceName === "root_motion") return;
    bindings.push({
      node,
      sourceName,
      reference,
      rotation: node.getWorldQuaternion(new T.Quaternion()),
      position: node.position.clone(),
      scale: node.scale.clone(),
    });
  });
  targets[team] = {
    model,
    bindings,
    ratio:
      bindings.find((b) => b.sourceName === "pelvis").node.getWorldPosition(new T.Vector3()).y /
      sourceReference.get("pelvis").position.y,
  };
}
const manifestBytes = await readFile(`${nativeDirectory}/manifest.json`);
const records = JSON.parse(manifestBytes);
const tokens = [
  "ak",
  "m4a1s",
  "usp",
  "awp",
  null,
  null,
  null,
  "glock",
  "deagle",
  "m4a4",
  "nova",
  "mp9",
  "hkp",
  "p250",
  "fiveseven",
  "tec9",
  "cz75a",
  "revolver",
  "elite",
  "famas",
  "galilar",
  "aug",
  "sg556",
  "ssg08",
  "scar20",
  "g3sg1",
  "mac10",
  "mp7",
  "mp5sd",
  "ump45",
  "p90",
  "bizon",
  "xm1014",
  "mag7",
  "sawedoff",
  "m249",
  "negev",
];
const poses = { t: {}, ct: {} };
const nativeInputs = [];
async function sample(record) {
  const bytes = await readFile(`${nativeDirectory}/${record.file}`);
  if (createHash("sha256").update(bytes).digest("hex") !== record.sha256)
    throw new Error(`Native checksum mismatch: ${record.file}`);
  const data = JSON.parse(bytes);
  nativeInputs.push({ file: record.file, sha256: record.sha256, provenance: data.provenance });
  if (!data.frames.length) throw new Error(`Empty pose: ${record.file}`);
  return data;
}
function nativeScene(data, frame = data.frames[0]) {
  const scene = new T.Group();
  scene.quaternion.set(-0.5, -0.5, -0.5, 0.5);
  scene.scale.setScalar(0.0254);
  const nodes = data.bones.map((bone, index) => {
    const node = new T.Object3D();
    node.name = bone.name;
    node.position.fromArray(frame.localPQ[index][0]);
    node.quaternion.fromArray(frame.localPQ[index][1]).normalize();
    node.scale.setScalar(frame.localScale?.[index] ?? data.localScale[index]);
    return node;
  });
  data.bones.forEach((bone, index) =>
    (bone.parent < 0 ? scene : nodes[bone.parent]).add(nodes[index]),
  );
  scene.updateMatrixWorld(true);
  return scene;
}
const q = new T.Quaternion(),
  parent = new T.Quaternion(),
  p = new T.Vector3();
for (let index = 0; index < tokens.length; index++) {
  const token = tokens[index];
  if (!token) continue;
  const weaponBones = {};
  const draw = records.find((r) => r.file.endsWith(`/draw_${token}.json`));
  if (!draw) throw new Error(`Missing secondary reference: ${token}`);
  const bind = await sample(draw);
  const bindScene = nativeScene(bind, {
    localPQ: bind.bindLocalPQ,
    localScale: bind.bindLocalScale,
  });
  const secondaryStart = bind.bones.findIndex((b) => b.name === "weapon" && b.parent < 0);
  if (secondaryStart < 0) throw new Error(`Missing weapon skeleton: ${token}`);
  const inverse = bindScene.matrixWorld.clone().invert();
  for (let i = secondaryStart; i < bind.bones.length; i++) {
    const node = bindScene.getObjectByName(bind.bones[i].name);
    const matrix = inverse.clone().multiply(node.matrixWorld),
      scale = new T.Vector3();
    matrix.decompose(p, q, scale);
    weaponBones[node.name] = { p: p.toArray(), q: q.toArray(), s: scale.x };
  }
  for (const stance of ["stand", "crouch"]) {
    const name = `idle_${stance === "crouch" ? "crouch_" : ""}${token}.vnmclip+non_additive`;
    const record = records.find((r) => r.file.endsWith(`/${name}.json`));
    if (!record) throw new Error(`Missing absolute grip: ${name}`);
    let data = await sample(record);
    // Native graph nodes269/270 intentionally both select standing M4A1-S deltas.
    if (index === 1 && stance === "crouch") {
      const base = await sample(
        records.find((r) => r.file === "poses/rifle/_default_rifle/idle_crouch_rifle.json"),
      );
      const layer = await sample(records.find((r) => r.file.endsWith("/idle_m4a1s.json")));
      data = structuredClone(base);
      const frame = data.frames[0],
        delta = layer.frames[0];
      frame.localPQ = frame.localPQ.map(([position, rotation], i) => [
        position.map((value, axis) => value + delta.localPQ[i][0][axis]),
        new T.Quaternion()
          .fromArray(rotation)
          .multiply(new T.Quaternion().fromArray(delta.localPQ[i][1]))
          .normalize()
          .toArray(),
      ]);
      frame.localScale = frame.localScale.map((scale, i) => scale + delta.localScale[i]);
    }
    const source = nativeScene(data);
    for (const team of ["t", "ct"]) {
      const { model, bindings, ratio } = targets[team];
      const bones = {};
      for (const b of bindings) {
        const from = source.getObjectByName(b.sourceName);
        if (!from) continue;
        b.node.position.copy(b.position);
        b.node.scale.copy(b.scale);
        b.node.parent.updateWorldMatrix(true, false);
        q.copy(from.getWorldQuaternion(q))
          .multiply(b.reference.rotation.clone().invert())
          .multiply(b.rotation);
        b.node.parent.getWorldQuaternion(parent).invert();
        b.node.quaternion.copy(parent.multiply(q));
        b.node.updateWorldMatrix(false, false);
        bones[b.node.name] = { p: b.node.position.toArray(), q: b.node.quaternion.toArray() };
      }
      model.scene.updateMatrixWorld(true);
      const hand = bindings.find((b) => b.sourceName === "hand_R").node;
      const sourceHand = source.getObjectByName("hand_R"),
        wpn = source.getObjectByName("wpn");
      const position = wpn
        .getWorldPosition(new T.Vector3())
        .sub(sourceHand.getWorldPosition(new T.Vector3()))
        .multiplyScalar(ratio)
        .add(hand.getWorldPosition(new T.Vector3()));
      const attachment = new T.Matrix4().compose(
        position,
        wpn.getWorldQuaternion(new T.Quaternion()),
        new T.Vector3(1, 1, 1),
      );
      attachment.premultiply(hand.matrixWorld.clone().invert());
      poses[team][index] ??= {};
      poses[team][index][stance] = {
        clip: name,
        bones,
        hand: hand.name,
        attachment: attachment.toArray(),
        weaponBones,
      };
    }
  }
}
await writeFile(`${output}/poses.json.gz`, gzipSync(JSON.stringify(poses), { level: 9 }));
await writeFile(
  `${output}/source.json`,
  JSON.stringify(
    {
      source:
        "Valve CS2 native gameplay idle grip components, extracted read-only from installed game",
      generator: "bun scripts/import-world-grips.mjs path/to/export-directory",
      inputs,
      installedSource: JSON.parse(
        await readFile(`${nativeDirectory}/package-provenance.json`, "utf8"),
      ),
      nativeManifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
      nativeInputs,
      count: Object.keys(poses.t).length,
      processing:
        "Absolute standing/crouching weapon idle samples retargeted to existing calibrated rigs; runtime converts upper-body tracks to additive deltas against matching locomotion stance. Native secondary skeleton reference pose retains weapon mesh binding. Native wpn attachment is calibrated relative to the target right hand. No hand-to-hand barrel guess.",
      limitations:
        "Static grip layer plus existing locomotion/recoil; this is not the full executable Source2 animation graph. IDF Source1 proportions/retargeting remain approximate. No new draw/reload animations are claimed.",
    },
    null,
    2,
  ) + "\n",
);
console.log("Imported", Object.keys(poses.t).length, "firearms, standing/crouching, both rigs");
