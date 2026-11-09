import { expect, test } from "@playwright/test";
import { selectHomeTeam, selectHomeWeapon } from "./home-controls";
import { defaultLoadouts } from "../src/loadouts";

test("saved showcase is usable while the rest of the armory loads, without duplicate downloads", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  const loadouts = defaultLoadouts();
  loadouts.ct[loadouts.ct.indexOf(35)] = 36;
  await page.addInitScript((loadouts) => {
    localStorage.setItem("cs2go-home-weapons", JSON.stringify({ ct: 3, t: 8 }));
    localStorage.setItem("cs2go-loadouts", JSON.stringify(loadouts));
  }, loadouts);
  const errors: string[] = [];
  const requests = new Map<string, number>();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (/\/models\/(?:viewmodels\/|animations\/knives\/|agents\/view-hands\.glb)/.test(path))
      requests.set(path, (requests.get(path) ?? 0) + 1);
  });
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/models/viewmodels/negev-hd.glb", async (route) => {
    await held;
    await route.continue();
  });
  try {
    const started = Date.now();
    await page.goto("/");
    await page.waitForFunction(() => window.__game?.menuReady, undefined, { timeout: 100_000 });
    await expect(page.locator("#startup")).toHaveCount(0);
    await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "3");
    await expect.poll(() => requests.has("/models/viewmodels/negev-hd.glb")).toBe(true);
    await expect(page.locator("#play")).toBeDisabled();
    expect(await page.evaluate(() => window.__game.assetsReady)).toBe(false);
    const menuMs = Date.now() - started;
    await page.screenshot({ path: "../../artifacts/startup-menu-background-armory.png" });

    await selectHomeTeam(page, "t");
    await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "8");
    await selectHomeTeam(page, "ct");
    await page.locator("#settings-button").click();
    await expect(page.locator("#settings")).toBeVisible();
    await page.locator("#close-settings").click();
    await page.locator("#inventory-button").click();
    await expect(page.locator('#loadout-editor [role="status"]')).toHaveText(
      "Preparing your loadout...",
    );
    await page.locator("#home-button").click();
    await expect(page.locator("#loadout-editor")).toHaveCount(0);

    await selectHomeWeapon(page, 36);
    await expect(page.locator("#home-agent-status")).toHaveText("Loading weapon...");
    await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "3");
    await page.evaluate(async () => {
      await window.__game.homeScene.playAnimation("ct", "weapon/ak::ct_buymenu_ak");
      window.__game.homeScene.stopAnimation("ct");
    });
    await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "9");
    await selectHomeWeapon(page, 1);
    await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "1", {
      timeout: 60_000,
    });
    release();
    await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
    await expect(page.locator("#loadout-editor")).toHaveCount(0);
    await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "1");
    const geometry = await page.evaluate(async () => {
      const path = "/src/physics.ts";
      const { weapons } = (await import(path)) as typeof import("../src/physics");
      return weapons.map((weapon, index) => {
        const gun = window.__game.viewGun(index);
        let vertices = 0;
        gun.getObjectByName("weapon-model")?.traverse((object) => {
          const mesh = object as import("three").Mesh;
          if (mesh.isMesh) vertices += mesh.geometry.getAttribute("position").count;
        });
        return { name: weapon.name, vertices, arms: !!gun.getObjectByName("agent-view-arms") };
      });
    });
    for (const model of geometry) {
      expect(model.vertices, `${model.name} has no loaded weapon geometry`).toBeGreaterThan(100);
      expect(model.arms, `${model.name} has no loaded hands`).toBe(true);
    }
    expect([...requests.values()].every((count) => count === 1)).toBe(true);
    expect(errors).toEqual([]);
    console.log(
      JSON.stringify({ menuMs, readyMs: Date.now() - started, modelRequests: requests.size }),
    );
  } finally {
    release();
  }
});

test("a failed background weapon keeps the ready homepage usable and prevents match entry", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/models/viewmodels/negev-hd.glb", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 100_000 });
  await expect(page.locator("#play")).toHaveText("ARMORY UNAVAILABLE", { timeout: 100_000 });
  await expect(page.locator("#play")).toBeDisabled();
  await page.locator("#settings-button").click();
  await expect(page.locator("#settings")).toBeVisible();
  await page.locator("#close-settings").click();
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "9");
  expect(errors).toEqual([]);
});
