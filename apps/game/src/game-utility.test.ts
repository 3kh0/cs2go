import { expect, test, vi } from "vitest";
import * as T from "three";
import type { Game } from "./game";
import { GameUtility } from "./game-utility";
import { MapCollision } from "./map-collision";
import { SMOKE_CELL_RADIUS, smokeCellDensity } from "./smoke-renderer";
import { segmentNearSphere } from "./utility";

test("utility preparation retains detached shader roots without creating gameplay effects", async () => {
  const game = {
    mode: "casual",
    scene: new T.Scene(),
    visible: vi.fn(),
    world: { collision: { floor: vi.fn() } },
    soundscape: { play: vi.fn() },
    damageActor: vi.fn(),
  };
  const utility = new GameUtility(game as unknown as Game);
  utility.inventory.smoke = 1;
  const sharedDispose = vi.spyOn(utility.sphere, "dispose");
  const roots = utility.preparationRoots();
  const prepareClouds = vi.spyOn(utility.smokeComposite, "prepareClouds").mockResolvedValue();
  const materials = roots.map((root) => (root as T.Mesh).material as T.Material);
  const disposals = materials.map((material) => vi.spyOn(material, "dispose"));
  try {
    expect(roots).toHaveLength(4);
    expect(new Set(materials).size).toBe(4);
    expect(utility.preparationRoots()).toBe(roots);
    const renderer = {} as T.WebGLRenderer;
    const camera = new T.PerspectiveCamera();
    const signal = new AbortController().signal;
    const scope = vi.fn((work: () => void) => work());
    await utility.prepareSmokeShader(renderer, camera, signal, scope);
    expect(prepareClouds).toHaveBeenCalledWith(renderer, [roots[0]], camera, signal, scope);
    expect(roots.every((root) => root.parent === null)).toBe(true);
    expect(game.scene.children).toHaveLength(0);
    expect(utility.effects).toHaveLength(0);
    expect(utility.projectiles).toHaveLength(0);
    expect(utility.inventory.smoke).toBe(1);
    expect(game.visible).not.toHaveBeenCalled();
    expect(game.world.collision.floor).not.toHaveBeenCalled();
    expect(game.soundscape.play).not.toHaveBeenCalled();
    expect(game.damageActor).not.toHaveBeenCalled();
    utility.reset();
    expect(utility.preparationRoots()).toBe(roots);
    for (const dispose of disposals) expect(dispose).not.toHaveBeenCalled();
    expect(sharedDispose).not.toHaveBeenCalled();
  } finally {
    for (const root of roots) {
      const mesh = root as T.InstancedMesh;
      mesh.dispose();
      mesh.geometry.dispose();
      (mesh.material as T.Material).dispose();
    }
    utility.sphere.dispose();
    utility.cylinder.dispose();
  }
});

test("deathmatch skips utility preparation and retains existing roots across mode changes", async () => {
  const game = { mode: "deathmatch" };
  const utility = new GameUtility(game as unknown as Game);
  const prepareClouds = vi.spyOn(utility.smokeComposite, "prepareClouds").mockResolvedValue();
  expect(utility.preparationRoots()).toHaveLength(0);
  await utility.prepareSmokeShader({} as T.WebGLRenderer, new T.PerspectiveCamera());
  expect(prepareClouds).not.toHaveBeenCalled();
  game.mode = "practice";
  const roots = utility.preparationRoots();
  game.mode = "deathmatch";
  expect(utility.preparationRoots()).toHaveLength(0);
  game.mode = "casual";
  expect(utility.preparationRoots()).toBe(roots);
  for (const root of roots) {
    const mesh = root as T.InstancedMesh;
    mesh.dispose();
    mesh.geometry.dispose();
    (mesh.material as T.Material).dispose();
  }
  utility.sphere.dispose();
  utility.cylinder.dispose();
});

function smokeFixture() {
  const crossing = vi.fn();
  const utility = new GameUtility({
    network: true,
    scene: new T.Scene(),
    world: { nativeWater: { crossing } },
    soundscape: { play: vi.fn() },
    // Asymmetric clipping exercises bounds derived from retained cells.
    visible: (from: T.Vector3, to: T.Vector3) => to.x >= from.x - 0.25,
  } as unknown as Game);
  for (const position of [new T.Vector3(17, 4, -12), new T.Vector3(23, 5, -12)])
    utility.detonate({
      kind: "smoke",
      owner: "player",
      team: "t",
      position,
      velocity: new T.Vector3(),
      age: 0,
      resting: true,
      mesh: new T.Group(),
      weapon: 0,
      lastBounce: 0,
    });
  const dispose = () => {
    for (const effect of utility.effects) utility.removeEffect(effect);
    utility.sphere.dispose();
    utility.cylinder.dispose();
  };
  const points = [
    new T.Vector3(-100, -100, -100),
    new T.Vector3(100, 100, 100),
    new T.Vector3(17, 4, -30),
    new T.Vector3(17, 4, 30),
  ];
  for (const effect of utility.effects)
    for (const cell of effect.cells.filter((_, i) => i % 13 === 0)) {
      points.push(cell.clone());
      for (const axis of ["x", "y", "z"] as const)
        for (const distance of [-SMOKE_CELL_RADIUS, SMOKE_CELL_RADIUS - 1e-8, SMOKE_CELL_RADIUS]) {
          const point = cell.clone();
          point[axis] += distance;
          points.push(point);
        }
    }
  return { utility, crossing, points, dispose };
}

test("smoke bounds preserve exhaustive sight queries across clipping, density and segment boundaries", () => {
  const { utility, points, dispose } = smokeFixture();
  try {
    utility.clock = 10;
    for (const effect of utility.effects)
      effect.holes = effect.cells.map((_, i) => [10.25, 9.895 - 1e-8, 9.895 + 1e-8, 0][i % 4]);
    // Retain the original exact cell predicate as an independent oracle.
    for (const age of [0.35 - 1e-8, 0.35, 0.35 + 1e-8, 20])
      for (const cleared of [2, 0, -0.105 + 1e-8, -0.105 - 1e-8, -1]) {
        for (const effect of utility.effects) {
          effect.age = age;
          effect.cleared = cleared;
        }
        for (const from of points)
          for (const to of points) {
            const expected = !utility.effects.some(
              (effect) =>
                effect.cleared <= 0 &&
                effect.age > 0.35 &&
                effect.cells.some(
                  (cell, i) =>
                    smokeCellDensity(utility.clock, effect.holes[i] ?? 0, effect.cleared) > 0.3 &&
                    segmentNearSphere(from, to, cell, SMOKE_CELL_RADIUS),
                ),
            );
            expect(utility.clearSight(from, to)).toBe(expected);
          }
      }
    // Effects supplied without bounds retain exhaustive behavior.
    for (const effect of utility.effects) effect.smokeBounds = undefined;
    const cell = utility.effects[0].cells[0];
    expect(utility.clearSight(cell, cell)).toBe(false);
  } finally {
    dispose();
  }
});

test("smoke bullets preserve every intersected hole and water crossing regardless of age or clearing", () => {
  const { utility, crossing, points, dispose } = smokeFixture();
  try {
    utility.clock = 10;
    for (const effect of utility.effects) {
      effect.age = 0;
      effect.cleared = 2;
    }
    let queries = 0;
    for (const from of points)
      for (const to of points) {
        for (const effect of utility.effects) effect.holes = effect.cells.map((_, i) => i / 10);
        const expected = utility.effects.map((effect) =>
          effect.cells.map((cell, i) =>
            segmentNearSphere(from, to, cell, SMOKE_CELL_RADIUS) ? 10.25 : effect.holes[i],
          ),
        );
        utility.bullet(from, to);
        queries++;
        expect(utility.effects.map((effect) => effect.holes)).toEqual(expected);
      }
    expect(crossing).toHaveBeenCalledTimes(queries);
    for (const effect of utility.effects) effect.smokeBounds = undefined;
    const cell = utility.effects[0].cells[0];
    utility.effects[0].holes[0] = 0;
    utility.bullet(cell, cell);
    expect(utility.effects[0].holes[0]).toBe(10.25);
  } finally {
    dispose();
  }
});

test.each(["molotov", "incendiary"] as const)(
  "%s traces only actors inside the flame footprint and still respects cover",
  (kind) => {
    const wall = new T.Mesh(new T.BoxGeometry(0.2, 3, 4));
    wall.name = "cover";
    wall.position.set(1, 1, 0);
    wall.updateMatrixWorld(true);
    const collision = new MapCollision([wall]);
    collision.setMeshEnabled("cover", false);
    const group = new T.Group();
    group.position.set(2, 0, 0);
    const bot = { group, health: 100, team: "ct", armor: 0, helmet: false };
    const game = {
      health: 100,
      position: new T.Vector3(100, 0, 0),
      bots: [bot],
      visible: vi.fn((from: T.Vector3, to: T.Vector3) => collision.visible(from, to)),
      recordDeathDamage: vi.fn(),
    };
    const utility = new GameUtility(game as unknown as Game);
    const effect: Parameters<GameUtility["areaDamage"]>[0] = {
      kind,
      owner: "player",
      team: "t",
      position: new T.Vector3(),
      cells: [new T.Vector3()],
      age: 0,
      mesh: new T.Group(),
      materials: [],
      holes: [],
      cleared: 0,
      pulse: 0,
      weapon: 0,
    };

    utility.areaDamage(effect, 10, 5);
    expect(game.visible).not.toHaveBeenCalled();
    expect(bot.health).toBe(100);

    effect.cells = [group.position.clone()];
    utility.areaDamage(effect, 10, 5);
    expect(game.visible).toHaveBeenCalledTimes(1);
    expect(bot.health).toBe(90);
    expect(game.recordDeathDamage).toHaveBeenCalledWith(bot, "player", 10);

    collision.setMeshEnabled("cover", true);
    utility.areaDamage(effect, 10, 5);
    expect(game.visible).toHaveBeenCalledTimes(2);
    expect(bot.health).toBe(90);

    effect.cells = [];
    utility.areaDamage(effect, 10, 5);
    expect(game.visible).toHaveBeenCalledTimes(2);
    expect(bot.health).toBe(90);
    utility.sphere.dispose();
    utility.cylinder.dispose();
    wall.geometry.dispose();
    (wall.material as T.Material).dispose();
  },
);
