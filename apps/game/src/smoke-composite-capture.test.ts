import { expect, it } from "vitest";
import * as T from "three";
import { registerSceneDepthMaterial, SmokeComposite, SmokeRenderer } from "./smoke-renderer";

function fixture() {
  const scene = new T.Scene();
  const background = new T.Color(0x123456);
  scene.background = background;
  const opaque = new T.MeshBasicMaterial();
  const transparent = new T.MeshBasicMaterial({ transparent: true });
  const parent = new T.Mesh(new T.BoxGeometry(), opaque);
  const excluded: T.Mesh<T.BoxGeometry, T.Material | T.Material[]> = new T.Mesh(
    parent.geometry,
    transparent,
  );
  const descendant = new T.Mesh(parent.geometry, opaque);
  const invisible = new T.Mesh(parent.geometry, opaque);
  invisible.visible = false;
  excluded.add(descendant, invisible);
  parent.add(excluded);
  parent.layers.mask = 5;
  descendant.layers.mask = 9;
  scene.add(parent);
  const destination = new T.WebGLRenderTarget(96, 64);
  let target: T.WebGLRenderTarget | null = destination;
  let draw = (_capture: boolean) => {};
  const renderer = {
    autoClear: true,
    toneMapping: T.NoToneMapping,
    shadowMap: { autoUpdate: true, needsUpdate: true },
    extensions: { has: () => true },
    getRenderTarget: () => target,
    setRenderTarget: (value: T.WebGLRenderTarget | null) => {
      target = value;
    },
    getViewport: (value: T.Vector4) => value.set(0, 0, 96, 64),
    getCurrentViewport: (value: T.Vector4) => value.set(0, 0, 96, 64),
    clear() {},
    render(value: T.Scene) {
      if (value === scene) draw(target !== destination);
    },
  } as unknown as T.WebGLRenderer;
  const composite = new SmokeComposite();
  const render = () =>
    composite.render(
      renderer,
      scene,
      new T.PerspectiveCamera(),
      [],
      false,
      { setDepth() {} },
      undefined,
      true,
    );
  const restored = () => {
    expect(parent.layers.mask).toBe(5);
    expect(descendant.layers.mask).toBe(9);
    expect(excluded.visible).toBe(true);
    expect(invisible.visible).toBe(false);
    expect(scene.background).toBe(background);
    expect(scene.matrixWorldAutoUpdate).toBe(true);
    expect(renderer.autoClear).toBe(true);
    expect(renderer.shadowMap.autoUpdate).toBe(true);
    expect(renderer.shadowMap.needsUpdate).toBe(true);
    expect(renderer.getRenderTarget()).toBe(destination);
  };
  return {
    renderer,
    scene,
    opaque,
    transparent,
    parent,
    excluded,
    descendant,
    composite,
    render,
    restored,
    onDraw(callback: typeof draw) {
      draw = callback;
    },
  };
}

it("retains opaque descendants of excluded roots and refreshes membership each invocation", () => {
  const f = fixture();
  const seen: boolean[] = [];
  f.onDraw((capture) => {
    seen.push(capture);
    expect(f.parent.layers.mask).toBe(capture ? 5 : 0);
    expect(f.excluded.visible).toBe(!capture);
    expect(f.descendant.layers.mask).toBe(9);
  });
  f.render();
  f.restored();
  expect(seen).toEqual([true, false]);
  // A mixed material array excludes the entire mesh and its nested subtree.
  f.excluded.material = [f.opaque, f.transparent];
  f.render();
  f.restored();
  // Neither material.version nor topology changes are required for invalidation.
  f.transparent.transparent = false;
  f.onDraw((capture) => {
    expect(f.excluded.visible).toBe(true);
    expect(f.descendant.layers.mask).toBe(capture ? 9 : 0);
  });
  f.render();
  f.restored();
  registerSceneDepthMaterial(f.transparent);
  f.onDraw((capture) => {
    expect(f.excluded.visible).toBe(!capture);
    expect(f.descendant.layers.mask).toBe(9);
  });
  f.render();
  f.restored();
});

for (const failure of ["capture", "remaining", "reentrant"] as const)
  it(`restores pass state after a ${failure} failure and accepts the next frame`, () => {
    const f = fixture();
    f.onDraw((capture) => {
      if (failure === "reentrant") f.render();
      if (capture === (failure === "capture")) throw new Error("draw failed");
    });
    expect(f.render).toThrow(failure === "reentrant" ? "cannot reenter" : "draw failed");
    f.restored();
    f.onDraw(() => {});
    expect(f.render).not.toThrow();
    f.restored();
  });

for (const fail of [false, true])
  it(`renders intact gameplay cloud roots alone and restores sibling order${fail ? " after failure" : ""}`, () => {
    const f = fixture();
    const geometry = new T.SphereGeometry(1, 8, 6);
    const clouds = [
      new SmokeRenderer([new T.Vector3()], geometry),
      new SmokeRenderer([new T.Vector3(1, 0, 0)], geometry),
    ];
    const roots = clouds.map((cloud, index) => {
      const root = new T.Group();
      root.layers.mask = index ? 1 : -1;
      root.renderOrder = index + 3;
      root.visible = index === 0;
      root.add(cloud.batch);
      f.scene.add(root, new T.Group());
      return root;
    });
    f.scene.updateMatrixWorld();
    const siblings = [...f.scene.children];
    const matrices = clouds.map((cloud) => cloud.batch.matrixWorld.clone());
    const render = f.renderer.render.bind(f.renderer);
    let isolated = false;
    f.renderer.render = (scene, camera) => {
      if (camera.layers.mask === 0x80000000) {
        isolated = true;
        expect(scene).not.toBe(f.scene);
        expect(scene.children).toEqual(roots);
        roots.forEach((root, index) => {
          expect(root.visible).toBe(index === 0);
          expect(root.renderOrder).toBe(index + 3);
          expect(root.layers.mask).toBe(index ? 1 : -1);
          expect(clouds[index].batch.matrixWorld.equals(matrices[index])).toBe(true);
        });
        if (fail) throw new Error("cloud draw failed");
      } else render(scene, camera);
    };
    const run = () =>
      f.composite.render(f.renderer, f.scene, new T.PerspectiveCamera(), [...clouds].reverse());
    if (fail) expect(run).toThrow("cloud draw failed");
    else run();
    expect(isolated).toBe(true);
    expect(f.scene.children).toEqual(siblings);
    f.restored();
    roots.forEach((root, index) => {
      expect(root.parent).toBe(f.scene);
      expect(clouds[index].batch.parent).toBe(root);
      expect(clouds[index].batch.layers.mask).toBe(1);
      expect(clouds[index].batch.matrixWorld.equals(matrices[index])).toBe(true);
    });
    clouds.forEach((cloud) => cloud.dispose());
    geometry.dispose();
  });

for (const hierarchy of ["transformed", "nested", "sibling"] as const)
  it(`keeps the original scene for a ${hierarchy} cloud hierarchy`, () => {
    const f = fixture();
    const geometry = new T.SphereGeometry(1, 8, 6);
    const cloud = new SmokeRenderer([new T.Vector3()], geometry);
    const root = new T.Group();
    root.add(cloud.batch);
    f.scene.add(root);
    if (hierarchy === "transformed") root.position.x = 2;
    if (hierarchy === "nested") {
      const outer = new T.Group();
      f.scene.add(outer);
      outer.add(root);
    }
    if (hierarchy === "sibling") root.add(new T.Group());
    const render = f.renderer.render.bind(f.renderer);
    let checked = false;
    f.renderer.render = (scene, camera) => {
      if (camera.layers.mask === 0x80000000) {
        checked = true;
        expect(scene).toBe(f.scene);
        expect(cloud.batch.parent).toBe(root);
      } else render(scene, camera);
    };
    f.composite.render(f.renderer, f.scene, new T.PerspectiveCamera(), [cloud]);
    expect(checked).toBe(true);
    cloud.dispose();
    geometry.dispose();
  });
