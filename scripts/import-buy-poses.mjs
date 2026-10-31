// Retarget native Source2Viewer buy-menu samples from scripts/extract-buy-poses.py.
// bun scripts/import-buy-poses.mjs path/to/export-directory [--refresh]
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
const origin = "https://cs2.cs2inspects.com/";
const cache = "artifacts/buy-poses";
const home = process.argv.includes("--home");
const output = `packages/assets/public/models/animations/${home ? "home" : "buy"}`;
const nativeDirectory =
  process.argv.slice(2).find((arg) => !arg.startsWith("--")) ?? "artifacts/buy-poses/windows";
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
const nativeInputs = JSON.parse(await readFile(`${nativeDirectory}/manifest.json`, "utf8"));
function nativeScene(data, frame = data.frames[0]) {
  const scene = new T.Group();
  // Same handedness/basis as the existing calibrated agent-animation imports.
  scene.quaternion.set(-0.5, -0.5, -0.5, 0.5);
  scene.scale.setScalar(0.0254);
  const nodes = data.bones.map((bone, index) => {
    const node = new T.Object3D();
    node.name = bone.name;
    node.position.fromArray(frame.localPQ[index][0]);
    node.quaternion.fromArray(frame.localPQ[index][1]).normalize();
    return node;
  });
  data.bones.forEach((bone, index) =>
    (bone.parent < 0 ? scene : nodes[bone.parent]).add(nodes[index]),
  );
  scene.updateMatrixWorld(true);
  return scene;
}
const resourceInputs = [];
const poses = { t: {}, ct: {} };
const q = new T.Quaternion(),
  parent = new T.Quaternion(),
  p = new T.Vector3();
for (const record of nativeInputs) {
  const bytes = await readFile(`${nativeDirectory}/${record.file}`);
  if (createHash("sha256").update(bytes).digest("hex") !== record.sha256)
    throw new Error(`Native sample checksum mismatch: ${record.file}`);
  const data = JSON.parse(bytes);
  if (!data.frames.length) throw new Error(`Missing native buy pose: ${record.file}`);
  resourceInputs.push(
    ...(Array.isArray(data.provenance)
      ? data.provenance
      : [{ path: data.provenance.resource, sha256: data.provenance.sourceSha256 }]
    ).filter((input) => input.path.endsWith(".vnmclip_c")),
  );
  for (const frame of home ? data.frames : [data.frames[0]]) {
    const source = { scene: nativeScene(data, frame) };
    const group = home ? (record.file.startsWith("ct_") ? "ct" : "t") : record.file.split("/")[1];
    const name = record.file.split("/").at(-1).replace(".json", "");
    const choice = {
      name,
      team: group,
      token: home ? "rifle" : name.replace(/^(?:ct|t|sh)_buymenu_/, "").replace(/_\d+$/, ""),
    };
    for (const team of choice.team === "shared" ? ["t", "ct"] : [choice.team]) {
      const { model, bindings, ratio } = targets[team];
      const bones = {};
      for (const b of bindings) {
        const from = source.scene.getObjectByName(b.sourceName);
        if (!from) continue;
        b.node.position.copy(b.position);
        b.node.scale.copy(b.scale);
        b.node.parent.updateWorldMatrix(true, false);
        q.copy(from.getWorldQuaternion(q))
          .multiply(b.reference.rotation.clone().invert())
          .multiply(b.rotation);
        b.node.parent.getWorldQuaternion(parent).invert();
        b.node.quaternion.copy(parent.multiply(q));
        if (b.sourceName === "pelvis") {
          from.getWorldPosition(p).sub(b.reference.position).multiplyScalar(ratio);
          b.node.position.add(p);
        }
        b.node.updateWorldMatrix(false, false);
        bones[b.node.name] = { p: b.node.position.toArray(), q: b.node.quaternion.toArray() };
      }
      model.scene.updateMatrixWorld(true);
      const hand = bindings.find((b) => b.sourceName === "hand_R").node;
      const sourceHand = source.scene.getObjectByName("hand_R");
      const wpn = source.scene.getObjectByName("wpn");
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
      const weaponStart = data.bones.findIndex(
        (bone) => bone.name === "weapon" && bone.parent === -1,
      );
      const weaponBones = {};
      if (weaponStart >= 0)
        for (let i = weaponStart; i < data.bones.length; i++) {
          weaponBones[data.bones[i].name] = {
            p: frame.modelPQ[i][0],
            q: frame.modelPQ[i][1],
            s: data.localScale[i],
          };
        }
      const sample = {
        time: frame.time,
        weaponBones,
        clip: choice.name,
        bones,
        hand: hand.name,
        attachment: attachment.toArray(),
      };
      if (home) {
        poses[team].rifle ??= { clip: choice.name, hand: hand.name, weaponBones, frames: [] };
        poses[team].rifle.frames.push({ time: sample.time, bones, attachment: sample.attachment });
      } else {
        delete sample.time;
        poses[team][choice.token] = sample;
      }
    }
  }
}
const round = (key, value) => (typeof value === "number" ? Math.round(value * 1e7) / 1e7 : value);
await writeFile(`${output}/poses.json.gz`, gzipSync(JSON.stringify(poses, round), { level: 9 }));
await writeFile(
  `${output}/source.json`,
  JSON.stringify(
    {
      author: "Valve",
      source: `Native CS2 ${home ? "homepage idle" : "buy-menu"} clips extracted from the user's installed game on Windows`,
      build: "26144732",
      depot: "2347770",
      depotManifest: "67499503218971311",
      decoder: "Source2Viewer 20.1.7467+9e2e6c7f67e3c4e5a5f443a60c3a5d841ba8f304",
      extractionArchiveSha256: home
        ? undefined
        : "36a08486d67fa6261bdc11ec3ac16167719370ae079d3b32326afbab6bbc7bf9",
      nativeResources: resourceInputs,
      generator: "bun scripts/import-buy-poses.mjs",
      inputs,
      processing:
        (home
          ? "All nonnegative native homepage idle samples; "
          : "First nonnegative sample per native buy-menu clip decoded on Windows; ") +
        "Source inches converted to meters, Z up to Y up; world-space rotations calibrated to each bundled agent rifle reference. Source wpn attachment retained relative to retargeted right hand, without weapon bounding-box placement.",
      limitations: `IDF retargeting retains its Source 1 proportions. Native graph idle layering and SnapWeapon graph evaluation are not reproduced. Static scale channels are restored from the compiled clips; native root vertical motion is verified as zero. ${home ? "Clips loop at their decoded final key; final native graph sequencing is not reproduced." : "The first sample is held rather than playing the few moving buy clips."} This is not a capture of the final game UI graph.`,
    },
    null,
    2,
  ) + "\n",
);
console.log("Wrote", Object.keys(poses.t).length, Object.keys(poses.ct).length, "poses");
