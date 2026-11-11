import { expect, test } from "vitest";
import * as T from "three";
import { createNativeFoliageBounds } from "./native-foliage-bounds";
import type { NativeFoliageMaterial } from "./native-map-foliage";

function source(mode = 1): NativeFoliageMaterial {
  return {
    shader: "csgo_foliage.vfx",
    nativeResource: "synthetic-bound.vmat",
    IntParams: { F_VERTEX_ANIMATION: mode },
    FloatParams: {
      g_flSwayAmount: 0.3,
      g_flSwaySpeed: 2,
      g_flSwayNoiseScale: 1,
      g_flSwayFalloff: 0.2,
      g_flFlutterAmount: 0.15,
      g_flFlutterSpeed: 1,
      g_flFlutterNoiseScale: 1,
      g_flFlutterFalloff: 0.5,
    },
    VectorParams: {},
    resolvedMaterialInputs: {},
    textures: {},
  };
}
const controllers = [{ values: { minwind: 10, maxwind: 15, mingust: 20, maxgust: 30 } }];
function mesh(geometry = new T.BoxGeometry(1, 1, 1)) {
  const material = new T.MeshStandardMaterial();
  material.name = "leaf";
  return new T.Mesh(geometry, material);
}

test("own-space wind corners stay enclosed under rotated/scaled sky and local placements", () => {
  const material = source(),
    sky = new T.Matrix4().compose(
      new T.Vector3(15, -7, 29),
      new T.Quaternion().setFromEuler(new T.Euler(0.2, 0.7, -0.3)),
      new T.Vector3(16, 16, 16),
    );
  for (const worldToOwn of [new T.Matrix4(), sky.clone().invert()]) {
    const root = new T.Group(),
      object = mesh();
    object.position.set(2, 3, -6);
    object.rotation.set(0.1, 0.4, 0.6);
    object.scale.set(2, 0.5, -3);
    root.add(object);
    const result = createNativeFoliageBounds(root, { leaf: material }, controllers, worldToOwn),
      bound = result.bounds.get(object)!;
    expect(bound).toBeDefined();
    const ownToLocal = object.matrixWorld.clone().invert().multiply(worldToOwn.clone().invert()),
      linear = new T.Matrix3().setFromMatrix4(ownToLocal);
    // Independent interval bound of the literal sway+flutter equations:
    // noise[-1,1], direction components[-1,1], controls/mask powers[0,1].
    const s = 150 * 0.3 * 0.25,
      f = 25 * 0.15 * 0.25,
      xy = 1.5 * (s + f),
      z = 1.25 * (s + f) + 0.314 * Math.SQRT2 * xy;
    const position = object.geometry.getAttribute("position"),
      point = new T.Vector3();
    for (let i = 0; i < position.count; i++) {
      for (const x of [-xy, xy])
        for (const y of [-xy, xy])
          for (const up of [-z, z]) {
            // Source XYZ -> own browser XYZ, then inverse mesh placement.
            const displacement = new T.Vector3(x, up, -y)
              .multiplyScalar(0.0254)
              .applyMatrix3(linear);
            point.fromBufferAttribute(position, i).add(displacement);
            expect(point.distanceTo(bound.center)).toBeLessThanOrEqual(bound.radius);
          }
    }
  }
});

test("individual object spheres preserve shared geometry and include wind at the frustum edge", () => {
  const root = new T.Group(),
    a = mesh(),
    b = mesh(a.geometry);
  a.position.set(6.5, 0, -5);
  b.position.set(30, 0, -5);
  root.add(a, b);
  const result = createNativeFoliageBounds(root, { leaf: source() }, controllers),
    camera = new T.PerspectiveCamera(90, 1, 0.1, 100);
  camera.updateMatrixWorld();
  const frustum = new T.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
  expect(frustum.intersectsObject(a)).toBe(false);
  Object.assign(a, { boundingSphere: result.bounds.get(a)! });
  Object.assign(b, { boundingSphere: result.bounds.get(b)! });
  expect(frustum.intersectsObject(a)).toBe(true);
  expect(frustum.intersectsObject(b)).toBe(false);
  expect(a.geometry.boundingSphere!.radius).toBeCloseTo(Math.sqrt(3) / 2);
  expect(result.bounds.get(a)).not.toBe(result.bounds.get(b));
});

test("unsupported wind or placements decline culling without introducing load failures", () => {
  for (const mutate of [
    (s: NativeFoliageMaterial) => {
      s.IntParams.F_VERTEX_ANIMATION = 2;
    },
    (s: NativeFoliageMaterial) => {
      s.FloatParams.g_flSwayFalloff = -1;
    },
    (s: NativeFoliageMaterial) => {
      delete s.FloatParams.g_flFlutterAmount;
    },
    (s: NativeFoliageMaterial) => {
      s.resolvedMaterialInputs.g_flSwayAmount = Number.NaN;
    },
  ]) {
    const root = new T.Group(),
      object = mesh(),
      material = source();
    mutate(material);
    root.add(object);
    expect(() => createNativeFoliageBounds(root, { leaf: material }, controllers)).not.toThrow();
    expect(createNativeFoliageBounds(root, { leaf: material }, controllers).bounds.size).toBe(0);
  }
  const root = new T.Group(),
    object = mesh();
  root.add(object);
  expect(createNativeFoliageBounds(root, { leaf: source() }, [{ values: {} }]).bounds.size).toBe(0);
  expect(createNativeFoliageBounds(root, { leaf: source(0) }, [{ values: {} }]).bounds.size).toBe(
    1,
  );
  object.matrixAutoUpdate = false;
  object.matrix.makeShear(0.5, 0, 0, 0, 0, 0);
  expect(createNativeFoliageBounds(root, { leaf: source(0) }, controllers).bounds.size).toBe(0);
});

test("changed static/animated placements and changed geometry leave admitted culling permanently", () => {
  for (const mode of [0, 1]) {
    const root = new T.Group(),
      object = mesh();
    root.add(object);
    const result = createNativeFoliageBounds(root, { leaf: source(mode) }, controllers);
    object.frustumCulled = true;
    result.update();
    expect(result.bounds.size).toBe(1);
    object.position.x = 2;
    object.updateMatrixWorld();
    result.update();
    expect(result.bounds.size).toBe(0);
    expect(object.frustumCulled).toBe(false);
    object.position.x = 0;
    object.updateMatrixWorld();
    result.update();
    expect(result.bounds.size).toBe(0);
  }
  const root = new T.Group(),
    object = mesh();
  root.add(object);
  const result = createNativeFoliageBounds(root, { leaf: source() }, controllers);
  object.geometry.getAttribute("position").needsUpdate = true;
  result.update();
  expect(result.bounds.size).toBe(0);
  expect(object.frustumCulled).toBe(false);
  const replaced = mesh();
  root.add(replaced);
  const partition = createNativeFoliageBounds(root, { leaf: source() }, controllers);
  const overflow = mesh();
  replaced.add(overflow);
  replaced.geometry = new T.BoxGeometry(2, 2, 2);
  replaced.frustumCulled = overflow.frustumCulled = true;
  partition.update();
  expect(replaced.frustumCulled).toBe(false);
  expect(overflow.frustumCulled).toBe(false);
});
