import { expect, it } from "vitest";
import { Vector3 } from "three";
import { createTracer, launchTracer, updateTracer } from "./tracers";

it("travels toward the hit without extending behind the muzzle or through the endpoint", () => {
  const tracer = createTracer();
  launchTracer(tracer, new Vector3(), new Vector3(0, 0, -60), 0);
  updateTracer(tracer, 1 / 120);
  const first = tracer.mesh.material.uniforms.end.value.z;
  updateTracer(tracer, 1 / 120);
  expect(tracer.mesh.material.uniforms.end.value.z).toBeLessThan(first);
  for (let i = 0; i < 30; i++) {
    updateTracer(tracer, 1 / 120);
    const { start, end } = tracer.mesh.material.uniforms;
    expect(start.value.z).toBeLessThanOrEqual(0);
    expect(end.value.z).toBeGreaterThanOrEqual(-60);
    expect(start.value.z).toBeGreaterThanOrEqual(end.value.z);
  }
  expect(tracer.mesh.visible).toBe(false);
  expect(tracer.life).toBe(0);
});

it("shows sub-frame flights at low FPS and reuses the same resources on the next shot", () => {
  const tracer = createTracer();
  const geometry = tracer.mesh.geometry,
    material = tracer.mesh.material;
  for (const weapon of [0, 7, 10]) {
    for (const distance of [0.1, 1, 20]) {
      launchTracer(tracer, new Vector3(), new Vector3(0, 0, -distance), weapon);
      updateTracer(tracer, 1 / 30);
      expect(tracer.mesh.visible).toBe(true);
      expect(tracer.mesh.material.uniforms.opacity.value).toBeGreaterThan(0);
      updateTracer(tracer, 1 / 30);
      updateTracer(tracer, 1 / 30);
      updateTracer(tracer, 1 / 30);
      expect(tracer.life).toBe(0);
      expect(tracer.mesh.geometry).toBe(geometry);
      expect(tracer.mesh.material).toBe(material);
    }
  }
});

it("uses each native trail family's configured fade-in endpoints", () => {
  const opacity = (weapon: number, age: number) => {
    const tracer = createTracer();
    launchTracer(tracer, new Vector3(), new Vector3(0, 0, -100), weapon);
    // Two updates reach the requested age without relying on the fresh-flight sample.
    updateTracer(tracer, tracer.flight * 0.1);
    updateTracer(tracer, tracer.flight * (age - 0.05));
    return tracer.mesh.material.uniforms.opacity.value;
  };
  expect(opacity(10, 0.15)).toBeCloseTo(0, 10);
  expect(opacity(10, 0.175)).toBeCloseTo(0.103125);
  expect(opacity(10, 0.25)).toBeCloseTo(0.66);
  expect(opacity(7, 0.2)).toBeCloseTo(0, 10);
  expect(opacity(7, 0.3)).toBeCloseTo(0.4888888889);
  expect(opacity(7, 0.35)).toBeCloseTo(0.66);
  for (const weapon of [0, 3]) {
    expect(opacity(weapon, 0.2)).toBeCloseTo(0, 10);
    expect(opacity(weapon, 0.25)).toBeCloseTo(0.33);
    expect(opacity(weapon, 0.3)).toBeCloseTo(0.66);
  }
});
