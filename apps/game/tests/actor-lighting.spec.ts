import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("actor probe shaders render independent light and compensate viewmodel rotation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/actor-lighting-fixture.ts";
    const { renderActorProbes } = await import(path);
    return renderActorProbes();
  });
  expect(result.front[0]).toBeGreaterThan(200);
  expect(result.front[2]).toBeLessThan(5);
  expect(result.turned[2]).toBeGreaterThan(200);
  expect(result.turned[0]).toBeLessThan(5);
  expect(result.disabled.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.independent).toBe(true);
  expect(errors).toEqual([]);
});

test("native map and every cached viewmodel compile without shader errors", async ({ page }) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (!/^(http:\/\/127\.0\.0\.1:5173|blob:|data:)/.test(request.url()))
      external.push(request.url());
  });
  await page.goto("/");
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.waitForFunction(() => {
    const reflections = window.__game.actorReflections as unknown as {
      cache: Map<number, unknown>;
    };
    return reflections.cache.size > 0;
  });
  const cacheSize = await page.evaluate(
    () => (window.__game.actorReflections as unknown as { cache: Map<number, unknown> }).cache.size,
  );
  expect(cacheSize).toBeLessThanOrEqual(8);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
