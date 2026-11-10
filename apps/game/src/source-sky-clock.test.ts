import { expect, test, vi } from "vitest";
import { sourceSkyFrameTime, withSourceSkyFrame } from "./source-sky-clock";

test("standalone sky renders retain the live wall clock", () => {
  let now = 1000;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    expect(sourceSkyFrameTime()).toBe(1);
    now = 1040;
    expect(sourceSkyFrameTime()).toBe(1.04);
  } finally {
    clock.mockRestore();
  }
});

test("slow capture/final passes share one 30 Hz bucket but the next frame advances", () => {
  let now = 1000;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    const times = withSourceSkyFrame(() => {
      const first = sourceSkyFrameTime();
      now = 1080;
      return [first, sourceSkyFrameTime()];
    });
    expect(times).toEqual([1, 1]);
    expect(times.map((time) => Math.floor(time * 30))).toEqual([30, 30]);
    expect(withSourceSkyFrame(() => sourceSkyFrameTime())).toBe(1.08);
  } finally {
    clock.mockRestore();
  }
});

test("nested renders preserve an outer zero timestamp and restore through errors", () => {
  let now = 0;
  const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
  try {
    expect(() =>
      withSourceSkyFrame(() => {
        now = 100;
        expect(() =>
          withSourceSkyFrame(() => {
            expect(sourceSkyFrameTime()).toBe(0);
            throw new Error("nested render");
          }),
        ).toThrow("nested render");
        expect(sourceSkyFrameTime()).toBe(0);
        now = 200;
        throw new Error("outer render");
      }),
    ).toThrow("outer render");
    expect(sourceSkyFrameTime()).toBe(0.2);
    expect(withSourceSkyFrame(() => "rendered")).toBe("rendered");
  } finally {
    clock.mockRestore();
  }
});
