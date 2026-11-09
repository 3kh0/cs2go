import { expect, type Page } from "@playwright/test";

const pins = new Map<string, string>();
export const lobbyPin = (label: string) => pins.get(label) ?? label;

export async function joinLobby(page: Page, label: string, team: "ct" | "t") {
  // Asset preparation yields between GPU uploads; keep the joining client
  // foregrounded so Chromium does not throttle its loading timers.
  await page.bringToFront();
  const pin = pins.get(label);
  await page.goto(`/?server=ws://127.0.0.1:3002/ws${pin ? `&room=${pin}` : ""}`);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator(pin ? "#play" : "#match-create").click();
  await expect(page.locator("#team-select")).toBeVisible({ timeout: 100000 });
  await page.locator(`#team-select [data-team="${team}"]`).click();
  await page.waitForFunction(() => !!window.__game.network?.connection.local);
  const assigned = await page.locator("#match-room").inputValue();
  expect(assigned).toMatch(/^\d{6}$/);
  pins.set(label, assigned);
}
