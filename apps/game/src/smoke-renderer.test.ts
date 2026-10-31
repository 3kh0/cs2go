import { describe, expect, it } from "vitest";
import { SphereGeometry, Vector3 } from "three";
import { smokeCellDensity, SmokeRenderer } from "./smoke-renderer";

describe("smoke density recovery", () => {
  it("holds bullet and HE openings, then recovers continuously", () => {
    expect(smokeCellDensity(10, 11, -1)).toBe(0);
    expect(smokeCellDensity(11.175, 11, -1)).toBeCloseTo(0.5);
    expect(smokeCellDensity(12, 11, -1)).toBe(1);
    expect(smokeCellDensity(12, 0, 0.5)).toBe(0);
    expect(smokeCellDensity(12, 0, -0.175)).toBeCloseTo(0.5);
    expect(smokeCellDensity(12, 0, -1)).toBe(1);
    expect(smokeCellDensity(10, 11, -0.175)).toBe(0);
  });
  it("keeps GPU allocation fixed and leaves the shared geometry untouched", () => {
    const shared = new SphereGeometry(1, 18, 12);
    const cloud = new SmokeRenderer([new Vector3(), new Vector3(1, 0, 0)], shared);
    const buffer = cloud.densities.array;
    cloud.update(2, 1, 2, [3], -1);
    expect(cloud.densities.getX(0)).toBe(0);
    expect(cloud.densities.getX(1)).toBe(1);
    cloud.update(3.175, 1, 3.175, [3], -1);
    expect(cloud.densities.getX(0)).toBeCloseTo(0.5);
    expect(cloud.densities.array).toBe(buffer);
    expect(shared.getAttribute("smokeDensity")).toBeUndefined();
    let sharedDisposed = false;
    shared.addEventListener("dispose", () => {
      sharedDisposed = true;
    });
    cloud.dispose();
    expect(sharedDisposed).toBe(false);
    shared.dispose();
  });
});
