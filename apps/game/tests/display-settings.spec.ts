import { expect, test } from "@playwright/test";

test("Video aspect stretches world, weapons and UI after reload, with an option to defer", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const ready = async () => {
    await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
    await expect(page.locator("#startup")).toHaveCount(0);
  };
  await page.addInitScript(() => {
    if (!localStorage.getItem("cs2go-settings"))
      localStorage.setItem("cs2go-settings", JSON.stringify({ viewmodelAspect: "4:3" }));
  });
  await page.goto("/");
  await ready();
  expect(await page.evaluate(() => window.__game.aspectAtStartup)).toBe("native");
  await page.screenshot({ path: "artifacts/display-native.png" });
  for (const [aspect, ratio] of [
    ["4:3", 4 / 3],
    ["5:4", 5 / 4],
  ] as const) {
    await page.locator("#settings-button").click();
    await page.getByRole("tab", { name: "Viewmodel", exact: true }).click();
    await expect(page.locator("#settings-viewmodel")).not.toContainText("Aspect ratio");
    await page.getByRole("tab", { name: "Video", exact: true }).click();
    if (aspect === "4:3") await expect(page.locator("#aspect-ratio")).toHaveValue("native");
    const previous = await page.evaluate(() => window.__game.camera.aspect);
    await page.locator("#aspect-ratio").selectOption(aspect);
    await expect(page.getByRole("dialog", { name: "RELOAD REQUIRED" })).toBeVisible();
    await page.screenshot({ path: `artifacts/display-reload-${aspect.replace(":", "-")}.png` });
    await page.locator("#settings-reload-later").click();
    await expect(page.locator("#settings")).toBeVisible();
    expect(await page.evaluate(() => window.__game.camera.aspect)).toBe(previous);
    await page.getByRole("tab", { name: "Viewmodel", exact: true }).click();
    await page.locator("#reset-viewmodel").click();
    await page.getByRole("tab", { name: "Video", exact: true }).click();
    await expect(page.locator("#aspect-ratio")).toHaveValue(aspect);
    await page.locator("#close-settings").click();
    await expect(page.locator("#settings-reload")).toHaveCount(0);
    await page.locator("#settings-button").click();
    await page.locator("#graphics-save").click();
    await Promise.all([page.waitForEvent("load"), page.locator("#settings-reload-now").click()]);
    await expect(page.locator("#startup")).toBeVisible();
    const loading = await page.locator("#startup").evaluate((node) => ({
      logical: (node as HTMLElement).offsetWidth,
      physical: node.getBoundingClientRect().width,
      width: innerWidth,
      height: innerHeight,
    }));
    expect(loading.logical / loading.height).toBeCloseTo(ratio, 2);
    expect(loading.physical).toBeCloseTo(loading.width);
    await page.screenshot({ path: `artifacts/display-loading-${aspect.replace(":", "-")}.png` });
    await expect(page.locator(".startup-title")).toBeVisible({ timeout: 100000 });
    await page.screenshot({
      path: `artifacts/display-intro-${aspect.replace(":", "-")}.png`,
      animations: "disabled",
    });
    await ready();
    await page.locator("#settings-button").click();
    await page.locator("#aspect-ratio").click();
    await expect
      .poll(() => page.locator("#aspect-ratio").evaluate((node) => node.matches(":open")))
      .toBe(true);
    const optionBounds = await page.locator("#aspect-ratio option").first().boundingBox();
    const triggerBounds = await page.locator("#aspect-ratio").boundingBox();
    expect(optionBounds!.x).toBeGreaterThanOrEqual(0);
    expect(optionBounds!.y).toBeGreaterThanOrEqual(0);
    expect(optionBounds!.x + optionBounds!.width).toBeLessThanOrEqual(1441);
    const lastOption = await page.locator("#aspect-ratio option").last().boundingBox();
    expect(lastOption!.y + lastOption!.height).toBeLessThanOrEqual(901);
    expect(
      Math.min(
        Math.abs(lastOption!.y + lastOption!.height - triggerBounds!.y),
        Math.abs(optionBounds!.y - triggerBounds!.y - triggerBounds!.height),
      ),
    ).toBeLessThan(40);
    const picker = await page.locator("#aspect-ratio").evaluate((node) => ({
      transform: getComputedStyle(node, "::picker(select)").transform,
      stretch: getComputedStyle(document.documentElement).getPropertyValue("--game-stretch"),
    }));
    expect(Number(picker.transform.match(/matrix\(([^,]+)/)?.[1])).toBeCloseTo(
      Number(picker.stretch),
    );
    await page.screenshot({ path: `artifacts/display-dropdown-${aspect.replace(":", "-")}.png` });
    await page.keyboard.press("Escape");
    await page.locator("#close-settings").click();
    const dimensions = await page.evaluate(() => {
      const g = window.__game;
      const app = document.getElementById("app")!.getBoundingClientRect();
      const icon = document.getElementById("home-scenery-button")!.getBoundingClientRect();
      return {
        world: g.camera.aspect,
        weapon: g.viewCamera.aspect,
        canvas: g.canvas.getBoundingClientRect().width,
        width: innerWidth,
        height: innerHeight,
        root: app.width,
        icon: icon.width / icon.height,
      };
    });
    expect(dimensions.world).toBeCloseTo(ratio);
    expect(dimensions.weapon).toBeCloseTo(ratio);
    expect(dimensions.canvas).toBeCloseTo(dimensions.width);
    expect(dimensions.root).toBeCloseTo(dimensions.width);
    expect(dimensions.icon).toBeCloseTo(dimensions.width / dimensions.height / ratio);
    await page.screenshot({ path: `artifacts/display-home-${aspect.replace(":", "-")}.png` });
    await page.locator("#home-play").click();
    await page.locator("#play").click();
    await page.locator('#team-select [data-team="ct"]').click();
    await page.waitForFunction(() => window.__game.active);
    await page.screenshot({ path: `artifacts/display-game-${aspect.replace(":", "-")}.png` });
    await page.waitForFunction(() => window.__game.locked);
    await page.keyboard.press("KeyB");
    await expect(page.locator("#loadout")).toBeVisible();
    await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-pose", /.+/);
    await page.screenshot({ path: `artifacts/display-buy-${aspect.replace(":", "-")}.png` });
    await page.evaluate(() => window.__game.menu());
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  expect(await page.evaluate(() => window.__game.camera.aspect)).toBeCloseTo(5 / 4);
  await expect
    .poll(() => page.locator("#game").evaluate((canvas) => canvas.getBoundingClientRect().width))
    .toBeCloseTo(1920);
  expect(errors).toEqual([]);
});
