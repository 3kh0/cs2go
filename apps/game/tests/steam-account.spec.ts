import { expect, test } from "@playwright/test";

test("Steam OpenID begins at the real provider with a cookie-bound return URL", async ({
  request,
  baseURL,
}) => {
  const response = await request.get("/api/steam?action=login", { maxRedirects: 0 });
  expect(response.status()).toBe(303);
  const destination = new URL(response.headers().location);
  expect(destination.origin).toBe("https://steamcommunity.com");
  expect(destination.pathname).toBe("/openid/login");
  expect(destination.searchParams.get("openid.mode")).toBe("checkid_setup");
  const callback = new URL(destination.searchParams.get("openid.return_to")!);
  expect(callback.origin).toBe(new URL(baseURL!).origin);
  expect(callback.searchParams.get("action")).toBe("callback");
  expect(response.headers()["set-cookie"]).toContain("HttpOnly; SameSite=Lax");
  const forged = await request.get("/api/steam?action=callback&state=forged", { maxRedirects: 0 });
  expect(forged.headers().location).toBe(`${new URL(baseURL!).origin}/?steam=failed`);
});

test("Steam profile and owned skin UI preserve exact wear and seed and handle sign-out", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let signedIn = true;
  let failSync = false;
  const profile = {
    steamId: "76561199528285628",
    name: "Grok <4.6>",
    avatar: "/api/steam?action=avatar",
    profileUrl: "https://steamcommunity.com/profiles/76561199528285628/",
  };
  await page.route("**/api/steam?*", async (route) => {
    const action = new URL(route.request().url()).searchParams.get("action");
    if (action === "avatar")
      return route.fulfill({
        path: decodeURIComponent(
          new URL("../../../packages/assets/public/icons/team-t.png", import.meta.url).pathname,
        ),
        contentType: "image/png",
      });
    if (action === "logout") signedIn = false;
    if (action === "sync") {
      if (failSync)
        return route.fulfill({
          status: 502,
          json: {
            error: "Steam inventory is private. Make your Inventory public, then sync again.",
          },
        });
      return route.fulfill({
        json: {
          reportedTotal: 3,
          syncedAt: Date.now(),
          items: [
            {
              assetId: "1",
              name: "AK-47 | Case Hardened (Field-Tested)",
              weaponName: "AK-47",
              finish: "Case Hardened",
              wear: 0.231234565,
              seed: 661,
            },
            {
              assetId: "2",
              name: "Unmatched Sticker",
              weaponName: "",
              finish: "",
              wear: null,
              seed: null,
            },
          ],
        },
      });
    }
    return route.fulfill({ json: { profile: signedIn ? profile : null } });
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#home-player-name")).toHaveText("Grok <4.6>");
  await expect(page.locator("#steam-avatar")).toBeVisible();
  await page.evaluate(() => window.__game.scoreboard());
  await expect(page.locator(".score-row.you .score-player")).toHaveText("Grok <4.6>");
  await expect(page.locator(".score-row.you .score-avatar img")).toHaveAttribute(
    "src",
    "/api/steam?action=avatar",
  );
  await page.locator("#steam-account-button").click();
  await expect(page.locator("#steam-status")).toContainText("1 finishes ready to equip");
  await expect(page.locator("#steam-status")).toContainText("3 total items");
  await expect(page.locator("#steam-login")).toBeHidden();
  await page.screenshot({ path: "artifacts/steam-account-inventory.png" });
  await page.locator('[data-steam-asset="1"]').click();
  await expect(page.locator("#steam-status")).toContainText("Equipped AK-47", { timeout: 30_000 });
  const choice = await page.evaluate(() => JSON.parse(localStorage.getItem("cs2go-skins-v1")!)[0]);
  expect(choice).toEqual({ id: "7_44", wear: 0.231234565, seed: 661 });
  failSync = true;
  await page.locator("#steam-sync").click();
  await expect(page.locator("#steam-status")).toContainText("inventory is private");
  await expect(page.locator('[data-steam-asset="1"]')).toBeVisible();
  await page.locator("#steam-logout").click();
  await expect(page.locator("#steam-status")).toContainText("Signed out");
  await expect(page.locator("#steam-login")).toBeVisible();
  await expect(page.locator("#steam-avatar")).toBeHidden();
  await expect(page.locator("#home-player-name")).toHaveText("PLAYER");
  await page.keyboard.press("Escape");
  await expect(page.locator("#steam-account")).toBeHidden();
  await expect(page.locator("#steam-account-button")).toBeFocused();
  await page.locator("#skins-button").click();
  await page.locator("#steam-owned-button").click();
  await expect(page.locator("#steam-account")).toBeVisible();
  expect(errors).toEqual([]);
});

test("rate-limited sync offers a local import and reuses its snapshot after reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  let syncs = 0;
  await page.route("**/api/steam?*", async (route) => {
    const action = new URL(route.request().url()).searchParams.get("action");
    if (action === "sync") {
      syncs++;
      return route.fulfill({
        status: 429,
        headers: { "Retry-After": "120" },
        json: { error: "Steam is rate limiting requests.", retryAfter: 120 },
      });
    }
    return route.fulfill({
      json: {
        profile: {
          steamId: "76561199528285628",
          name: "Test Player",
          avatar: null,
          profileUrl: "https://steamcommunity.com/profiles/76561199528285628/",
        },
      },
    });
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await page.locator("#steam-account-button").click();
  await expect(page.locator("#steam-status")).toContainText("Retry in 120 seconds");
  await expect(page.locator("#steam-sync")).toBeDisabled();
  await expect(page.locator("#steam-local-open")).toHaveAttribute(
    "href",
    /steamcommunity.com\/inventory\/76561199528285628\/730\/2/,
  );
  const data = {
    success: 1,
    total_inventory_count: 1,
    assets: [{ assetid: "5", classid: "4", instanceid: "0" }],
    descriptions: [
      {
        classid: "4",
        instanceid: "0",
        market_hash_name: "AK-47 | Case Hardened (Field-Tested)",
        tags: [{ category: "Weapon", localized_tag_name: "AK-47" }],
      },
    ],
    asset_properties: [
      {
        assetid: "5",
        asset_properties: [
          { propertyid: 1, int_value: 661 },
          { propertyid: 2, float_value: 0.231234565 },
        ],
      },
    ],
  };
  const selectJSON = async (value: unknown) =>
    page.locator("#steam-local-file").evaluate((input, value) => {
      const files = new DataTransfer();
      files.items.add(
        new File([JSON.stringify(value)], "inventory.json", { type: "application/json" }),
      );
      (input as HTMLInputElement).files = files.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  await selectJSON(data);
  await expect(page.locator("#steam-status")).toContainText(
    "Imported 1 visible Steam items on this device",
  );
  await expect(page.locator('[data-steam-asset="5"]')).toBeVisible();
  await page.screenshot({ path: "artifacts/steam-local-import.png" });
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await page.locator("#steam-account-button").click();
  await expect(page.locator('[data-steam-asset="5"]')).toBeVisible();
  expect(syncs).toBe(1);
  // A partial replacement must not destroy the last successful snapshot.
  await page.locator("#steam-local-import summary").click();
  await selectJSON({ ...data, more_items: 1, last_assetid: "5" });
  await expect(page.locator("#steam-status")).toContainText("Incomplete inventory");
  await expect(page.locator('[data-steam-asset="5"]')).toBeVisible();
});
