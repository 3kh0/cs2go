import { expect, test } from "vitest";
import { nativeMapSamplerReservation } from "./native-map-sampler-budget";
const resolved = {
  lighting: { directional: {} },
  probes: { textures: [{}, {}] },
  reflections: { combined: true, textures: [{}] },
  fog: { cube: {} },
  stockEnvironmentFallback: true,
  grade: "active" as const,
  sourceSunShadows: 2 as const,
};
test("main resolved graph reserves8 slots and uses atlas OR LPVs rather than their sum", () => {
  const row = nativeMapSamplerReservation(resolved);
  expect(row.samplers).toBe(8);
  expect(row.lighting).toBe(3);
  expect(row.reflectionMode).toBe("native");
  expect(nativeMapSamplerReservation({ ...resolved, lighting: undefined }).samplers).toBe(7);
});
test("sky5-slot graph explicitly marks conservative sixth grade reservation", () => {
  const actual = nativeMapSamplerReservation({
    ...resolved,
    stockEnvironmentFallback: false,
    grade: "none",
    sourceSunShadows: 0,
  });
  const reserved = nativeMapSamplerReservation({
    ...resolved,
    stockEnvironmentFallback: false,
    grade: "reserved",
    sourceSunShadows: 0,
  });
  expect(actual.samplers).toBe(5);
  expect(reserved.samplers).toBe(6);
  expect(reserved.gradeReservation).toBe(true);
});
test("resolved split arrays and stock fallback reserve distinct real sampler names", () => {
  expect(
    nativeMapSamplerReservation({
      ...resolved,
      reflections: { combined: false, textures: [{}, {}] },
    }).samplers,
  ).toBe(9);
  expect(nativeMapSamplerReservation({ ...resolved, reflections: undefined }).samplers).toBe(8);
  expect(
    nativeMapSamplerReservation({
      ...resolved,
      reflections: undefined,
      stockEnvironmentFallback: false,
    }).samplers,
  ).toBe(7);
});
test("invalid resolved resource layouts fail instead of dropping native features", () => {
  expect(() =>
    nativeMapSamplerReservation({
      ...resolved,
      reflections: { combined: false, textures: [{}, {}, {}] },
    }),
  ).toThrow("reflection");
  expect(() => nativeMapSamplerReservation({ ...resolved, probes: { textures: [{}] } })).toThrow(
    "probe",
  );
});
