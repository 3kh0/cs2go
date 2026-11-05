import { describe, expect, it } from "vitest";
import { Vector2 } from "three";
import { steerAroundTeammate } from "./bot-avoidance";

describe("local teammate passing", () => {
  it("passes a stalled teammate on the right while retaining forward progress", () => {
    const desired = new Vector2(0, 4.8);
    steerAroundTeammate(desired, 0, 0.5, 0, 1);
    expect(desired.x).toBeGreaterThan(0);
    expect(desired.y).toBeGreaterThan(0);
    expect(desired.length()).toBeCloseTo(4.8);
  });
  it("gives head-on teammates opposite world passing sides", () => {
    const north = new Vector2(0, -4.8),
      south = new Vector2(0, 4.8);
    steerAroundTeammate(north, 0, -0.6, 0, -1);
    steerAroundTeammate(south, 0, 0.6, 0, 1);
    expect(north.x).toBeLessThan(0);
    expect(south.x).toBeGreaterThan(0);
    expect(north.y).toBeLessThan(0);
    expect(south.y).toBeGreaterThan(0);
  });
  it("clears a stationary teammate and resumes the route without circling", () => {
    const position = new Vector2(),
      teammate = new Vector2(0, 1.5),
      goal = new Vector2(0, 5),
      desired = new Vector2();
    let closest = Infinity;
    for (let tick = 0; tick < 128 * 2; tick++) {
      desired.copy(goal).sub(position).normalize().multiplyScalar(3.2);
      steerAroundTeammate(
        desired,
        teammate.x - position.x,
        teammate.y - position.y,
        desired.x,
        desired.y,
      );
      position.addScaledVector(desired, 1 / 128);
      closest = Math.min(closest, position.distanceTo(teammate));
    }
    expect(closest).toBeGreaterThan(0.6);
    expect(position.distanceTo(goal)).toBeLessThan(0.05);
  });
  it("retains original forward progress through eight symmetric neighbours", () => {
    const desired = new Vector2(0, 4.8);
    for (const [x, z] of [
      [-0.4, 0.2],
      [0.4, 0.2],
      [-0.3, 0.4],
      [0.3, 0.4],
      [-0.2, 0.6],
      [0.2, 0.6],
      [-0.1, 0.8],
      [0.1, 0.8],
    ]) {
      steerAroundTeammate(desired, x, z, 0, 4.8);
      expect(desired.y).toBeGreaterThan(0.5);
      expect(desired.x).toBeGreaterThan(0);
      expect(desired.length()).toBeCloseTo(4.8);
    }
  });
  it("leaves teammates behind and outside the travel corridor alone", () => {
    for (const [x, z] of [
      [0, -0.5],
      [0, 2],
      [1.1, 0.5],
    ]) {
      const desired = new Vector2(0, 4.8);
      steerAroundTeammate(desired, x, z, 0, 1);
      expect(desired.toArray()).toEqual([0, 4.8]);
    }
  });
  it("does not create motion for an idle bot or amplify speed in a crowd", () => {
    const idle = new Vector2();
    steerAroundTeammate(idle, 0, 0, 0, 1);
    expect(idle.toArray()).toEqual([0, 0]);
    const desired = new Vector2(0, 3.2);
    for (let i = 0; i < 50; i++) {
      steerAroundTeammate(desired, (i % 3) * 0.15, 0.3, 0, 1);
      expect(desired.length()).toBeCloseTo(3.2);
      expect(desired.toArray().every(Number.isFinite)).toBe(true);
    }
  });
});
