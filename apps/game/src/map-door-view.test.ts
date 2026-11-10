import { expect, test } from "vitest";
import * as T from "three";
import { NativeMapDoorView } from "./map-door-view";
import type { NativeDoorDefinition } from "@cs2go/simulation/doors";

test("door view rotates the exact leaf hierarchy about its world hinge while its frame stays static", () => {
  const root = new T.Group(),
    parent = new T.Group();
  parent.position.x = 10;
  root.add(parent);
  const leaf = new T.Group();
  leaf.name = "leaf";
  const panel = new T.Mesh(new T.BoxGeometry(2, 2, 0.1).translate(1, 1, 0));
  leaf.add(panel);
  parent.add(leaf);
  const frame = new T.Mesh(new T.BoxGeometry(0.1, 3, 0.1));
  frame.position.set(0, 1.5, 0);
  parent.add(frame);
  root.updateMatrixWorld(true);
  const originalFrame = frame.matrixWorld.clone();
  root.traverse((object) => {
    object.matrixAutoUpdate = object.matrixWorldAutoUpdate = false;
  });
  const definition: NativeDoorDefinition = {
    id: "door",
    pivot: [10, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 180,
    returnDelay: -1,
    physicsNames: ["physics"],
    renderNames: ["leaf"],
  };
  const view = new NativeMapDoorView(root, [definition]);
  expect(view.sync([{ id: "door", angle: 90, target: 90, returnTime: -1 }])).toBe(true);
  const point = new T.Vector3(1, 1, 0).applyMatrix4(panel.matrixWorld);
  expect(point.x).toBeCloseTo(10);
  expect(point.y).toBeCloseTo(1);
  expect(point.z).toBeCloseTo(-1);
  expect(frame.matrixWorld.equals(originalFrame)).toBe(true);
  expect(panel.userData.sourceSunDynamic).toBe(true);
  expect(panel.matrixWorldAutoUpdate).toBe(true);
  expect(view.sync([{ id: "door", angle: 90, target: 90, returnTime: -1 }])).toBe(false);
  view.sync([{ id: "door", angle: 0, target: 0, returnTime: -1 }]);
  expect(new T.Vector3(1, 1, 0).applyMatrix4(panel.matrixWorld).x).toBeCloseTo(11);
});

test("missing authored render bindings fail instead of silently leaving a static or invisible door", () => {
  const definition: NativeDoorDefinition = {
    id: "door",
    pivot: [0, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 180,
    returnDelay: -1,
    physicsNames: ["physics"],
    renderNames: ["missing"],
  };
  expect(() => new NativeMapDoorView(new T.Group(), [definition])).toThrow("render leaf missing");
});

test("authored damage geometry replaces only the leaf and follows the same hinge through reset", () => {
  const root = new T.Group();
  root.position.x = 4;
  const leaf = new T.Mesh(new T.BoxGeometry(2, 2, 0.1).translate(1, 1, 0));
  leaf.name = "base";
  const residue = new T.Mesh(new T.BoxGeometry(0.2, 2, 0.1).translate(0.1, 1, 0));
  residue.name = "stage1";
  const frame = new T.Mesh(new T.BoxGeometry(0.1, 2.5, 0.1));
  root.add(leaf, residue, frame);
  root.updateMatrixWorld(true);
  const originalFrame = frame.matrixWorld.clone();
  const definition: NativeDoorDefinition = {
    id: "damage",
    pivot: [4, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 180,
    returnDelay: -1,
    physicsNames: ["base"],
    renderNames: ["base"],
    damage: {
      health: 100,
      damageMultipliers: { bullet: 1 },
      stages: [{ belowHealth: 100, renderNames: ["stage1"], physicsNames: ["stage1"] }],
    },
  };
  const view = new NativeMapDoorView(root, [definition]);
  expect(leaf.visible).toBe(true);
  expect(residue.visible).toBe(false);
  view.sync([{ id: "damage", angle: 90, target: 90, returnTime: -1, health: 99, stage: 1 }]);
  expect(leaf.visible).toBe(false);
  expect(residue.visible).toBe(true);
  expect(
    new T.Vector3(0.1, 1, 0)
      .applyMatrix4(residue.matrixWorld)
      .distanceTo(new T.Vector3(4, 1, -0.1)),
  ).toBeLessThan(1e-6);
  expect(frame.matrixWorld.equals(originalFrame)).toBe(true);
  view.sync([{ id: "damage", angle: 0, target: 0, returnTime: -1, health: 100, stage: 0 }]);
  expect(leaf.visible).toBe(true);
  expect(residue.visible).toBe(false);
  expect(new T.Vector3(1, 1, 0).applyMatrix4(leaf.matrixWorld).x).toBeCloseTo(5);
  expect(
    () =>
      new NativeMapDoorView(root, [
        {
          ...definition,
          damage: {
            ...definition.damage!,
            stages: [
              { belowHealth: 100, renderNames: ["missing-stage"], physicsNames: ["missing-stage"] },
            ],
          },
        },
      ]),
  ).toThrow("render leaf missing");
});

test("terminal visibility changes independently of unchanged stage and hinge angle, including late join and reset", () => {
  const root = new T.Group();
  const base = new T.Mesh(new T.BoxGeometry(2, 2, 0.1));
  base.name = "base";
  const residue = new T.Mesh(new T.BoxGeometry(0.1, 2, 0.1));
  residue.name = "residue";
  root.add(base, residue);
  const definition: NativeDoorDefinition = {
    id: "terminal",
    pivot: [0, 0, 0],
    axis: [0, 1, 0],
    distance: 90,
    speed: 100,
    returnDelay: -1,
    renderNames: ["base"],
    physicsNames: ["base"],
    damage: {
      health: 100,
      destroyOnZero: true,
      damageMultipliers: { explosion: 1 },
      stages: [{ belowHealth: 100, renderNames: ["residue"], physicsNames: ["residue"] }],
    },
  };
  const view = new NativeMapDoorView(root, [definition]);
  const state = { id: definition.id, angle: 30, target: 30, returnTime: -1, health: 1, stage: 1 };
  expect(view.sync([state])).toBe(true);
  expect(residue.visible).toBe(true);
  expect(view.sync([{ ...state, health: 0 }])).toBe(true);
  expect(residue.visible).toBe(false);
  expect(base.visible).toBe(false);
  expect(view.sync([{ ...state, health: 0 }])).toBe(false);
  const late = new NativeMapDoorView(root, [definition]);
  late.sync([{ ...state, health: 0 }]);
  expect(base.visible || residue.visible).toBe(false);
  expect(late.sync([{ ...state, health: 100, stage: 0, angle: 0, target: 0 }])).toBe(true);
  expect(base.visible).toBe(true);
  expect(residue.visible).toBe(false);
});
