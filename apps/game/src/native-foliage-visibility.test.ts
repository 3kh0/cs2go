import { expect, it } from "vitest";
import * as T from "three";
import { MapCollision } from "@cs2go/simulation/map-collision";
import { NativeMapBreakableView, type NativeBreakableManifest } from "./map-breakable-view";
import {
  bindNativeFoliageVisibility,
  type NativeFoliageVisibilitySource,
} from "./native-foliage-visibility";
function fixture() {
  const scene = new T.Group(),
    scenery = new T.Group(),
    replacement = new T.Group();
  scene.add(scenery);
  scenery.add(replacement);
  const shared = new T.MeshStandardMaterial();
  shared.userData.nativeGltfMaterialIndex = 893;
  const mesh = (name: string, index: number, material?: T.MeshStandardMaterial) => {
    const m = material ?? new T.MeshStandardMaterial();
    if (!material) m.userData.nativeGltfMaterialIndex = index;
    const node = new T.Mesh(new T.BoxGeometry(1, 1, 1), m);
    node.name = name;
    return node;
  };
  const pot = mesh("pot", 893, shared),
    leaf = mesh("leaf", 893, shared),
    staticLeaf = mesh("static-leaf", 197),
    oldRemainder = mesh("old-remainder", 197),
    newLeaf = mesh("new-leaf", 197),
    newRemainder = mesh("new-remainder", 197),
    unrelatedPiece = mesh("piece-template", 197);
  scenery.add(pot, leaf, staticLeaf, oldRemainder, unrelatedPiece);
  replacement.add(newLeaf, newRemainder);
  const manifest: NativeBreakableManifest = {
    version: 1,
    mapId: "synthetic",
    breakables: [
      {
        id: "planter",
        health: 1,
        material: "concrete",
        bounds: [
          [0, 0, 0],
          [1, 1, 1],
        ],
        renderNames: ["pot", "leaf"],
        physicsNames: ["original-physics"],
        onBreakEnable: ["rem"],
      },
    ],
    enabledRemainders: [
      { id: "rem", renderNames: ["old-remainder"], physicsNames: ["remainder-physics"] },
    ],
  };
  const source: NativeFoliageVisibilitySource = {
    originalMainMaterialIndices: [197],
    visibilityLinks: [
      { ownerId: "planter", originalRenderName: "leaf", sidecarRenderNames: ["new-leaf"] },
      {
        ownerId: "rem",
        originalRenderName: "old-remainder",
        sidecarRenderNames: ["new-remainder"],
      },
    ],
  };
  return {
    scene,
    scenery,
    replacement,
    pot,
    leaf,
    staticLeaf,
    oldRemainder,
    newLeaf,
    newRemainder,
    unrelatedPiece,
    manifest,
    source,
    originals: [pot, leaf, staticLeaf, oldRemainder],
  };
}
it("replaces view bindings across break/reset without resurrecting originals or changing shared pot material/physics", () => {
  const f = fixture(),
    before = JSON.stringify(f.manifest);
  const binding = bindNativeFoliageVisibility(f.originals, f.replacement, f.source, f.manifest);
  expect(binding.manifest).not.toBe(f.manifest);
  expect(JSON.stringify(f.manifest)).toBe(before);
  expect(binding.manifest!.breakables[0].renderNames).toEqual(["pot", "new-leaf"]);
  expect(binding.manifest!.breakables[0].physicsNames).toEqual(["original-physics"]);
  expect(f.unrelatedPiece.visible).toBe(true);
  expect(f.pot.visible).toBe(true);
  expect(f.pot.material).toBe(f.leaf.material);
  expect(f.pot.material.userData.nativeGltfMaterialIndex).toBe(893);
  const view = new NativeMapBreakableView(
    f.scene,
    f.scenery,
    binding.manifest!,
    new MapCollision([]),
  );
  view.sync([{ id: "planter", health: 0 }]);
  expect(f.newLeaf.visible).toBe(false);
  expect(f.newRemainder.visible).toBe(true);
  expect(f.oldRemainder.visible).toBe(false);
  view.sync([{ id: "planter", health: 1 }]);
  expect(f.newLeaf.visible).toBe(true);
  expect(f.newRemainder.visible).toBe(false);
  expect(f.leaf.visible).toBe(false);
  expect(f.staticLeaf.visible).toBe(false);
  expect(f.pot.visible).toBe(true);
  expect(JSON.stringify(f.manifest)).toBe(before);
  f.leaf.visible = true;
  binding.hideOriginals();
  expect(f.leaf.visible).toBe(false);
  expect(f.pot.visible).toBe(true);
});
it("rejects missing replacement and mixed-material admission atomically", () => {
  const f = fixture();
  const source = {
    ...f.source,
    visibilityLinks: [
      { ownerId: "planter", originalRenderName: "leaf", sidecarRenderNames: ["missing"] },
    ],
  };
  expect(() => bindNativeFoliageVisibility(f.originals, f.replacement, source, f.manifest)).toThrow(
    /replacement missing/,
  );
  expect(f.staticLeaf.visible).toBe(true);
  expect(f.leaf.visible).toBe(true);
  const selected = new T.MeshStandardMaterial(),
    other = new T.MeshStandardMaterial();
  selected.userData.nativeGltfMaterialIndex = 197;
  other.userData.nativeGltfMaterialIndex = 893;
  const mixed = new T.Mesh(new T.BoxGeometry(), [selected, other]);
  expect(() => bindNativeFoliageVisibility([mixed], f.replacement, f.source, f.manifest)).toThrow(
    /Mixed admitted/,
  );
  expect(mixed.visible).toBe(true);
});
