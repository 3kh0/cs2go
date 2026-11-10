import { expect, test } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";
import { bindDoorPhysics, type NativeDoorDefinition } from "./doors";
import { createMatch, createPlayer, joinMatch, startRound } from "./match";
import { shoot } from "./combat";

function fixture() {
  const root = new T.Group();
  const leaf = new T.Mesh(new T.BoxGeometry(2, 2.5, 0.08));
  leaf.name = "leaf";
  leaf.position.y = 1.25;
  leaf.userData.bulletMaterial = "wood";
  const floor = new T.Mesh(new T.PlaneGeometry(30, 30).rotateX(-Math.PI / 2));
  root.add(leaf, floor);
  root.updateMatrixWorld(true);
  // Deliberately synthetic thresholds: this verifies authority wiring, not a
  // native map's unevidenced stage threshold or damage multiplier.
  const definition: NativeDoorDefinition = {
    id: "test:door",
    pivot: [-1, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 200,
    returnDelay: -1,
    physicsNames: [leaf.name],
    renderNames: [leaf.name],
    damage: {
      health: 5,
      damageMultipliers: { bullet: 1, melee: 1 },
      stages: [
        { belowHealth: 0, inclusive: true, renderNames: ["hinge"], physicsNames: ["hinge"] },
      ],
    },
  };
  const hinge = new T.Mesh(new T.BoxGeometry(0.08, 2.5, 0.08));
  hinge.position.set(-0.96, 1.25, 0);
  hinge.updateMatrixWorld();
  hinge.name = "hinge";
  root.add(hinge);
  const physics = bindDoorPhysics(root, [definition]);
  const map = {
    collision: new MapCollision([leaf, floor, hinge]),
    doorDefinitions: [definition],
    doorPhysics: physics,
    spawns: { ct: [[0, 0, 2]], t: [[5, 0, 2]] },
  };
  return { map };
}

test("authoritative firearm and knife impacts change door collision stages, isolate rooms and reset", () => {
  for (const melee of [false, true]) {
    const { map } = fixture();
    const match = createMatch("casual", map),
      untouched = createMatch("casual", map);
    const player = createPlayer("p", "Player", "ct");
    joinMatch(match, player);
    Object.assign(player, { x: 0, y: 0, z: melee ? 0.6 : 2, yaw: 0, pitch: 0 });
    if (melee) player.weapon = player.knife;
    const ray = new T.Ray(new T.Vector3(0, 1.6, 2), new T.Vector3(0, 0, -1));
    expect(match.map.collision.intersections(ray, 4).length).toBeGreaterThan(0);
    shoot(match, player);
    expect(match.doors.states[0]).toMatchObject({ health: 0, stage: 1 });
    expect(match.map.collision.intersections(ray, 4)).toHaveLength(0);
    expect(untouched.doors.states[0]).toMatchObject({ health: 5, stage: 0 });
    expect(untouched.map.collision.intersections(ray, 4).length).toBeGreaterThan(0);
    startRound(match);
    expect(match.doors.states[0]).toMatchObject({ health: 5, stage: 0 });
    expect(match.map.collision.intersections(ray, 4).length).toBeGreaterThan(0);
  }
});
