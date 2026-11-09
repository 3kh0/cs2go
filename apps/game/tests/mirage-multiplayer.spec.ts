import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { joinLobby, lobbyPin } from "./multiplayer-helpers";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}
async function command(request: APIRequestContext, room: string, op: string) {
  const response = await request.post("http://127.0.0.1:3004", {
    data: { room: lobbyPin(room), op },
  });
  expect(response.ok()).toBe(true);
  return response.json() as Promise<{ players: { id: string; team: "ct" | "t"; yaw: number }[] }>;
}
async function lock(page: Page) {
  await page.bringToFront();
  if (await page.locator("#resume").isVisible()) await page.locator("#resume").click();
  if (!(await page.evaluate(() => window.__game.locked))) await page.locator("#game").click();
  await page.waitForFunction(() => window.__game.locked);
}

test("two clients discover Mirage, move and fight on native geometry, then recover the same map", async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const ac = await browser.newContext(),
    bc = await browser.newContext();
  const a = await ac.newPage(),
    b = await bc.newPage();
  const room = `mirage-${Date.now()}`;
  const errors: string[] = [];
  let transports = 0;
  a.on("websocket", () => transports++);
  for (const page of [a, b]) {
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && /\/(models|audio|icons|fonts|maps|ui)\//.test(response.url()))
        errors.push(`Asset ${response.status()}: ${response.url()}`);
    });
    page.on("requestfailed", (request) => {
      const reason = request.failure()?.errorText;
      // Changing music events deliberately cancels the previous HTML audio
      // stream. Keep actual failures and every map/model failure actionable.
      if (reason === "net::ERR_ABORTED" && /\/audio\/music-kits\//.test(request.url())) return;
      if (/\/(models|audio|icons|fonts|maps|ui)\//.test(request.url()))
        errors.push(`Asset failed: ${request.url()}: ${reason}`);
    });
  }
  try {
    await joinLobby(a, room, "ct", "mirage");
    await expect(a.locator("#match-waiting")).toBeVisible();
    // B starts with the default Dust II card. Native-map selection comes from
    // the host lobby response, rather than requiring an out-of-band setting.
    await joinLobby(b, room, "t");
    await a.waitForFunction(() => window.__game.network?.connection.round?.phase === "freeze");
    for (const [page, team] of [
      [a, "ct"],
      [b, "t"],
    ] as const) {
      await expect(page.locator("#location")).toHaveText("MIRAGE");
      expect(
        await page.evaluate((side) => {
          const g = window.__game,
            c = g.network!.connection;
          const position = c.local!;
          return {
            map: g.mapId,
            world: g.world === g.dust && g.dust!.id,
            authority: c.map.id,
            nativeNav: g.dust!.navigation.data.mapId,
            ladders: c.map.ladders!.length,
            football: !!g.dust!.ball.mesh,
            radar: g.radarImage?.src.endsWith("/models/maps/mirage-radar.png"),
            radarLayers:
              g.radarLayers.size > 0 &&
              [...g.radarLayers.keys()].every((key) => key.startsWith("mirage:")),
            spawnDistance: Math.min(
              ...g.dust!.navigation.data.spawns[side].map((spawn) =>
                Math.hypot(position.x - spawn[0], position.z - spawn[2]),
              ),
            ),
          };
        }, team),
      ).toEqual({
        map: "mirage",
        world: "mirage",
        authority: "mirage",
        nativeNav: "mirage",
        ladders: 2,
        football: false,
        radar: true,
        radarLayers: true,
        spawnDistance: expect.any(Number),
      });
      expect(
        await page.evaluate(() => {
          const g = window.__game,
            p = g.network!.connection.local!;
          return Math.min(
            ...g.dust!.navigation.data.spawns[p.team].map((s) =>
              Math.hypot(p.x - s[0], p.z - s[2]),
            ),
          );
        }),
      ).toBeLessThan(0.55);
    }
    const ids = await Promise.all(
      [a, b].map((page) => page.evaluate(() => window.__game.network!.connection.id)),
    );
    const metadata = await request.get(`http://127.0.0.1:3002/lobbies/${lobbyPin(room)}`, {
      headers: { Origin: "http://127.0.0.1:5173" },
    });
    expect(await metadata.json()).toEqual({ mode: "casual", map: "mirage" });
    await command(request, room, "live");
    await lock(a);
    const before = await a.evaluate(() => {
      const g = window.__game,
        eye = g.position.clone();
      eye.y += g.eye;
      for (let n = 0; n < 32; n++) {
        const yaw = (n * Math.PI) / 16;
        const target = eye.clone();
        target.x -= Math.sin(yaw) * 2;
        target.z -= Math.cos(yaw) * 2;
        if (
          g.dust!.collision.visible(eye, target) &&
          Math.abs(g.dust!.collision.floor(target.x, target.z, g.position.y + 0.5) - g.position.y) <
            0.08
        ) {
          g.yaw = yaw;
          break;
        }
      }
      return { x: g.position.x, z: g.position.z };
    });
    await a.keyboard.down("KeyW");
    await a.waitForTimeout(500);
    await a.keyboard.up("KeyW");
    await expect
      .poll(() =>
        a.evaluate(
          (start) =>
            Math.hypot(window.__game.position.x - start.x, window.__game.position.z - start.z),
          before,
        ),
      )
      .toBeGreaterThan(0.3);
    await expect
      .poll(() =>
        b.evaluate(
          ({ id, start }) => {
            const player = window.__game.network!.connection.players.find(
              (player) => player.id === id,
            );
            return player ? Math.hypot(player.x - start.x, player.z - start.z) : 0;
          },
          { id: ids[0], start: before },
        ),
      )
      .toBeGreaterThan(0.3);
    expect(
      await a.evaluate(() => {
        const g = window.__game,
          local = g.network!.connection.local!;
        return Math.hypot(g.position.x - local.x, g.position.y - local.y, g.position.z - local.z);
      }),
    ).toBeLessThan(0.01);
    const duel = await command(request, room, "duel");
    const ct = duel.players.find((player) => player.team === "ct")!;
    await a.evaluate((yaw) => {
      window.__game.yaw = yaw;
      window.__game.pitch = -0.22;
    }, ct.yaw);
    await a.waitForTimeout(350);
    await a.waitForFunction(() => window.__game.network!.connection.local!.cooldown === 0);
    const ammo = await a.evaluate(() => window.__game.ammo);
    await a.screenshot({ path: "artifacts/mirage-multiplayer-before-shot.png" });
    // Pointer lock turns Playwright's implicit move in mouse.click(x,y) into
    // camera rotation. Fire without moving the already-aimed locked pointer.
    await a.mouse.down();
    await a.mouse.up();
    await expect.poll(() => a.evaluate(() => window.__game.ammo)).toBe(ammo - 1);
    await expect.poll(() => b.evaluate(() => window.__game.health)).toBeLessThan(100);
    await expect
      .poll(() =>
        b.evaluate(
          (id) => window.__game.network!.connection.players.find((p) => p.id === id)?.ammo,
          ids[0],
        ),
      )
      .toBe(ammo - 1);
    await a.screenshot({ path: "artifacts/mirage-multiplayer-ct.png" });
    const initialTransports = transports;
    await a.evaluate(() =>
      window.__game.network!.connection.socket.close(4000, "Mirage recovery test"),
    );
    await expect.poll(() => transports).toBeGreaterThan(initialTransports);
    await a.waitForFunction((id) => {
      const c = window.__game.network?.connection;
      return c?.id === id && !!c.local && !c.reconnecting && c.socket.readyState === WebSocket.OPEN;
    }, ids[0]);
    expect(
      await a.evaluate(() => ({
        map: window.__game.mapId,
        authority: window.__game.network!.connection.map.id,
        football: !!window.__game.dust!.ball.mesh,
      })),
    ).toEqual({ map: "mirage", authority: "mirage", football: false });
    await expect
      .poll(() =>
        b.evaluate(
          (id) => window.__game.network!.connection.players.filter((p) => p.id === id).length,
          ids[0],
        ),
      )
      .toBe(1);
    expect(errors).toEqual([]);
  } finally {
    await ac.close();
    await bc.close();
  }
});
