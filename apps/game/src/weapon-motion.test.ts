import { beforeAll, expect, test, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { Buffer } from "node:buffer";
import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  animateNativeWeapon,
  createNativeWeapon,
  loadNativeWeapons,
  nativeShotDuration,
  nativeSoundCues,
  nativeSuppressor,
} from "./weapon-motion";

const fixture = vi.hoisted(() => ({ hands: undefined as T.Group | undefined }));
vi.mock("./skins", () => ({ registerSkinModel() {} }));
vi.mock("./knife-motion", () => ({ viewHandsTemplate: () => fixture.hands }));
vi.mock("./gltf", () => ({
  // Keep the actual model joints, DE clips, and four suppressor clips. Other
  // weapon templates use DE fixtures so this test needs no whole-armory fetch.
  loadModel: async (url: string) => {
    const path = /\/deagle\/[^/]+\.glb$|\/silencer_(attach|detach)\.glb$/.test(url)
      ? url
      : /^\/models\/viewmodels\/[^/]+\.glb$/.test(url)
        ? "/models/viewmodels/deagle.glb"
        : "/models/viewmodels/deagle/idle.glb";
    return parseAsset(path);
  },
}));

async function parseAsset(path: string) {
  const data = await readFile(new URL(`../../../packages/assets/public${path}`, import.meta.url));
  const length = data.readUInt32LE(12);
  const doc = JSON.parse(data.subarray(20, 20 + length).toString());
  // Avoid image/DOM dependencies in this CPU-only test, retaining the complete
  // skeleton, transforms, animation channels, and native event metadata.
  for (const node of doc.nodes) {
    delete node.mesh;
    delete node.skin;
  }
  delete doc.meshes;
  const json = JSON.stringify(doc);
  const padded = Buffer.from(json + " ".repeat((4 - (Buffer.byteLength(json) % 4)) % 4));
  const blob = data.subarray(28 + length);
  const output = Buffer.alloc(28 + padded.length + blob.length);
  output.writeUInt32LE(0x46546c67, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(output.length, 8);
  output.writeUInt32LE(padded.length, 12);
  output.writeUInt32LE(0x4e4f534a, 16);
  padded.copy(output, 20);
  output.writeUInt32LE(blob.length, 20 + padded.length);
  output.writeUInt32LE(0x004e4942, 24 + padded.length);
  blob.copy(output, 28 + padded.length);
  return new GLTFLoader().parseAsync(output.buffer, "");
}

beforeAll(async () => {
  fixture.hands = (await parseAsset("/models/agents/view-hands.glb")).scene;
  await loadNativeWeapons();
});

test("DE empty actions have distinct poses and matching native reload cues", () => {
  const gun = new T.Group();
  gun.userData.muzzle = new T.Vector3();
  expect(createNativeWeapon(gun, 8)).toBe(true);
  const pose = { draw: 0, reload: 0, bolt: 0, bob: 0, sway: 0 };
  const hand = () => gun.getObjectByName("right-hand")!.position.clone();
  animateNativeWeapon(gun, { ...pose, reload: 0.43, emptyReload: false });
  const partial = hand();
  animateNativeWeapon(gun, { ...pose, reload: 0.43, emptyReload: true });
  expect(hand().distanceTo(partial)).toBeGreaterThan(0.01);
  const slide = gun.getObjectByName("weapon-model")!.getObjectByName("slide")!;
  animateNativeWeapon(gun, { ...pose, shotActive: true, shot: 0.95 });
  const normal = slide.position.clone();
  animateNativeWeapon(gun, { ...pose, shotActive: true, shot: 0.95, lastShot: true });
  expect(slide.position.distanceTo(normal)).toBeGreaterThan(0.1);
  expect(nativeSoundCues(8, "reload").find((c) => c.kind === "reload")!.time).toBe(0.151515);
  expect(nativeSoundCues(8, "reload").find((c) => c.kind === "reloadIn")!.time).toBe(0.318182);
  expect(nativeSoundCues(8, "reload_empty").find((c) => c.kind === "reloadIn")!.time).toBe(
    0.424242,
  );
});

test("forearm support preserves sampled hand contacts without accumulating on paused frames", () => {
  const gun = new T.Group();
  gun.userData.muzzle = new T.Vector3();
  createNativeWeapon(gun, 8);
  const arms = gun.getObjectByName("agent-view-arms")!;
  const helper = arms.getObjectByName("arm_lower_L_twist1")!;
  const rest = helper.quaternion.clone();
  const pose = { draw: 0, reload: 0.5, bolt: 0, bob: 0, sway: 0 };
  animateNativeWeapon(gun, pose);
  expect(helper.quaternion.angleTo(rest)).toBeGreaterThan(0.1);
  const rotation = helper.quaternion.clone();
  for (let i = 0; i < 20; i++) animateNativeWeapon(gun, pose);
  expect(helper.quaternion.angleTo(rotation)).toBeLessThan(0.000001);
  for (const side of ["L", "R"]) {
    const actual = arms.getObjectByName(`hand_${side}`)!.getWorldPosition(new T.Vector3());
    const marker = gun.getObjectByName(side === "L" ? "left-hand" : "right-hand")!;
    expect(actual.distanceTo(marker.getWorldPosition(new T.Vector3()))).toBeLessThan(0.000001);
  }
  // Carried guns deliberately have no arms; the shared poser must still work.
  const carried = new T.Group();
  carried.userData.muzzle = new T.Vector3();
  createNativeWeapon(carried, 8, false);
  expect(animateNativeWeapon(carried, { ...pose, reload: 0 })).toBe(true);
});

test("verified clip intervals retain the authored 0.9 playback rate", () => {
  expect(nativeShotDuration(8)).toBeCloseTo(0.7 / 0.9, 6);
  expect(nativeShotDuration(8, false, true)).toBeCloseTo(0.7 / 0.9, 6);
  for (const id of [1, 2])
    for (const attach of [true, false])
      expect(nativeSuppressor(id, attach).duration).toBeCloseTo(4.8333 / 0.9, 5);
});
