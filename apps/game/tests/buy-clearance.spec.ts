import { expect, test } from "@playwright/test";
import type * as T from "three";
import type { Game } from "../src/game";
import type { Soldier } from "../src/soldier";

declare global {
  interface Window {
    __game: Game;
  }
}

test("the diver holds M4A4 clear of chest equipment with both hands on the same grips", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem("cs2go-agents", JSON.stringify({ ct: "agent-4772-ct", t: "default-t" })),
  );
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-agent", "agent-4772-ct", {
    timeout: 45_000,
  });
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    window.__game.health = 1e6;
    window.__game.freezeTime = 1000;
  });
  await page.keyboard.press("b");
  const inventory = await page.evaluate(() => window.__game.inventory());
  await page.locator('#loadout [data-weapon="9"]').hover();
  await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-item", "9");
  const result = await page.evaluate(async () => {
    const g = window.__game;
    const preview = g.buyPreview as unknown as { soldier: Soldier; item: T.Group };
    const s = preview.soldier,
      hands = [s.rightHand, s.leftHand];
    const inverse = s.group.matrixWorld.clone().invert(),
      point = g.position.clone();
    const after = hands.map((h) => h.getWorldPosition(point.clone()));
    const rotations = hands.map((h) => h.getWorldQuaternion(h.quaternion.clone()).normalize());
    const bones: { bone: T.Bone; position: T.Vector3; rotation: T.Quaternion }[] = [];
    s.model.traverse((object) => {
      if ((object as T.Bone).isBone)
        bones.push({
          bone: object as T.Bone,
          position: object.position.clone(),
          rotation: object.quaternion.clone(),
        });
    });
    const path = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .reverse()
      .find((url) => new URL(url).pathname === "/src/buy-poses.ts")!;
    const { applyBuyPose } = (await import(path)) as typeof import("../src/buy-poses");
    applyBuyPose(s, "m4a4");
    const moves = hands.map((h, i) => after[i].clone().sub(h.getWorldPosition(point.clone())));
    const wristError = Math.max(
      ...hands.map((h, i) => h.getWorldQuaternion(h.quaternion.clone()).angleTo(rotations[i])),
    );
    bones.forEach(({ bone, position, rotation }) => {
      bone.position.copy(position);
      bone.quaternion.copy(rotation);
    });
    s.group.updateMatrixWorld(true);
    const localMove = moves[0]
      .clone()
      .transformDirection(inverse)
      .multiplyScalar(moves[0].length());
    // Compare posed torso/gear vertices with the gun in actor space. Restrict
    // skin weights to the torso so hands touching the gun are not penetration.
    const front = new Map<string, number>();
    s.model.traverse((object) => {
      const mesh = object as T.SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const weights = mesh.geometry.getAttribute("skinWeight"),
        indices = mesh.geometry.getAttribute("skinIndex");
      for (let i = 0; i < weights.count; i += 2) {
        let torso = 0;
        for (let j = 0; j < 4; j++)
          if (/spine|pelvis/.test(mesh.skeleton.bones[indices.getComponent(i, j)].name))
            torso += weights.getComponent(i, j);
        if (torso < 0.5) continue;
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        if (Math.abs(point.x) > 0.18 || point.y < 0.8 || point.y > 1.5) continue;
        const key = `${Math.round(point.x / 0.04)},${Math.round(point.y / 0.04)}`;
        front.set(key, Math.max(front.get(key) ?? -Infinity, point.z));
      }
    });
    let contacts = 0,
      penetration = 0,
      originalPenetration = 0;
    preview.item.traverse((object) => {
      const mesh = object as T.Mesh;
      if (!mesh.isMesh) return;
      for (let i = 0; i < mesh.geometry.getAttribute("position").count; i++) {
        mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);
        const surface = front.get(`${Math.round(point.x / 0.04)},${Math.round(point.y / 0.04)}`);
        if (surface === undefined) continue;
        contacts++;
        penetration = Math.max(penetration, surface - point.z);
        originalPenetration = Math.max(originalPenetration, surface - point.z + localMove.z);
      }
    });
    return {
      contacts,
      penetration,
      originalPenetration,
      wristError,
      gripError: moves[0].distanceTo(moves[1]),
    };
  });
  expect(result.contacts).toBeGreaterThan(100);
  expect(result.originalPenetration).toBeGreaterThan(0.08);
  expect(result.penetration).toBeLessThan(0.005);
  expect(result.gripError).toBeLessThan(0.001);
  expect(result.wristError).toBeLessThan(0.0001);
  expect(await page.evaluate(() => window.__game.inventory())).toEqual(inventory);
  await page.screenshot({ path: "artifacts/buy-diver-clearance.png" });
  expect(errors).toEqual([]);
});
