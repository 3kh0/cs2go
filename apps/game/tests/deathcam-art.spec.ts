import { expect, test } from "@playwright/test";

test("death card uses the killer's equipped finish and clears previous artwork", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const missing: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() === 404 && /\/(skins|icons|models\/agents)\//.test(response.url()))
      missing.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator('[data-mode="deathmatch"]').click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.active && window.__game.locked);
  await page.evaluate(async () => {
    const g = window.__game;
    g.simulate = () => {};
    const skinModule = "/src/skins.ts";
    const soldierModule = "/src/soldier.ts";
    const { skinCatalog, skinChoices } = (await import(
      skinModule
    )) as typeof import("../src/skins");
    const { setSoldierWeapon } = (await import(soldierModule)) as typeof import("../src/soldier");
    await skinCatalog();
    // The local player owns Case Hardened; the killing bot holds a separate
    // Redline instance. Painting the card from the local loadout would be wrong.
    skinChoices[0] = { id: "7_44", wear: 0.1, seed: 1 };
    const killer = g.bots[0];
    setSoldierWeapon(killer.rig, 0, true, {
      serial: 9001,
      weapon: 0,
      creator: "another-player",
      skin: { id: "7_282", wear: 0.1, seed: 1 },
    });
    g.feed(killer.name, "YOU", false, 0);
    // Artwork assertions intentionally isolate presentation; the companion
    // deathcam test exercises actual bullets, overkill and real respawn timing.
    g.deathBannerUntil = Infinity;
  });
  const art = page.locator("#death-weapon-icon");
  await expect(page.locator("#death-weapon")).toHaveText("AK-47 | Redline");
  await expect(art).toHaveAttribute("src", /\/skins\/thumbs\/7_282\.webp$/);
  await expect(art).toHaveClass(/death-weapon-thumbnail/);
  await expect
    .poll(() => art.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await expect(art).toHaveCSS("filter", "none");
  await page.screenshot({ path: "artifacts/deathcam-killer-redline-art.png" });
  await page.evaluate(() => {
    const g = window.__game;
    // This is the authoritative network kill-message path's appearance payload,
    // whose weapon can differ from the holder's current selection at receipt.
    g.feed("Remote player", "YOU", false, 3, false, false, undefined, {
      killerTeam: "t",
      killerId: "remote-player",
      appearance: {
        serial: 9002,
        weapon: 3,
        creator: "remote-player",
        skin: { id: "9_344", wear: 0.1, seed: 1 },
      },
    });
    g.deathBannerUntil = Infinity;
  });
  await expect(page.locator("#death-weapon")).toHaveText("AWP | Dragon Lore");
  await expect(art).toHaveAttribute("src", /\/skins\/thumbs\/9_344\.webp$/);
  await expect
    .poll(() => art.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  await page.screenshot({ path: "artifacts/deathcam-remote-dragon-lore-art.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.feed("Base weapon", "YOU", false, 1);
    g.deathBannerUntil = Infinity;
  });
  await expect(art).toHaveAttribute("src", /\/skins\/defaults\/1\.webp$/);
  await expect(art).toHaveAttribute("data-skin", "");
  await page.evaluate(() => window.__game.menu());
  await expect(page.locator("#death-banner")).toBeHidden();
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});
