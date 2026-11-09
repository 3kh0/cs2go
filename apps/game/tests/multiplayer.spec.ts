import { joinLobby as join, lobbyPin } from "./multiplayer-helpers";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { writeFileSync } from "node:fs";
test.use({ actionTimeout: 15000 });

async function command(request: APIRequestContext, room: string, op: string) {
  const response = await request.post("http://127.0.0.1:3004", {
    data: { room: lobbyPin(room), op },
  });
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
    await a.waitForFunction(() => window.__game.selected === window.__game.knife);
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
    await expect(a.locator("#location")).toHaveText("CT Start");
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
    // Observe the short native animation while it plays; waiting for the
    // remote impact first can miss the entire firing clip.
    const shotAnimation = b.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const until = performance.now() + 600;
          let peak = 0;
          const sample = () => {
            peak = Math.max(peak, window.__game.shotTime);
            if (performance.now() < until) requestAnimationFrame(sample);
            else resolve(peak);
          };
          requestAnimationFrame(sample);
        }),
    );
    await b.mouse.click(700, 400);
    await expect.poll(() => b.evaluate(() => window.__game.ammo)).toBe(19);
    await expect.poll(() => b.evaluate(() => window.__game.decals.count)).toBeGreaterThan(0);
    await expect
      .poll(() => a.evaluate(() => window.__game.decals.count))
      .toBeGreaterThan(beforeImpacts);
    expect(await shotAnimation).toBeGreaterThan(0);
    await b.keyboard.press("Digit3");
    await b.waitForFunction(
      () =>
        window.__game.selected === window.__game.knife &&
        window.__game.drawTime === 0 &&
        window.__game.network?.connection.local?.cooldown === 0,
    );
    await b.mouse.click(700, 400);
    await expect.poll(() => b.evaluate(() => window.__game.knifeTime)).toBeGreaterThan(0);
    expect(await b.evaluate(() => window.__game.shotTime)).toBe(0);
    await b.waitForFunction(
      () =>
        window.__game.knifeTime === 0 && window.__game.network?.connection.local?.cooldown === 0,
    );
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
    expect(await b.evaluate(() => window.__game.soundscape.currentMusic)).toBe("bomb");
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
    await a.waitForFunction(() => window.__game.active && !window.__game.matchLoading);
    expect(await a.evaluate(() => !!window.__game.network)).toBe(false);
    expect(await a.evaluate(() => window.__game.bots.length)).toBe(19);
    expect(await a.evaluate(() => window.__game.world === window.__game.dust)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await ac.close();
    await bc.close();
  }
});

test("a transport interruption recovers the same player and resumes acknowledged input", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await join(page, `reconnect-${Date.now()}`, "ct");
  const id = await page.evaluate(() => {
    const connection = window.__game.network!.connection;
    const id = connection.id;
    connection.socket.close(4000, "Snapshot timeout");
    return id;
  });
  await page.waitForFunction((id) => {
    const connection = window.__game.network?.connection;
    return (
      connection?.id === id &&
      !connection.reconnecting &&
      connection.socket.readyState === WebSocket.OPEN &&
      !!connection.local
    );
  }, id);
  expect(await page.evaluate(() => window.__game.network!.connection.players.length)).toBe(1);
  await page.waitForFunction(() => window.__game.network!.connection.local!.ack > 0);
  expect(errors).toEqual([]);
});

test("multiplayer C4 equips with 5 and plants after the result with synchronized audio", async ({
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const ct = await browser.newContext();
  const t = await browser.newContext();
  const a = await ct.newPage();
  const b = await t.newPage();
  const room = `c4-audio-${Date.now()}`;
  const errors: string[] = [];
  for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    await join(a, room, "ct");
    await join(b, room, "t");
    await b.bringToFront();
    if (!(await b.evaluate(() => window.__game.locked))) await b.locator("#game").click();
    await b.waitForFunction(() => window.__game.locked);
    await b.evaluate(() => {
      const played: string[] = [];
      const sound = window.__game.soundscape;
      const play = sound.play.bind(sound);
      sound.play = (...args) => {
        const voice = play(...args);
        if (
          voice &&
          (args[0] === "bomb-draw" ||
            args[0] === "bomb-initiate" ||
            args[0].startsWith("bomb-key-"))
        )
          played.push(args[0]);
        return voice;
      };
      Object.assign(window, { c4NetworkCues: played });
    });
    await command(request, room, "plant");
    await b.waitForFunction(
      () => window.__game.bomb?.carrier === "player" && window.__game.freezeTime === 0,
    );
    await expect(b.locator("#bomb-carrier")).toBeVisible();
    await b.keyboard.press("5");
    await b.waitForFunction(
      () =>
        window.__game.bombSelected &&
        window.__game.bombView.visible &&
        window.__game.bombDrawTime === 0,
    );
    await command(request, room, "timeout");
    await b.waitForFunction(() => window.__game.network?.connection.round?.phase === "post");
    const settled = await b.evaluate(() => ({
      money: window.__game.money,
      scores: window.__game.teamScores,
      ammo: window.__game.ammo,
    }));
    await b.mouse.down();
    await b.waitForFunction(
      () =>
        window.__game.planting && window.__game.eye < 1.2 && window.__game.camera.rotation.x < -0.7,
    );
    await b.waitForFunction(
      () =>
        (window.__game.network?.connection.local?.eye ?? 2) < 1.2 &&
        (window.__game.network?.connection.local?.pitch ?? 0) > 0.7,
    );
    await b.screenshot({ path: "artifacts/c4-multiplayer-crouched-plant.png" });
    await b.waitForFunction(() => window.__game.bomb?.planted, {}, { timeout: 7000 });
    expect(await b.evaluate(() => window.__game.soundscape.currentMusic)).not.toBe("bomb");
    await b.mouse.up();
    expect(
      await b.evaluate(() => ({
        money: window.__game.money,
        scores: window.__game.teamScores,
        ammo: window.__game.ammo,
      })),
    ).toEqual(settled);
    await expect(b.locator("#bomb-carrier")).toBeHidden();
    expect(
      await b.evaluate(() => (window as unknown as { c4NetworkCues: string[] }).c4NetworkCues),
    ).toEqual([
      "bomb-draw",
      "bomb-initiate",
      ...Array.from({ length: 7 }, (_, i) => `bomb-key-${i + 1}`),
    ]);
    expect(errors).toEqual([]);
  } finally {
    await ct.close();
    await t.close();
  }
});
