import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

for (const compressed of [true, false])
  test(`Mirage first-person knife and gloves use ${compressed ? "native reflections" : "decoded probes without studio reflections"} in dark rooms`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    const failed: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && /\/(models|maps|audio|icons)\//.test(response.url()))
        failed.push(`${response.status()} ${response.url()}`);
    });
    if (!compressed)
      await page.addInitScript(() => {
        // oxlint-disable-next-line typescript/unbound-method -- Called with the real GL context below.
        const original = WebGL2RenderingContext.prototype.getExtension as (
          this: WebGL2RenderingContext,
          name: string,
        ) => unknown;
        Object.defineProperty(WebGL2RenderingContext.prototype, "getExtension", {
          value(this: WebGL2RenderingContext, name: string) {
            return name === "EXT_texture_compression_bptc" ? null : original.call(this, name);
          },
        });
      });
    await page.goto("/");
    await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
    await expect(page.locator("#startup")).toHaveCount(0);
    await page.locator("#home-play").click();
    await page.locator('[data-mode="practice"]').click();
    await page.locator('[data-map="mirage"]').click();
    await page.locator("#play").click();
    await page.locator('#team-select [data-team="ct"]').click();
    await page.waitForFunction(() => window.__game.locked && window.__game.mapId === "mirage");
    await page.evaluate(() => {
      const g = window.__game;
      for (const bot of g.bots) {
        bot.health = 0;
        bot.respawn = Infinity;
        bot.group.visible = false;
      }
    });
    await page.keyboard.press("Digit3");
    await page.waitForFunction(() => window.__game.drawTime <= 0);
    const captures = [];
    for (const location of [
      { name: "sun", x: -10, y: -4.5, z: 55 },
      { name: "underpass", x: -26.2763, y: -9.2456, z: 4.06388 },
    ]) {
      const position = await page.evaluate(async (location) => {
        const path = "/src/physics.ts";
        const { movement } = (await import(path)) as typeof import("../src/physics");
        const g = window.__game;
        const floor = g.world.collision.support(
          location.x,
          location.z,
          location.y + 0.2,
          location.y - 0.7,
          movement.hullRadius,
        );
        if (
          !Number.isFinite(floor) ||
          g.world.collision.blocked(
            location.x,
            location.z,
            floor,
            movement.hullRadius,
            movement.standingHeight,
          )
        )
          throw new Error(`Unsupported viewmodel lighting fixture: ${location.name}`);
        g.keys.clear();
        g.position.set(location.x, floor, location.z);
        g.eye = movement.standingEye;
        g.velocity.x = g.velocity.z = g.vertical = 0;
        g.grounded = true;
        g.yaw = Math.PI / 2;
        g.pitch = -0.3;
        g.updateAimCamera(1);
        return { x: g.position.x, y: g.position.y, z: g.position.z };
      }, location);
      await page.waitForTimeout(350);
      const result = await page.evaluate(async () => {
        const path = "/tests/mirage-viewmodel-lighting-fixture.ts";
        return (
          (await import(path)) as typeof import("./mirage-viewmodel-lighting-fixture")
        ).measureNativeViewmodel();
      });
      captures.push({ name: location.name, position, ...result });
      await page.screenshot({
        path: `artifacts/mirage-viewmodel-${compressed ? "" : "fallback-"}${location.name}.png`,
      });
      expect(result.visiblePixels).toBeGreaterThan(100);
      expect(result.nativeProbeCount).toBe(58);
      expect(result.nativeReflectionCount).toBe(compressed ? 58 : 0);
      expect(result.glError).toBe(0);
    }
    await writeFile(
      `artifacts/mirage-viewmodel-lighting${compressed ? "" : "-fallback"}.json`,
      JSON.stringify(captures, null, 2),
    );
    expect(captures[1].meanLuminance).toBeLessThan(captures[0].meanLuminance);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
