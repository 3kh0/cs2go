import { expect, test } from "vitest";
import { characterLocomotion, characterPhase } from "./character-locomotion";

test("native locomotion selects distinct diagonals and stance clips at authored Source speeds", () => {
  const unit = 0.0254;
  expect(characterLocomotion(136 * unit, 0, 1, 0)).toEqual([
    { name: "walk_n", weight: 1, duration: 1 },
  ]);
  const diagonal = characterLocomotion(Math.hypot(159, 159) * unit, 1, 1, 0);
  expect(diagonal).toHaveLength(1);
  expect(diagonal[0]).toMatchObject({ name: "run_ne", weight: 1 });
  const crouched = characterLocomotion(96 * unit, -1, 0, 1);
  expect(crouched).toHaveLength(1);
  expect(crouched[0]).toMatchObject({ name: "crouch_w", duration: 0.8 });
  expect(crouched[0].weight).toBeCloseTo(1, 7);
  expect(characterLocomotion(0, 0, 0, 0.25)).toEqual([
    { name: "idle", weight: 0.75, duration: 1 },
    { name: "idle_crouch", weight: 0.25, duration: 1 },
  ]);
});

test("authored triangle blending stays normalized and clamps extreme movement to its hull", () => {
  for (const speed of [0, 0.7, 2.4384, 3.4544, 5.715, 9])
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12)
      for (const crouch of [0, 0.3, 1]) {
        const samples = characterLocomotion(speed, Math.sin(angle), Math.cos(angle), crouch);
        expect(samples.reduce((sum, sample) => sum + sample.weight, 0)).toBeCloseTo(1, 6);
        expect(samples.every((sample) => sample.weight > 0 && sample.weight <= 1.000001)).toBe(
          true,
        );
        expect(samples.length).toBeLessThanOrEqual(6);
      }
});

test("phase follows native clip seconds without speeding footsteps by an invented stride length", () => {
  const walk = characterLocomotion(136 * 0.0254, 0, 1, 0);
  const run = characterLocomotion(225 * 0.0254, 0, 1, 0);
  expect(characterPhase(0, 0.5, walk)).toBeCloseTo(0.5, 6);
  expect(characterPhase(0, 0.5, run)).toBeCloseTo(0.5 / run[0].duration, 6);
  expect(characterPhase(0.9, 0, run)).toBe(0.9);
  expect(characterPhase(0.9, 0.2, walk)).toBeCloseTo(0.1, 6);
});
