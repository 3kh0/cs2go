import { expect, test } from "vitest";
import * as T from "three";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  sourceAgentClip,
  ensureAgentAnimationBones,
  agentClipForModel,
  completeAgentClip,
} from "./agent-animations";

const assets = new URL("../../../packages/assets/public/", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, assets));
const json = (path: string) => JSON.parse(read(path).toString());
const sha = (raw: Uint8Array) => createHash("sha256").update(raw).digest("hex");
test("sparse native idles supply constant bind channels before additive grip rebasing", () => {
  const model = new T.Group(),
    finger = new T.Bone();
  finger.name = "finger_index_1_R";
  finger.position.x = 1.25;
  model.add(finger);
  const idle = new T.AnimationClip("idle", 2, []);
  const grip = new T.AnimationClip("grip", 1, [
    new T.VectorKeyframeTrack(`${finger.name}.position`, [0], [1.25, 0, 0]),
  ]);
  const absolute = completeAgentClip(idle, model);
  T.AnimationUtils.makeClipAdditive(grip, 0, absolute);
  expect([...grip.tracks[0].values]).toEqual([0, 0, 0]);
  expect(idle.tracks).toHaveLength(0);
});
test("all pinned viewer agents and every non-pet animation pack are local and complete", () => {
  const root = "models/agents/inspects/";
  const provenance = json(root + "source.json");
  const source = json(root + "animations-source.json");
  const nativeAgents = json(root + "agents-source.json").items as { id: number }[];
  const manifest = json(root + "animations.json");
  const agents = json(root + "catalog.json");
  expect(sha(read(root + "agents-source.json"))).toBe(
    provenance.inputs["https://api.cs2inspects.com/items/agents2"].sha256,
  );
  expect(sha(read(root + "animations-source.json"))).toBe(
    provenance.inputs["https://cs2.cs2inspects.com/data/agentanims/manifest.json"].sha256,
  );
  expect(nativeAgents).toHaveLength(65);
  expect(Object.keys(agents).sort()).toEqual(nativeAgents.map((agent) => String(agent.id)).sort());
  for (const [id, entry] of Object.entries(agents) as [
    string,
    { model: string; image: string; nativeModel: string },
  ][]) {
    expect(read(entry.model.slice(1)).byteLength, id).toBeGreaterThan(10000);
    expect(read(entry.image.slice(1)).byteLength, id).toBeGreaterThan(1000);
    const api = json(root + `models/${id}.json`);
    expect(api.mesh_url.split("/data/")[1].replace(/\.glb$/, ".vmdl_c")).toBe(entry.nativeModel);
  }
  const keys = Object.keys(source.packs)
    .filter((key) => key !== "pet")
    .sort();
  expect(keys).toHaveLength(153);
  expect(Object.keys(manifest.packs).sort()).toEqual(keys);
  let clips = 0,
    secondaries = 0;
  for (const key of keys) {
    const expected = source.packs[key];
    const packed = manifest.packs[key];
    const raw = read(packed.url.slice(1));
    expect(sha(raw), key).toBe(packed.sha256);
    expect(sha(raw), key).toBe(
      provenance.inputs["https://cs2.cs2inspects.com/" + expected.url].sha256,
    );
    const doc = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)).toString());
    expect(doc.meshes ?? [], key).toHaveLength(0);
    const actual = new Map<string, { name: string; samplers: { input: number }[] }>(
      doc.animations.map((clip: { name: string }) => [clip.name, clip]),
    );
    expect(packed.clips).toEqual(expected.clips);
    for (const clip of expected.clips) {
      const animation = actual.get(clip.name)!;
      expect(animation, `${key}/${clip.name}`).toBeDefined();
      const end = Math.max(
        ...animation.samplers.map((sampler) => doc.accessors[sampler.input].max?.[0] ?? 0),
      );
      // Export optimization can omit a held trailing key; preserve manifest duration.
      expect(end, `${key}/${clip.name}`).toBeLessThanOrEqual(clip.duration + 0.001);
      actual.delete(clip.name);
      clips++;
    }
    for (const name of actual.keys()) {
      expect(name.endsWith(source.weapon_anim_suffix)).toBe(true);
      secondaries++;
    }
  }
  expect(clips).toBe(1221);
  expect(source.packs.pet.clips).toHaveLength(23);
  expect(provenance.categories).toEqual({ additive: 3, base: 15, weapon: 1082, taunt: 121 });
  expect(secondaries).toBeGreaterThan(0);
}, 15000);

test("native agent conversion preserves clock/root basis and leaves source samplers intact", () => {
  const times = [0, 1];
  const source = new T.AnimationClip("draw", 1, [
    new T.VectorKeyframeTrack(
      "hand_R.position",
      times,
      [0.0254, 0.0508, 0.0762, 0.0508, 0.0762, 0.1016],
    ),
    new T.VectorKeyframeTrack("root_motion.position", times, [0, 0, 0, 0, 0.1, 0]),
    new T.VectorKeyframeTrack("root_motion.scale", times, [1, 1, 1, 1, 1, 1]),
    new T.VectorKeyframeTrack("weapon.position", times, [0, 0, 0, 1, 0, 0]),
  ]);
  const copy = sourceAgentClip(source, 1.2);
  expect(copy.duration).toBe(1.2);
  expect([...copy.tracks[0].values]).toEqual([1, 2, 3, 2, 3, 4]);
  expect(copy.tracks.map((track) => track.name)).toEqual([
    "hand_R.position",
    "root_motion.position",
  ]);
  expect(copy.tracks[1].values).toEqual(source.tracks[1].values);
  expect(source.tracks[0].values[0]).toBeCloseTo(0.0254);
});

test("missing attachment helpers follow native hierarchy while body-only clips filter foreign channels", () => {
  const source = new T.Group(),
    model = new T.Group();
  const nativePelvis = new T.Bone(),
    pelvis = new T.Bone();
  nativePelvis.name = pelvis.name = "pelvis";
  const nativeHand = new T.Bone(),
    hand = new T.Bone();
  nativeHand.name = hand.name = "hand_R";
  const attachment = new T.Bone();
  attachment.name = "attachHand_R";
  attachment.position.x = 0.0254;
  source.add(nativePelvis);
  nativePelvis.add(nativeHand);
  nativeHand.add(attachment);
  model.add(pelvis);
  pelvis.add(hand);
  ensureAgentAnimationBones(model, source);
  expect(model.getObjectByName("attachHand_R")!.parent).toBe(hand);
  expect(model.getObjectByName("attachHand_R")!.position.x).toBe(1);
  const clip = new T.AnimationClip("test", 1, [
    new T.VectorKeyframeTrack("attachHand_R.position", [0], [1, 2, 3]),
    new T.VectorKeyframeTrack("foreign.position", [0], [0, 0, 0]),
  ]);
  expect(agentClipForModel(clip, model).tracks).toHaveLength(1);
  ensureAgentAnimationBones(model, source);
  expect(hand.children).toHaveLength(1);
});
