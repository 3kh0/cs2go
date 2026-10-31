import { describe, expect, it } from "vitest";
import { actorCarry, actorLanding, actorSupport, slideActors } from "./actor-collision";
const actors = [{ x: 0, y: 0, z: 0, radius: 0.3, height: 1.65 }];
describe("dynamic player hulls", () => {
  it("lands on a head, never climbs through the torso, and loses support off its edge", () => {
    expect(actorSupport(0, 0, 1.8, 1.6, actors)).toBe(1.65);
    expect(actorSupport(0, 0, 0, -0.01, actors)).toBe(-Infinity);
    expect(actorSupport(0.61, 0, 1.65, 1.64, actors)).toBe(-Infinity);
    expect(actorSupport(0, 0, 1.65, 1.64, [])).toBe(-Infinity);
  });
  it("sweeps fast motion and retains tangential travel", () => {
    const end = { x: 2, y: 0, z: 0.4 };
    const hit = slideActors({ x: -2, y: 0, z: 0 }, end, 1.65, actors);
    expect(end.x).toBeCloseTo(-0.6, 3);
    expect(end.z).toBeCloseTo(0.4);
    expect(hit.hitX).toBe(true);
  });
  it("permits movement over heads and escape from preexisting overlap", () => {
    const end = { x: 2, y: 1.65, z: 0 };
    slideActors({ x: -2, y: 1.65, z: 0 }, end, 1.65, actors);
    expect(end.x).toBe(2);
    end.y = 0;
    slideActors({ x: 0, y: 0, z: 0 }, end, 1.65, actors);
    expect(end.x).toBe(2);
  });
});

it("resolves diagonal head landings at the time feet cross the top", () => {
  expect(actorLanding({ x: -0.7, y: 1.8, z: 0 }, { x: -0.4, y: 1.5, z: 0 }, actors)).toBe(1.65);
  // Horizontal overlap at the endpoint alone does not permit entering a torso.
  expect(actorLanding({ x: -0.8, y: 1.66, z: 0 }, { x: -0.59, y: 1.5, z: 0 }, actors)).toBe(
    -Infinity,
  );
  expect(actorLanding({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1.8, z: 0 }, actors)).toBe(-Infinity);
});
it("separates a landing during the step from support at its endpoint", () => {
  const start = { x: 0, y: 1.65, z: 0 };
  const end = { x: 0.7, y: 1.64, z: 0 };
  const floor = actorLanding(start, end, actors);
  expect(floor).toBe(1.65);
  end.y = floor;
  slideActors(start, end, 1.65, actors);
  expect(end.x).toBe(0.7);
  expect(actorSupport(end.x, end.z, start.y, end.y, actors)).toBe(-Infinity);
});
it("follows a known carrier's uncrouch without permitting torso steps or dead carriers", () => {
  const carrier = { ...actors[0], height: 1.1492 };
  expect(actorCarry({ x: 0, y: 1.1, z: 0 }, 1.1, carrier)).toBe(1.1492);
  expect(actorCarry({ x: 0, y: 1.1, z: 0 }, 0, carrier)).toBeUndefined();
  expect(actorCarry({ x: 0.7, y: 1.1, z: 0 }, 1.1, carrier)).toBeUndefined();
  expect(actorCarry({ x: 0, y: 1.1, z: 0 }, 1.1, undefined)).toBeUndefined();
});
