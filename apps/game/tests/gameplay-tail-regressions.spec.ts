import { expect, test } from "@playwright/test";

test("gameplay defers hidden buy UI and updates scoreboard clock without replacing rows", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toBeHidden();
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const hiddenRefreshes = await page.evaluate(() => {
    const game = window.__game;
    game.health = 1000000;
    const update = game.updateBuyMenu.bind(game);
    let calls = 0;
    game.updateBuyMenu = () => {
      calls++;
      update();
    };
    game.updateUI();
    return calls;
  });
  expect(hiddenRefreshes).toBe(0);
  await page.keyboard.press("b");
  await expect(page.locator("#loadout")).toBeVisible();
  await expect(page.locator("#buy-money")).toHaveText("FREE PRACTICE LOADOUT");
  await expect(page.locator("#buy-rules")).toContainText("Unlimited buying");
  const clock = await page.evaluate(() => {
    const game = window.__game;
    const mode = game.mode,
      time = game.time,
      freeze = game.freezeTime;
    try {
      game.mode = "casual";
      game.freezeTime = 0;
      game.time = 61;
      game.scoreboard();
      const rows = document.getElementById("scoreboard-rows")!;
      const first = rows.firstElementChild;
      const before = document.getElementById("scoreboard-clock")!.textContent;
      game.time = 60;
      game.scoreboard();
      return {
        before,
        after: document.getElementById("scoreboard-clock")!.textContent,
        retained: !!first && first === rows.firstElementChild,
      };
    } finally {
      game.mode = mode;
      game.time = time;
      game.freezeTime = freeze;
    }
  });
  expect(clock).toEqual({ before: "1:01", after: "1:00", retained: true });
  expect(errors).toEqual([]);
});
