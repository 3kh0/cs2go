import { expect, it } from "vitest";
import { GrenadeHandling } from "./grenade-handling";
function advance(h: GrenadeHandling, seconds: number) {
  const throws: number[] = [];
  for (let i = 0; i < Math.ceil(seconds * 128); i++) {
    const strength = h.update(1 / 128);
    if (strength !== null) throws.push(strength);
  }
  return throws;
}
it("holds indefinitely without cooking, then releases exactly once", () => {
  const h = new GrenadeHandling();
  h.press(0);
  expect(advance(h, 8)).toEqual([]);
  expect(h.phase).toBe("held");
  h.release(0);
  expect(advance(h, 2)).toEqual([1]);
});
it("quick clicks finish pulling the pin before releasing", () => {
  const h = new GrenadeHandling();
  h.press(2);
  h.release(2);
  expect(advance(h, 0.3)).toEqual([]);
  expect(advance(h, 2)).toEqual([0]);
});
it("supports medium throws and changing strength while held", () => {
  const h = new GrenadeHandling();
  h.press(0);
  h.press(2);
  advance(h, 0.5);
  h.release(0);
  h.release(2);
  expect(advance(h, 2)).toEqual([0.5]);
  h.press(0);
  h.press(2);
  advance(h, 0.5);
  h.release(0);
  advance(h, 0.2);
  h.release(2);
  expect(advance(h, 2)).toEqual([0]);
});
it("cancellation discards pending release and input state", () => {
  const h = new GrenadeHandling();
  h.press(0);
  h.release(0);
  advance(h, 0.4);
  h.cancel();
  expect(advance(h, 2)).toEqual([]);
  h.press(2);
  h.release(2);
  expect(advance(h, 2)).toEqual([0]);
});
