import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

test("Xbox wall stops forward travel while allowing diagonal sliding and retreat", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as unknown as { __game: Game }).__game?.assetsReady);
  const result = await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game;
    g.useWorld(true);
    const c = g.world.collision!;
    const p = g.position.clone().set(-7.8, c.support(-7.8, -33.4, -2, -4), -33.4);
    for (let i = 0; i < 128; i++) c.moveHorizontal(p, { x: 0, z: -4 }, 1 / 128);
    const contact = p.clone();
    for (let i = 0; i < 16; i++) c.moveHorizontal(p, { x: 4, z: -4 }, 1 / 128);
    const slide = p.clone();
    const blocked = c.blocked(p.x, p.z, p.y);
    for (let i = 0; i < 16; i++) c.moveHorizontal(p, { x: 0, z: 4 }, 1 / 128);
    return { contact: contact.toArray(), slide: slide.toArray(), retreat: p.toArray(), blocked };
  });
  expect(result.contact[2]).toBeGreaterThan(-34.4);
  expect(result.contact[2]).toBeLessThan(-34.1);
  // Sweeps retain a 10 micrometer contact margin on each movement tick.
  // Bound the accumulated tangential loss to a quarter millimeter over 0.5 m.
  expect(Math.abs(result.slide[0] - result.contact[0] - 0.5)).toBeLessThan(0.00025);
  expect(result.slide[2]).toBeCloseTo(result.contact[2], 5);
  expect(result.blocked).toBe(false);
  expect(result.retreat[2] - result.slide[2]).toBeCloseTo(0.5, 5);
});
