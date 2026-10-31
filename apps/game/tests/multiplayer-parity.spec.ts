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
    await command(request, room, "at-buy");
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
    await expect.poll(() => a.evaluate(() => window.__game.audio?.state)).toBe("running");
    await expect.poll(() => b.evaluate(() => window.__game.health)).toBeLessThan(100);
    await expect(a.locator("#inventory")).toContainText("Ticket to Hell");

    await command(request, room, "at-buy");
    await command(request, room, "rich");
    await focus(b);
    await b.waitForFunction(() => window.__game.canBuy() && window.__game.money >= 2700);
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
    await a.waitForFunction(() => window.__game.canBuy());
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
        b.evaluate(() =>
          window.__game.network!.connection.round!.drops.some(
            (drop) => drop.weapon === 0 && drop.appearance.skin.id !== "",
          ),
        ),
      )
      .toBe(true);
    await b.keyboard.down("KeyS");
    await b.waitForTimeout(750);
    await b.keyboard.up("KeyS");
    await focus(a);
    if (!(await a.evaluate(() => window.__game.primary === 0))) {
      await a.waitForTimeout(800);
      await a.evaluate(() => {
        const g = window.__game,
          drop = g.network!.connection.round!.drops.find((drop) => drop.weapon === 0);
        if (drop) g.yaw = Math.atan2(g.position.x - drop.x, g.position.z - drop.z);
      });
      await a.keyboard.down("KeyW");
      await a.keyboard.press("Space");
      await a.waitForFunction(() => window.__game.primary === 0, {}, { timeout: 6000 });
      await a.keyboard.up("KeyW");
    }
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

test("a human teammate's spectator camera, ammunition, reload and scope replicate", async ({
  browser,
  request,
}) => {
  test.setTimeout(240000);
  const contexts = await Promise.all([
    browser.newContext(),
    browser.newContext(),
    browser.newContext(),
  ]);
  const [a, b, c] = await Promise.all(contexts.map((context) => context.newPage()));
  const room = `spectate-${Date.now()}`,
    errors: string[] = [];
  for (const page of [a, b, c]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    await join(a, room, "ct");
    await join(b, room, "t");
    await join(c, room, "ct");
    await command(request, room, "reset");
    await command(request, room, "at-buy");
    await command(request, room, "rich");
    // A late joiner is admitted at the next round boundary.
    await request.post("http://127.0.0.1:3004", { data: { room, op: "admit-late" } });
    await focus(c);
    await c.waitForFunction(() => !window.__game.dead && window.__game.canBuy());
    await c.keyboard.press("KeyB");
    await c.locator('[data-weapon="3"]').click();
    await c.waitForFunction(() => window.__game.selected === 3);
    await command(request, room, "live");
    await command(request, room, "kill-ct");
    await c.evaluate(() => {
      window.__game.yaw = 0.6;
      window.__game.pitch = 0.25;
    });
    await c.waitForTimeout(100);
    await focus(a);
    await a.waitForFunction(() => !!window.__game.dead);
    await a.evaluate(() => {
      window.__game.spectatorMode = "first";
      window.__game.spectate();
    });
    await expect.poll(() => a.evaluate(() => window.__game.camera.rotation.x)).toBeCloseTo(0.25, 2);
    await expect(a.locator("#health")).toHaveText("100");
    await expect(a.locator("#ammo")).toHaveText("5");
    await expect(a.locator("#ammo")).toBeVisible();
    await command(request, room, "observer-reload");
    await focus(c);
    await c.keyboard.press("KeyR");
    await c.waitForFunction(() => window.__game.reload > 0);
    await focus(a);
    await a.waitForFunction(() => !!window.__game.spectated?.reloadTime);
    await a.screenshot({ path: "artifacts/multiplayer-spectator-reload.png" });
    await c.waitForFunction(() => window.__game.reload === 0);
    await focus(c);
    await c.mouse.down({ button: "right" });
    await c.mouse.up({ button: "right" });
    await c.waitForFunction(() => window.__game.scopeLevel === 1);
    await focus(a);
    await expect(a.locator("#scope")).toBeVisible();
    await expect(a.locator("#crosshair")).toBeHidden();
    expect(await a.evaluate(() => window.__game.camera.fov)).toBeLessThan(60);
    await a.screenshot({ path: "artifacts/multiplayer-spectator-scope.png" });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});

test("Steam portraits sync across clients and reset to faction icons on sign-out", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a, b] = await Promise.all(contexts.map((c) => c.newPage()));
  const urls = ["a", "b"].map(
    (c) => `https://avatars.fastly.steamstatic.com/${c.repeat(40)}_full.jpg`,
  );
  const room = `portraits-${Date.now()}`;
  try {
    for (const [i, page] of [a, b].entries()) {
      await page.route("**/api/steam?*", (route) => {
        const action = new URL(route.request().url()).searchParams.get("action");
        if (action === "avatar")
          return route.fulfill({
            path: "packages/assets/public/icons/team-ct.png",
            contentType: "image/png",
          });
        return route.fulfill({
          json:
            action === "session"
              ? {
                  profile: {
                    steamId: `7656119952828562${i}`,
                    name: `Portrait ${i}`,
                    avatar: "/api/steam?action=avatar",
                    publicAvatar: urls[i],
                    profileUrl: "https://steamcommunity.com/",
                  },
                }
              : { items: [], reportedTotal: 0, syncedAt: Date.now() },
        });
      });
      await page.route("https://avatars.fastly.steamstatic.com/**", (route) =>
        route.fulfill({
          path: "packages/assets/public/icons/team-ct.png",
          contentType: "image/png",
        }),
      );
    }
    await join(a, room, "ct");
    await join(b, room, "t");
    for (const [page, other] of [
      [a, 1],
      [b, 0],
    ] as const) {
      await focus(page);
      await page.keyboard.down("Tab");
      await expect(page.locator("#scoreboard")).toBeVisible();
      const row = page
        .locator(".score-row")
        .filter({ has: page.locator(".score-player", { hasText: `Portrait ${other}` }) });
      await expect(row.locator(".score-avatar img")).toHaveAttribute("src", urls[other]);
      await expect
        .poll(() =>
          row
            .locator(".score-avatar img")
            .evaluate((img) => (img as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
      await page.screenshot({ path: `artifacts/multiplayer-avatar-${other}.png` });
      await page.keyboard.up("Tab");
    }
    await a.evaluate(async () => {
      const path = "/src/player-profile.ts";
      const { setPlayerProfile } = await import(path);
      setPlayerProfile(null);
    });
    await focus(b);
    await b.keyboard.down("Tab");
    const guest = b
      .locator(".score-row")
      .filter({ has: b.locator(".score-player", { hasText: /^PLAYER$/ }) });
    await expect(guest.locator(".score-avatar img")).toHaveAttribute(
      "src",
      /\/icons\/team-ct.png$/,
    );
    await b.screenshot({ path: "artifacts/multiplayer-avatar-sync.png" });
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
