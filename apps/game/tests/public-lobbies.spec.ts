import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("ONLINE creates an explicit public lobby and another client browses and joins it", async ({
  page: host,
  context,
}) => {
  test.setTimeout(240_000);
  const guest = await context.newPage();
  const errors: string[] = [];
  for (const page of [host, guest]) page.on("pageerror", (error) => errors.push(error.message));
  const invitation = `/?server=${encodeURIComponent("ws://127.0.0.1:3002/ws")}`;
  await host.goto(invitation);
  await expect(host.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(host.locator("#startup")).toHaveCount(0);
  await expect(host.getByRole("button", { name: "ONLINE", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(host.locator("#match-visibility")).toHaveValue("private");
  await host.locator("#match-visibility").selectOption("public");
  await host.locator("#match-create").click();
  await expect(host.locator("#team-select")).toBeVisible({ timeout: 120_000 });
  await host.locator('#team-select [data-team="ct"]').click();
  await expect(host.locator("#lobby-pin")).toHaveText(/^\d{6}$/, { timeout: 15_000 });
  const pin = (await host.locator("#lobby-pin").textContent())!;
  await guest.goto(invitation);
  await expect(guest.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(guest.locator("#startup")).toHaveCount(0);
  const lobby = guest.locator(`[data-public-room="${pin}"]`);
  await expect(lobby).toBeVisible({ timeout: 15_000 });
  await expect(lobby).toContainText("1/20");
  await expect(lobby).toContainText("Dust II");
  await guest.screenshot({ path: "artifacts/online-public-lobby-browser.png" });
  await lobby.click();
  await expect(guest.locator("#team-select")).toBeVisible({ timeout: 120_000 });
  await guest.locator('#team-select [data-team="t"]').click();
  await expect(guest.locator("#lobby-pin")).toHaveText(pin, { timeout: 15_000 });
  for (const page of [host, guest])
    await page.waitForFunction(() => window.__game.network?.connection.players.length === 2);
  expect(errors).toEqual([]);
  await guest.close();
});
