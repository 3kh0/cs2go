import { expect, test } from "vitest";
import { packNativeLocalLights, type NativeBakedLocalLight } from "./native-local-light-kernel";
const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function light(): NativeBakedLocalLight {
  return {
    projection: identity,
    worldToBounds: identity,
    positionRadius: [0, 0, 1, 0],
    depthFalloff: [1, 0, 0, 0],
    color: [2, 4, 6],
    rotation: [0, 0, 0, 1],
    angularLine: [1, 0, 0],
    barn: [0.5, 0.5, 0],
    shadowWeights: [0, 0, 1, 0],
    minimumRoughness: 0.2,
    cookieKind: 0,
  };
}
test("resolved local-light std140 records preserve uint counts HDR fields and independent records", () => {
  const first = light(),
    second = { ...light(), color: [3, 5, 7] };
  const words = packNativeLocalLights([first, second], identity, identity),
    floats = new Float32Array(words.buffer);
  expect(words.byteLength).toBe(144 + 2 * 256);
  expect(words[32]).toBe(2);
  expect(floats[32]).not.toBe(2);
  expect(Array.from(floats.subarray(36 + 40, 36 + 43))).toEqual([2, 4, 6]);
  expect(Array.from(floats.subarray(36 + 64 + 40, 36 + 64 + 43))).toEqual([3, 5, 7]);
  expect(Array.from(floats.subarray(36 + 56, 36 + 60))).toEqual([0, 0, 1, 0]);
  expect(first.color).toEqual([2, 4, 6]);
});
test("unresolved or unsupported local-light inputs fail rather than inventing host values", () => {
  expect(() => packNativeLocalLights([], identity, identity)).toThrow("empty");
  expect(() =>
    packNativeLocalLights([{ ...light(), color: [1, 2, 1e100] }], identity, identity),
  ).toThrow("linear color");
  expect(() =>
    packNativeLocalLights(
      [{ ...light(), cookieKind: 1 } as unknown as NativeBakedLocalLight],
      identity,
      identity,
    ),
  ).toThrow("cookie");
  expect(() => packNativeLocalLights([light()], identity.slice(0, 12), identity)).toThrow(
    "world frame",
  );
});

test("recovered planar cookie logical layer and affine UV preserve std140 layout", () => {
  const data = packNativeLocalLights(
      [
        {
          ...light(),
          cookieKind: 1,
          cookieLayer: 2,
          cookieResource: "fixture",
          cookieTransform: [0.1, 0.2, 0.3, 0.4],
        },
      ],
      identity,
      identity,
    ),
    f = new Float32Array(data.buffer);
  expect(f[36 + 43]).toBe(3);
  expect([...f.subarray(36 + 52, 36 + 56)]).toEqual([0.1, 0.2, 0.3, 0.4].map(Math.fround));
});
