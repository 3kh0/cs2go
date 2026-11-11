import { expect, test, vi } from "vitest";
import * as T from "three";
import { GameInventory } from "./game-inventory";
import { createWeaponInstance } from "./weapon-instance";

function inventory() {
  const game = {
    active: true,
    dead: 0,
    health: 100,
    mode: "casual",
    primary: 1,
    secondary: 2,
    position: new T.Vector3(),
    visible: vi.fn(() => true),
    suppressors: [{ attached: false, cancel: vi.fn() }],
    equip: vi.fn(),
    magazines: [{}],
    updateUI: vi.fn(),
    bots: [],
    world: {},
    bomb: { defuser: "player" },
    armor: 100,
    helmet: true,
  };
  const value = Object.assign(Object.create(GameInventory.prototype), {
    game,
    drops: [],
    instances: new Map(),
    receipts: new Map(),
    equipmentReceipts: [],
    sidearmDropped: false,
    playerAlive: true,
    clock: 0,
  }) as GameInventory;
  const drop = vi.spyOn(value, "drop").mockReturnValue(true);
  return { value, game, drop };
}

function dropped(id = 0): GameInventory["drops"][number] {
  return {
    id,
    instance: createWeaponInstance(id, "bot:0"),
    ammo: 12,
    reserve: 34,
    mesh: new T.Group(),
    velocity: new T.Vector3(),
    tossed: false,
    age: 2,
    sleeping: true,
    owner: 0,
    suppressed: true,
  };
}

test("automatic pickup skips visibility checks for occupied primary and sidearm slots", () => {
  const { value, game } = inventory();
  value.drops.push(dropped(), dropped(2));
  expect(value.pickup()).toBe(false);
  expect(game.visible).not.toHaveBeenCalled();
  expect(value.drops).toHaveLength(2);
});

test("manual pickup still replaces an occupied slot using the first visible drop", () => {
  const { value, game, drop } = inventory();
  const first = dropped();
  const second = dropped();
  value.drops.push(first, second);
  expect(value.pickup(true)).toBe(true);
  expect(game.visible).toHaveBeenCalledTimes(1);
  expect(drop).toHaveBeenCalledWith(1);
  expect(game.equip).toHaveBeenCalledWith(first.id);
  expect(value.instances.get(first.id)).toBe(first.instance);
  expect(game.magazines[first.id]).toEqual({ ammo: 12, reserve: 34 });
  expect(value.drops).toEqual([second]);
});

test("defusing removes kit receipts once while preserving armor refund receipts", () => {
  const { value } = inventory();
  const state = { armor: 100, helmet: true, kit: true };
  const armor = { kind: "helmet" as const, price: 1000, before: state, after: state };
  value.equipmentReceipts = [armor, { kind: "kit", price: 400, before: state, after: state }];
  value.update(1 / 128);
  expect(value.equipmentReceipts).toEqual([armor]);
  const remaining = value.equipmentReceipts;
  value.update(1 / 128);
  expect(value.equipmentReceipts).toBe(remaining);
  value.invalidateEquipment();
  expect(value.equipmentReceipts).toEqual([]);
  const kit = { kind: "kit" as const, price: 400, before: state, after: state };
  value.equipmentReceipts = [armor, kit];
  value.invalidateEquipment();
  expect(value.equipmentReceipts).toEqual([kit]);
});
