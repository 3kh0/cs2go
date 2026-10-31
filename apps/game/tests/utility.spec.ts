import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("utility purchases, refunds, throws, smoke obstruction and flash exposure", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady, { timeout: 90000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  if (await page.locator("#team-select").isVisible())
    await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.keyboard.press("b");
  await page.locator('[data-grenade="smoke"]').click();
  expect(await page.evaluate(() => window.__game.utility.inventory.smoke)).toBe(1);
  await page.locator('[data-grenade-refund="smoke"]').click();
  expect(await page.evaluate(() => window.__game.utility.inventory.smoke)).toBe(0);
  await page.locator('[data-grenade="smoke"]').click();
  await page.locator("#close-loadout").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = 0;
  });
  await page.keyboard.press("4");
  expect(await page.evaluate(() => window.__game.utility.selected)).toBe("smoke");
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => window.__game.utility.handling.phase)).toBe("held");
  expect(await page.evaluate(() => window.__game.utility.inventory.smoke)).toBe(1);
  expect(await page.evaluate(() => window.__game.utility.projectiles.length)).toBe(0);
  await page.screenshot({ path: "artifacts/grenade-held.png" });
  await page.keyboard.press("3");
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__game.utility.inventory.smoke)).toBe(1);
  expect(await page.evaluate(() => window.__game.utility.projectiles.length)).toBe(0);
  await page.keyboard.press("4");
  await page.mouse.click(700, 450, { button: "right" });
  await page.waitForFunction(() => window.__game.utility.effects.some((e) => e.kind === "smoke"), {
    timeout: 10000,
  });
  const smoke = await page.evaluate(() => {
    const g = window.__game,
      e = g.utility.effects.find((e) => e.kind === "smoke")!;
    e.age = 1;
    const a = e.position.clone();
    a.x -= 6;
    a.y += 1;
    const b = a.clone();
    b.x += 12;
    return {
      count: g.utility.inventory.smoke,
      cells: e.cells.length,
      blocked: !g.utility.clearSight(a, b),
      finite: e.cells.every((c) => Number.isFinite(c.y)),
    };
  });
  expect(smoke).toMatchObject({ count: 0, blocked: true, finite: true });
  expect(smoke.cells).toBeGreaterThan(10);
  await page.screenshot({ path: "artifacts/utility-smoke.png" });
  const flash = await page.evaluate(() => {
    const g = window.__game;
    const position = g.position.clone();
    position.y += g.eye;
    position.z -= 2;
    g.utility.launch(
      "flash",
      "player",
      g.team,
      position,
      position.clone().set(0, 0, 0),
      g.selected,
    );
    const p = g.utility.projectiles.at(-1)!;
    g.utility.detonate(p);
    return g.utility.blind.get("player") ?? 0;
  });
  expect(flash).toBeGreaterThan(0);
  const airborne = await page.evaluate(() => {
    const g = window.__game;
    g.utility.reset();
    const position = g.position.clone();
    position.y = 40;
    g.utility.launch(
      "smoke",
      "player",
      g.team,
      position,
      position.clone().set(0, 0.01, 0),
      g.selected,
    );
    g.utility.projectiles[0].age = 6;
    g.utility.update(1 / 128);
    return { projectiles: g.utility.projectiles.length, effects: g.utility.effects.length };
  });
  expect(airborne).toEqual({ projectiles: 1, effects: 0 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("a lethal enemy HE plays its blast alongside death and renders a visible flash", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.position.set(-17, 0, 17);
    g.yaw = 0;
    g.pitch = -0.15;
    g.updateAimCamera();
    g.invulnerable = 0;
    g.health = 1;
    g.armor = 0;
    const position = g.position.clone();
    position.y += 0.8;
    position.z -= 2;
    g.utility.launch(
      "he",
      0,
      g.team === "t" ? "ct" : "t",
      position,
      position.clone().set(0, 0, 0),
      0,
    );
    g.soundscape.stop();
    g.utility.detonate(g.utility.projectiles.at(-1)!);
    const effect = g.utility.effects.at(-1)!;
    effect.age = 0.05;
    g.utility.renderEffects();
    const voices = [...g.soundscape.voices];
    return {
      dead: g.dead > 0,
      explosion: voices.some(
        (voice) => voice.buffer === g.soundscape.buffers.get("utility-he-explode"),
      ),
      death: voices.some((voice) =>
        [1, 2, 3].some((i) => voice.buffer === g.soundscape.buffers.get(`death-${i}`)),
      ),
      opacity: (effect.visual!.mesh.material as import("three").ShaderMaterial).uniforms.fade.value,
    };
  });
  expect(result).toMatchObject({ dead: true, explosion: true, death: true });
  expect(result.opacity).toBeGreaterThan(0.5);
  await page.screenshot({ path: "artifacts/he-explosion.png" });
  expect(errors).toEqual([]);
});
