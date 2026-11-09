import { expect, test } from "@playwright/test";

test("native faction badges stay translucent and follow live HUD color changes", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [],
    missing: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) missing.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  for (const team of ["ct", "t"] as const) {
    await page.evaluate((team) => {
      const game = window.__game;
      game.active = false;
      game.setTeam(team);
      game.start("casual");
      game.simulate = () => {};
      game.active = true;
      game.settings.hudHue = 110;
      game.saveSettings();
      game.updateUI();
    }, team);
    const badge = page.locator("#hud-team-icon");
    await expect(badge).toHaveAttribute("role", "img");
    await expect(badge).toHaveAttribute(
      "aria-label",
      team === "ct" ? "Counter-Terrorists" : "Terrorists",
    );
    const alpha = await badge.evaluate(async (element, team) => {
      const style = getComputedStyle(element),
        path = style.maskImage.match(/^url\("?(.+?)"?\)$/)?.[1];
      if (!path || !path.endsWith(`/icons/hud/team-${team}.svg`))
        throw new Error("Wrong native faction mask");
      const image = new Image();
      image.src = path;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 64;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0, 64, 64);
      const pixels = context.getImageData(0, 0, 64, 64).data;
      let transparent = 0,
        filled = 0;
      for (let i = 3; i < pixels.length; i += 4) {
        if (!pixels[i]) transparent++;
        if (pixels[i] > 200) filled++;
      }
      const circle = element.parentElement!,
        ring = getComputedStyle(circle, "::after"),
        iconRect = element.getBoundingClientRect(),
        circleRect = circle.getBoundingClientRect();
      return {
        transparent,
        filled,
        corner: pixels[3],
        ratio: circleRect.width / iconRect.width,
        centered: Math.abs(iconRect.x + iconRect.width / 2 - circleRect.x - circleRect.width / 2),
        ringWidth: parseFloat(ring.borderTopWidth),
        ringColor: ring.borderTopColor,
        ringOpacity: parseFloat(ring.opacity),
        iconColor: style.backgroundColor,
        iconOpacity: parseFloat(style.opacity),
        plateColor: getComputedStyle(circle).backgroundColor,
        accent: getComputedStyle(document.getElementById("health-fill")!).backgroundColor,
      };
    }, team);
    expect(alpha.transparent).toBeGreaterThan(1000);
    expect(alpha.filled).toBeGreaterThan(100);
    expect(alpha.corner).toBe(0);
    expect(alpha.ratio).toBeCloseTo(64 / 48, 2);
    expect(alpha.centered).toBeLessThan(0.1);
    expect(alpha.ringWidth).toBeGreaterThan(1);
    expect(alpha.iconColor).toBe(alpha.accent);
    expect(alpha.ringColor).toBe(alpha.accent);
    expect(alpha.ringOpacity).toBeLessThan(0.8);
    expect(alpha.ringOpacity).toBeGreaterThan(0.2);
    expect(alpha.iconOpacity).toBeLessThan(0.9);
    expect(alpha.iconOpacity).toBeGreaterThan(0.4);
    expect(alpha.plateColor).toBe("rgba(0, 0, 0, 0.2)");
    await page.evaluate((team) => {
      const game = window.__game;
      game.settings.hudHue = team === "ct" ? 210 : 280;
      game.saveSettings();
      game.updateUI();
    }, team);
    const live = await badge.evaluate((element) => ({
      team: element.dataset.team,
      color: getComputedStyle(element).backgroundColor,
      ring: getComputedStyle(element.parentElement!, "::after").borderTopColor,
      accent: getComputedStyle(document.getElementById("health-fill")!).backgroundColor,
    }));
    expect(live.team).toBe(team);
    expect(live.color).toBe(live.accent);
    expect(live.ring).toBe(live.accent);
    expect(live.color).not.toBe(alpha.iconColor);
    await page.screenshot({ path: `artifacts/hud-accent-badge-${team}.png` });
    await page
      .locator(".hud-team")
      .screenshot({ path: `artifacts/hud-accent-badge-${team}-detail.png` });
  }
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});
