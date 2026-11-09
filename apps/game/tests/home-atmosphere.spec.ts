import { test, expect } from "@playwright/test";
import type * as T from "three";
import { selectHomeWeapon } from "./home-controls";

test("native atmosphere drifts at scene depth and selectors use equipped items", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const missing: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/models/home/"))
      missing.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  const read = () =>
    page.evaluate(() => {
      const root = window.__game.homeScene.graphicsRoot;
      const haze = root.getObjectByName("home-haze")!;
      const dust = root.getObjectByName("home-ground-dust") as T.InstancedMesh;
      const paper = root.getObjectByName("home-windblown-paper")!;
      return {
        backdrops: haze.children.filter((mesh) => mesh !== dust).length,
        dust: dust.count,
        dustMatrices: Array.from(dust.instanceMatrix.array).slice(0, dust.count * 16),
        paper: paper.children.map((mesh) => ({
          count: (mesh as T.InstancedMesh).count,
          matrix: [...(mesh as T.InstancedMesh).instanceMatrix.array],
        })),
      };
    });
  const before = await read();
  expect(before.backdrops).toBe(14);
  expect(before.dust).toBeGreaterThan(0);
  expect(before.dust).toBeLessThanOrEqual(128);
  expect(before.paper.reduce((sum, mesh) => sum + mesh.count, 0)).toBeGreaterThan(0);
  await page.screenshot({ path: "artifacts/home-atmosphere-before.png" });
  await page.waitForTimeout(1500);
  const after = await read();
  expect(after.dustMatrices).not.toEqual(before.dustMatrices);
  expect(after.paper).not.toEqual(before.paper);
  expect(after.dustMatrices.every(Number.isFinite)).toBe(true);
  await page.screenshot({ path: "artifacts/home-atmosphere-after.png" });

  await page.locator("#home-scenery-button").click();
  await page.getByRole("button", { name: "Change Weapon", exact: true }).click();
  const expected = await page.evaluate(() => window.__game.groundInventory.loadouts.ct);
  const actual = await page
    .locator("[data-home-weapon]")
    .evaluateAll((buttons) =>
      buttons.map((button) => Number((button as HTMLElement).dataset.homeWeapon)),
    );
  expect(actual).toEqual([37, ...expected]);
  await page.locator('[data-home-weapon="37"]').click();
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "37", {
    timeout: 60_000,
  });
  await expect(page.locator("#home-agent-stage")).toHaveAttribute(
    "data-clip",
    /^ct_main_menu_knife_/,
    { timeout: 60_000 },
  );
  await page.screenshot({ path: "artifacts/home-equipped-knife.png" });
  await selectHomeWeapon(page, 9);
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "9");
  await page.waitForFunction(() => {
    const home = window.__game.homeScene as unknown as {
      previews: Map<string, { idleVariation?: { initialized?: boolean } }>;
    };
    return home.previews.get("ct")?.idleVariation?.initialized;
  });
  // Completing an idle should select the next authored gesture without an
  // additional random pause. Exercise the real mixer/scheduler together.
  await page.evaluate(() => {
    const home = window.__game.homeScene as unknown as {
      previews: Map<
        string,
        {
          action: T.AnimationAction;
          idleVariation: { current?: T.AnimationAction; returning: boolean };
        }
      >;
    };
    const preview = home.previews.get("ct")!;
    preview.idleVariation.current?.stop();
    preview.idleVariation.current = undefined;
    preview.idleVariation.returning = false;
    preview.action.reset().setEffectiveWeight(1).play();
    preview.action.time = preview.action.getClip().duration - 0.3;
  });
  await page.waitForFunction(
    () => {
      const home = window.__game.homeScene as unknown as {
        previews: Map<string, { idleVariation: { current?: T.AnimationAction } }>;
      };
      return !!home.previews.get("ct")!.idleVariation.current;
    },
    undefined,
    { timeout: 5000 },
  );
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-view-loadout").click();
  await expect(page.locator("#loadout-category")).toHaveValue("Agents");
  await expect(page.locator('.loadout-team[data-team="ct"]')).toBeVisible();
  await page.locator("#home-button").click();

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const frozen = await read();
  await page.waitForTimeout(400);
  expect(await read()).toEqual(frozen);
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});

test("paired knives keep both native hand contacts during menu gestures", async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() =>
    localStorage.setItem("cs2go-equipped-knives", JSON.stringify({ ct: 46, t: 38 })),
  );
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 90_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await selectHomeWeapon(page, 46);
  await expect(page.locator("#home-agent-stage")).toHaveAttribute(
    "data-clip",
    /^ct_main_menu_pushknife_/,
    { timeout: 30_000 },
  );
  for (const fraction of [0.2, 0.5, 0.8]) {
    await page.evaluate((fraction) => {
      const home = window.__game.homeScene as any;
      const preview = home.previews.get("ct");
      const state = preview.idleVariation;
      const action = state.actions.find((a: T.AnimationAction) =>
        a.getClip().name.includes("lookat01"),
      );
      preview.mixer.stopAllAction();
      state.current = action;
      state.returning = false;
      action.reset().setEffectiveWeight(1).play();
      action.paused = true;
      action.time = action.getClip().duration * fraction;
      preview.mixer.update(0);
    }, fraction);
    await page.waitForTimeout(100);
    const contacts = await page.evaluate(() => {
      const home = window.__game.homeScene as any;
      const preview = home.previews.get("ct");
      const vector = preview.weapon.position.clone();
      return ["L", "R"].map((side) =>
        preview.weapon
          .getObjectByName(`weapon_hand_${side.toLowerCase()}`)
          .getWorldPosition(vector.clone())
          .distanceTo(
            preview.soldier.model.getObjectByName(`hand_${side}`).getWorldPosition(vector.clone()),
          ),
      );
    });
    for (const distance of contacts) expect(distance).toBeLessThan(0.025);
    await page.screenshot({ path: `artifacts/home-paired-knife-${fraction}.png` });
  }
  expect(errors).toEqual([]);
});
