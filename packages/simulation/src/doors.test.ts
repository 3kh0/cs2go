import { expect, test, vi } from "vitest";
import * as T from "three";
import { DoorWorld, bindDoorPhysics, DOOR_USE_DISTANCE, type NativeDoorDefinition } from "./doors";
import { MapCollision } from "./map-collision";
import { createMatch, createPlayer, joinMatch, startRound, stepMatch, STEP } from "./match";
import { neutralInput } from "@cs2go/protocol";
import { testMap } from "./test-map";

function fixture(overrides: Partial<NativeDoorDefinition> = {}) {
  const mesh = new T.Mesh(new T.BoxGeometry(2, 2.4, 0.12).translate(1, 1.2, 0));
  mesh.name = "leaf";
  const definition: NativeDoorDefinition = {
    id: "door",
    pivot: [0, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 180,
    returnDelay: -1,
    physicsNames: ["leaf"],
    renderNames: ["leaf"],
    ...overrides,
  };
  const root = new T.Group();
  root.add(mesh);
  const physics = bindDoorPhysics(root, [definition]);
  const collision = new MapCollision([mesh]);
  const world = new DoorWorld(collision, [definition], physics);
  return { mesh, definition, physics, collision, world };
}
const from = new T.Vector3(1, 1, 1),
  direction = new T.Vector3(0, 0, -1);
function advance(world: DoorWorld, seconds: number, actors: Parameters<DoorWorld["step"]>[1] = []) {
  for (let i = 0; i < seconds * 128; i++) world.step(STEP, actors);
}

test("held use opens only once, follows authored angular speed and keeps the rotated leaf collidable", () => {
  const { world, collision } = fixture();
  expect(world.use("t", true, from, direction)).toBe(true);
  expect(world.states[0].target).toBe(90);
  world.step(STEP);
  expect(world.states[0].angle).toBeCloseTo(180 / 128);
  for (let i = 0; i < 63; i++) {
    expect(world.use("t", true, from, direction)).toBe(false);
    world.step(STEP);
  }
  expect(world.states[0].angle).toBe(90);
  expect(collision.visible(from, new T.Vector3(1, 1, -2))).toBe(true);
  expect(collision.visible(new T.Vector3(1, 1, -1), new T.Vector3(-1, 1, -1))).toBe(false);
  world.use("t", false, from, direction);
  expect(world.use("t", true, new T.Vector3(1, 1, -1), new T.Vector3(-1, 0, 0))).toBe(true);
  advance(world, 0.5);
  expect(world.states[0].angle).toBe(0);
  expect(collision.visible(from, new T.Vector3(1, 1, -2))).toBe(false);
});

test("use is bounded by range, cover, locks, and objective/pickup arbitration", () => {
  const { world, collision } = fixture();
  expect(world.target(new T.Vector3(1, 1, DOOR_USE_DISTANCE + 0.1), direction)).toBeUndefined();
  const blocker = new T.Mesh(new T.BoxGeometry(2, 2, 0.1));
  blocker.position.set(1, 1, 0.6);
  blocker.updateMatrixWorld(true);
  collision.setDynamicMeshes("blocker", [blocker]);
  expect(world.use("p", true, from, direction)).toBe(false);
  collision.removeDynamicMeshes("blocker");
  world.use("p", false, from, direction);
  expect(world.use("p", true, from, direction, false)).toBe(false);
  expect(world.use("p", true, from, direction)).toBe(false);
  expect(world.states[0].angle).toBe(0);
  world.use("p", false, from, direction);
  expect(world.use("p", true, from, direction)).toBe(true);
  const locked = fixture({ locked: true }).world;
  expect(locked.use("p", true, from, direction)).toBe(false);
  expect(locked.states[0].target).toBe(0);
});

test("distant bot door requests avoid world rays while nearby queries retain exact cover and range", () => {
  const { world, collision } = fixture();
  const intersections = vi.spyOn(collision, "intersections");
  for (const origin of [
    new T.Vector3(30, 1, 0),
    new T.Vector3(1, 30, 0),
    new T.Vector3(1, 1, -30),
  ]) {
    expect(world.target(origin, direction)).toBeUndefined();
    expect(world.openAhead(origin, direction)).toBe(false);
  }
  expect(intersections).not.toHaveBeenCalled();
  const front = Math.fround(0.06);
  expect(world.target(new T.Vector3(1, 1, front + DOOR_USE_DISTANCE - 1e-7), direction)).toBe(
    "door",
  );
  expect(intersections).toHaveBeenCalledTimes(1);
  // A conservative bound admits nearby rays even when they point away.
  expect(world.target(from, direction.clone().negate())).toBeUndefined();
  expect(intersections).toHaveBeenCalledTimes(2);
  const blocker = new T.Mesh(new T.BoxGeometry(2, 2, 0.1));
  blocker.position.set(1, 1, 0.6);
  blocker.updateMatrixWorld(true);
  collision.setDynamicMeshes("blocker", [blocker]);
  expect(world.target(from, direction)).toBeUndefined();
  expect(intersections).toHaveBeenCalledTimes(3);
  collision.removeDynamicMeshes("blocker");
  expect(world.openAhead(from, direction)).toBe(true);
  expect(intersections).toHaveBeenCalledTimes(4);
});

test("door interaction bounds follow swinging, restoration, reset and obstruction rollback", () => {
  const { world, collision } = fixture();
  const rotatedFrom = new T.Vector3(-1, 1, -1.9),
    rotatedDirection = new T.Vector3(1, 0, 0);
  const intersections = vi.spyOn(collision, "intersections");
  expect(world.target(rotatedFrom, rotatedDirection)).toBeUndefined();
  expect(intersections).not.toHaveBeenCalled();
  world.openAhead(from, direction);
  advance(world, 0.5);
  expect(world.target(rotatedFrom, rotatedDirection)).toBe("door");
  const snapshot = structuredClone(world.states);
  world.reset();
  intersections.mockClear();
  expect(world.target(rotatedFrom, rotatedDirection)).toBeUndefined();
  expect(intersections).not.toHaveBeenCalled();
  world.restore(snapshot);
  expect(world.target(rotatedFrom, rotatedDirection)).toBe("door");
  world.use("p", true, rotatedFrom, rotatedDirection);
  // The blocked closing attempt restores both the collision pose and bounds.
  advance(world, 0.5, [{ x: 1, y: 0, z: -0.1, height: 1.65 }]);
  const origin = new T.Vector3(1, 1, -1),
    aim = new T.Vector3(-1, 0, 0);
  const expected = collision.intersections(new T.Ray(origin, aim), DOOR_USE_DISTANCE)[0];
  const actual = world.target(origin, aim);
  expect(actual).toBe(expected?.object.userData.nativeDoorId);
});

test("any nearby current leaf retains the world query regardless of definition order", () => {
  const { mesh, definition } = fixture();
  const distant = mesh.clone();
  distant.name = "distant";
  distant.position.x = 50;
  const root = new T.Group();
  root.add(distant, mesh);
  const definitions: NativeDoorDefinition[] = [
    {
      ...definition,
      id: "distant",
      pivot: [50, 0, 0],
      physicsNames: ["distant"],
      renderNames: ["distant"],
    },
    definition,
  ];
  const physics = bindDoorPhysics(root, definitions),
    collision = new MapCollision([distant, mesh]),
    world = new DoorWorld(collision, definitions, physics),
    intersections = vi.spyOn(collision, "intersections");
  expect(world.target(from, direction)).toBe("door");
  expect(world.target(new T.Vector3(51, 1, 1), direction)).toBe("distant");
  expect(intersections).toHaveBeenCalledTimes(2);
  expect(world.target(new T.Vector3(25, 1, 1), direction)).toBeUndefined();
  expect(intersections).toHaveBeenCalledTimes(2);
});

test("both-way doors swing away while explicit one-way direction wins", () => {
  const both = fixture().world;
  both.use("p", true, new T.Vector3(1, 1, -1), new T.Vector3(0, 0, 1));
  expect(both.states[0].target).toBe(-90);
  const reversed = fixture({ openDirection: -1 }).world;
  reversed.use("p", true, from, direction);
  expect(reversed.states[0].target).toBe(-90);
});

test("linked leaves receive one command and swing in opposite directions about their own hinges", () => {
  const first = fixture({ group: "pair" });
  const second = new T.Mesh(new T.BoxGeometry(2, 2.4, 0.12).translate(-1, 1.2, 0));
  second.name = "second";
  second.position.x = 4;
  const root = new T.Group();
  root.add(first.mesh, second);
  const definitions = [
    first.definition,
    {
      ...first.definition,
      id: "other",
      pivot: [4, 0, 0] as const,
      physicsNames: ["second"],
      renderNames: ["second"],
    },
  ];
  const physics = bindDoorPhysics(root, definitions),
    collision = new MapCollision([first.mesh, second]);
  const world = new DoorWorld(collision, definitions, physics);
  expect(world.use("p", true, from, direction)).toBe(true);
  expect(world.states.map((state) => state.target)).toEqual([90, -90]);
  advance(world, 0.5);
  expect(world.states.map((state) => state.angle)).toEqual([90, -90]);
});

test("closing waits on occupied player hulls then resumes without moving players through walls", () => {
  const { world } = fixture();
  world.use("p", true, from, direction);
  advance(world, 0.5);
  world.use("p", false, from, direction);
  world.use("p", true, new T.Vector3(1, 1, -1), new T.Vector3(-1, 0, 0));
  const actor = { x: 1, y: 0, z: -0.1, height: 1.65 };
  advance(world, 1, [actor]);
  expect(world.states[0].angle).toBeGreaterThan(0);
  expect(world.states[0].angle).toBeLessThan(90);
  expect(actor).toEqual({ x: 1, y: 0, z: -0.1, height: 1.65 });
  advance(world, 1);
  expect(world.states[0].angle).toBe(0);
});

test("authored return delay, restore and reset retain collision poses without toggling on bot route requests", () => {
  const { world, collision } = fixture({ returnDelay: 0.5 });
  expect(world.openAhead(from, direction)).toBe(true);
  expect(world.openAhead(from, direction)).toBe(false);
  advance(world, 0.5);
  expect(world.states[0].returnTime).toBe(0.5);
  advance(world, 0.25);
  expect(world.states[0].angle).toBe(90);
  const snapshot = structuredClone(world.states);
  advance(world, 0.75);
  expect(world.states[0].angle).toBe(0);
  world.restore(snapshot);
  expect(world.states[0].angle).toBe(90);
  expect(collision.visible(from, new T.Vector3(1, 1, -1))).toBe(true);
  world.reset();
  expect(world.states[0].angle).toBe(0);
  expect(collision.visible(from, new T.Vector3(1, 1, -1))).toBe(false);
  expect(world.use("p", true, from, direction)).toBe(true);
});

test("restoring physics health cannot resurrect a closed static duplicate beside an open leaf", () => {
  const { world, collision } = fixture();
  world.openAhead(from, direction);
  advance(world, 0.5);
  const snapshot = structuredClone(world.states);
  collision.setMeshEnabled("leaf", true);
  world.restore(snapshot);
  expect(collision.visible(from, new T.Vector3(1, 1, -2))).toBe(true);
  expect(collision.visible(new T.Vector3(1, 1, -1), new T.Vector3(-1, 1, -1))).toBe(false);
  collision.setMeshEnabled("leaf", false);
  world.restore(snapshot);
  expect(collision.visible(new T.Vector3(1, 1, -1), new T.Vector3(-1, 1, -1))).toBe(true);
});

test("server matches fork door-only maps, accept T use and reset independent room/late-join poses", () => {
  const { definition, physics, collision } = fixture();
  const map = { ...testMap(), collision, doorDefinitions: [definition], doorPhysics: physics };
  const a = createMatch("casual", map),
    b = createMatch("casual", map);
  expect(a.map.collision).not.toBe(b.map.collision);
  expect(a.map.collision).not.toBe(map.collision);
  const player = createPlayer("t", "T", "t");
  joinMatch(a, player);
  a.state.phase = "live";
  Object.assign(player, { x: 1, y: 0, z: 1, yaw: 0, pitch: 0, eye: 1.6, grounded: true });
  stepMatch(a, new Map([[player.id, { ...neutralInput(1), interact: true }]]));
  expect(a.state.doors?.[0].target).toBe(90);
  expect(b.state.doors?.[0].target).toBe(0);
  for (let i = 0; i < 64; i++) stepMatch(a, new Map());
  expect(a.state.doors?.[0].angle).toBeGreaterThan(80);
  const late = createMatch("casual", map);
  late.doors.restore(structuredClone(a.state.doors!));
  expect(late.map.collision.visible(from, new T.Vector3(1, 1, -1))).toBe(true);
  startRound(a);
  expect(a.state.doors?.[0].angle).toBe(0);
  expect(b.state.doors?.[0].angle).toBe(0);
});

test("generic E cannot begin planting during the C4 draw or toggle a door through an objective use", () => {
  const { definition, physics, mesh } = fixture();
  const floor = new T.Mesh(new T.PlaneGeometry(40, 40).rotateX(-Math.PI / 2));
  const map = {
    ...testMap(),
    collision: new MapCollision([floor, mesh]),
    doorDefinitions: [definition],
    doorPhysics: physics,
    spawns: { ct: [[10, 0, 1]], t: [[1, 0, 1]] },
    triggers: { zones: [], sites: [{ site: 0, hulls: [{ min: [-5, -1, -5], max: [5, 3, 5] }] }] },
  };
  const match = createMatch("casual", map),
    player = createPlayer("t", "T", "t"),
    ct = createPlayer("ct", "CT", "ct");
  joinMatch(match, player);
  joinMatch(match, ct);
  match.state.phase = "live";
  match.state.bomb.carrier = player.id;
  for (let i = 0; i < 160; i++)
    stepMatch(match, new Map([[player.id, { ...neutralInput(i + 1), interact: true }]]));
  expect(match.state.bomb.plantProgress).toBe(0);
  expect(match.doors.states[0].target).toBe(0);
  stepMatch(match, new Map([[player.id, { ...neutralInput(161), interact: true, use: true }]]));
  expect(match.state.bomb.plantProgress).toBe(STEP);
});

function damageFixture(destroyOnZero = false) {
  // Synthetic thresholds/holes exercise the transport; these are not native
  // CS2 health thresholds or replacement geometry for imported map doors.
  const base = new T.Mesh(new T.BoxGeometry(2, 2.4, 0.12).translate(1, 1.2, 0));
  base.name = "base";
  const frame = [
    new T.Mesh(new T.BoxGeometry(0.3, 2.4, 0.12).translate(0.15, 1.2, 0)),
    new T.Mesh(new T.BoxGeometry(0.3, 2.4, 0.12).translate(1.85, 1.2, 0)),
    new T.Mesh(new T.BoxGeometry(1.4, 0.3, 0.12).translate(1, 0.15, 0)),
    new T.Mesh(new T.BoxGeometry(1.4, 0.3, 0.12).translate(1, 2.25, 0)),
  ];
  const hinge = new T.Mesh(new T.BoxGeometry(0.15, 2.4, 0.12).translate(0.075, 1.2, 0));
  [base, ...frame, hinge].forEach((m) => m.updateMatrixWorld(true));
  const definition: NativeDoorDefinition = {
    id: "damage",
    pivot: [0, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 180,
    returnDelay: -1,
    renderNames: ["base"],
    physicsNames: ["base"],
    damage: {
      health: 100,
      destroyOnZero,
      damageMultipliers: { bullet: 1, melee: 1.25, explosion: 1.5 },
      stages: [
        { belowHealth: 100, renderNames: ["frame"], physicsNames: ["frame"] },
        {
          belowHealth: 25,
          inclusive: true,
          renderNames: ["hinge"],
          physicsNames: ["hinge"],
          damageMultipliers: { bullet: 0 },
        },
      ],
    },
  };
  const physics = [{ id: definition.id, meshes: [base], stages: [frame, [hinge]] }];
  const collision = new MapCollision([base]);
  const world = new DoorWorld(collision, [definition], physics);
  return { world, collision, definition, physics };
}

test("interaction range follows damaged remnants, terminal destruction and restored stages", () => {
  for (const destroy of [false, true]) {
    const { world, collision } = damageFixture(destroy);
    const intersections = vi.spyOn(collision, "intersections");
    const side = new T.Vector3(3, 1, 0),
      toward = new T.Vector3(-1, 0, 0),
      hinge = new T.Vector3(0.075, 1, 1);
    expect(world.target(side, toward)).toBe("damage");
    const intact = structuredClone(world.states);
    world.damage("damage", 100, "explosion");
    intersections.mockClear();
    // The old intact leaf was in range; the surviving hinge is not.
    expect(world.target(side, toward)).toBeUndefined();
    expect(intersections).not.toHaveBeenCalled();
    expect(world.target(hinge, direction)).toBe(destroy ? undefined : "damage");
    expect(intersections).toHaveBeenCalledTimes(destroy ? 0 : 1);
    world.restore(intact);
    expect(world.target(side, toward)).toBe("damage");
    world.damage("damage", 1, "bullet");
    // A hole in a nearby damaged frame still needs exact triangle occlusion.
    expect(world.target(from, direction)).toBeUndefined();
    world.reset();
    expect(world.target(from, direction)).toBe("damage");
  }
});

test("authored damage stages swap exact holed collision without losing hinge motion or terminal residue", () => {
  const { world, collision } = damageFixture();
  const ray = new T.Ray(new T.Vector3(1, 1, 1), new T.Vector3(0, 0, -1));
  expect(collision.intersections(ray, 2).length).toBeGreaterThan(0);
  expect(world.damage("damage", 1, "bullet")).toMatchObject({
    health: 99,
    stage: 1,
    stageChanged: true,
  });
  expect(collision.intersections(ray, 2)).toHaveLength(0);
  expect(collision.blocked(0.15, 0.07, 0, 0.05, 1.5)).toBe(true);
  world.use("player", true, new T.Vector3(0.15, 1, 1), new T.Vector3(0, 0, -1));
  advance(world, 0.6);
  expect(world.states[0].angle).toBeCloseTo(90);
  expect(
    collision.intersections(new T.Ray(new T.Vector3(1, 1, -1), new T.Vector3(-1, 0, 0)), 2),
  ).toHaveLength(0);
  expect(world.damage("damage", 74, "bullet")).toMatchObject({ health: 25, stage: 2 });
  expect(world.damage("damage", 10, "bullet")).toBeUndefined();
  expect(world.damage("damage", 10, "melee")).toMatchObject({ health: 12.5, stage: 2 });
  expect(world.damage("damage", 100, "explosion")).toMatchObject({ health: 0, stage: 2 });
  expect(collision.blocked(0.08, -0.075, 0, 0.05, 1.5)).toBe(true);
  world.reset();
  expect(world.states[0]).toMatchObject({ health: 100, stage: 0, angle: 0 });
  expect(collision.intersections(ray, 2).length).toBeGreaterThan(0);
});

test("damage stages restore atomically for late joins, reject inconsistent state and retain room isolation", () => {
  const { world, collision, definition, physics } = damageFixture();
  const otherCollision = collision.fork(),
    other = new DoorWorld(otherCollision, [definition], physics);
  world.damage("damage", 1, "bullet");
  expect(other.states[0]).toMatchObject({ health: 100, stage: 0 });
  const ray = new T.Ray(new T.Vector3(1, 1, 1), new T.Vector3(0, 0, -1));
  expect(collision.intersections(ray, 2)).toHaveLength(0);
  expect(otherCollision.intersections(ray, 2).length).toBeGreaterThan(0);
  other.restore(world.states.map((state) => ({ ...state })));
  expect(other.states[0]).toMatchObject({ health: 99, stage: 1 });
  expect(otherCollision.intersections(ray, 2)).toHaveLength(0);
  other.restore([{ ...world.states[0], health: 99, stage: 0 }]);
  expect(other.states[0]).toMatchObject({ health: 100, stage: 0 });
  expect(otherCollision.intersections(ray, 2).length).toBeGreaterThan(0);
  expect(
    () =>
      new DoorWorld(
        collision.fork(),
        [definition],
        [{ id: definition.id, meshes: physics[0].meshes }],
      ),
  ).toThrow("evidence incomplete");
});

test("moving door template detachment preserves inherited native player collision exclusions", () => {
  const root = new T.Group(),
    owner = new T.Group();
  root.add(owner);
  owner.userData.nativeCollisionAttributes = {
    m_InteractExcludeStrings: ["player"],
    m_InteractAsStrings: ["world"],
  };
  const leaf = new T.Mesh(new T.BoxGeometry(2, 2, 0.1).translate(1, 1, 0));
  leaf.name = "excluded-door";
  owner.add(leaf);
  const definition: NativeDoorDefinition = {
    id: "excluded",
    pivot: [0, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 180,
    returnDelay: -1,
    physicsNames: [leaf.name],
    renderNames: ["render"],
  };
  const templates = bindDoorPhysics(root, [definition]);
  expect(
    templates[0].meshes[0].userData.nativeCollisionAttributes.m_InteractExcludeStrings,
  ).toEqual(["player"]);
  const collision = new MapCollision([leaf]),
    world = new DoorWorld(collision, [definition], templates);
  const ray = new T.Ray(new T.Vector3(1, 1, 1), new T.Vector3(0, 0, -1));
  expect(collision.intersections(ray, 2).length).toBeGreaterThan(0);
  expect(collision.blocked(1, 0.07, 0, 0.3, 1.65)).toBe(false);
  world.use("player", true, new T.Vector3(0.1, 1, 1), new T.Vector3(0, 0, -1));
  advance(world, 0.6);
  expect(world.states[0].angle).toBeCloseTo(90);
  expect(
    collision.intersections(new T.Ray(new T.Vector3(1, 1, -1), new T.Vector3(-1, 0, 0)), 2).length,
  ).toBeGreaterThan(0);
  expect(collision.blocked(0.07, -1, 0, 0.3, 1.65)).toBe(false);
});

test("radial door damage measures actual hole surfaces, honors cover and can explicitly bypass occlusion", () => {
  const { world, collision } = damageFixture();
  world.damage("damage", 1, "bullet");
  let sampled = -1;
  expect(world.damageRadius(new T.Vector3(1, 1.2, 0.1), 0.2, () => 100, "explosion")).toEqual([]);
  const changes = world.damageRadius(
    new T.Vector3(1, 1.2, 0.1),
    1,
    (distance) => {
      sampled = distance;
      return 5;
    },
    "explosion",
  );
  expect(sampled).toBeGreaterThan(0.69);
  expect(changes[0]).toMatchObject({ health: 91.5, stage: 1 });
  world.reset();
  const cover = new T.Mesh(new T.BoxGeometry(2, 3, 0.1).translate(1, 1.5, 0.5));
  cover.updateMatrixWorld(true);
  collision.setDynamicMeshes("cover", [cover]);
  expect(world.damageRadius(new T.Vector3(1, 1, 1), 3, () => 20, "explosion")).toEqual([]);
  expect(world.states[0].health).toBe(100);
  expect(
    world.damageRadius(new T.Vector3(1, 1, 1), 3, () => 20, "explosion", false)[0],
  ).toMatchObject({ health: 70, stage: 1 });
  expect(world.damageRadius(new T.Vector3(1, 1, 1), 3, () => 20, "fire", false)).toEqual([]);
  expect(
    world.damageRadius(new T.Vector3(1, 1, 1), Infinity, () => 20, "explosion", false)[0],
  ).toMatchObject({ health: 40 });
  expect(world.damageRadius(new T.Vector3(1, 1, 1), NaN, () => 20, "explosion", false)).toEqual([]);
});

test("one radial event snapshots all door occlusion before creating new holes", () => {
  const source = damageFixture(),
    front = source.physics[0];
  const shifted = (mesh: T.Mesh) => {
    const clone = mesh.clone(false);
    clone.matrixAutoUpdate = false;
    clone.matrix.makeTranslation(0, 0, -1).multiply(mesh.matrixWorld);
    clone.matrixWorld.copy(clone.matrix);
    return clone;
  };
  const back = {
    id: "back",
    meshes: front.meshes.map(shifted),
    stages: front.stages!.map((stage) => stage.map(shifted)),
  };
  back.meshes[0].name = "back-base";
  const definition = {
    ...source.definition,
    id: "back",
    pivot: [0, 0, -1] as const,
    physicsNames: ["back-base"],
  };
  const collision = new MapCollision([...front.meshes, ...back.meshes]);
  const world = new DoorWorld(collision, [source.definition, definition], [front, back]);
  const first = world.damageRadius(new T.Vector3(1, 1, 1), 4, () => 20, "explosion");
  expect(first.map((c) => c.id)).toEqual(["damage"]);
  expect(world.states.find((s) => s.id === "back")!.health).toBe(100);
  const second = world.damageRadius(new T.Vector3(1, 1, 1), 4, () => 20, "explosion");
  expect(second.map((c) => c.id)).toContain("back");
  const impact = collision.intersections(
    new T.Ray(new T.Vector3(0.1, 1, 1), new T.Vector3(0, 0, -1)),
    4,
  )[0];
  expect(world.idForImpact(impact)).toBe("damage");
  expect(world.damageImpact(impact, 1, "bullet")).toMatchObject({ id: "damage" });
});

test("sidecar stage binding owns every replacement and removes inactive stages from static collision", () => {
  const { definition, physics } = damageFixture();
  const root = new T.Group();
  const base = physics[0].meshes[0].clone();
  base.name = "base";
  const frame = new T.Group();
  frame.name = "frame";
  frame.userData.nativeCollisionAttributes = { m_InteractExcludeStrings: ["player"] };
  frame.add(...physics[0].stages![0].map((mesh) => mesh.clone()));
  const hinge = physics[0].stages![1][0].clone();
  hinge.name = "hinge";
  root.position.set(4, 0, 0);
  root.add(base, frame, hinge);
  const templates = bindDoorPhysics(root, [definition]);
  expect(templates[0].stages?.map((parts) => parts.length)).toEqual([4, 1]);
  const meshes: T.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof T.Mesh) {
      meshes.push(object);
      expect(object.userData.nativeDoorId).toBe(definition.id);
      expect(object.userData.nativePhysicsName).toBeTruthy();
    }
  });
  expect(templates[0].stages![0][0].userData.nativeCollisionAttributes).toEqual(
    frame.userData.nativeCollisionAttributes,
  );
  expect(templates[0].meshes[0].matrixWorld.elements[12]).toBe(4);
  const collision = new MapCollision(meshes);
  const world = new DoorWorld(collision, [definition], templates);
  const a = new T.Vector3(5, 1, 1),
    b = new T.Vector3(5, 1, -1);
  expect(collision.visible(a, b)).toBe(false);
  world.damage(definition.id, 1, "bullet");
  expect(collision.visible(a, b)).toBe(true);
  // The earlier frame must also disappear from static CSR at the terminal
  // replacement; only the authored hinge strip remains, never all stages.
  world.damage(definition.id, 74, "bullet");
  expect(collision.visible(new T.Vector3(5.85, 1, 1), new T.Vector3(5.85, 1, -1))).toBe(true);
  expect(collision.visible(new T.Vector3(4.075, 1, 1), new T.Vector3(4.075, 1, -1))).toBe(false);
  world.reset();
  expect(collision.visible(a, b)).toBe(false);
  expect(() =>
    bindDoorPhysics(root, [
      {
        ...definition,
        damage: {
          ...definition.damage!,
          stages: [{ ...definition.damage!.stages[0], physicsNames: ["absent"] }],
        },
      },
    ]),
  ).toThrow("Native door physics missing");
});

test("explicit terminal destruction removes the last physical remnant, stays inert on late join and resets", () => {
  const { world, collision, definition } = damageFixture(true);
  world.damage(definition.id, 75, "bullet");
  expect(world.states[0]).toMatchObject({ health: 25, stage: 2 });
  const hingeA = new T.Vector3(0.075, 1, 1),
    hingeB = new T.Vector3(0.075, 1, -1);
  expect(collision.visible(hingeA, hingeB)).toBe(false);
  const change = world.damage(definition.id, 100, "explosion");
  expect(change).toMatchObject({ health: 0, stage: 2, stageChanged: false, destroyed: true });
  expect(collision.visible(hingeA, hingeB)).toBe(true);
  expect(world.target(hingeA, direction)).toBeUndefined();
  expect(world.use("actor", true, hingeA, direction)).toBe(false);
  expect(world.openAhead(hingeA, direction)).toBe(false);
  expect(world.step(1)).toBe(false);
  expect(world.states[0].target).toBe(world.states[0].angle);
  const late = damageFixture(true);
  late.world.restore(world.states.map((state) => ({ ...state })));
  expect(late.collision.visible(hingeA, hingeB)).toBe(true);
  late.world.reset();
  expect(late.collision.visible(hingeA, hingeB)).toBe(false);
  // Health reaching zero alone never removes a map's unverified remnant.
  const preserved = damageFixture();
  preserved.world.damage(preserved.definition.id, 1000, "explosion");
  expect(preserved.collision.visible(hingeA, hingeB)).toBe(false);
});
