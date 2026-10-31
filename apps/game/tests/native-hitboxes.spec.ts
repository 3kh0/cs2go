import { test, expect } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("native Ground Rebel capsules follow standing and crouched head bones", async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.waitForFunction(() => !!window.__game);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game?.locked);
  const result = await page.evaluate(async () => {
    const hitboxModule = "/src/soldier-hitboxes.ts";
    const soldierModule = "/src/soldier.ts";
    const dataModule = "/src/data/agent-hitboxes.json";
    const threeModule = "/node_modules/three/build/three.module.js";
    const { nativeSoldierHit } = (await import(
      hitboxModule
    )) as typeof import("../src/soldier-hitboxes");
    const { animateSoldier } = (await import(soldierModule)) as typeof import("../src/soldier");
    const { default: data } = (await import(dataModule)) as {
      default: typeof import("../src/data/agent-hitboxes.json");
    };
    const T = (await import(threeModule)) as typeof import("three");
    const g = window.__game;
    g.freezeTime = 0;
    const bot = g.bots.find((b) => b.team === "t")!;
    g.bots.forEach((b) => {
      if (b !== bot) {
        b.health = 0;
        b.respawn = Infinity;
        b.group.visible = false;
      }
    });
    bot.group.position.set(0, 0, 10);
    bot.group.rotation.y = 0;
    bot.speed = 0;
    bot.rig.drawTime = bot.rig.shotTime = 0;
    const traceHead = () => {
      bot.group.updateMatrixWorld(true);
      const target = new T.Vector3(1.25, 1, 0).applyMatrix4(bot.rig.head.matrixWorld);
      const origin = target.clone().add(new T.Vector3(0, 0, 4));
      const ray = new T.Ray(origin, target.clone().sub(origin).normalize());
      const hit = nativeSoldierHit(bot.rig, ray);
      return { group: hit?.group, distance: hit?.point.distanceTo(target), y: target.y };
    };
    animateSoldier(bot.rig, 0, 0.016, true);
    const standing = traceHead();
    bot.rig.crouch = 1;
    for (let i = 0; i < 32; i++) animateSoldier(bot.rig, 0, 1 / 128, true);
    const crouched = traceHead();
    bot.rig.crouch = 0;
    animateSoldier(bot.rig, 0, 0.016, true);
    for (const box of data.hitboxes) {
      const name = box.bone.replace(
        /_([lr])(?=_|$)/g,
        (_, side: string) => `_${side.toUpperCase()}`,
      );
      const bone = bot.rig.model.getObjectByName(name)!;
      const start = new T.Vector3(...box.min),
        end = new T.Vector3(...box.max);
      const shape = new T.Mesh(
        new T.CapsuleGeometry(box.radius, start.distanceTo(end), 4, 8),
        new T.MeshBasicMaterial({
          color: box.group === 1 ? 0xff3333 : 0x00ffbb,
          wireframe: true,
          depthTest: false,
        }),
      );
      shape.position.copy(start).add(end).multiplyScalar(0.5);
      shape.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        end.clone().sub(start).normalize(),
      );
      shape.renderOrder = 100;
      bone.add(shape);
    }
    g.position.set(0, 0, 13.5);
    g.yaw = 0;
    g.pitch = -0.13;
    g.simulate = () => {};
    g.animateBots = () => {};
    g.updateAimCamera();
    g.renderer.render(g.scene, g.camera);
    return { standing, crouched };
  });
  expect(result.standing.group).toBe(1);
  expect(result.crouched.group).toBe(1);
  expect(result.standing.distance).toBeLessThan(0.2);
  expect(result.crouched.distance).toBeLessThan(0.2);
  expect(result.crouched.y).toBeLessThan(result.standing.y - 0.3);
  await page.screenshot({ path: "artifacts/native-hitboxes.png" });
  expect(errors).toEqual([]);
});
