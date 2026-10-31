import { expect, test } from "@playwright/test";

test("magazine seating survives a quick switch without bypassing reload or deploy time", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const samples = await page.evaluate(async () => {
    const { weapons } = await import("../src/physics");
    const path = "/src/weapon-motion.ts";
    const { nativeMagazineInsert } = (await import(path)) as typeof import("../src/weapon-motion");
    const g = window.__game;
    g.freezeTime = 0;
    g.updateBots = () => {};
    g.moveBots = () => {};
    g.bots.forEach((b) => {
      b.health = 0;
      b.respawn = Infinity;
    });
    const results = [];
    for (const id of [0, 2, 3, 8, 18]) {
      g.buy(id);
      g.cooldown = g.drawTime = 0;
      g.weaponCooldowns.fill(0);
      g.reloadLockouts.fill(0);
      g.ammo = id === 8 ? 0 : 1;
      g.reserve = weapons[id].reserve;
      const initial = g.ammo,
        reserve = g.reserve;
      g.beginReload();
      const duration = g.reload;
      const marker = nativeMagazineInsert(id, g.emptyReload);
      const before = Math.max(0, Math.ceil(duration * marker * 128) - 1);
      for (let t = 0; t < before; t++) g.simulate(1 / 128);
      const untouched = g.ammo === initial && g.reserve === reserve;
      g.equip(g.knife);
      g.equip(id);
      const earlyCancelled = g.ammo === initial && g.reserve === reserve && !g.reload;
      g.cooldown = g.drawTime = 0;
      g.beginReload();
      const ticks = Math.ceil(duration * marker * 128);
      for (let t = 0; t < ticks; t++) g.simulate(1 / 128);
      const committed = { ammo: g.ammo, reserve: g.reserve, tail: g.reload };
      g.equip(g.knife);
      g.equip(id);
      const drawn = { ammo: g.ammo, reserve: g.reserve, delay: g.cooldown, reload: g.reload };
      const wait = Math.ceil(g.cooldown * 128);
      for (let t = 0; t < wait - 1; t++) g.simulate(1 / 128);
      g.fire();
      const blocked = g.ammo === weapons[id].mag;
      g.simulate(1 / 128);
      g.fire();
      results.push({
        id,
        marker,
        duration,
        untouched,
        earlyCancelled,
        committed,
        drawn,
        blocked,
        fired: g.ammo === weapons[id].mag - 1,
        readyTime: (ticks + wait) / 128,
        mag: weapons[id].mag,
        reserve,
      });
    }
    return results;
  });
  for (const s of samples) {
    expect(s.marker).toBeGreaterThan(0);
    expect(s.marker, JSON.stringify(s)).toBeLessThan(1);
    expect(s.untouched && s.earlyCancelled).toBe(true);
    expect(s.committed.ammo).toBe(s.mag);
    expect(s.committed.reserve).toBe(s.reserve - s.mag);
    expect(s.committed.tail).toBeGreaterThan(0);
    expect(s.drawn.ammo).toBe(s.mag);
    expect(s.drawn.reserve).toBe(s.reserve - s.mag);
    expect(s.drawn.reload).toBe(0);
    expect(s.drawn.delay).toBeGreaterThanOrEqual(s.committed.tail);
    expect(s.readyTime).toBeGreaterThanOrEqual(s.duration);
    expect(s.blocked && s.fired).toBe(true);
  }
});
