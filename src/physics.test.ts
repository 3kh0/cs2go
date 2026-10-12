import { describe, expect, it } from "vite-plus/test";
import { accelerate, blocked, fallStep, limitJumpSpeed, movement, weapons } from "./physics";

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
  it("crouch movement overcomes stop-speed friction without exceeding its target", () => {
    const v = { x: 0, z: 0 },
      maxSpeed = weapons[2].speed;
    const crouchSpeed = maxSpeed * movement.crouchModifier;
    for (let i = 0; i < 32; i++) accelerate(v, 1, 0, crouchSpeed, 1 / 128, true, maxSpeed);
    expect(v.x).toBeCloseTo(crouchSpeed, 8);
  });
  it("takes about 0.6 seconds to reach AK running speed, rather than snapping to it", () => {
    const v = { x: 0, z: 0 };
    let ticks = 0;
    while (v.x < weapons[0].speed && ticks < 128) {
      accelerate(v, 1, 0, weapons[0].speed, 1 / 128, true);
      ticks++;
    }
    expect(ticks / 128).toBeGreaterThan(0.5);
    expect(ticks / 128).toBeLessThan(0.7);
  });
  it("caps airborne acceleration along the wish direction without clamping sideways momentum", () => {
    const v = { x: weapons[4].speed, z: 0 };
    for (let i = 0; i < 128; i++) accelerate(v, 0, 1, weapons[4].speed, 1 / 128, false);
    expect(v.x).toBe(weapons[4].speed);
    expect(v.z).toBeCloseTo(0.762);
    expect(Math.hypot(v.x, v.z)).toBeGreaterThan(weapons[4].speed);
    accelerate(v, 1, 0, weapons[4].speed, 1 / 128, false);
    expect(v.x).toBe(weapons[4].speed);
  });
  it("air strafing gains speed by turning while forward holding alone does not", () => {
    const strafe = { x: weapons[4].speed, z: 0 },
      straight = { ...strafe };
    for (let i = 0; i < 96; i++) {
      const angle = Math.atan2(strafe.z, strafe.x) + Math.PI / 2;
      accelerate(strafe, Math.cos(angle), Math.sin(angle), weapons[4].speed, 1 / 128, false);
      accelerate(straight, 1, 0, weapons[4].speed, 1 / 128, false);
    }
    expect(Math.hypot(strafe.x, strafe.z)).toBeGreaterThan(8);
    expect(straight.x).toBe(weapons[4].speed);
    limitJumpSpeed(strafe, weapons[4].speed);
    expect(Math.hypot(strafe.x, strafe.z)).toBeCloseTo(6.985);
  });
  it("has a 57-unit jump apex and frame-step independent gravity integration", () => {
    for (const dt of [1 / 64, 1 / 128, 1 / 256]) {
      let y = 0,
        v = movement.jumpImpulse,
        apex = 0,
        time = 0;
      while (time < 0.8) {
        const next = fallStep(v, dt);
        y += next.distance;
        v = next.vertical;
        apex = Math.max(apex, y);
        time += dt;
      }
      expect(apex / 0.0254).toBeCloseTo(57, 1);
      expect(y).toBeCloseTo(movement.jumpImpulse * time - (movement.gravity * time ** 2) / 2, 9);
    }
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
