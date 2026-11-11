import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

test("bot acquisition preserves visible priority, ties, smoke and blindness", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 150_000 });
  await expect(page.locator("#startup")).toBeHidden();
  const results = await page.evaluate(() => {
    const game = window.__game;
    type Bot = Game["bots"][number];
    const scenarios: {
      name: string;
      candidates: { z: number; wall?: boolean; smoke?: boolean }[];
      current?: number;
      blind?: boolean;
    }[] = [
      { name: "tie", candidates: [{ z: 10 }, { z: 10 }] },
      { name: "wall", candidates: [{ z: 10 }, { z: 5, wall: true }] },
      { name: "smoke", candidates: [{ z: 10 }, { z: 5, smoke: true }, { z: 7 }] },
      { name: "current", candidates: [{ z: 10 }, { z: 15 }], current: 2 },
      { name: "blind", candidates: [{ z: 10 }, { z: 5 }], blind: true },
    ];
    return scenarios.map((scenario) => {
      const vector = (z = 0) => game.position.clone().set(0, 0, z);
      const group = () => {
        const root = game.scene.clone(false);
        root.position.set(0, 0, 0);
        return root;
      };
      const bot = {
        group: group(),
        team: "t",
        health: 100,
        facing: 0,
        alert: 0,
        report: 0,
        suppressTime: 0,
        reaction: 0.3,
        burst: 0,
        target: scenario.current ?? null,
        tracking: false,
        moving: false,
        memory: vector(),
        aim: vector(),
        lastSight: vector(),
      } as unknown as Bot;
      const enemies = scenario.candidates.map((candidate) => {
        const root = group();
        root.position.z = candidate.z;
        return { group: root, team: "ct", health: 100, tracking: false } as unknown as Bot;
      });
      let geometryChecks = 0,
        smokeChecks = 0;
      const fake = {
        bots: [bot, ...enemies],
        teamMode: true,
        dead: true,
        eye: 1.6,
        position: vector(1000),
        velocity: vector(),
        utility: {
          blind: new Set(scenario.blind ? [0] : []),
          clearSight: (_from: unknown, to: { z: number }) => {
            smokeChecks++;
            return !scenario.candidates.some(
              (candidate) => candidate.z === to.z && candidate.smoke,
            );
          },
        },
        visible: (_from: unknown, to: { z: number }) => {
          geometryChecks++;
          return !scenario.candidates.some((candidate) => candidate.z === to.z && candidate.wall);
        },
      } as unknown as Game;
      const selected = game.perceiveBot.call(fake, bot, 1 / 16);
      return {
        name: scenario.name,
        target: selected?.id ?? null,
        tracking: bot.tracking,
        geometryChecks,
        smokeChecks,
      };
    });
  });
  expect(results).toEqual([
    { name: "tie", target: 1, tracking: true, geometryChecks: 1, smokeChecks: 1 },
    { name: "wall", target: 1, tracking: true, geometryChecks: 2, smokeChecks: 1 },
    { name: "smoke", target: 3, tracking: true, geometryChecks: 3, smokeChecks: 3 },
    { name: "current", target: 2, tracking: true, geometryChecks: 2, smokeChecks: 2 },
    { name: "blind", target: null, tracking: false, geometryChecks: 0, smokeChecks: 0 },
  ]);
});
