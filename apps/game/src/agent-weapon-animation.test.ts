import { beforeAll, expect, test, vi } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { AgentWeaponAnimation } from "./agent-weapon-animation";
import { createNativeWorldGun, loadNativeWeapons, nativeWorldRig } from "./weapon-motion";

vi.mock("./skins", () => ({ registerSkinModel() {} }));
vi.mock("./knife-motion", () => ({ viewHandsTemplate: () => new T.Group() }));
vi.mock("./gltf", () => ({ loadModel: (path: string) => parse(path) }));

async function parse(path: string) {
  const data = await readFile(new URL(`../../../packages/assets/public${path}`, import.meta.url));
  const length = data.readUInt32LE(12);
  const doc = JSON.parse(data.subarray(20, 20 + length).toString());
  // Keep real geometry, weights, inverse binds, joints and animation channels;
  // only image/material loading is unnecessary for this headless pose audit.
  for (const mesh of doc.meshes ?? [])
    for (const primitive of mesh.primitives) delete primitive.material;
  delete doc.materials;
  delete doc.textures;
  delete doc.images;
  const text = JSON.stringify(doc);
  const json = Buffer.from(text + " ".repeat((4 - (Buffer.byteLength(text) % 4)) % 4));
  const binary = data.subarray(28 + length);
  const output = Buffer.alloc(28 + json.length + binary.length);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(json.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  json.copy(output, 20);
  output.writeUInt32LE(binary.length, 20 + json.length);
  output.writeUInt32LE(0x004e4942, 24 + json.length);
  binary.copy(output, 28 + json.length);
  return new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(output.buffer, "");
}
beforeAll(() => loadNativeWeapons([0, 18]));

test("all firearm models expose the named secondary skeleton anchors retained by world rigs", async () => {
  const folder = new URL("../../../packages/assets/public/models/viewmodels/", import.meta.url);
  const models = (await readdir(folder)).filter((name) => name.endsWith("-hd.glb"));
  expect(models).toHaveLength(34);
  for (const name of models) {
    const bytes = await readFile(new URL(name, folder));
    const doc = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const names = new Set(doc.nodes.map((node: { name?: string }) => node.name));
    expect(names.has("weapon"), name).toBe(true);
    expect(
      names.has("weapon_offset") || (names.has("weapon_hand_l") && names.has("weapon_hand_r")),
      name,
    ).toBe(true);
    expect(doc.skins.length, name).toBeGreaterThan(0);
  }
});

test("retaining world skinning preserves the baked weapon's metric bounds and grip", async () => {
  const bytes = await readFile(
    new URL(
      "../../../packages/assets/public/models/animations/grips/poses.json.gz",
      import.meta.url,
    ),
  );
  const poses = JSON.parse(gunzipSync(bytes).toString()).t;
  for (const index of [0, 18])
    for (const pose of [undefined, poses[index].stand.weaponBones]) {
      const rigid = createNativeWorldGun(index, true, pose);
      const animated = createNativeWorldGun(index, true, pose, false, true);
      const a = new T.Box3().setFromObject(rigid, true),
        b = new T.Box3().setFromObject(animated, true);
      expect(a.min.distanceTo(b.min)).toBeLessThan(1e-5);
      expect(a.max.distanceTo(b.max)).toBeLessThan(1e-5);
      animated.userData.buyGrip.forEach((value: number, i: number) =>
        expect(value).toBeCloseTo(rigid.userData.buyGrip[i], 7),
      );
      let skinned = 0;
      animated.traverse((node) => {
        if (node instanceof T.SkinnedMesh) skinned++;
      });
      expect(skinned).toBeGreaterThan(0);
      expect(nativeWorldRig(animated)).toBeDefined();
    }
});

test("native secondary reload moves the actual magazine and scrubs back without scale drift", async () => {
  const pack = await parse("/models/agents/inspects/animations/world/rifle/rifle_ak.glb");
  const clip = pack.animations.find((clip) => clip.name === "reload_ak@weapon")!;
  const weapon = createNativeWorldGun(0, true, undefined, false, true);
  const idleBounds = new T.Box3().setFromObject(weapon, true);
  const mixer = new T.AnimationMixer(new T.Group());
  const clock = mixer.clipAction(new T.AnimationClip("body", clip.duration, [])).play();
  const secondary = new AgentWeaponAnimation(weapon, pack.scene);
  secondary.bind(clock, clip);
  const magazine = nativeWorldRig(weapon)!.model.getObjectByName("clip")!;
  const sample = (time: number) => {
    clock.time = time;
    mixer.update(0);
    secondary.update();
    return {
      position: magazine.getWorldPosition(new T.Vector3()),
      scale: magazine.getWorldScale(new T.Vector3()),
      bounds: new T.Box3().setFromObject(weapon, true),
    };
  };
  const first = sample(0),
    removed = sample(0.7666561603546143);
  expect(first.bounds.min.distanceTo(idleBounds.min)).toBeLessThan(0.03);
  expect(first.bounds.max.distanceTo(idleBounds.max)).toBeLessThan(0.03);
  // Original @weapon clip frame23: the native magazine travels71.078cm.
  expect(removed.position.distanceTo(first.position)).toBeCloseTo(0.7107803839, 5);
  expect(removed.bounds.getSize(new T.Vector3()).length()).toBeLessThan(2);
  // The native clip hides the discarded magazine with its authored scale.
  expect(
    removed.scale.distanceTo(first.scale.clone().multiplyScalar(0.0010012686252594)),
  ).toBeLessThan(1e-6);
  const restored = sample(0);
  expect(restored.position.distanceTo(first.position)).toBeLessThan(1e-6);
  expect(restored.scale.distanceTo(first.scale)).toBeLessThan(1e-6);
  expect(restored.bounds.min.distanceTo(first.bounds.min)).toBeLessThan(1e-6);
  secondary.dispose();
});

test("late animation and skin arrivals use bind scale rather than the currently hidden magazine", async () => {
  const pack = await parse("/models/agents/inspects/animations/world/rifle/rifle_ak.glb");
  const clip = pack.animations.find((clip) => clip.name === "reload_ak@weapon")!;
  const weapon = createNativeWorldGun(0, true, undefined, false, true);
  const clock = new T.AnimationMixer(new T.Group())
    .clipAction(new T.AnimationClip("body", clip.duration, []))
    .play();
  const secondary = new AgentWeaponAnimation(weapon, pack.scene);
  secondary.bind(clock, clip);
  const magazine = nativeWorldRig(weapon)!.model.getObjectByName("clip")!;
  const initial = magazine.getWorldScale(new T.Vector3());
  clock.time = 0.7666561604;
  secondary.update();
  expect(
    magazine
      .getWorldScale(new T.Vector3())
      .distanceTo(initial.clone().multiplyScalar(0.0010012686252594)),
  ).toBeLessThan(1e-6);
  const legacy = createNativeWorldGun(0, true, undefined, false, true);
  weapon.add(legacy);
  secondary.update();
  const late = nativeWorldRig(legacy)!.model.getObjectByName("clip")!;
  expect(
    late
      .getWorldScale(new T.Vector3())
      .distanceTo(initial.clone().multiplyScalar(0.0010012686252594)),
  ).toBeLessThan(1e-6);
  clock.time = 1.2;
  for (let i = 0; i < 20; i++) secondary.update();
  expect(late.getWorldScale(new T.Vector3()).distanceTo(initial)).toBeLessThan(1e-6);
  secondary.dispose();
});

test("cached secondary samples preserve paused, interrupted and restored world poses", async () => {
  const pack = await parse("/models/agents/inspects/animations/world/rifle/rifle_ak.glb");
  const clips = ["reload_ak@weapon", "shoot_ak@weapon"].map((name) =>
    pack.animations.find((clip) => clip.name === name)!,
  );
  const make = () => {
    const weapon = createNativeWorldGun(0, true, undefined, false, true);
    const parent = new T.Group();
    parent.add(weapon);
    const secondary = new AgentWeaponAnimation(weapon, pack.scene);
    const mixer = new T.AnimationMixer(new T.Group());
    const clocks = clips.map((clip, i) => {
      const clock = mixer.clipAction(new T.AnimationClip(`body-${i}`, clip.duration, []));
      secondary.bind(clock, clip);
      return clock;
    });
    return { weapon, parent, secondary, clocks };
  };
  const cached = make(),
    reference = make();
  // The reference always evaluates its detached source. Compare actual target
  // matrices and skinned geometry against that path, including external motion.
  const internals = (secondary: AgentWeaponAnimation) =>
    secondary as unknown as { sampled: boolean; mixer: T.AnimationMixer; source: T.Object3D };
  const evaluate = vi.spyOn(internals(cached.secondary).mixer, "update");
  const sourceWorld = vi.spyOn(internals(cached.secondary).source, "updateMatrixWorld");
  const sample = (change?: (rig: ReturnType<typeof make>) => void) => {
    if (change) for (const rig of [cached, reference]) change(rig);
    internals(reference.secondary).sampled = false;
    cached.secondary.update();
    reference.secondary.update();
    const bones = (weapon: T.Group) => {
      const values: number[] = [];
      weapon.traverse((node) => {
        if (node instanceof T.Bone) values.push(...node.matrixWorld.elements);
      });
      return values;
    };
    const a = bones(cached.weapon),
      b = bones(reference.weapon);
    expect(a).toHaveLength(b.length);
    expect(Math.max(...a.map((value, i) => Math.abs(value - b[i])))).toBeLessThan(1e-9);
    const boundsA = new T.Box3().setFromObject(cached.weapon, true),
      boundsB = new T.Box3().setFromObject(reference.weapon, true);
    expect(boundsA.min.distanceTo(boundsB.min)).toBeLessThan(1e-9);
    expect(boundsA.max.distanceTo(boundsB.max)).toBeLessThan(1e-9);
  };
  sample();
  sample(({ clocks }) => {
    clocks[0].play().setEffectiveWeight(1);
    clocks[0].time = 0.7666561604;
    clocks[0].paused = true;
  });
  const beforePause = evaluate.mock.calls.length;
  for (let i = 0; i < 10; i++) sample();
  expect(evaluate).toHaveBeenCalledTimes(beforePause);
  expect(sourceWorld).toHaveBeenCalledTimes(beforePause);
  sample(({ parent, weapon }) => {
    parent.position.set(4, 2, -3);
    parent.rotation.set(0.2, -0.7, 0.1);
    weapon.add(createNativeWorldGun(0, true, undefined, false, true));
  });
  expect(evaluate).toHaveBeenCalledTimes(beforePause);
  sample(({ clocks }) => {
    clocks[0].setEffectiveWeight(0.3);
    clocks[1].play().setEffectiveWeight(0.7);
    clocks[1].time = 0.02;
  });
  sample();
  sample(({ clocks }) => clocks[0].stop());
  sample(({ clocks }) => clocks[1].stop());
  const afterStop = evaluate.mock.calls.length;
  sample();
  expect(evaluate).toHaveBeenCalledTimes(afterStop);
  sample(({ clocks }) => {
    clocks[0].play();
    clocks[0].time = 0;
  });
  sample(({ clocks }) => {
    clocks[0].enabled = false;
    clocks[0].setEffectiveWeight(1);
  });
  sample(({ clocks }) => {
    clocks[0].enabled = true;
    clocks[0].setEffectiveWeight(1);
  });
  for (const rig of [cached, reference]) rig.secondary.dispose();
});
