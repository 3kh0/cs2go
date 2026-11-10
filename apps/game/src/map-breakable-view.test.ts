import { expect, test } from "vitest";
import * as T from "three";
import { MapCollision } from "@cs2go/simulation/map-collision";
import { NativeMapBreakableView, type NativeBreakableManifest } from "./map-breakable-view";
function fixture(count = 1) {
  const scene = new T.Group(),
    scenery = new T.Group();
  scene.add(scenery);
  const manifest: NativeBreakableManifest = { version: 1, mapId: "synthetic", breakables: [] };
  for (let i = 0; i < count; i++) {
    const intact = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial());
    intact.name = `intact${i}`;
    const piece = new T.Group();
    piece.name = `piece${i}`;
    const mesh = new T.Mesh(new T.BoxGeometry(0.1, 0.2, 0.3), intact.material);
    mesh.customDepthMaterial = new T.MeshDepthMaterial();
    piece.add(mesh, new T.Mesh(new T.BoxGeometry(0.2, 0.1, 0.1), intact.material));
    piece.position.set(i * 2, 2, -5);
    scenery.add(intact, piece);
    manifest.breakables.push({
      id: String(i),
      health: 1,
      material: "wood",
      bounds: [
        [0, 0, 0],
        [1, 1, 1],
      ],
      renderNames: [intact.name],
      physicsNames: [],
      pieces: [{ renderNames: [piece.name], fadeTime: 20, spawnChance: 1, essential: i < 3 }],
    });
  }
  scene.updateMatrixWorld(true);
  return { scene, scenery, manifest };
}
test("native multi-material piece is one exact rigid fragment; hidden templates and shared shadow/depth resources survive reset", () => {
  const { scene, scenery, manifest } = fixture();
  const view = new NativeMapBreakableView(scene, scenery, manifest, new MapCollision([]));
  const template = scenery.getObjectByName("piece0")!;
  expect(template.visible).toBe(false);
  view.sync([{ id: "0", health: 0 }], true);
  expect(view.root.children).toHaveLength(1);
  const meshes: T.Mesh[] = [];
  view.root.traverse((object) => {
    if (object instanceof T.Mesh) meshes.push(object);
  });
  expect(meshes).toHaveLength(2);
  expect(meshes[0].geometry).toBe((template.children[0] as T.Mesh).geometry);
  expect(meshes[0].customDepthMaterial).toBe((template.children[0] as T.Mesh).customDepthMaterial);
  expect(
    meshes.every(
      (mesh) => mesh.geometry !== (scenery.getObjectByName("intact0") as T.Mesh).geometry,
    ),
  ).toBe(true);
  view.update(4);
  expect(view.root.children).toHaveLength(1); // Authored20s parameter is retained beyond old reconstructed3s.
  view.sync([{ id: "0", health: 1 }]);
  expect(view.root.children).toHaveLength(0);
  expect(scenery.getObjectByName("intact0")!.visible).toBe(true);
  expect(template.visible).toBe(false);
});
test("nonessential debris budget never evicts authored essential pieces; round restoration clears both", () => {
  const { scene, scenery, manifest } = fixture(105);
  const view = new NativeMapBreakableView(scene, scenery, manifest, new MapCollision([]));
  view.sync(
    manifest.breakables.map((entry) => ({ id: entry.id, health: 0 })),
    true,
  );
  expect(view.root.children).toHaveLength(99); //3essential+96optional, not24wholeownerclones.
  const names = new Set<string>();
  view.root.traverse((object) => names.add(object.name));
  for (let i = 0; i < 3; i++) expect(names.has(`piece${i}`)).toBe(true);
  view.sync(manifest.breakables.map((entry) => ({ id: entry.id, health: 1 })));
  expect(view.root.children).toHaveLength(0);
});
test("missing source piece geometry rejects instead of flying an intact owner as a substitute", () => {
  const { scene, scenery, manifest } = fixture();
  manifest.breakables[0].pieces![0].renderNames = ["absent-source-piece"];
  expect(() => new NativeMapBreakableView(scene, scenery, manifest, new MapCollision([]))).toThrow(
    "piece geometry missing",
  );
});

test("explicit native piece spawn_motion_disabled keeps its authored remnant fixed instead of launching or spinning", () => {
  const { scene, scenery, manifest } = fixture();
  manifest.breakables[0].pieces![0].motionDisabled = true;
  const view = new NativeMapBreakableView(scene, scenery, manifest, new MapCollision([]));
  view.sync([{ id: "0", health: 0 }], true, new T.Vector3(), new T.Vector3(1, 1, 1));
  const body = view.root.children[0];
  const position = body.position.clone(),
    rotation = body.quaternion.clone();
  view.update(1);
  expect(body.position).toEqual(position);
  expect(body.quaternion.toArray()).toEqual(rotation.toArray());
  expect(view.root.children).toHaveLength(1);
  view.sync([{ id: "0", health: 1 }]);
  expect(view.root.children).toHaveLength(0);
});
