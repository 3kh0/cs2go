import { expect, test, vi } from "vitest";
import * as T from "three";
import { retainImportedSceneryMatrices } from "./imported-scenery-matrices";
import { NativeMapDoorView } from "./map-door-view";

function fixture() {
  const scene = new T.Scene(),
    map = new T.Group(),
    scenery = new T.Group(),
    leaf = new T.Group(),
    sibling = new T.Group();
  scene.add(map);
  map.add(scenery, sibling);
  scenery.add(leaf);
  scene.updateMatrixWorld(true);
  scenery.traverse((object) => {
    object.matrixAutoUpdate = object.matrixWorldAutoUpdate = false;
  });
  return { scene, map, scenery, leaf, sibling };
}

test("ordinary forced scene updates skip admitted scenery while updating dynamic siblings", () => {
  const { scene, scenery, leaf, sibling } = fixture();
  const visit = vi.spyOn(leaf, "updateMatrixWorld");
  const restore = retainImportedSceneryMatrices(scenery);
  sibling.position.set(3, 4, 5);
  scene.updateMatrixWorld(true);
  scene.updateMatrixWorld();
  expect(visit).not.toHaveBeenCalled();
  expect(new T.Vector3().setFromMatrixPosition(sibling.matrixWorld).toArray()).toEqual([3, 4, 5]);
  restore();
  scene.updateMatrixWorld();
  expect(visit).toHaveBeenCalledTimes(1);
});

test("direct forced scenery updates retain Three behavior and leave the automatic shortcut", () => {
  const { scene, scenery, leaf } = fixture();
  leaf.matrixWorldAutoUpdate = true;
  const visit = vi.spyOn(leaf, "updateMatrixWorld");
  retainImportedSceneryMatrices(scenery);
  leaf.matrix.makeTranslation(7, 0, 0);
  scenery.updateMatrixWorld(true);
  expect(leaf.matrixWorld.elements[12]).toBe(7);
  scene.updateMatrixWorld();
  expect(visit).toHaveBeenCalledTimes(2);
});

test("parent motion falls back permanently with the original frozen-child semantics", () => {
  const { scene, map, scenery, leaf } = fixture();
  const visit = vi.spyOn(leaf, "updateMatrixWorld");
  retainImportedSceneryMatrices(scenery);
  map.position.x = 9;
  scene.updateMatrixWorld();
  expect(visit).toHaveBeenCalledTimes(1);
  expect(scenery.matrixWorld.elements[12]).toBe(0);
  expect(map.matrixWorld.elements[12]).toBe(9);
  map.position.x = 0;
  scene.updateMatrixWorld();
  expect(visit).toHaveBeenCalledTimes(2);
});

test("reparenting leaves the shortcut even when frozen world matrices remain unchanged", () => {
  const { scene, scenery, leaf } = fixture();
  const visit = vi.spyOn(leaf, "updateMatrixWorld");
  retainImportedSceneryMatrices(scenery);
  const replacement = new T.Group();
  replacement.position.x = 6;
  scene.add(replacement);
  replacement.add(scenery);
  scene.updateMatrixWorld();
  expect(visit).toHaveBeenCalledTimes(1);
  expect(scenery.matrixWorld.elements[12]).toBe(0);
});

test.each(["local", "world", "flags", "parent-flags"])(
  "changed %s boundary state leaves the shortcut permanently",
  (change) => {
    const { scene, map, scenery, leaf } = fixture();
    const visit = vi.spyOn(leaf, "updateMatrixWorld");
    retainImportedSceneryMatrices(scenery);
    if (change === "local") scenery.matrix.makeTranslation(2, 0, 0);
    if (change === "world") scenery.matrixWorld.makeTranslation(2, 0, 0);
    if (change === "flags") scenery.matrixWorldAutoUpdate = true;
    if (change === "parent-flags") map.matrixAutoUpdate = false;
    scene.updateMatrixWorld();
    scene.updateMatrixWorld();
    expect(visit).toHaveBeenCalledTimes(2);
  },
);

test("explicit door subtree updates preserve hinge motion, visibility and shadow hooks", () => {
  const { scene, scenery, leaf } = fixture();
  leaf.name = "door";
  const panel = new T.Mesh(new T.BoxGeometry(2, 2, 0.1));
  leaf.add(panel);
  panel.matrixAutoUpdate = panel.matrixWorldAutoUpdate = false;
  const view = new NativeMapDoorView(scenery, [
    {
      id: "door",
      pivot: [0, 0, 0],
      axis: [0, 1, 0],
      distance: 90,
      speed: 180,
      returnDelay: -1,
      physicsNames: ["physics"],
      renderNames: ["door"],
    },
  ]);
  const shadowHook = panel.onBeforeShadow;
  const visit = vi.spyOn(panel, "updateMatrixWorld");
  retainImportedSceneryMatrices(scenery);
  view.sync([{ id: "door", angle: 90, target: 90, returnTime: -1 }]);
  const expected = new T.Vector3(1, 0, 0).applyMatrix4(panel.matrixWorld);
  expect(expected.distanceTo(new T.Vector3(0, 0, -1))).toBeLessThan(1e-6);
  leaf.visible = false;
  scene.updateMatrixWorld();
  expect(visit).not.toHaveBeenCalled();
  expect(new T.Vector3(1, 0, 0).applyMatrix4(panel.matrixWorld).equals(expected)).toBe(true);
  expect(panel.onBeforeShadow).toBe(shadowHook);
  expect(leaf.visible).toBe(false);
});

test("unfrozen descendants are never admitted", () => {
  const { scene, scenery, leaf } = fixture();
  leaf.matrixAutoUpdate = leaf.matrixWorldAutoUpdate = true;
  retainImportedSceneryMatrices(scenery);
  leaf.position.x = 8;
  scene.updateMatrixWorld();
  expect(leaf.matrixWorld.elements[12]).toBe(8);
});
