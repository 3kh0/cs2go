import { expect, test } from "@playwright/test";

test("bulky homepage agents keep their grips and use repaired cloth materials", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-showcase-team").selectOption("ct");
  await page.locator("#home-showcase-agent").selectOption("agent-5305-ct");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-agent", "agent-5305-ct", {
    timeout: 30000,
  });
  await page.locator("#home-background").selectOption("close");
  // Render each grip, including the native home idle and handgun poses.
  await page.locator("#home-scenery-button").click();
  for (const index of [9, 1, 2]) {
    await page.locator("#home-showcase-weapon").selectOption(String(index));
    await expect(page.locator("#home-agent-stage")).toHaveAttribute(
      "data-showcase-weapon",
      String(index),
    );
    await page.waitForTimeout(250);
    const sample = await page.evaluate(() => {
      const home = window.__game.homeScene as any;
      const preview = home.previews.get("ct");
      const s = preview.soldier;
      const source = s.rightHand.position.clone();
      const hand = s.rightHand.getWorldPosition(source);
      const gun = preview.weapon;
      const point = hand.clone();
      const bounds: number[] = [];
      gun.traverseVisible((mesh: any) => {
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingBox();
        bounds.push(
          mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld).distanceToPoint(hand),
        );
      });
      const cloth: { roughness: number; map: boolean }[] = [];
      s.model.traverse((mesh: any) => {
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          if (material?.name === "ctm_fbi_v2_body_variantf")
            cloth.push({ roughness: material.roughness, map: !!material.roughnessMap });
      });
      return {
        distance: Math.min(...bounds),
        finite: gun.matrixWorld.elements.every(Number.isFinite),
        cloth,
        wrist: s.leftHand.getWorldPosition(point).toArray(),
      };
    });
    expect(sample.finite).toBe(true);
    expect(sample.distance).toBeLessThan(0.1);
    expect(sample.cloth.length).toBeGreaterThan(0);
    expect(
      sample.cloth.every(
        (material: { roughness: number; map: boolean }) =>
          material.roughness === 0.85 && !material.map,
      ),
    ).toBe(true);
    await page.screenshot({ path: `artifacts/agent-presentation-fbi-${index}.png` });
  }
  await page.locator("#home-showcase-weapon").selectOption("9");
  // Side view exposes receiver/vest intersections that a front view can hide.
  await page.evaluate(async () => {
    const source = await (await fetch("/src/home-scene.ts")).text();
    const path = source.match(/from "([^"]*three\.js[^"]*)"/)![1];
    const T = await import(/* @vite-ignore */ path);
    const home = window.__game.homeScene as any;
    const position = home.previews.get("ct").soldier.group.position;
    home.cameraPosition.copy(position).add(new T.Vector3(2.8, 1.25, 0));
    home.camera.position.copy(home.cameraPosition);
    home.camera.lookAt(position.clone().add(new T.Vector3(0, 1.1, 0)));
    home.cameraRotation.copy(home.camera.quaternion);
    home.cameraDirection.set(0, 0, 0);
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/agent-presentation-fbi-side.png" });
  expect(errors).toEqual([]);
});
