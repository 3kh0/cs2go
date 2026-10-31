import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

test("Dust II ramps retain ground friction, stop, and allow jumping", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as unknown as { __game: Game }).__game?.assetsReady);
  const results = await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game;
    g.start("practice");
    g.locked = false;
    g.useWorld();
    g.updateBots = () => {};
    g.moveBots = () => {};
    const collision = g.world.collision!;
    // Native navigation points on Mid, CT ramp and the short ramp.
    return [
      { name: "Mid", x: -9.2075, z: -23.5712, y: -1.02, dx: 0, dz: -1 },
      { name: "CT ramp", x: 18.0594, z: -55.0418, y: -1.778, dx: -1, dz: 0 },
      { name: "Short ramp", x: 7.58984, z: -44.9199, y: 2.26, dx: 0, dz: 1 },
    ].map(({ name, x, z, y, dx, dz }) => {
      const floor = collision.floor(x, z, y + 0.4, y - 0.4);
      g.position.set(x, floor, z);
      g.velocity.x = dx * 4;
      g.velocity.z = dz * 4;
      g.vertical = 0;
      g.grounded = true;
      g.dead = 0;
      g.keys.clear();
      g.jumpQueued = false;
      let airborne = 0;
      for (let tick = 0; tick < 128; tick++) {
        g.simulate(1 / 128);
        if (!g.grounded) airborne++;
      }
      const stop = g.position.clone();
      const speed = Math.hypot(g.velocity.x, g.velocity.z);
      for (let tick = 0; tick < 256; tick++) g.simulate(1 / 128);
      const drift = g.position.distanceTo(stop);
      const supported = g.grounded;
      g.jumpQueued = true;
      g.simulate(1 / 128);
      return {
        name,
        floor,
        airborne,
        speed,
        distance: Math.hypot(stop.x - x, stop.z - z),
        descent: floor - stop.y,
        drift,
        supported,
        jumpRise: g.position.y - stop.y,
        jumpGrounded: g.grounded,
      };
    });
  });
  for (const result of results) {
    expect(Number.isFinite(result.floor), result.name).toBe(true);
    expect(result.descent, result.name).toBeGreaterThan(0.05);
    expect(result.airborne, result.name).toBe(0);
    expect(result.distance, result.name).toBeLessThan(0.8);
    expect(result.speed, result.name).toBe(0);
    expect(result.drift, result.name).toBeLessThan(1e-8);
    expect(result.supported, result.name).toBe(true);
    expect(result.jumpRise, result.name).toBeGreaterThan(0.05);
    expect(result.jumpGrounded, result.name).toBe(false);
  }
});

test("Shift-jumping onto Xbox's native side lip lands and holds without crouching", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as unknown as { __game: Game }).__game?.assetsReady);
  const results = await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game;
    g.start("practice");
    g.locked = false;
    g.useWorld();
    g.updateBots = () => {};
    g.moveBots = () => {};
    g.equip(4);
    const c = g.world.collision!;
    return [-33.8, -34, -34.2].map((z) => {
      g.position.set(-7.8, c.support(-7.8, z, -2, -4), z);
      const startY = g.position.y;
      g.velocity.x = 0;
      g.velocity.z = -3.302;
      g.vertical = 0;
      g.grounded = true;
      g.eye = 1.65;
      g.dead = 0;
      g.yaw = 0;
      g.keys.clear();
      g.keys.add("KeyW");
      g.keys.add("ShiftLeft");
      g.jumpQueued = true;
      let apex = -Infinity;
      for (let i = 0; i < 128; i++) {
        g.simulate(1 / 128);
        apex = Math.max(apex, g.position.y);
      }
      g.keys.clear();
      const landed = g.position.clone();
      for (let i = 0; i < 256; i++) g.simulate(1 / 128);
      const held = g.position.distanceTo(landed);
      const supported = g.grounded;
      const eye = g.eye;
      // The center is beyond the lip; actual support is under the front of the feet.
      const centerFloor = c.floor(g.position.x, g.position.z, -1, -4);
      g.keys.add("KeyS");
      for (let i = 0; i < 32; i++) g.simulate(1 / 128);
      return {
        z,
        y: landed.y,
        held,
        supported,
        eye,
        centerFloor,
        apex: apex - startY,
        walkedOff: g.position.y < landed.y - 0.2,
      };
    });
  });
  for (const result of results) {
    expect(result.y, `approach ${result.z}`).toBeCloseTo(-1.75285, 4);
    expect(result.held).toBeLessThan(1e-8);
    expect(result.supported).toBe(true);
    expect(result.eye).toBeCloseTo(1.65);
    expect(result.centerFloor).toBeLessThan(-3);
    expect(result.apex).toBeCloseTo(1.44774, 4);
    expect(result.walkedOff).toBe(true);
  }
});

test("airborne crouching raises the feet without changing the head arc or adding jump momentum", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as unknown as { __game: Game }).__game?.assetsReady);
  const result = await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game;
    g.start("practice");
    g.locked = false;
    g.updateBots = () => {};
    g.moveBots = () => {};
    const run = (duck: boolean) => {
      g.position.set(100, 10, 100);
      g.velocity.x = g.velocity.z = 0;
      g.vertical = 3;
      g.grounded = false;
      g.eye = 1.65;
      g.duckCooldown = 0;
      g.duckHeld = g.duckAccepted = false;
      g.keys.clear();
      const head: number[] = [];
      let tuckedFeet = 0;
      for (let i = 0; i < 64; i++) {
        if (duck && i === 0) g.keys.add("KeyC");
        if (i === 32) {
          tuckedFeet = g.position.y;
          g.keys.clear();
        }
        g.simulate(1 / 128);
        head.push(g.position.y + g.eye);
      }
      return { head, tuckedFeet, vertical: g.vertical };
    };
    return { standing: run(false), ducked: run(true) };
  });
  expect(result.ducked.tuckedFeet - result.standing.tuckedFeet).toBeGreaterThan(0.5);
  expect(result.ducked.vertical).toBe(result.standing.vertical);
  result.ducked.head.forEach((height, i) => expect(height).toBeCloseTo(result.standing.head[i], 8));
});

test("real Shift + Space input reaches Xbox's side ledge", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page.bringToFront();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 60000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => (window as unknown as { __game: Game }).__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => (window as unknown as { __game: Game }).__game.locked);
  await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game;
    g.useWorld();
    g.equip(4);
    g.settings.autoBunnyhop = false;
    g.position.set(-7.8, g.world.collision!.support(-7.8, -33.4, -2, -4), -33.4);
    g.velocity.x = g.velocity.z = g.vertical = 0;
    g.grounded = true;
    g.yaw = g.pitch = 0;
  });
  await page.keyboard.down("ShiftLeft");
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => (window as unknown as { __game: Game }).__game.position.z < -33.95,
  );
  await page.keyboard.down("Space");
  await page.waitForFunction(() => {
    const g = (window as unknown as { __game: Game }).__game;
    return g.grounded && g.position.y > -1.8;
  });
  await page.keyboard.up("Space");
  await page.keyboard.up("KeyW");
  await page.keyboard.up("ShiftLeft");
  const landing = await page.evaluate(() =>
    (window as unknown as { __game: Game }).__game.position.toArray(),
  );
  await page.waitForTimeout(400);
  const held = await page.evaluate(() => {
    const g = (window as unknown as { __game: Game }).__game;
    return { position: g.position.toArray(), grounded: g.grounded, crouching: g.crouching };
  });
  expect(landing[1]).toBeCloseTo(-1.75285, 4);
  expect(held.position).toEqual(landing);
  expect(held.grounded).toBe(true);
  expect(held.crouching).toBe(false);
  await page.screenshot({ path: "artifacts/xbox-keyboard-landing.png" });
});
