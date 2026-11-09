import { expect, test } from "@playwright/test";
import type { Soldier } from "../src/soldier";

test("native-scale CT and T bodies share authored eight-direction locomotion and clip clocks", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  const setup = await page.evaluate(async () => {
    const path = "/src/soldier.ts",
      three = "/tests/three-fixture.ts";
    const { createSoldier, setSoldierWeapon, animateSoldier } = (await import(
      path
    )) as typeof import("../src/soldier");
    const T = (await import(three)) as typeof import("three");
    const game = window.__game,
      home = game.homeScene!;
    const original = home.previewRoots[0].parent!;
    const position = original.position.clone();
    const yaw = original.rotation.y;
    const side = new T.Vector3(1, 0, 0).applyQuaternion(home.backgroundCamera.quaternion);
    // Freeze the menu actor clock while sampling real runtime rigs. The native
    // scenery, imported body meshes, animations and weapon grips remain intact.
    for (const root of home.previewRoots) root.parent!.visible = false;
    const soldiers = (["ct", "t"] as const).map((team, i) => {
      const soldier = createSoldier(0, team, undefined, false);
      setSoldierWeapon(soldier, 0);
      soldier.group.position.copy(position).addScaledVector(side, i ? 0.55 : -0.55);
      soldier.group.rotation.y = yaw;
      soldier.group.visible = true;
      soldier.phase = soldier.time = 0;
      soldier.drawTime = 0;
      home.graphicsRoot.add(soldier.group);
      animateSoldier(soldier, 0, 0, true);
      return soldier;
    });
    home.render = (renderer) => renderer.render(home.graphicsRoot, home.backgroundCamera);
    Object.assign(window, { nativeLocomotionFixture: soldiers });
    return soldiers.map((soldier) => ({
      scale: soldier.model.scale.toArray(),
      origin: soldier.model.position.toArray(),
      head: soldier.head.getWorldPosition(new T.Vector3()).sub(soldier.group.position).y,
      diagonals: ["run_ne_rifle", "walk_sw_rifle", "crouch_nw_rifle"].every(
        (name) => !!soldier.actions[name],
      ),
    }));
  });
  expect(setup[0].scale).toEqual([1, 1, 1]);
  expect(setup[1].scale).toEqual([1, 1, 1]);
  expect(setup.map((sample) => sample.origin)).toEqual([
    [0, 0, 0],
    [0, 0, 0],
  ]);
  expect(setup[0].head).toBeCloseTo(setup[1].head, 5);
  expect(setup.every((sample) => sample.diagonals)).toBe(true);
  await page.screenshot({ path: "artifacts/native-locomotion-standing.png" });
  for (const crouch of [false, true]) {
    const poses = await page.evaluate(async (duck) => {
      const path = "/src/soldier.ts";
      const { animateSoldier } = (await import(path)) as typeof import("../src/soldier");
      const soldiers = (window as unknown as { nativeLocomotionFixture: Soldier[] })
        .nativeLocomotionFixture;
      return soldiers.map((soldier, i) => {
        soldier.phase = i ? 0.65 : 0.25;
        soldier.crouch = duck ? 1 : 0;
        soldier.moveX = soldier.moveZ = 1;
        animateSoldier(soldier, Math.hypot(duck ? 67 : 159, duck ? 67 : 159) * 0.0254, 0, true);
        const name = `${duck ? "crouch" : "run"}_ne_rifle`;
        return {
          name,
          weight: soldier.actions[name].getEffectiveWeight(),
          progress: soldier.actions[name].time / soldier.actions[name].getClip().duration,
        };
      });
    }, crouch);
    expect(poses.every((pose) => Math.abs(pose.weight - 1) < 1e-6)).toBe(true);
    expect(poses[0].progress).toBeCloseTo(0.25, 6);
    expect(poses[1].progress).toBeCloseTo(0.65, 6);
    await page.screenshot({
      path: `artifacts/native-locomotion-${crouch ? "crouch" : "diagonal"}.png`,
    });
  }
  expect(errors).toEqual([]);
});
