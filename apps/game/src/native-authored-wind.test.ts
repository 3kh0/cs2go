import { expect, test } from "vitest";
import * as T from "three";
import { createAuthoredWind } from "./native-authored-wind";

const controller = {
  space: "main",
  values: {
    classname: "env_wind",
    angles: [0, 0, 0],
    windradius: -1,
    minwind: 20,
    maxwind: 30,
    mingust: 40,
    maxgust: 60,
    mingustdelay: 10,
    maxgustdelay: 20,
    gustduration: 5,
    gustdirchange: 20,
  },
};
test("authored wind stays in its declared speed range and rotates Source directions into the own sky frame", () => {
  const main = createAuthoredWind([controller], { space: "main", speedToStrength: 0.01 });
  const sky = createAuthoredWind([controller], {
    space: "sky",
    speedToStrength: 0.01,
    worldToOwn: new T.Matrix4().makeRotationY(Math.PI / 2),
  });
  expect(main.state.direction).toEqual([1, -0, 0]);
  expect(sky.state.direction[0]).toBeCloseTo(0, 10);
  expect(sky.state.direction[1]).toBeCloseTo(1, 10);
  for (const time of [-20, 0, 1, 2.5, 5, 17, 40]) {
    const value = main.update(time);
    expect(value.strength).toBeGreaterThanOrEqual(0.25);
    expect(value.strength).toBeLessThanOrEqual(0.5);
    expect(Math.hypot(...value.direction)).toBeCloseTo(1, 10);
  }
});
test("missing controllers do not invent wind, and invalid source ranges or unsupported local controllers reject", () => {
  expect(
    createAuthoredWind([], { space: "main", speedToStrength: 0.01 }).update(123).strength,
  ).toBe(0);
  for (const patch of [{ minwind: 31 }, { windradius: 20 }, { maxgust: NaN }])
    expect(() =>
      createAuthoredWind([{ ...controller, values: { ...controller.values, ...patch } }], {
        space: "main",
        speedToStrength: 0.01,
      }),
    ).toThrow();
});

test("own-sky controllers keep their own authored orientation instead of rotating it twice", () => {
  const wind = createAuthoredWind([{ ...controller, space: "sky0" }], {
    space: "sky",
    speedToStrength: 0.01,
    worldToOwn: new T.Matrix4().makeRotationY(Math.PI / 2),
  });
  expect(wind.state.direction).toEqual([1, -0, 0]);
});
