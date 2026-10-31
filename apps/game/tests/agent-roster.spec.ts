import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
import type { AgentDefinition } from "../src/agent-roster";
declare global {
  interface Window {
    __game: Game;
  }
}

test("agent roster is lazy, saved per team, and used by previews and newly spawned bots", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const models: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/agents\/roster\/[^/]+\.glb/.test(request.url())) models.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  expect(models).toEqual([]);
  await page.locator("#home-scenery-button").click();
  const catalog = await page.evaluate(async () => {
    const { loadAgentCatalog } = await import("../src/agent-roster");
    return loadAgentCatalog();
  });
  expect(catalog.length).toBeGreaterThan(60);
  expect(models).toEqual([]);
  const choose = async (team: "ct" | "t", preferred: RegExp) => {
    await page.locator("#home-showcase-team").selectOption(team);
    const options = catalog.filter((agent: AgentDefinition) => agent.team === team && agent.model);
    const agent =
      options.find((entry: AgentDefinition) => preferred.test(entry.name)) ?? options[0]!;
    await page.locator("#home-showcase-agent").selectOption(agent.id);
    await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-agent", agent.id, {
      timeout: 30_000,
    });
    await expect(page.locator("#home-agent-name")).toHaveText(agent.name);
    await expect(page.locator("#play")).toBeEnabled();
    await page.screenshot({ path: `artifacts/agent-roster-${team}.png` });
    return agent;
  };
  const ct = await choose("ct", /\bava\b|\bmae\b/i);
  const t = await choose("t", /darryl/i);
  expect(models.length).toBe(2);
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await expect(page.locator("#team-select")).not.toHaveAttribute("aria-busy", "true");
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  const appearances = await page.evaluate(() =>
    window.__game.bots.map((bot) => ({ team: bot.team, model: bot.rig.model.userData.agentModel })),
  );
  expect(
    appearances.filter((agent) => agent.team === "ct").every((agent) => agent.model === ct.model),
  ).toBe(true);
  expect(
    appearances.filter((agent) => agent.team === "t").every((agent) => agent.model === t.model),
  ).toBe(true);
  await page.evaluate(() => {
    window.__game.freezeTime = window.__game.invulnerable = 100;
  });
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-agent", ct.id);
  await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-agent-model", ct.model);
  await page.evaluate(() => {
    document.exitPointerLock();
    window.__game.menu();
  });
  await page.locator("#home-scenery-button").click();
  const replacement = await choose("ct", /\bava\b/i);
  expect(replacement.id).not.toBe(ct.id);
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.freezeTime = window.__game.invulnerable = 100;
  });
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-agent", replacement.id);
  await expect(page.locator("#buy-preview-stage")).toHaveAttribute(
    "data-agent-model",
    replacement.model,
  );
  await page.evaluate(() => {
    document.exitPointerLock();
    window.__game.menu();
  });
  await page.reload();
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-agent", replacement.id, {
    timeout: 100_000,
  });
  await expect(page.locator("#home-agent-name")).toHaveText(replacement.name);
  expect(errors).toEqual([]);
});
