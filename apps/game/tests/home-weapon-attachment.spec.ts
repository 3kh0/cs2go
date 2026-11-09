import { expect, test } from "@playwright/test";

test("T AK stays in the hands across home gestures and a legacy finish", async ({ page }) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.evaluate(() => {
    window.__game.team = "t";
  });
  await page.waitForFunction(() => {
    const home = window.__game.homeScene as unknown as {
      previews: Map<string, { idleVariation?: { initialized: boolean } }>;
    };
    return home.previews.get("t")?.idleVariation?.initialized;
  });
  for (const skin of ["", "7_801"]) {
    await page.evaluate(async (id) => {
      const path = "/src/skins.ts";
      const { setSkin } = (await import(path)) as typeof import("../src/skins");
      await setSkin(0, { id, wear: 0.12, seed: 1 });
    }, skin);
    const poses = await page.evaluate(async () => {
      const path = "/src/preview-framing.ts",
        three = "/tests/three-fixture.ts";
      const { previewBounds } = (await import(path)) as typeof import("../src/preview-framing");
      const { Vector3 } = (await import(three)) as typeof import("three");
      type Preview = {
        weapon: import("three").Group;
        mixer: import("three").AnimationMixer;
        soldier: { group: import("three").Group; rightHand: import("three").Object3D };
        idleVariation: {
          idle: import("three").AnimationAction;
          actions: import("three").AnimationAction[];
        };
      };
      const home = window.__game.homeScene as unknown as {
        previews: Map<string, Preview>;
        updateIdleVariation(): void;
        render(renderer: import("three").WebGLRenderer, team: "t", dt: number): void;
      };
      const preview = home.previews.get("t")!;
      home.updateIdleVariation = () => {};
      const samples = [];
      for (const action of [preview.idleVariation.idle, ...preview.idleVariation.actions])
        for (const fraction of [0, 0.5, 0.95]) {
          preview.mixer.stopAllAction();
          action.reset().play();
          action.time = action.getClip().duration * fraction;
          preview.mixer.update(0);
          home.render(window.__game.renderer, "t", 0);
          const center = previewBounds([preview.weapon]).getCenter(new Vector3());
          const hand = preview.soldier.rightHand.getWorldPosition(new Vector3());
          samples.push({
            clip: action.getClip().name,
            height: center.y - preview.soldier.group.position.y,
            distance: center.distanceTo(hand),
          });
        }
      return samples;
    });
    expect(poses.length).toBeGreaterThanOrEqual(18);
    for (const pose of poses) {
      expect(pose.height, pose.clip).toBeGreaterThan(0.7);
      expect(pose.distance, pose.clip).toBeLessThan(0.5);
    }
    await page.screenshot({ path: `artifacts/home-ak-${skin ? "asiimov" : "default"}.png` });
  }
  expect(errors).toEqual([]);
});
