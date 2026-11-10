import { expect, test } from "vitest";
import * as T from "three";
import { buildQualifiedVrfLocalBarn, vrfLocalLightSrgbToLinear } from "./native-local-light-bridge";

const entity = {
  classname: "light_barn",
  directlight: 3,
  enabled: true,
  scales: [1, 1, 1],
  origin: [0, 0, 0],
  angles: [0, 0, 0],
  size_params: [1, 1, 1],
  range: 4,
  skirt_near: 0.1,
  skirt: 0.2,
  soft_x: 0.1,
  soft_y: 0.2,
  shape: 1,
  precomputedfieldsvalid: 1,
  precomputedobborigin: [0, 0, 0],
  precomputedobbextent: [100, 100, 100],
  precomputedobbangles: [0, 0, 0],
  color: [128, 64, 255],
  brightness_lumens: 6000,
  brightness_legacy: 123456,
};
const options = { linearizeSrgb: (v: readonly number[]) => v, compiledShadowChannel: 2 };

test("qualified photometric barn reconstructs near/far planes and independent solid-angle intensity", () => {
  const { record, intensity, divisor } = buildQualifiedVrfLocalBarn(entity, options);
  const matrix = new T.Matrix4().fromArray(record.projection);
  expect(new T.Vector3(0, 0, 0).applyMatrix4(matrix).z).toBeCloseTo(0, 12);
  expect(new T.Vector3(4, 0, 0).applyMatrix4(matrix).z).toBeCloseTo(1, 12);
  expect(new T.Vector3(0, 1, 1).applyMatrix4(matrix).toArray()).toEqual([1, 1, 0]);
  const omega = 4 * Math.atan(1 / Math.sqrt(3));
  expect(divisor).toBeCloseTo(omega / (4 * Math.PI * 10), 12);
  expect(intensity).toBeCloseTo(360000, 6);
  expect(record.color[0]).toBeCloseTo((128 / 255) * 360000, 6);
  expect(record.positionRadius).toEqual([-1, 0, 0, 1]);
  expect(record.shadowWeights).toEqual([0, 0, 1, 0]);
  expect(record.minimumRoughness).toBe(0.04);
});

test("qualified orthographic geometry preserves shear, rotation and directional light semantics", () => {
  const { record, intensity } = buildQualifiedVrfLocalBarn(
    { ...entity, origin: [10, 20, 30], angles: [0, 90, 0], size_params: [2, 3, 0], shear: [2, 1] },
    options,
  );
  const matrix = new T.Matrix4().fromArray(record.projection);
  expect(new T.Vector3(10, 20, 30).applyMatrix4(matrix).length()).toBeLessThan(1e-12);
  // Source forward +Y, local right -X: authored shear shifts far center -2X,+1Z.
  const far = new T.Vector3(8, 24, 31).applyMatrix4(matrix);
  expect(far.x).toBeCloseTo(0, 12);
  expect(far.y).toBeCloseTo(0, 12);
  expect(far.z).toBeCloseTo(1, 12);
  expect(record.positionRadius[3]).toBe(0);
  record.positionRadius
    .slice(0, 3)
    .forEach((value, i) => expect(value).toBeCloseTo([2, -4, -1][i] / Math.sqrt(21), 12));
  expect(intensity).toBeCloseTo((6000 * Math.PI * 10) / 6, 9);
});

test("bridge rejects unproven bindings and unsupported entity behavior", () => {
  expect(() =>
    buildQualifiedVrfLocalBarn(entity, { linearizeSrgb: options.linearizeSrgb }),
  ).toThrow("shadow-channel");
  expect(() => buildQualifiedVrfLocalBarn({ ...entity, lightcookie: "foo" }, options)).toThrow(
    "recovered logical resource",
  );
  expect(() => buildQualifiedVrfLocalBarn({ ...entity, scales: [2, 1, 1] }, options)).toThrow(
    "unit entity",
  );
  expect(() =>
    buildQualifiedVrfLocalBarn({ ...entity, precomputedfieldsvalid: 0 }, options),
  ).toThrow("OBB");
});

test("pinned color decoder preserves linear toe and reference minus1e-7 correction", () => {
  const values = [0, 10 / 255, 11 / 255, 181 / 255, 205 / 255, 1];
  const decoded = vrfLocalLightSrgbToLinear(values);
  expect(decoded[0]).toBe(0);
  expect(decoded[1]).toBeCloseTo(10 / 255 / 12.92, 9);
  values
    .slice(2)
    .forEach((value, index) =>
      expect(decoded[index + 2]).toBeCloseTo(((value + 0.055) / 1.055) ** 2.4 - 0.0000001, 6),
    );
  expect(decoded[5]).toBe(0.9999998807907104);
  expect(decoded[5]).not.toBe(1);
  expect(() => vrfLocalLightSrgbToLinear([Number.NaN])).toThrow("sRGB");
});

test("authored rotated illumination box preserves the reference .999 border", () => {
  const { record } = buildQualifiedVrfLocalBarn(
    {
      ...entity,
      precomputedobborigin: [10, 20, 30],
      precomputedobbextent: [2, 3, 4],
      precomputedobbangles: [0, 90, 0],
    },
    options,
  );
  const bounds = new T.Matrix4().fromArray(record.worldToBounds);
  expect(new T.Vector3(10, 20, 30).applyMatrix4(bounds).length()).toBeLessThan(1e-12);
  const edge = new T.Vector3(10, 22, 30).applyMatrix4(bounds);
  expect(edge.x).toBeCloseTo(0.999, 12);
  expect(edge.y).toBeCloseTo(0, 12);
  expect(new T.Vector3(10, 22.01, 30).applyMatrix4(bounds).x).toBeGreaterThan(1);
});

test("recovered native planar cookie requires exact resource identity and preserves logical UV without resizing", () => {
  const result = buildQualifiedVrfLocalBarn(
    { ...entity, lightcookie: "native/window.vtex" },
    { ...options, cookie: { resource: "native/window.vtex", layer: 1 } },
  );
  expect(result.record.cookieKind).toBe(1);
  expect(result.record.cookieLayer).toBe(1);
  expect(result.record.cookieResource).toBe("native/window.vtex");
  expect(result.record.cookieTransform).toEqual([0, 0, 1, 1]);
  expect(() =>
    buildQualifiedVrfLocalBarn(
      { ...entity, lightcookie: "native/window.vtex" },
      { ...options, cookie: { resource: "other.vtex", layer: 1 } },
    ),
  ).toThrow("logical resource");
});
