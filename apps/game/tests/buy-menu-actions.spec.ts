import { expect, test } from "@playwright/test";
import type * as T from "three";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("Cmd-click buys ground weapons, keeps held items, renders players and places money below radar", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.money = 10000;
    g.freezeTime = g.buyRemaining = g.invulnerable = 1000;
    g.updateUI();
    const bot = g.bots.find((bot) => bot.team === g.team)!;
    bot.group.position
      .copy(g.position)
      .add(g.camera.getWorldDirection(g.position.clone()).multiplyScalar(2));
    bot.group.visible = true;
    bot.group.userData.menuDraws = 0;
    bot.rig.model.traverse((object) => {
      const mesh = object as T.Mesh;
      if (!mesh.isMesh) return;
      const previous = mesh.onBeforeRender.bind(mesh);
      mesh.onBeforeRender = (...args) => {
        if (!document.getElementById("loadout")!.classList.contains("hidden"))
          bot.group.userData.menuDraws++;
        previous(...args);
      };
    });
  });
  await expect(page.locator("#economy-hud")).toHaveText("$10,000");
  const radar = await page.locator("#radar").boundingBox(),
    money = await page.locator("#economy-hud").boundingBox();
  expect(money!.y).toBeGreaterThanOrEqual(radar!.y + radar!.height);
  expect(money!.y).toBeLessThan(radar!.y + radar!.height + 25);
  expect(money!.x).toBeCloseTo(radar!.x, 0);
  await expect(page.locator("#equipment-status, #buy-status")).toHaveCount(0);
  await page.keyboard.press("b");
  const held = await page.evaluate(() => ({
    inventory: window.__game.inventory(),
    weapon: window.__game.selected,
    ammo: window.__game.ammo,
  }));
  const rifle = page.locator('#loadout [data-weapon="9"]');
  await rifle.click({ modifiers: ["Meta"] });
  await expect(page.locator("#loadout")).toBeVisible();
  await expect(page.locator("#economy-hud")).toHaveText("$7,100");
  await expect(page.locator("#buy-dropped-items > div")).toHaveCount(1);
  await expect(page.locator("#buy-dropped-items img")).toHaveAttribute(
    "src",
    /\/icons\/buy\/m4a1\.svg$/,
  );
  await page.waitForTimeout(1700);
  expect(
    await page.evaluate(() => ({
      inventory: window.__game.inventory(),
      weapon: window.__game.selected,
      ammo: window.__game.ammo,
    })),
  ).toEqual(held);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          window.__game.bots.find((bot) => bot.team === window.__game.team)!.group.userData
            .menuDraws,
      ),
    )
    .toBeGreaterThan(0);
  await page.screenshot({ path: "artifacts/buy-menu-players-and-drop.png" });
  await rifle.click();
  await page.waitForFunction(() => window.__game.locked);
  await page.keyboard.press("b");
  const serial = await page.evaluate(() => window.__game.groundInventory.playerWeapon(9).serial);
  await rifle.click({ modifiers: ["Meta"] });
  await expect(page.locator("#economy-hud")).toHaveText("$1,300");
  await expect(page.locator("#buy-dropped-items > div")).toHaveCount(2);
  expect(await page.evaluate(() => window.__game.groundInventory.playerWeapon(9).serial)).toBe(
    serial,
  );
  await rifle.click({ modifiers: ["Meta"] });
  await expect(page.locator("#buy-dropped-items > div")).toHaveCount(2);
  await expect(page.locator("#economy-hud")).toHaveText("$1,300");
  expect(errors).toEqual([]);
});
