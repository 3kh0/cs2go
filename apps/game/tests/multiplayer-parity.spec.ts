import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { readFileSync } from "node:fs";
test.use({ actionTimeout: 15000 });
const catalog = JSON.parse(
  readFileSync(
    new URL("../../../packages/assets/public/skins/catalog.json", import.meta.url),
    "utf8",
  ),
) as { id: string; name: string; weapon: number }[];
async function join(page: Page, room: string, team: "ct" | "t") {
  await page.goto(`/?server=ws://127.0.0.1:3002/ws&room=${room}`);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#play").click();
  await page.locator(`#team-select [data-team="${team}"]`).click();
  await page.waitForFunction(() => !!window.__game.network?.connection.local);
}
async function command(request: APIRequestContext, room: string, op: string) {
  const response = await request.post("http://127.0.0.1:3004", { data: { room, op } });
  expect(response.ok()).toBe(true);
  return response.json();
}
async function focus(page: Page) {
  await page.bringToFront();
  if (!(await page.evaluate(() => window.__game.locked))) await page.locator("#game").click();
  await page.waitForFunction(() => window.__game.locked);
}
async function aim(page: Page, yaw: number) {
  await page.evaluate((yaw) => {
    const g = window.__game;
    g.yaw = yaw;
    g.pitch = 0;
  }, yaw);
}
async function throwUnderhand(page: Page, kind: "flash" | "smoke" | "molotov") {
  await focus(page);
  await page.evaluate((kind) => window.__game.utility.select(kind), kind);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(1300);
  await page.mouse.up({ button: "right" });
}
test("headshot audio, shared skins, refunds and grenade effects retain the normal gameplay presentation", async ({
  browser,
  request,
}) => {
  test.setTimeout(300000);
  const ac = await browser.newContext(),
    bc = await browser.newContext(),
    a = await ac.newPage(),
    b = await bc.newPage();
  const room = `parity-${Date.now()}`,
    errors: string[] = [];
  for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
  const usp = catalog.find((skin) => skin.weapon === 2 && skin.name === "Ticket to Hell")!;
  const ak = catalog.find((skin) => skin.weapon === 0 && skin.name === "Asiimov")!;
  try {
    await a.addInitScript(
      ({ id }) =>
        localStorage.setItem("cs2go-skins-v1", JSON.stringify({ 2: { id, wear: 0.1, seed: 1 } })),
      usp,
    );
    await b.addInitScript(
      ({ id }) =>
        localStorage.setItem("cs2go-skins-v1", JSON.stringify({ 0: { id, wear: 0.1, seed: 1 } })),
      ak,
    );
    await join(a, room, "ct");
    await join(b, room, "t");
    await a.waitForFunction(() => window.__game.network?.connection.round?.phase === "freeze");
    expect(
      await a.evaluate(() => window.__game.network!.connection.local!.appearances[2].skin.id),
    ).toBe(usp.id);
    const duel = await command(request, room, "duel");
    await focus(a);
    await aim(a, duel.players.find((p: { team: string }) => p.team === "ct").yaw);
    await a.evaluate(() => {
      const g = window.__game,
        original = g.sound.bind(g);
      g.scene.userData.networkSounds = [];
      g.sound = (...args) => {
        g.scene.userData.networkSounds.push(args[0]);
        original(...args);
      };
    });
    await a.waitForFunction(() => window.__game.network!.connection.local!.cooldown === 0);
    await a.mouse.down();
    await a.mouse.up();
    await expect
      .poll(() => a.evaluate(() => window.__game.scene.userData.networkSounds))
      .toContain("head");
    await expect.poll(() => b.evaluate(() => window.__game.health)).toBeLessThan(100);
    await expect(a.locator("#inventory")).toContainText("Ticket to Hell");

    await command(request, room, "at-buy");
    await command(request, room, "rich");
    await focus(b);
    await b.keyboard.press("KeyB");
    await b.locator('[data-weapon="0"]').click();
    await b.waitForFunction(() => window.__game.selected === 0);
    expect(await b.evaluate(() => window.__game.groundInventory.playerWeapon(0).skin.id)).toBe(
      ak.id,
    );
    await b.keyboard.press("KeyB");
    await b.locator('[data-refund="0"]').click();
    await b.waitForFunction(() => window.__game.primary === null);
    await b.locator('[data-weapon="0"]').click();
    await b.waitForFunction(() => window.__game.selected === 0);
    await focus(a);
    await a.keyboard.press("KeyB");
    await a.locator('[data-grenade="flash"]').click();
    await a.waitForFunction(() => window.__game.utility.inventory.flash === 1);
    await a.locator('[data-grenade="smoke"]').click();
    await a.waitForFunction(() => window.__game.utility.inventory.smoke === 1);
    await a.locator('[data-grenade="he"]').click();
    await a.waitForFunction(() => window.__game.utility.inventory.he === 1);
    await a.locator('[data-grenade-refund="he"]').click();
    await a.waitForFunction(() => window.__game.utility.inventory.he === 0);
    await a.locator("#close-loadout").click();
    const duel2 = await command(request, room, "duel");
    await focus(b);
    await aim(b, duel2.players.find((p: { team: string }) => p.team === "t").yaw);
    await b.keyboard.press("KeyG");
    await expect
      .poll(() =>
        a.evaluate(() =>
          window.__game.network!.connection.round!.drops.some(
            (drop) => drop.weapon === 0 && drop.appearance.skin.id !== "",
          ),
        ),
      )
      .toBe(true);
    await focus(a);
    await aim(a, duel2.players.find((p: { team: string }) => p.team === "ct").yaw);
    await a.keyboard.down("KeyW");
    await a.waitForTimeout(250);
    await a.keyboard.up("KeyW");
    await a.keyboard.press("KeyE");
    await a.waitForFunction(() => window.__game.primary === 0);
    expect(await a.evaluate(() => window.__game.groundInventory.playerWeapon(0).skin.id)).toBe(
      ak.id,
    );
    await expect(a.locator("#inventory")).toContainText("Asiimov");
    await throwUnderhand(a, "flash");
    await expect
      .poll(() => a.evaluate(() => window.__game.utility.blind.get("player") ?? 0), {
        timeout: 10000,
      })
      .toBeGreaterThan(0);
    await a.waitForTimeout(5000);
    await throwUnderhand(a, "smoke");
    await expect
      .poll(
        () =>
          a.evaluate(() => window.__game.utility.effects.some((effect) => effect.kind === "smoke")),
        { timeout: 12000 },
      )
      .toBe(true);
    await expect
      .poll(
        () =>
          b.evaluate(() => window.__game.utility.effects.some((effect) => effect.kind === "smoke")),
        { timeout: 12000 },
      )
      .toBe(true);
    await a.screenshot({ path: "artifacts/multiplayer-shared-smoke.png" });
    await a.evaluate(() => window.__game.menu());
    await b.evaluate(() => window.__game.menu());
    expect(errors).toEqual([]);
  } finally {
    await ac.close();
    await bc.close();
  }
});
