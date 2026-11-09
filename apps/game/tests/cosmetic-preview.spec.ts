import { expect, test } from "@playwright/test";

test("draft agents and gloves render native poses without equipping and close cleanly", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || /PropertyBinding|No target node/.test(message.text()))
      errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && /\/(models|skins|icons)\//.test(response.url()))
      errors.push(`${response.status()} ${response.url()}`);
  });
  const started = Date.now();
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  console.log("GAME READY", Date.now() - started, "ms");
  const original = await page.evaluate(() => ({
    agents: localStorage.getItem("cs2go-agents"),
    gloves: localStorage.getItem("cs2go-gloves"),
    team: (window as unknown as { __game: { team: string } }).__game.team,
  }));
  await page.locator("#skins-button").click();
  await page.locator("#inventory-gloves").click();
  const stage = page.locator("#cosmetic-preview-stage");
  await expect(stage).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  const glove = await page.evaluate(async () => {
    const path = "/src/gloves.ts";
    const { loadGloveCatalog } = (await import(path)) as typeof import("../src/gloves");
    return (await loadGloveCatalog()).find((item) => /Pandora/i.test(item.name))!;
  });
  await page.locator(`[data-cosmetic-item="${glove.id}"]`).click();
  await expect(stage).toHaveAttribute("data-item", glove.id, { timeout: 60_000 });
  await expect(stage).toHaveAttribute("data-ready", "true");
  await expect(stage).toHaveAttribute("data-animation", /pedestal_gloves_loop/);
  await page.locator("#glove-details summary").click();
  await page.locator("#glove-float").fill("0.123456");
  await page.locator("#glove-seed").fill("749");
  await expect(stage).toHaveAttribute("data-wear", "0.123456", { timeout: 60_000 });
  await expect(stage).toHaveAttribute("data-seed", "749");
  await expect(stage).toHaveAttribute("data-ready", "true");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "artifacts/cosmetic-gloves-native-preview.png" });
  await page.locator('[data-cosmetic-category="agents"]').click();
  await expect(stage).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  const team = original.team === "ct" ? "t" : "ct";
  await page.locator("#cosmetic-team").selectOption(team);
  await expect(stage).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await expect(page.locator("#agent-animation-controls")).not.toHaveAttribute("open");
  await expect(page.locator("#agent-animation")).toBeHidden();
  const agent = await page
    .locator("#cosmetic-items [data-cosmetic-item]")
    .nth(1)
    .getAttribute("data-cosmetic-item");
  await page.locator(`[data-cosmetic-item="${agent}"]`).click();
  await expect(stage).toHaveAttribute("data-item", agent!, { timeout: 60_000 });
  await expect(stage).toHaveAttribute("data-ready", "true");
  await page.screenshot({ path: "artifacts/cosmetic-agent-draft-preview.png" });
  expect(
    await page.evaluate(() => ({
      agents: localStorage.getItem("cs2go-agents"),
      gloves: localStorage.getItem("cs2go-gloves"),
      team: (window as unknown as { __game: { team: string } }).__game.team,
    })),
  ).toEqual(original);
  await page.locator("#agent-animation-controls summary").click();
  const animation = team === "ct" ? "weapon/ak::ct_buymenu_ak" : "weapon/ak::t_buymenu_ak_03";
  await page.locator("#agent-animation").selectOption(animation);
  await page.locator("#play-agent-animation").click();
  await expect(page.locator("#cosmetic-status")).toContainText("Playing", { timeout: 60_000 });
  await expect(stage).toHaveAttribute("data-animation", animation);
  expect(
    await page.locator("#close-cosmetic").evaluate((element) => {
      const r = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }),
  ).toBe(true);
  await page.locator("#close-cosmetic").click();
  await expect(page.locator("#cosmetic-menu")).toBeHidden();
  await expect(stage).not.toHaveAttribute("data-ready");
  // Close while a real, uncached model is in flight; its late completion must
  // release its lease and must not resurrect the preview or change equipment.
  const delayed = await page.evaluate(async () => {
    const path = "/src/gloves.ts";
    const { loadGloveCatalog } = (await import(path)) as typeof import("../src/gloves");
    return (await loadGloveCatalog()).find((item) => item.model.endsWith("5034.glb"))!;
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  let requested!: () => void;
  const arrived = new Promise<void>((resolve) => (requested = resolve));
  await page.route("**/models/gloves/5034.glb", async (route) => {
    requested();
    await gate;
    await route.continue();
  });
  await page.locator("#skins-button").click();
  await page.locator("#inventory-gloves").click();
  await page.locator(`[data-cosmetic-item="${delayed.id}"]`).click();
  await arrived;
  await page.locator("#close-cosmetic").click();
  release();
  await page.waitForTimeout(1200);
  await expect(page.locator("#cosmetic-menu")).toBeHidden();
  await expect(stage).not.toHaveAttribute("data-ready");
  expect(await page.evaluate(() => localStorage.getItem("cs2go-gloves"))).toBe(original.gloves);
  expect(errors).toEqual([]);
});
