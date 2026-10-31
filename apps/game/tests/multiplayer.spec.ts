import { expect, test, type Page } from "@playwright/test";
import type { PlayerState, ServerMessage } from "@cs2go/protocol";

declare global {
  interface Window {
    __onlineMessages: ServerMessage[];
  }
}
async function observe(page: Page) {
  await page.addInitScript(() => {
    window.__onlineMessages = [];
    const Native = window.WebSocket;
    window.WebSocket = class extends Native {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        this.addEventListener("message", (event) => {
          window.__onlineMessages.push(JSON.parse(String(event.data)));
          if (window.__onlineMessages.length > 150) window.__onlineMessages.shift();
        });
      }
    };
  });
}
async function players(page: Page) {
  return page.evaluate(
    () =>
      window.__onlineMessages.filter((message) => message.type === "snapshot").at(-1)?.players ??
      [],
  );
}
async function join(page: Page, name: string, room: string) {
  await observe(page);
  await page.goto(`/online.html?server=ws://127.0.0.1:3002/ws&room=${room}`);
  await expect(page.locator("#online-join")).toBeEnabled({ timeout: 100000 });
  await page.locator("#online-name").fill(name);
  await page.locator("#online-join").click();
  await expect(page.locator("#online-lobby")).toBeHidden();
}

test("two browsers share authoritative movement, combat and reconnectable private rooms", async ({
  browser,
}) => {
  test.setTimeout(180000);
  const aContext = await browser.newContext(),
    bContext = await browser.newContext();
  const a = await aContext.newPage(),
    b = await bContext.newPage();
  const errors: string[] = [];
  for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
  const room = `browser-${Date.now()}`;
  try {
    await join(a, "Alpha", room);
    await join(b, "Bravo", room);
    await expect(a.locator("#online-telemetry")).toContainText("2/10 PLAYERS");
    await expect(b.locator("#online-telemetry")).toContainText("2/10 PLAYERS");
    await a.bringToFront();
    if (await a.locator("#online-resume").isVisible()) await a.locator("#online-resume").click();
    await a.waitForFunction(() => document.pointerLockElement?.id === "online-canvas");
    const before = (await players(b)).find((player) => player.name === "Alpha")!;
    await a.keyboard.down("KeyW");
    await a.waitForTimeout(400);
    await a.keyboard.up("KeyW");
    await expect
      .poll(async () => (await players(b)).find((player) => player.name === "Alpha")!.z)
      .toBeLessThan(before.z - 0.2);
    await a.waitForTimeout(500);
    // Walk around the courtyard buildings into the opponent's clear side lane.
    await a.keyboard.down("KeyS");
    await expect
      .poll(async () => (await players(b)).find((p) => p.name === "Alpha")!.z)
      .toBeGreaterThan(19);
    await a.keyboard.up("KeyS");
    await a.keyboard.down("KeyD");
    await expect
      .poll(async () => (await players(b)).find((p) => p.name === "Alpha")!.x, {
        timeout: 12000,
        intervals: [50],
      })
      .toBeGreaterThan(16.8);
    await a.keyboard.up("KeyD");
    await a.waitForTimeout(500);
    await b.bringToFront();
    if (await b.locator("#online-resume").isVisible()) await b.locator("#online-resume").click();
    await b.waitForFunction(() => document.pointerLockElement?.id === "online-canvas");
    await b.keyboard.down("KeyW");
    await expect
      .poll(async () => (await players(a)).find((p) => p.name === "Bravo")!.z, {
        timeout: 12000,
        intervals: [50],
      })
      .toBeGreaterThan(14);
    await b.keyboard.up("KeyW");
    await a.bringToFront();
    if (await a.locator("#online-resume").isVisible()) await a.locator("#online-resume").click();
    await a.waitForTimeout(500);
    const states = await players(a);
    const shooter = states.find((player) => player.name === "Alpha")!,
      victim = states.find((player) => player.name === "Bravo")!;
    const distance = Math.hypot(victim.x - shooter.x, victim.z - shooter.z);
    const yaw = Math.atan2(-(victim.x - shooter.x), -(victim.z - shooter.z));
    const pitch = Math.atan2(shooter.y + shooter.eye - (victim.y + 1), distance);
    await a.evaluate(
      ({ shooter, yaw, pitch }: { shooter: PlayerState; yaw: number; pitch: number }) => {
        window.dispatchEvent(
          new MouseEvent("mousemove", {
            movementX: -(yaw - shooter.yaw) / 0.002,
            movementY: (pitch - shooter.pitch) / 0.002,
          }),
        );
      },
      { shooter, yaw, pitch },
    );
    await a.screenshot({ path: "artifacts/multiplayer-aim.png" });
    await a.mouse.down();

    await expect
      .poll(async () => (await players(b)).find((player) => player.name === "Bravo")!.deaths)
      .toBe(1);
    await a.mouse.up();
    await expect(a.locator("#online-feed")).toContainText("Alpha");
    await expect(b.locator("#online-feed")).toContainText("Bravo");
    await a.keyboard.down("Tab");
    await expect(a.locator("#online-scoreboard")).toBeVisible();
    await expect(a.locator("#online-scores .you")).toContainText("1 K");
    await a.screenshot({ path: "artifacts/multiplayer-scoreboard.png" });
    await a.keyboard.up("Tab");
    await expect
      .poll(async () => (await players(b)).find((player) => player.name === "Bravo")!.health, {
        timeout: 6000,
      })
      .toBe(100);
    await a.screenshot({ path: "artifacts/multiplayer-arena.png" });
    await a.evaluate(() => document.exitPointerLock());
    await expect(a.locator("#online-resume")).toBeVisible();
    await a.locator("#online-disconnect").click();
    await expect(a.locator("#online-lobby")).toBeVisible();
    await expect(b.locator("#online-telemetry")).toContainText("1/10 PLAYERS");
    await a.locator("#online-join").click();
    await expect(a.locator("#online-lobby")).toBeHidden();
    await expect(b.locator("#online-telemetry")).toContainText("2/10 PLAYERS");
    expect(errors).toEqual([]);
  } finally {
    await aContext.close();
    await bContext.close();
  }
});
