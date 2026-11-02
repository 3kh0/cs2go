import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}
test("AK headshot damage on the native A-site ramp line", async ({ page }) => {
  test.setTimeout(180000);
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.waitForLoadState("networkidle");
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.roundPause = 10000;
    g.health = 1e6;
    g.updateBots = () => {};
    g.moveBots = () => {};
    g.bots.forEach((bot) => {
      bot.group.position.x += 100;
    });
    g.buy(0);
    g.reload = g.drawTime = g.cooldown = 0;
    const victim = g.bots.find((bot) => bot.team !== g.team)!;
    const victimIndex = g.bots.indexOf(victim);
    const hits: { damage: number; head: boolean | undefined }[] = [];
    const damage = g.damageActor.bind(g);
    g.damageActor = (actor, amount, data, ...rest) => {
      hits.push({ damage: amount, head: data.head });
      damage(actor, amount, data, ...rest);
    };
    const sounds: string[] = [];
    g.sound = (cue) => {
      sounds.push(cue);
    };
    const nav = g.dust!.navigation;
    const rows = [];
    for (const source of [1902, 1930, 1952])
      for (const target of [1896, 1905, 1938]) {
        const from = nav.areas.find((area) => area.id === source)!.center;
        const to = nav.areas.find((area) => area.id === target)!.center;
        g.position.fromArray(from);
        g.velocity.x = g.velocity.z = 0;
        g.vertical = 0;
        g.eye = 1.65;
        victim.health = 100;
        victim.armor = 100;
        victim.helmet = true;
        victim.group.position.fromArray(to);
        victim.group.updateMatrixWorld(true);
        const head = victim.rig.head.getWorldPosition(g.position.clone());
        head.y += 0.04;
        const eye = g.position.clone();
        eye.y += g.eye;
        const direction = head.clone().sub(eye).normalize();
        g.yaw = Math.atan2(-direction.x, -direction.z);
        g.pitch = Math.asin(direction.y);
        g.aimPunch.pitch = g.aimPunch.yaw = 0;
        g.weaponRecoil[0].index = 0;
        g.ammo = 30;
        g.cooldown = g.drawTime = g.shotTime = 0;
        g.ray.set(eye, direction);
        g.ray.far = eye.distanceTo(head) + 0.5;
        const cover = g.dust!.collision.intersections(g.ray.ray, g.ray.far).map((impact) => ({
          distance: impact.distance,
          material: impact.object.userData.bulletMaterial,
          name: impact.object.name,
        }));
        hits.length = sounds.length = 0;
        const random = Math.random;
        Math.random = () => 0;
        try {
          g.fire();
        } finally {
          Math.random = random;
        }
        rows.push({
          source,
          target,
          distance: eye.distanceTo(head),
          cover,
          hits: [...hits],
          sounds: [...sounds],
          health: victim.health,
          victimIndex,
        });
      }
    return rows;
  });
  console.log("A-SITE DAMAGE AUDIT", JSON.stringify(result));
  const clear = result.filter((row) => row.cover.length === 0 && row.hits.some((hit) => hit.head));
  expect(clear.length).toBeGreaterThan(0);
  for (const row of clear) expect(row.health, JSON.stringify(row)).toBe(0);
  const utility = await page.evaluate(() => {
    const g = window.__game,
      victim = g.bots.find((bot) => bot.team !== g.team)!;
    victim.group.position.copy(g.position).x += 2;
    g.visible = () => true;
    return ["he", "decoy", "molotov", "incendiary"].map((kind) => {
      victim.health = 100;
      victim.armor = kind === "he" || kind === "decoy" ? 0 : 100;
      const position = victim.group.position.clone();
      position.y += 0.8;
      g.utility.areaDamage(
        {
          kind,
          owner: "player",
          team: g.team,
          position,
          cells: [victim.group.position.clone()],
        } as never,
        2.9,
        1.5,
      );
      return { kind, health: victim.health, armor: victim.armor };
    });
  });
  expect(utility).toEqual([
    { kind: "he", health: 98, armor: 0 },
    { kind: "decoy", health: 98, armor: 0 },
    { kind: "molotov", health: 98, armor: 100 },
    { kind: "incendiary", health: 98, armor: 100 },
  ]);
});
