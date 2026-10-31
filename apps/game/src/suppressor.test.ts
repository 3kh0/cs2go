import { expect, test } from "vitest";
import { SuppressorState } from "./suppressor";
test("cancellation preserves whichever side of the native attachment event was reached", () => {
  const state = new SuppressorState();
  state.start(3, 0.7);
  state.update(1);
  state.cancel();
  expect(state.attached).toBe(true);
  state.start(3, 0.7);
  state.update(2.2);
  expect(state.attached).toBe(false);
  state.cancel();
  expect(state.attached).toBe(false);
  state.start(3, 0.7);
  expect(state.action).toBe("silencer_attach");
  state.update(3);
  expect(state.attached).toBe(true);
  expect(state.action).toBeNull();
});
