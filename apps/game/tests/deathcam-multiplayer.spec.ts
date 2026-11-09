import { expect, test, type Page } from "@playwright/test";
import type { Game } from "../src/game";
import { joinLobby, lobbyPin } from "./multiplayer-helpers";

declare global {
  interface Window {
    __game: Game;
  }
}

async function focus(page: Page) {
  await page.bringToFront();
  if (!(await page.evaluate(() => window.__game.locked))) await page.locator("#game").click();
  await page.waitForFunction(() => window.__game.locked);
}

// Uses actual input, authoritative combat, WebSocket snapshots, and two clients.
// Only placement uses the existing local server fixture; no hurt/kill is injected.
test("network death card receives authoritative damage given and taken through real shots", async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const [a, b] = await Promise.all(contexts.map((context) => context.newPage()));
  const label = `deathcam-${Date.now()}`;
  const errors: string[] = [];
  let completed = false;
  for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    await joinLobby(a, label, "ct");
    await joinLobby(b, label, "t");
    // Joining's first snapshot can precede the authoritative startRound.
    // Finish that boundary before placing the duel, otherwise the next server
    // step legitimately respawns both players and freezes the match again.
    await expect
      .poll(() => a.evaluate(() => window.__game.network!.connection.round!.phase))
      .toBe("freeze");
    await expect
      .poll(() => b.evaluate(() => window.__game.network!.connection.round!.phase))
      .toBe("freeze");
    const response = await request.post("http://127.0.0.1:3004", {
      data: { room: lobbyPin(label), op: "duel" },
    });
    expect(response.ok()).toBe(true);
    const duel = (await response.json()) as {
      players: { id: string; team: "ct" | "t"; x: number; z: number; yaw: number }[];
    };
    const ct = duel.players.find((player) => player.team === "ct")!;
    const t = duel.players.find((player) => player.team === "t")!;
    await a.waitForFunction(({ x, z }) => {
      const local = window.__game.network!.connection.local!;
      return (
        window.__game.network!.connection.round!.phase === "live" &&
        Math.hypot(local.x - x, local.z - z) < 0.05
      );
    }, ct);
    await a.evaluate(() => {
      const g = window.__game;
      g.deathDamage.reset();
      g.scene.userData.authoritativeHurt = [];
      g.scene.userData.authoritativeCombat = [];
      // Observe already decoded messages from the real socket. This does not
      // synthesize an event or change health, armor, bullets, or server state.
      const connection = g.network!.connection as unknown as {
        onMessage(message: import("@cs2go/protocol").ServerMessage): void;
      };
      const receive = connection.onMessage.bind(connection);
      connection.onMessage = (message) => {
        if (message.type === "snapshot") {
          g.scene.userData.authoritativeHurt.push(
            ...message.events.filter((event) => event.kind === "hurt"),
          );
          g.scene.userData.authoritativeCombat.push(
            ...message.events.filter((event) => ["hurt", "shot", "kill"].includes(event.kind)),
          );
        }
        receive(message);
      };
    });
    await focus(a);
    await a.evaluate((yaw) => {
      const g = window.__game;
      g.yaw = yaw;
      // Aim at chest height so one return shot cannot kill through the helmet.
      g.pitch = -0.14;
    }, ct.yaw);
    await a.waitForFunction(() => window.__game.network!.connection.local!.cooldown === 0);
    await a.mouse.down();
    await a.mouse.up();
    await expect.poll(() => b.evaluate(() => window.__game.health)).toBeLessThan(100);
    const given = 100 - (await b.evaluate(() => window.__game.health));
    expect(given).toBeGreaterThan(0);
    expect(given).toBeLessThan(100);
    await expect
      .poll(() => a.evaluate((id) => window.__game.deathDamage.exchange(id).given, t.id))
      .toEqual({ damage: given, hits: 1 });

    await focus(b);
    await b.evaluate((yaw) => {
      window.__game.yaw = yaw;
      window.__game.pitch = 0;
    }, t.yaw);
    for (let shot = 0; shot < 10; shot++) {
      if (await a.evaluate(() => window.__game.health <= 0)) break;
      await b.waitForFunction(() => window.__game.network!.connection.local!.cooldown === 0);
      await b.mouse.down();
      await b.mouse.up();
      await b.waitForTimeout(220);
    }
    await a.bringToFront();
    await expect.poll(() => a.evaluate(() => window.__game.health)).toBe(0);
    await expect(a.locator("#death-banner")).toBeVisible();
    const actual = await a.evaluate(
      ({ attacker, victim }) => {
        const events = window.__game.scene.userData.authoritativeHurt as {
          attacker: string;
          victim: string;
          damage: number;
        }[];
        const taken = events.filter(
          (event) => event.attacker === attacker && event.victim === victim,
        );
        return { damage: taken.reduce((sum, event) => sum + event.damage, 0), hits: taken.length };
      },
      { attacker: t.id, victim: ct.id },
    );
    expect(actual.damage).toBeGreaterThanOrEqual(100);
    expect(actual.hits).toBeGreaterThan(0);
    await expect(a.locator("#death-damage-taken")).toHaveText(
      `Damage taken: ${actual.damage} in ${actual.hits} ${actual.hits === 1 ? "hit" : "hits"}`,
    );
    await expect(a.locator("#death-damage-given")).toHaveText(`Damage given: ${given} in 1 hit`);
    await expect(a.locator("#death-fade")).toBeVisible();
    await a.screenshot({ path: "artifacts/multiplayer-damage-deathcam.png" });
    expect(errors).toEqual([]);
    completed = true;
  } finally {
    if (!completed) {
      const state = await Promise.all(
        [a, b].map((page) =>
          page
            .evaluate(() => {
              const g = window.__game,
                connection = g.network!.connection;
              return {
                locked: g.locked,
                dead: g.dead,
                phase: connection.round?.phase,
                local: connection.local,
                players: connection.players,
                events: g.scene.userData.authoritativeCombat,
                view: { yaw: g.yaw, pitch: g.pitch, selected: g.selected },
              };
            })
            .catch((error: unknown) => String(error)),
        ),
      );
      await test.info().attach("authoritative-deathcam-state", {
        body: JSON.stringify(state, null, 2),
        contentType: "application/json",
      });
    }
    await Promise.all(contexts.map((context) => context.close()));
  }
});
