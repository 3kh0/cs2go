import { expect, test } from "vitest";
import * as T from "three";
import { displayViewport, readDisplaySettings } from "./display-settings";

test("display ratio defaults to Native without inheriting an old viewmodel preview", () => {
  expect(readDisplaySettings({})).toEqual({ aspectRatio: "native" });
  expect(readDisplaySettings({ viewmodelAspect: "4:3" })).toEqual({ aspectRatio: "native" });
  expect(readDisplaySettings({ aspectRatio: "5:4", viewmodelAspect: "4:3" })).toEqual({
    aspectRatio: "5:4",
  });
  expect(readDisplaySettings({ aspectRatio: "constructor" })).toEqual({ aspectRatio: "native" });
});

test("4:3 and 5:4 project the whole world wider and fill wide displays without bars", () => {
  const point = new T.Vector3(1, 0, -5);
  const project = (aspect: "native" | "4:3" | "5:4") => {
    const size = displayViewport(aspect, 1920, 1080);
    expect(size.width * size.stretch).toBeCloseTo(1920);
    expect(size.height).toBe(1080);
    return point.clone().project(new T.PerspectiveCamera(90, size.width / size.height)).x;
  };
  const normal = project("native");
  expect(project("4:3") / normal).toBeCloseTo(4 / 3);
  expect(project("5:4") / normal).toBeCloseTo(64 / 45);
  expect(displayViewport("4:3", 2560, 1080).width).toBe(1440);
});
