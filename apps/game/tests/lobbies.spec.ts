import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

test.use({ actionTimeout: 15000 });

declare global {
  interface Window {
    __game: Game;
  }
}

test("Panorama lobby flow creates a PIN, joins a peer, rejects missing lobbies", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const hostContext = await browser.newContext();
  const peerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const peer = await peerContext.newPage();
  const errors: string[] = [];
  for (const page of [host, peer]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    await host.goto("/");
    await expect(host.locator("#play")).toBeEnabled({ timeout: 120000 });
    await host.locator("#home-play").click();
    await host.locator('[data-session="multi"]').click();
    await expect(host.locator("#match-server option")).toContainText([
      "na1-cs.3kh0.dev",
      "na2-cs.3kh0.dev",
    ]);
    await expect(host.locator('[type="password"]')).toHaveCount(0);
    await host.locator("#match-server").selectOption("ws://127.0.0.1:3002/ws");
    await host.locator("#play").click();
    await expect(host.locator("#match-status")).toContainText("six-digit");
    await host.locator('[data-mode="competitive"]').click();
    await host.screenshot({ path: "artifacts/online-lobby-menu.png" });
    await host.locator("#match-create").click();
    await expect(host.locator("#team-select")).toBeVisible({ timeout: 100000 });
    await host.locator('#team-select [data-team="ct"]').click();
    await host.waitForFunction(() => !!window.__game.network?.connection.local);
    const pin = await host.locator("#match-room").inputValue();
    expect(pin).toMatch(/^\d{6}$/);
    await host.evaluate(() => document.exitPointerLock());
    await expect(host.locator("#pause")).toBeVisible();
    await expect(host.locator("#lobby-pin")).toHaveText(pin);
    await expect(host.locator("#match-invite")).toHaveCount(0);
    const invite = new URL("/", host.url());
    invite.search = new URLSearchParams({
      room: pin,
      server: "ws://127.0.0.1:3002/ws",
      mode: "competitive",
    }).toString();
    await host.screenshot({ path: "artifacts/online-lobby-pin.png" });
    await peer.goto(invite.href);
    await expect(peer.locator("#play")).toBeEnabled({ timeout: 120000 });
    await expect(peer.locator("#team-select")).toHaveCount(0);
    // Joining by PIN must adopt the host's mode even if the guest selected Casual.
    await peer.locator('[data-mode="casual"]').click();
    await peer.locator("#play").click();
    await peer.locator('#team-select [data-team="t"]').click();
    await peer.waitForFunction(() => window.__game.network?.connection.players.length === 2);
    expect(await peer.evaluate(() => window.__game.mode)).toBe("competitive");
    await host.waitForFunction(() => window.__game.network?.connection.players.length === 2);
    // Transport recovery keeps the assigned PIN and does not create a second lobby.
    const id = await host.evaluate(() => {
      const c = window.__game.network!.connection;
      c.socket.close(4000, "Snapshot timeout");
      return c.id;
    });
    await host.waitForFunction((id) => {
      const c = window.__game.network?.connection;
      return (
        !!c &&
        c.socket.readyState === WebSocket.OPEN &&
        !c.reconnecting &&
        c.id === id &&
        c.players.length === 2
      );
    }, id);
    await peer.evaluate(() => window.__game.menu());
    await host.evaluate(() => window.__game.menu());
    await peer.locator("#home-play").click();
    await peer.locator("#match-room").fill(pin);
    await peer.locator("#play").click();
    await expect(peer.locator("#match-status")).toContainText("Lobby not found");
    await expect(peer.locator("#team-select")).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await hostContext.close();
    await peerContext.close();
  }
});
