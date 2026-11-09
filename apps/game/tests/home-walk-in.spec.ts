import { expect, test } from "@playwright/test";
import type * as T from "three";

type Frame = {
  fading: boolean;
  covered: boolean;
  walking: boolean;
  elapsed: number;
  depth: number;
  weight: number;
  idleRunning: boolean;
  position: number[];
};

for (const skip of [false, true]) {
  test(`walk-in is positioned under the splash before ${skip ? "skipping" : "automatic"} fade`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (skip)
      await page.route("**/ctm-fbi.glb", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });
    await page.addInitScript((skip) => {
      if (skip) localStorage.setItem("cs2go-agents", JSON.stringify({ ct: "agent-5300-ct" }));
      const frames: Frame[] = [];
      Object.assign(window, { walkInFrames: frames });
      let revealing = false,
        after = 0;
      const sample = () => {
        const splash = document.getElementById("startup");
        revealing ||= !!splash?.classList.contains("startup-walk-in");
        const home = window.__game?.homeScene as unknown as
          | {
              camera: T.PerspectiveCamera;
              previews: Map<
                string,
                {
                  soldier: { group: T.Group; model: T.Group };
                  idleVariation?: {
                    current?: T.AnimationAction;
                    entrance?: T.AnimationAction;
                    idle?: T.AnimationAction;
                  };
                }
              >;
            }
          | undefined;
        const preview = home?.previews.get("ct");
        if (revealing && preview) {
          const state = preview.idleVariation,
            position = preview.soldier.group.position;
          const pelvis = preview.soldier.model.getObjectByName("pelvis")!;
          const body = pelvis
            .getWorldPosition(position.clone())
            .applyMatrix4(home!.camera.matrixWorldInverse);
          frames.push({
            fading: !!splash?.classList.contains("startup-exit"),
            covered: !!splash && !splash.classList.contains("startup-exit"),
            walking: !!state?.current && state.current === state.entrance,
            elapsed: state?.current?.time ?? 0,
            depth: -body.z,
            weight: state?.current?.getEffectiveWeight() ?? 0,
            idleRunning: state?.idle?.isRunning() ?? false,
            position: [position.x, position.y, position.z],
          });
        }
        if (!splash && revealing && ++after >= 30) return;
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    }, skip);
    await page.goto("/");
    await expect(page.locator(".startup-title")).toBeVisible({ timeout: 120_000 });
    if (skip) await page.keyboard.press("Enter");
    await expect(page.locator("#startup")).toHaveCount(0, { timeout: 30_000 });
    await page.waitForTimeout(600);
    const frames = await page.evaluate(
      () => (window as unknown as { walkInFrames: Frame[] }).walkInFrames,
    );
    expect(frames.some((frame) => frame.covered && frame.walking && frame.elapsed > 0)).toBe(true);
    const visible = frames.filter((frame) => !frame.covered);
    expect(visible.length).toBeGreaterThan(5);
    expect(visible[0]!.walking).toBe(true);
    expect(visible[0]!.elapsed).toBeGreaterThan(0);
    // Authored pelvis motion advances toward the camera. Neither an idle
    // crossfade nor a second group translation should drag it backward.
    expect(visible[0]!.weight).toBeCloseTo(1, 5);
    expect(visible[0]!.idleRunning).toBe(false);
    expect(visible[0]!.depth - visible.at(-1)!.depth).toBeGreaterThan(0.05);
    for (let i = 1; i < visible.length; i++) {
      const delta = Math.hypot(
        ...visible[i]!.position.map((value, axis) => value - visible[i - 1]!.position[axis]!),
      );
      expect(delta).toBeLessThan(0.001);
      expect(visible[i]!.depth - visible[i - 1]!.depth).toBeLessThan(0.015);
    }
    expect(errors).toEqual([]);
    await page.screenshot({ path: `artifacts/home-walk-in-${skip ? "skip" : "automatic"}.png` });
  });
}
