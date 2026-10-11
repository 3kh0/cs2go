import { describe, expect, it } from "vite-plus/test";
import { accelerate, blocked } from "./physics";

describe("Source-style movement", () => {
  it("limits diagonal movement to the same speed as forward movement", () => {
    const forward = { x: 0, z: 0 },
      diagonal = { x: 0, z: 0 };
    for (let i = 0; i < 128; i++) {
      accelerate(forward, 0, -1, 5.2, 1 / 128, true);
      accelerate(diagonal, 1, -1, 5.2, 1 / 128, true);
    }
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(Math.hypot(forward.x, forward.z), 5);
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(5.2, 5);
  });
  it("counter-strafing reaches accurate speed faster than releasing movement", () => {
    const coast = { x: 5.2, z: 0 },
      counter = { ...coast };
    let coastTicks = 0,
      counterTicks = 0;
    while (coast.x > 0.15) {
      accelerate(coast, 0, 0, 5.2, 1 / 128, true);
      coastTicks++;
    }
    while (counter.x > 0.15) {
      accelerate(counter, -1, 0, 5.2, 1 / 128, true);
      counterTicks++;
    }
    expect(counterTicks).toBeLessThan(coastTicks / 2);
  });
  it("preserves horizontal momentum in the air", () => {
    const v = { x: 5.2, z: 0 };
    accelerate(v, 0, 0, 5.2, 1 / 128, false);
    expect(v.x).toBe(5.2);
  });
  it("prevents entering solid walls but allows passage beneath ceilings and standing on boxes", () => {
    const walls = [{ x: 0, z: 0, w: 4, d: 4, h: 4, y: 3 }];
    expect(blocked(0, 0, 0, walls)).toBe(false);
    expect(blocked(0, 0, 2, walls)).toBe(true);
    expect(blocked(0, 0, 4, walls)).toBe(false);
    expect(blocked(0, 0, 0, [{ ...walls[0], y: 0 }])).toBe(true);
    expect(blocked(3, 0, 0, [{ ...walls[0], y: 0 }])).toBe(false);
  });
});
