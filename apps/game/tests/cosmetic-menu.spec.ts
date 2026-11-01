import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("inventory equips gloves per team, previews agent animations and restores defaults", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [],
    failed: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400) failed.push(response.url());
    if (/^https?:$/.test(url.protocol) && url.hostname !== "127.0.0.1")
      external.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#skins-button").click();
  await page.locator("#inventory-gloves").click();
  await expect(page.locator("#cosmetic-menu")).toBeVisible();
  await expect(page.locator("#cosmetic-search")).toBeFocused({ timeout: 30_000 });
  const glove = await page.evaluate(async () => {
    const path = "/src/gloves.ts";
    const { loadGloveCatalog } = (await import(path)) as typeof import("../src/gloves");
    const catalog = await loadGloveCatalog();
    return (
      catalog.find((glove) => /Pandora/i.test(glove.name)) ?? catalog.find((glove) => glove.paint)!
    );
  });
  await page.locator("#cosmetic-team").selectOption("ct");
  await page.locator(`[data-cosmetic-item="${glove.id}"]`).click();
  await page.locator("#cosmetic-preview-image").evaluate(async (element) => {
    await (element as HTMLImageElement).decode();
  });
  await page.locator("#glove-float").fill("1.2");
  await page.locator("#equip-cosmetic").click();
  expect(
    await page
      .locator("#glove-float")
      .evaluate((element) => (element as HTMLInputElement).validity.valid),
  ).toBe(false);
  await page.locator("#reset-cosmetic").click();
  await expect(page.locator("#glove-float")).toHaveValue("0.01");
  await page.locator(`[data-cosmetic-item="${glove.id}"]`).click();
  await page.locator("#glove-float").fill("0.123456");
  await page.locator("#glove-seed").fill("749");
  await page.locator("#equip-cosmetic").click();
  await expect(page.locator("#cosmetic-status")).toContainText("equipped for Counter-Terrorists", {
    timeout: 30_000,
  });
  const choices = () =>
    page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("cs2go-gloves") ?? "{}") as Record<
          "ct" | "t",
          { id: string; wear: number; seed: number }
        >,
    );
  expect((await choices()).ct).toEqual({ id: glove.id, wear: 0.123456, seed: 749 });
  await page.screenshot({ path: "artifacts/inventory-gloves.png" });
  await page.locator("#cosmetic-team").selectOption("t");
  await page.locator("#reset-cosmetic").click();
  await expect(page.locator("#cosmetic-status")).toContainText(
    "Default gloves equipped for Terrorists",
  );
  expect((await choices()).ct.id).toBe(glove.id);
  expect((await choices()).t.id).toBe("");
  await page.locator('[data-cosmetic-category="agents"]').click();
  await expect(page.locator("#cosmetic-search")).toBeFocused({ timeout: 30_000 });
  await page.locator("#cosmetic-team").selectOption("ct");
  await expect(page.locator("#play-agent-animation")).toBeEnabled();
  await page.locator("#agent-animation").selectOption("weapon/ak::ct_buymenu_ak");
  await page.locator("#play-agent-animation").click();
  await expect(page.locator("#cosmetic-status")).toContainText("Playing", { timeout: 45_000 });
  await page.screenshot({ path: "artifacts/inventory-default-sas.png" });
  await page.locator("#stop-agent-animation").click();
  await page.locator("#cosmetic-team").selectOption("t");
  const agent = await page.evaluate(async () => {
    const path = "/src/agent-roster.ts";
    const { loadAgentCatalog } = (await import(path)) as typeof import("../src/agent-roster");
    const catalog = await loadAgentCatalog();
    const visible = catalog.filter(
      (agent) =>
        agent.team === "t" &&
        agent.model &&
        document.querySelector(`[data-cosmetic-item="${agent.id}"]`),
    );
    return visible.find((agent) => /Little Kev/i.test(agent.name)) ?? visible[0]!;
  });
  await page.locator(`[data-cosmetic-item="${agent.id}"]`).click();
  await page.locator("#equip-cosmetic").click();
  await expect(page.locator("#cosmetic-status")).toContainText("equipped for Terrorists", {
    timeout: 45_000,
  });
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-agent", /^(?!default)/, {
    timeout: 45_000,
  });
  await expect(page.locator("#agent-animation option")).not.toHaveCount(0);
  await page.locator("#agent-animation-group").selectOption("taunt");
  const option = await page.locator("#agent-animation option").first().getAttribute("value");
  expect(option).toBeTruthy();
  await page.locator("#agent-animation").selectOption(option!);
  await page.locator("#play-agent-animation").click();
  await expect(page.locator("#cosmetic-status")).toContainText("Playing", { timeout: 45_000 });
  await page.screenshot({ path: "artifacts/inventory-agent-animation.png" });
  // A temporarily disabled Play button can leave focus on the document body.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  expect(
    await page
      .locator("#cosmetic-menu")
      .evaluate((element) => element.contains(document.activeElement)),
  ).toBe(true);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Escape");
  await expect(page.locator("#cosmetic-menu")).toBeHidden();
  await page.locator("#skins-button").click();
  await page.locator("#inventory-agents").click();
  await expect(page.locator("#cosmetic-search")).toBeFocused();
  await page.locator("#agent-animation-group").selectOption("weapon");
  await page.locator("#agent-animation-search").fill("buy menu");
  await page.locator("#agent-animation").selectOption("weapon/ak::t_buymenu_ak_03");
  await page.locator("#play-agent-animation").click();
  await expect(page.locator("#cosmetic-status")).toContainText("Playing", { timeout: 45_000 });
  await page.screenshot({ path: "artifacts/inventory-agent-armed.png" });
  await page.locator("#stop-agent-animation").click();
  await expect(page.locator("#cosmetic-status")).toHaveText("Default idle restored.");
  await page.locator("#reset-cosmetic").click();
  await expect(page.locator("#cosmetic-status")).toContainText("equipped for Terrorists");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-agent", "default-t", {
    timeout: 30_000,
  });
  await page.locator("#cosmetic-weapons").click();
  await expect(page.locator("#skin-menu")).toBeVisible();
  await expect(page.locator("#cosmetic-menu")).toBeHidden();
  await page.locator("#close-skins").click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.bringToFront();
  if (!(await page.evaluate(() => window.__game.locked))) await page.locator("#game").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => document.exitPointerLock());
  await page.locator("#pause-skins").click();
  await page.locator("#inventory-agents").click();
  await expect(page.locator("#cosmetic-search")).toBeFocused();
  await expect(page.locator("#play-agent-animation")).toBeDisabled();
  await expect(page.locator("#agent-animation")).toBeDisabled();
  await expect(page.locator("#agent-animation-hint")).toContainText("main menu");
  await page.keyboard.press("Escape");
  await expect(page.locator("#cosmetic-menu")).toBeHidden();
  await page.locator("#resume").click();
  await page.waitForFunction(() => window.__game.locked);
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
});
