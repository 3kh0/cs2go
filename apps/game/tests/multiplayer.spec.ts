import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
async function join(page: Page, room: string, team: "ct" | "t") {
  await page.goto(`/?server=ws://127.0.0.1:3002/ws&room=${room}`);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toHaveCount(0);

  await expect(page.locator("#multiplayer-options")).toBeVisible();
  await page.locator("#play").click();
  await page.locator(`#team-select [data-team="${team}"]`).click();
  await page.waitForFunction(() => !!window.__game.network?.connection.local);
}
async function command(request: APIRequestContext, room: string, op: string) {
  const response = await request.post("http://127.0.0.1:3004", { data: { room, op } });
  expect(response.ok()).toBe(true);
  return response.json();
}
test("single-player and multiplayer share Dust II and its normal HUD, buying, rounds and C4", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  const a = await ac.newPage(),
    b = await bc.newPage(),
    room = `dust2-${Date.now()}`;
  const errors: string[] = [];
  for (const page of [a, b]) page.on("pageerror", (e) => errors.push(e.message));
  try {
    await join(a, room, "ct");
    await join(b, room, "t");
    await a.waitForFunction(() => window.__game.network?.connection.round?.phase === "freeze");
    expect(await a.evaluate(() => window.__game.world === window.__game.dust)).toBe(true);
    expect(await a.evaluate(() => "range" in window.__game)).toBe(false);
    await expect(a.locator("#location")).toHaveText("DUST II");
    await a.bringToFront();
    await a
      .locator("#resume")
      .click({ force: true })
      .catch(() => {});
    if (!(await a.evaluate(() => window.__game.locked))) await a.locator("#game").click();
    const before = await a.evaluate(() => ({
      x: window.__game.position.x,
      z: window.__game.position.z,
    }));
    await a.keyboard.down("KeyW");
    await a.waitForTimeout(200);
    await a.keyboard.up("KeyW");
    expect(
      await a.evaluate(() => ({ x: window.__game.position.x, z: window.__game.position.z })),
    ).toEqual(before);
    await a.keyboard.press("KeyB");
    await expect(a.locator("#loadout")).toBeVisible();
    const deagle = a.locator('[data-weapon="8"]');
    await deagle.click();
    await a.waitForFunction(() => window.__game.secondary === 8);
    expect(await a.evaluate(() => window.__game.money)).toBe(300);

    await command(request, room, "live");
    await a.keyboard.down("KeyW");
    await a.waitForTimeout(300);
    await a.keyboard.up("KeyW");
    await expect
      .poll(() =>
        a.evaluate(
          (p) => Math.hypot(window.__game.position.x - p.x, window.__game.position.z - p.z),
          before,
        ),
      )
      .toBeGreaterThan(0.1);

    await command(request, room, "timeout");
    await expect(a.locator("#round-banner-title")).toHaveText("ROUND WON");
    await expect(b.locator("#round-banner-title")).toHaveText("ROUND LOST");
    expect(await a.evaluate(() => window.__game.teamScores.ct)).toBe(1);
    const post = await a.evaluate(() => ({
      x: window.__game.position.x,
      z: window.__game.position.z,
    }));
    await a.keyboard.down("KeyW");
    await a.waitForTimeout(300);
    await a.keyboard.up("KeyW");
    await expect
      .poll(() =>
        a.evaluate(
          (p) => Math.hypot(window.__game.position.x - p.x, window.__game.position.z - p.z),
          post,
        ),
      )
      .toBeGreaterThan(0.1);
    await a.bringToFront();
    if (!(await a.evaluate(() => window.__game.locked))) await a.locator("#resume").click();
    await a.waitForFunction(() => window.__game.locked);

    await a.waitForFunction(() => window.__game.network?.connection.local?.cooldown === 0);
    await a.mouse.down();
    await a.waitForTimeout(100);
    await a.mouse.up();
    await expect.poll(() => a.evaluate(() => window.__game.ammo)).toBeLessThan(7);
    await command(request, room, "reset");
    await a.waitForFunction(() => window.__game.round === 2);

    await command(request, room, "plant");
    await b.bringToFront();
    if (!(await b.evaluate(() => window.__game.locked))) await b.locator("#game").click();
    await b.keyboard.down("KeyE");
    await b.waitForFunction(() => window.__game.bomb?.planted, {}, { timeout: 7000 });
    await b.keyboard.up("KeyE");
    await command(request, room, "defuse");
    await a.bringToFront();
    if (!(await a.evaluate(() => window.__game.locked))) await a.locator("#game").click();
    await a.keyboard.down("KeyE");
    await a.waitForFunction(
      () => window.__game.network?.connection.round?.result?.reason === "Bomb defused",
      {},
      { timeout: 8000 },
    );
    await a.keyboard.up("KeyE");
    await expect(a.locator("#round-mvp-reason")).toContainText("defusing");
    await a.waitForTimeout(400);
    await a.screenshot({ path: "artifacts/dust2-multiplayer-round.png" });
    await a.evaluate(() => window.__game.menu());
    await expect(a.locator("#menu")).toBeVisible();
    await a.locator('[data-session="single"]').click();
    await a.locator("#play").click();
    await a.locator('#team-select [data-team="ct"]').click();
    expect(await a.evaluate(() => !!window.__game.network)).toBe(false);
    expect(await a.evaluate(() => window.__game.bots.length)).toBe(19);
    expect(await a.evaluate(() => window.__game.world === window.__game.dust)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await ac.close();
    await bc.close();
  }
});
