import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("radar settings persist and native map modes share the same projection", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const missing: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() === 404) missing.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#settings-button").click();
  await page.locator("#tab-radar").click();
  await page.locator("#radarRotate").selectOption("0");
  await page.locator("#radarCentered").selectOption("0");
  await page.locator("#radarTeammateColors").selectOption("2");
  await page.locator("#radarScale").fill("0.35");
  await page.locator("#radarScale").dispatchEvent("input");
  await page.locator("#radarAlternateScale").fill("0.85");
  await page.locator("#radarAlternateScale").dispatchEvent("input");
  await page.screenshot({ path: "artifacts/radar-settings.png" });
  await page.locator("#close-settings").click();
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  expect(
    await page.evaluate(() => {
      const s = window.__game.settings;
      return [
        s.radarRotate,
        s.radarCentered,
        s.radarScale,
        s.radarAlternateScale,
        s.radarTeammateColors,
      ];
    }),
  ).toEqual([false, false, 0.35, 0.85, 2]);
  await page.evaluate(() => {
    const g = window.__game;
    g.start("competitive");
    g.active = true;
    g.simulate = () => {};
    g.settings.radarCentered = g.settings.radarRotate = true;
    g.settings.radarScale = 0.7;
    g.settings.radarAlternateScale = 1;
    g.yaw = Math.PI / 3;
    g.updateAimCamera();
    document.getElementById("scoreboard")!.classList.add("hidden");
    g.drawMap(document.querySelector<HTMLCanvasElement>("#radar")!, true);
  });
  await expect(page.locator(".radar-wrap")).toHaveAttribute("data-square", "false");
  await expect(page.locator("#radar")).toHaveCSS("border-top-left-radius", "50%");
  await page.screenshot({ path: "artifacts/radar-circle.png" });
  const blended = await page
    .locator(".radar-wrap")
    .screenshot({ path: "artifacts/radar-blended.png" });
  await page.evaluate(() => {
    window.__game.settings.radarMapBlend = false;
  });
  await expect(page.locator(".radar-map-layer")).toHaveCSS("mix-blend-mode", "normal");
  const opaque = await page
    .locator(".radar-wrap")
    .screenshot({ path: "artifacts/radar-unblended.png" });
  expect(blended.equals(opaque)).toBe(false);
  await page.evaluate(() => {
    window.__game.settings.radarMapBlend = true;
  });
  await page.evaluate(() => {
    window.__game.locked = true;
  });
  await page.keyboard.press("h");
  expect(await page.evaluate(() => window.__game.radarAlternate)).toBe(true);
  await page.keyboard.down("Tab");
  await expect(page.locator(".radar-wrap")).toHaveAttribute("data-square", "true");
  await page.screenshot({ path: "artifacts/radar-scoreboard.png" });
  await page.keyboard.up("Tab");
  await expect(page.locator(".radar-wrap")).toHaveAttribute("data-square", "false");
  await page.evaluate(() => {
    window.__game.settings.radarSquare = true;
  });
  await expect(page.locator(".radar-wrap")).toHaveAttribute("data-square", "true");
  await page.evaluate(() => {
    const g = window.__game;
    g.settings.radarSquare = false;
    g.mode = "deathmatch";
    g.updateUI();
  });
  await expect(page.locator(".radar-wrap")).toHaveAttribute("data-square", "false");
  await page.screenshot({ path: "artifacts/radar-deathmatch.png" });
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});

test("real map walls stop enemy radar tracking and round reset clears remembered contacts", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.start("competitive");
    g.active = false;
    g.bots.forEach((b) => {
      b.health = 0;
    });
    const enemy = g.bots.find((b) => b.team !== g.team)!;
    const id = g.bots.indexOf(enemy);
    const from = g.position.clone();
    from.y += g.eye;
    const positions = g.world.navigation.areas.map((area) =>
      g.position.clone().fromArray(area.center),
    );
    const open = positions.find(
      (p) =>
        p.distanceTo(g.position) > 2 &&
        p.distanceTo(g.position) < 15 &&
        g.visible(from, p.clone().add({ x: 0, y: 1.3, z: 0 })),
    )!;
    const hidden = positions.find(
      (p) =>
        p.distanceTo(g.position) > 3 &&
        p.distanceTo(g.position) < 30 &&
        !g.visible(from, p.clone().add({ x: 0, y: 1.3, z: 0 })),
    )!;
    if (!open || !hidden)
      throw new Error("Need actual open and wall-obstructed navigation positions");
    enemy.health = 100;
    enemy.group.position.copy(open);
    g.yaw = Math.atan2(g.position.x - open.x, g.position.z - open.z);
    g.radar.reset();
    const visible = g.radar.sample(g, 100).markers.find((m) => m.id === id);
    enemy.group.position.copy(hidden);
    g.yaw = Math.atan2(g.position.x - hidden.x, g.position.z - hidden.z);
    const remembered = g.radar.sample(g, 100.5).markers.find((m) => m.id === id);
    const expired = g.radar.sample(g, 110).markers.find((m) => m.id === id);
    g.round++;
    const reset = g.radar.sample(g, 111).markers.find((m) => m.id === id);
    return { visible, remembered, expired, reset, open: { x: open.x, y: open.y, z: open.z } };
  });
  expect(result.visible?.kind).toBe("enemy");
  expect(result.remembered?.position).toEqual(result.open);
  expect(result.remembered?.uncertain).toBe(true);
  expect(result.expired).toBeUndefined();
  expect(result.reset).toBeUndefined();
});
