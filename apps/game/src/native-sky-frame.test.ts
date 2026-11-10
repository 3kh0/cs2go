import { expect, test } from "vitest";
import * as T from "three";
import { nativeSkyFrame } from "./native-sky-frame";
const toBrowser = (point: T.Vector3) =>
  new T.Vector3(point.x, point.z, -point.y).multiplyScalar(0.0254);

test("own-sky shader frame reverses baked camera/reference placement once at scale1 and16", () => {
  for (const scale of [1, 16]) {
    const placement = {
      skyCamera: { origin: [8, 40, 64], scale },
      skyboxReference: { origin: [100, 200, 300], angles: [0, 90, 0] },
    };
    const frame = nativeSkyFrame(placement);
    const own = new T.Vector3(10, 40, 64),
      main = new T.Vector3(100, 200 + 2 * scale, 300);
    expect(
      toBrowser(own).applyMatrix4(frame.worldFromSkyBrowser).distanceTo(toBrowser(main)),
    ).toBeLessThan(1e-12);
    expect(main.clone().applyMatrix4(frame.skySourceFromMainSource).distanceTo(own)).toBeLessThan(
      1e-12,
    );
    expect(
      toBrowser(main).applyMatrix4(frame.skyBrowserFromWorld).distanceTo(toBrowser(own)),
    ).toBeLessThan(1e-12);
    expect(
      new T.Vector3(0, 1, 0)
        .transformDirection(frame.skySourceFromMainSource)
        .distanceTo(new T.Vector3(1, 0, 0)),
    ).toBeLessThan(1e-12);
    // A one-Source-unit virtual displacement spans scale*.0254 world metres.
    expect(
      toBrowser(own.clone().add(new T.Vector3(1, 0, 0)))
        .applyMatrix4(frame.worldFromSkyBrowser)
        .distanceTo(toBrowser(main)),
    ).toBeCloseTo(scale * 0.0254, 12);
    expect(
      nativeSkyFrame({
        ...placement,
        browserWorldFromSkyBrowser: frame.worldFromSkyBrowser.toArray(),
      }).skyBrowserFromWorld.equals(frame.skyBrowserFromWorld),
    ).toBe(true);
  }
});
test("sky frame validates native provenance rather than accepting a second placement or bad vector", () => {
  const placement = { skyCamera: { origin: "8 40 64", scale: 16 } };
  expect(() =>
    nativeSkyFrame({ ...placement, browserWorldFromSkyBrowser: new T.Matrix4().toArray() }),
  ).toThrow("disagrees");
  expect(() => nativeSkyFrame({ skyCamera: { origin: [0, NaN, 0], scale: 16 } })).toThrow("vector");
  expect(() => nativeSkyFrame({ skyCamera: { origin: [0, 0, 0], scale: Infinity } })).toThrow(
    "scale",
  );
});
