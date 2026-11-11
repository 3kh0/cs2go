import { expect, test, vi } from "vitest";
import * as T from "three";
import type { Game } from "./game";
import { GameUtility } from "./game-utility";
import { MapCollision } from "./map-collision";

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
