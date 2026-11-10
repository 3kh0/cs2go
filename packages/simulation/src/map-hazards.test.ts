import { expect, test } from "vitest";
import * as T from "three";
import { neutralInput } from "@cs2go/protocol";
import { BombReset, MapHazards, supportedBombPosition } from "./map-hazards";
import type { NativeMapTrigger, TriggerBox } from "./buy-zones";
import { MapCollision } from "./map-collision";
import { createMatch, createPlayer, joinMatch, stepMatch, STEP } from "./match";
import { testMap } from "./test-map";

const brush: TriggerBox = { min: [-2, 0, -2], max: [2, 2, 2] };
function trigger(hulls: TriggerBox[] = [brush], damage = 1000): NativeMapTrigger {
  return {
    entity: "native-trigger",
    model: "maps/test/entities/trigger.vmdl",
    enabled: true,
    hulls,
    damage,
    damagecap: 20,
    damagemodel: 0,
    damagetype: 32,
    spawnflags: 1,
  };
}
const actor = (id: string, x = 0, height = 1.8) => ({
  id,
  position: { x, y: 0, z: 0 },
  hull: { halfWidth: 0.4, height },
});

test("native hurt uses one pulse per entity, exact posture contact, and constant damage ignores scaling cap", () => {
  const high = { min: [-2, 1.5, -2], max: [2, 1.7, 2] };
  const hazards = new MapHazards([trigger([high, high])]);
  expect(hazards.update(STEP, [actor("standing"), actor("crouching", 0, 1.3)])).toEqual([
    { actor: "standing", damage: 500, trigger: "native-trigger" },
  ]);
  expect(hazards.update(STEP, [actor("standing")])).toEqual([]);
  expect(new MapHazards([{ ...trigger(), enabled: false }]).update(STEP, [actor("a")])).toEqual([]);
  expect(new MapHazards([{ ...trigger(), spawnflags: 2 }]).update(STEP, [actor("a")])).toEqual([]);
});

test("hurt pulses share a half-second clock and a short crossing cannot dodge all damage", () => {
  const hazards = new MapHazards<string>([trigger([brush], 40)]);
  expect(hazards.update(STEP, [actor("first")])[0].damage).toBe(20);
  for (let i = 0; i < 30; i++) expect(hazards.update(STEP, [actor("first")])).toEqual([]);
  expect(hazards.update(STEP, [actor("first"), actor("crossing")])).toEqual([]);
  expect(hazards.update(STEP, [actor("first")])).toEqual([
    { actor: "crossing", damage: 20, trigger: "native-trigger" },
  ]);
  for (let i = 0; i < 31; i++) expect(hazards.update(STEP, [actor("first")])).toEqual([]);
  expect(hazards.update(STEP, [actor("first")])[0].damage).toBe(20);
  hazards.reset();
  expect(hazards.update(STEP, [actor("first")])[0].damage).toBe(20);
});

test("bomb reset follows exact rotated brush planes and only remembers supported reachable checkpoints", () => {
  const diamond: TriggerBox = {
    min: [-2, -2, -2],
    max: [2, 2, 2],
    planes: [
      [1, 0, 1, 2],
      [-1, 0, 1, 2],
      [1, 0, -1, 2],
      [-1, 0, -1, 2],
      [0, 1, 0, 2],
      [0, -1, 0, 2],
    ],
  };
  const reset = new BombReset({ zones: [], sites: [], bombReset: [trigger([diamond])] });
  const checkpoint = { x: 10, y: 300, z: 20 };
  reset.remember(checkpoint, true, () => true);
  checkpoint.x = 99;
  reset.remember({ x: 44, y: 400, z: 3 }, false, () => true);
  reset.remember({ x: 33, y: 400, z: 3 }, true, () => false);
  reset.remember({ x: 0, y: 0, z: 0 }, true, () => true);
  const bomb = { x: 1.5, y: 0, z: 1.5 };
  expect(reset.restore(bomb)).toBe(false);
  bomb.x = bomb.z = 0;
  expect(reset.restore(bomb)).toBe(true);
  expect(bomb).toEqual({ x: 10, y: 300, z: 20 });
  reset.reset();
  Object.assign(bomb, { x: 0, y: 0, z: 0 });
  expect(reset.restore(bomb)).toBe(false);
});

test("dropped C4 falls into a thin reset brush below the lethal brush and returns to safe ground", () => {
  const platform = new T.Mesh(new T.BoxGeometry(8, 1, 8), new T.MeshBasicMaterial());
  platform.position.set(0, 299.5, 0);
  platform.updateMatrixWorld();
  const collision = new MapCollision([platform]);
  const reset = new BombReset({
    zones: [],
    sites: [],
    hurt: [trigger([{ min: [4, 294, -5], max: [20, 296, 5] }])],
    bombReset: [trigger([{ min: [4, 289, -5], max: [20, 289.01, 5] }])],
  });
  reset.remember({ x: 0, y: 300, z: 0 }, true, (position) =>
    supportedBombPosition(collision, position),
  );
  const bomb = { x: 10, y: 295, z: 0 };
  let falling = false,
    restored = false;
  for (let i = 0; i < 256; i++) {
    reset.advance(bomb, STEP, collision, false);
    falling ||= bomb.y < 294.5;
    if (bomb.x === 0 && bomb.y === 300) {
      restored = true;
      break;
    }
  }
  expect(falling).toBe(true);
  expect(restored).toBe(true);
  for (let i = 0; i < 128; i++) reset.advance(bomb, STEP, collision, false);
  expect(bomb).toEqual({ x: 0, y: 300, z: 0 });
  const legacy = new BombReset();
  const old = { x: 10, y: 295, z: 0 };
  legacy.advance(old, 1, collision, false);
  expect(old.y).toBe(295);
});

test("authoritative hurt bypasses armor and cancels combat, planting and defusing without awarding a kill", () => {
  const map = testMap();
  map.id = "mirage";
  map.spawns = { t: [[10, 0, 0]], ct: [[20, 0, 0]] };
  map.triggers = { zones: [], sites: [], hurt: [trigger()] };
  const match = createMatch("casual", map);
  const t = createPlayer("t", "T", "t"),
    ct = createPlayer("ct", "CT", "ct");
  joinMatch(match, t);
  joinMatch(match, ct);
  stepMatch(match, new Map());
  match.state.phase = "live";
  match.state.remaining = 100;
  match.state.bomb.carrier = t.id;
  match.state.bomb.plantProgress = 2;
  match.state.bomb.defuser = t.id;
  match.state.bomb.progress = 2;
  Object.assign(t, { x: 0, y: 0, z: 0, health: 100, armor: 100, reloadTime: 2 });
  match.actions.get(t.id)!.charge = 1;
  match.utility.get(t.id)!.held = 1;
  const events = stepMatch(match, new Map([[t.id, { ...neutralInput(), use: true }]]));
  expect(t.health).toBe(0);
  expect(t.armor).toBe(100);
  expect(t.deaths).toBe(1);
  expect(ct.kills).toBe(0);
  expect(t.reloadTime).toBe(0);
  expect(match.actions.get(t.id)!.charge).toBe(0);
  expect(match.utility.get(t.id)!.held).toBe(0);
  expect(match.state.bomb.carrier).toBeNull();
  expect(match.state.bomb.plantProgress).toBe(0);
  expect(match.state.bomb.defuser).toBeNull();
  expect(events.filter((event) => event.kind === "kill")).toMatchObject([
    { killer: "World", victim: "t", weapon: -1 },
  ]);
});
