import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";
import { joinLobby, lobbyPin } from "./multiplayer-helpers";

declare global {
  interface Window {
    __game: Game;
  }
}
const sheet = "mirage:2:60417:4063";
const shutter = "mirage:2:60417:3716";
const windowGlass = "mirage:2:60417:4395";
const metal = "mirage:2:60417:3758";

async function enter(page: Page) {
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator('[data-mode="practice"]').click();
  await page.locator('.match-maps [data-map="mirage"]').click();
  await page.locator("#play").click();
  await expect(page.locator('#team-select [data-team="ct"]')).toBeVisible({ timeout: 120_000 });
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked && window.__game.mapId === "mirage");
  await page.evaluate(() => {
    const g = window.__game;
    g.invulnerable = Infinity;
    for (const bot of g.bots) {
      bot.health = 0;
      bot.respawn = Infinity;
      bot.group.visible = false;
    }
  });
}
async function place(page: Page, id: string, distance?: number) {
  return page.evaluate(
    async ({ id, distance }) => {
      const path = "/tests/mirage-breakables-fixture.ts";
      return (
        (await import(path)) as typeof import("./mirage-breakables-fixture")
      ).placeAtNativeBreakable(id, distance);
    },
    { id, distance },
  );
}
async function status(page: Page, id: string) {
  return page.evaluate(async (id) => {
    const path = "/tests/mirage-breakables-fixture.ts";
    return (
      (await import(path)) as typeof import("./mirage-breakables-fixture")
    ).nativeBreakableStatus(id);
  }, id);
}
async function coverClear(page: Page, from: number[], to: number[]) {
  return page.evaluate(
    async ({ from, to }) => {
      const path = "/tests/mirage-breakables-fixture.ts";
      return (
        (await import(path)) as typeof import("./mirage-breakables-fixture")
      ).nativeCoverClear(from, to);
    },
    { from, to },
  );
}
async function gun(page: Page) {
  await page.keyboard.press("Digit2");
  await page.waitForFunction(() => window.__game.drawTime <= 0 && window.__game.cooldown <= 0);
}
async function fire(page: Page, id: string) {
  const ammo = await page.evaluate(() => window.__game.ammo);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(async () => (await status(page, id)).health).toBe(0);
  expect(await page.evaluate(() => window.__game.ammo)).toBeLessThan(ammo);
}
function errors(page: Page) {
  const found: string[] = [];
  page.on("pageerror", (e) => found.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") found.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400 && /\/(audio|models|ui)\//.test(r.url()))
      found.push(`${r.status()}: ${r.url()}`);
  });
  return found;
}

test("Mirage native sheet metal opens to real fire and physical movement, then a new match restores it", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const failed = errors(page);
  await enter(page);
  const audio = await page.evaluate(async () => {
    const path = "/tests/mirage-breakables-fixture.ts";
    return (
      (await import(path)) as typeof import("./mirage-breakables-fixture")
    ).nativeBreakAudio();
  });
  expect(audio.context).toBe("running");
  expect(audio.clips).toHaveLength(8);
  expect(audio.clips.every((clip) => clip.nonzero && clip.samples > 0 && clip.duration > 0)).toBe(
    true,
  );
  await gun(page);
  const setup = await place(page, sheet);
  const before = await status(page, sheet);
  expect(await coverClear(page, setup.eye, setup.beyond)).toBe(false);
  expect(before.parts.length).toBe(7);
  expect(before.parts.every((p) => p.visible)).toBe(true);
  await page.screenshot({ path: "artifacts/mirage-breakable-sheet-intact.png" });
  await fire(page, sheet);
  const broken = await status(page, sheet);
  expect(await coverClear(page, setup.eye, setup.beyond)).toBe(true);
  expect(broken.parts.every((p) => !p.visible)).toBe(true);
  expect(broken.staticFrames).toEqual(before.staticFrames);
  expect(broken.debris).toBeGreaterThan(0);
  await page.screenshot({ path: "artifacts/mirage-breakable-sheet-open.png" });
  await page.keyboard.down("ControlLeft");
  await page.keyboard.down("KeyW");
  try {
    await page.waitForFunction(
      ({ axis, side, center }) =>
        (window.__game.position.getComponent(axis) - center[axis]) * side < -0.25,
      setup,
      { timeout: 6000 },
    );
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      position: window.__game.position.toArray(),
      yaw: window.__game.yaw,
      keys: [...window.__game.keys],
      eye: window.__game.eye,
      locked: window.__game.locked,
    }));
    await page.screenshot({ path: "artifacts/mirage-breakable-route-stalled.png" });
    throw new Error(
      `${String(error)}; setup=${JSON.stringify(setup)} actual=${JSON.stringify(diagnostic)}`,
    );
  } finally {
    await page.keyboard.up("KeyW");
    await page.keyboard.up("ControlLeft");
  }
  const crossed = await status(page, sheet);
  expect((crossed.position[setup.axis] - setup.center[setup.axis]) * setup.side).toBeLessThan(
    -0.25,
  );
  await page.screenshot({ path: "artifacts/mirage-breakable-sheet-crossed.png" });
  // Exercise the real new-match reset while retaining the pointer-lock session.
  // Only the original entry uses the chooser; no object state is reset by the test.
  await page.evaluate(() => window.__game.start("practice", { bots: false }));
  await expect.poll(async () => (await status(page, sheet)).health).toBe(1);
  expect((await status(page, sheet)).parts.every((p) => p.visible)).toBe(true);
  expect(failed).toEqual([]);
});

test("Mirage native shutter, glass and metal use real melee, bullet and HE paths with their authored aftermath", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const failed = errors(page);
  await enter(page);
  await page.keyboard.press("Digit3");
  await page.waitForFunction(() => window.__game.drawTime <= 0 && window.__game.cooldown <= 0);
  await place(page, shutter, 0.8);
  const before = await status(page, shutter);
  expect(before.remainder?.every((p) => !p.visible)).toBe(true);
  await page.mouse.down();
  await page.mouse.up();
  await expect.poll(async () => (await status(page, shutter)).health).toBe(0);
  const cut = await status(page, shutter);
  expect(cut.cooldown).toBeGreaterThan(0);
  expect(cut.parts.every((p) => !p.visible)).toBe(true);
  expect(cut.remainder?.some((p) => p.visible)).toBe(true);
  await page.screenshot({ path: "artifacts/mirage-breakable-shutter-remainder.png" });
  await gun(page);
  await place(page, windowGlass);
  await fire(page, windowGlass);
  expect((await status(page, windowGlass)).parts.every((p) => !p.visible)).toBe(true);
  await place(page, metal, 1.4);
  await page.evaluate(() => {
    const u = window.__game.utility;
    u.inventory.he = 1;
    u.select("he");
  });
  await page.mouse.down({ button: "right" });
  await page.waitForFunction(() => window.__game.utility.handling.phase === "held");
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(() => window.__game.utility.projectiles.some((p) => p.kind === "he"));
  await expect.poll(async () => (await status(page, metal)).health, { timeout: 8000 }).toBe(0);
  expect((await status(page, metal)).parts.every((p) => !p.visible)).toBe(true);
  await page.screenshot({ path: "artifacts/mirage-breakable-he-metal.png" });
  expect(failed).toEqual([]);
});

test("two Mirage clients share native destruction and a late join restores it quietly before the next round", async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const contextA = await browser.newContext(),
    contextB = await browser.newContext();
  const a = await contextA.newPage();
  let b = await contextB.newPage();
  const failedA = errors(a);
  let failedB = errors(b);
  const room = `mirage-breakable-${Date.now()}`;
  try {
    await joinLobby(a, room, "ct", "mirage");
    await joinLobby(b, room, "t");
    await a.bringToFront();
    if (await a.locator("#resume").isVisible()) await a.locator("#resume").click();
    if (!(await a.evaluate(() => window.__game.locked))) await a.locator("#game").click();
    await a.waitForFunction(() => window.__game.locked);
    const pose = await place(a, sheet);
    const player = await a.evaluate(() => window.__game.network!.connection.id);
    const response = await request.post("http://127.0.0.1:3004", {
      data: {
        room: lobbyPin(room),
        op: "breakable-setup",
        id: sheet,
        players: [
          {
            id: player,
            x: pose.start[0],
            y: pose.start[1],
            z: pose.start[2],
            yaw: pose.yaw,
            pitch: -pose.pitch,
          },
        ],
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    await a.waitForFunction(
      (start) => window.__game.position.distanceTo({ x: start[0], y: start[1], z: start[2] }) < 0.1,
      pose.start,
    );
    await gun(a);
    await a.evaluate(({ yaw, pitch }) => {
      const g = window.__game;
      g.yaw = yaw;
      g.pitch = pitch;
      g.updateAimCamera(1);
    }, pose);
    await fire(a, sheet);
    await expect.poll(async () => (await status(b, sheet)).health).toBe(0);
    expect((await status(b, sheet)).parts.every((part) => !part.visible)).toBe(true);
    expect((await status(b, sheet)).debris).toBeGreaterThan(0);
    await a.screenshot({ path: "artifacts/mirage-breakable-network-host.png" });
    await b.screenshot({ path: "artifacts/mirage-breakable-network-peer.png" });
    // Retain the opposing player: disconnecting the sole Terrorist would
    // legitimately end the round and restore panels before this late join.
    const firstPeerErrors = failedB;
    b = await contextB.newPage();
    failedB = errors(b);
    await joinLobby(b, room, "t");
    const joined = await status(b, sheet);
    expect(joined.health).toBe(0);
    expect(joined.parts.every((part) => !part.visible)).toBe(true);
    expect(joined.debris).toBe(0);
    expect(joined.lastCue?.startsWith("map-break-")).not.toBe(true);
    const reset = await request.post("http://127.0.0.1:3004", {
      data: { room: lobbyPin(room), op: "breakable-reset" },
    });
    expect(reset.ok()).toBe(true);
    for (const page of [a, b]) {
      await expect.poll(async () => (await status(page, sheet)).health).toBe(1);
      expect((await status(page, sheet)).parts.every((part) => part.visible)).toBe(true);
    }
    expect(failedA).toEqual([]);
    expect(firstPeerErrors).toEqual([]);
    expect(failedB).toEqual([]);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test("a native Mirage bot clears genuine route obstruction and physically crosses the opening", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const failed = errors(page);
  await enter(page);
  const setup = await page.evaluate(async (id) => {
    const path = "/tests/mirage-breakables-fixture.ts";
    return (
      (await import(path)) as typeof import("./mirage-breakables-fixture")
    ).startNativeBotObstruction(id);
  }, sheet);
  const read = () =>
    page.evaluate(async () => {
      const path = "/tests/mirage-breakables-fixture.ts";
      return (
        (await import(path)) as typeof import("./mirage-breakables-fixture")
      ).nativeBotObstructionStatus();
    });
  try {
    await expect.poll(async () => (await read()).health, { timeout: 8000 }).toBe(0);
    await expect
      .poll(
        async () => {
          const state = await read();
          return (state.position[setup.axis] - setup.center[setup.axis]) * setup.side;
        },
        { timeout: 8000 },
      )
      .toBeLessThan(-0.25);
    const state = await read();
    expect(state.spent).toBe(1);
    expect(state.stuck).toBeGreaterThan(0.15);
    expect(state.cooldown).toBeGreaterThan(0);
    expect((await status(page, sheet)).parts.every((part) => !part.visible)).toBe(true);
    await test.info().attach("native-bot-obstruction", {
      body: JSON.stringify({ setup, state }),
      contentType: "application/json",
    });
    expect(failed).toEqual([]);
  } finally {
    await page.evaluate(async () => {
      const path = "/tests/mirage-breakables-fixture.ts";
      (
        (await import(path)) as typeof import("./mirage-breakables-fixture")
      ).stopNativeBotObstruction();
    });
  }
});
