import { expect, type Page } from "@playwright/test";

async function openSwitcher(page: Page) {
  if (!(await page.locator("#home-scenery").isVisible()))
    await page.locator("#home-scenery-button").click();
}

export async function selectHomeWeapon(page: Page, index: string | number) {
  await openSwitcher(page);
  await page.getByRole("button", { name: "Change Weapon", exact: true }).click();
  await page.locator(`[data-home-weapon="${index}"]`).click();
}

export async function selectHomeScenery(page: Page, name: string) {
  await openSwitcher(page);
  await page.getByRole("button", { name: "Change Main Menu Scenery", exact: true }).click();
  await page.locator("#home-background-options").getByRole("button", { name, exact: true }).click();
}

export async function equipHomeAgent(page: Page, team: "ct" | "t", id: string) {
  await selectHomeTeam(page, team);
  await page.locator("#inventory-button").click();
  await page.locator('.loadout-team [data-loadout-cosmetic="agents"]').click();
  await page.locator(`[data-cosmetic-choice="${id}"]`).click();
  await expect(page.locator(`#loadout-agent-${team}`)).toHaveAttribute("data-agent", id, {
    timeout: 30000,
  });
  await page.locator("#home-button").click();
}

export async function selectHomeTeam(page: Page, team: "ct" | "t") {
  if ((await page.locator("#home-agent-stage").getAttribute("data-agent"))?.endsWith("-" + team))
    return;
  await openSwitcher(page);
  const switcher = page.locator("#home-switch-team");
  if ((await switcher.textContent())?.includes(team === "t" ? " T " : " CT "))
    await switcher.click();
  else await page.locator("#home-scenery-button").click();
}
