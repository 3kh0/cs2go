import { expect, test, type Page, type APIRequestContext } from "@playwright/test";
import { writeFileSync } from "node:fs";
test.use({ actionTimeout: 15000 });
async function join(page: Page, room: string, team: "ct" | "t") {
  await page.goto(`/?server=ws://127.0.0.1:3002/ws&room=${room}`);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toHaveCount(0);

  await expect(page.locator("#multiplayer-options")).toBeVisible();
  await page.locator("#home-play").click();
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
    await expect(a.locator("#match-waiting")).toBeVisible();
    expect(
      await a.evaluate(() => {
        const g = window.__game,
          ball = g.network!.connection.round!.ball;
        return Math.hypot(
          g.dust!.ball.origin.x - ball.x,
          g.dust!.ball.origin.y - ball.y,
          g.dust!.ball.origin.z - ball.z,
        );
      }),
    ).toBeLessThan(0.005);
    const waiting = await a.locator("#match-waiting").boundingBox();
    const actionPosition = await a.locator("#bomb-action").evaluate((node) => {
      const element = node as HTMLElement;
      element.style.visibility = "hidden";
      element.classList.remove("hidden");
      const rect = element.getBoundingClientRect();
      element.classList.add("hidden");
      element.style.removeProperty("visibility");
      return { top: rect.y, left: rect.x + rect.width / 2 };
    });
    expect(waiting!.y).toBeCloseTo(actionPosition.top, 0);
    expect(waiting!.x + waiting!.width / 2).toBeCloseTo(actionPosition.left, 0);
    await a.bringToFront();
    if (!(await a.evaluate(() => window.__game.locked))) await a.locator("#game").click();
    const waitingStart = await a.evaluate(() => window.__game.network!.connection.local!.z);
    await a.keyboard.down("KeyW");
    await a.waitForTimeout(500);
    await a.keyboard.up("KeyW");
    await expect
      .poll(() =>
        a.evaluate((z) => Math.abs(window.__game.network!.connection.local!.z - z), waitingStart),
      )
      .toBeGreaterThan(0.1);
    await a.screenshot({ path: "artifacts/dust2-waiting.png" });
    await expect(a.locator("#toast")).toHaveCount(0);
    expect(waiting!.width).toBeLessThan(340);
    expect(waiting!.height).toBeLessThan(40);
    await a.waitForFunction(() => window.__game.network?.connection.local?.cooldown === 0);
    await a.mouse.click(700, 400);
    await expect.poll(() => a.evaluate(() => window.__game.ammo)).toBe(11);
    await expect.poll(() => a.evaluate(() => window.__game.decals.count)).toBeGreaterThan(0);
    await a.keyboard.press("KeyG");
    await a.waitForFunction(() => window.__game.selected === 4);
    await expect
      .poll(() => a.evaluate(() => window.__game.network!.connection.round!.drops.length))
      .toBe(1);
    await a.waitForTimeout(1600);
    if (!(await a.evaluate(() => window.__game.selected === 2))) {
      await a.evaluate(() => {
        const g = window.__game,
          drop = g.network!.connection.round!.drops[0];
        if (drop) g.yaw = Math.atan2(g.position.x - drop.x, g.position.z - drop.z);
      });
      await a.keyboard.down("KeyW");
      await a.keyboard.press("Space");
      await a.keyboard.press("KeyE");
      await a.waitForFunction(() => window.__game.selected === 2, {}, { timeout: 6000 });
      await a.keyboard.up("KeyW");
    }
    expect(await a.evaluate(() => window.__game.ammo)).toBe(11);
    await join(b, room, "t");
    await expect(a.locator("#match-waiting")).toBeHidden();
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

    await b.bringToFront();
    if (!(await b.evaluate(() => window.__game.locked))) await b.locator("#game").click();
    await b.waitForFunction(() => window.__game.network?.connection.local?.cooldown === 0);
    const beforeImpacts = await a.evaluate(() => window.__game.decals.count);
    await b.mouse.click(700, 400);
    await expect.poll(() => b.evaluate(() => window.__game.ammo)).toBe(19);
    await expect.poll(() => b.evaluate(() => window.__game.decals.count)).toBeGreaterThan(0);
    await expect
      .poll(() => a.evaluate(() => window.__game.decals.count))
      .toBeGreaterThan(beforeImpacts);
    await expect.poll(() => b.evaluate(() => window.__game.shotTime)).toBeGreaterThan(0.15);
    await b.keyboard.press("Digit3");
    await b.waitForFunction(
      () =>
        window.__game.selected === 4 &&
        window.__game.drawTime === 0 &&
        window.__game.network?.connection.local?.cooldown === 0,
    );
    await b.mouse.click(700, 400);
    await expect.poll(() => b.evaluate(() => window.__game.knifeTime)).toBeGreaterThan(0);
    expect(await b.evaluate(() => window.__game.shotTime)).toBe(0);
    await b.waitForTimeout(600);
    await b.mouse.click(700, 400, { button: "right" });
    await expect
      .poll(() => b.evaluate(() => window.__game.knifeStab && window.__game.knifeTime > 0))
      .toBe(true);
    await b.keyboard.press("Digit2");
    await b.waitForFunction(() => window.__game.selected === 7);
    await a.bringToFront();
    if (!(await a.evaluate(() => window.__game.locked))) await a.locator("#game").click();
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
    await command(request, room, "reset");
    await a.waitForFunction(() => window.__game.round === 3);
    await command(request, room, "live");
    await command(request, room, "kill-ct");
    await expect(a.locator("#death-banner")).toBeVisible();
    await b.waitForFunction(() =>
      window.__game.bots.some((bot) => bot.health <= 0 && bot.group.visible && !!bot.rig.ragdoll),
    );
    const corpseStart = await b.evaluate(
      () => window.__game.bots[0].rig.ragdoll!.points[0].position.y,
    );
    await b.waitForTimeout(750);
    expect(
      await b.evaluate(() => window.__game.bots[0].rig.ragdoll!.points[0].position.y),
    ).toBeLessThan(corpseStart);
    const corpseImage = await b.evaluate(() => {
      const g = window.__game;
      const center = g.bots[0].rig.ragdoll!.points[0].position;
      const oldPosition = g.camera.position.clone(),
        oldRotation = g.camera.quaternion.clone();
      g.camera.position.set(center.x + 1.5, center.y + 2.5, center.z + 2.5);
      g.camera.lookAt(center);
      g.camera.updateMatrixWorld();
      g.renderer.render(g.scene, g.camera);
      const image = g.renderer.domElement.toDataURL("image/png");
      g.camera.position.copy(oldPosition);
      g.camera.quaternion.copy(oldRotation);
      return image;
    });
    writeFileSync(
      "artifacts/dust2-multiplayer-ragdoll.png",
      Buffer.from(corpseImage.split(",")[1], "base64"),
    );
    await expect(a.locator("#death-banner")).toBeHidden({ timeout: 3300 });
    await expect.poll(() => a.evaluate(() => window.__game.health)).toBe(0);
    await command(request, room, "reset");
    await b.waitForFunction(
      () => window.__game.bots[0]?.health > 0 && !window.__game.bots[0]?.rig.ragdoll,
    );
    await a.evaluate(() => window.__game.menu());
    await expect(a.locator("#menu")).toBeVisible();
    await a.locator("#home-play").click();
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
