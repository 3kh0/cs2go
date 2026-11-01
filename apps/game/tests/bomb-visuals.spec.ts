import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}

test("CT defuse tools and connected wires reflect kit ownership and cancel with the action", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  const latePlantMotion = await page.evaluate(() => {
    const plant = window.__game.bombView;
    plant.sample(0.9);
    const before = plant.getObjectByName("vmrig_wpn")!.matrixWorld.elements.slice();
    plant.sample(0.99);
    const after = plant.getObjectByName("vmrig_wpn")!.matrixWorld.elements;
    const delta = after.reduce((sum, value, i) => sum + Math.abs(value - before[i]), 0);
    plant.sample(0);
    return delta;
  });
  // The old full-clip mapping reached the held recovery tail before 90%.
  expect(latePlantMotion).toBeGreaterThan(0.0001);
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.freezeTime = 0;
    g.bots.forEach((bot, i) => bot.group.position.set(200 + i, 500, 200));
    g.velocity.x = g.velocity.z = 0;
    g.pitch = -0.7;
    g.yaw = 0;
    g.bomb!.planted = true;
    g.bomb!.carrier = -1;
    g.bomb!.position.copy(g.position);
    g.bomb!.position.z -= 0.6;
    g.bombMesh.position.copy(g.bomb!.position);
    g.bombMesh.visible = true;
    g.bomb!.timer = 35;
    g.defuseKit = false;
    g.keys.add("KeyE");
    g.updateRound(1 / 128);
  });
  await page.waitForFunction(() => window.__game.defuseView.visible);
  const inspect = () =>
    page.evaluate(() => {
      const g = window.__game;
      const wires = g.defuseView.wires.children as import("three").Mesh<
        import("three").BufferGeometry,
        import("three").MeshStandardMaterial
      >[];
      const ends = wires.map((wire) => {
        const positions = wire.geometry.getAttribute("position");
        const end = [0, 0, 0];
        for (let i = positions.count - 6; i < positions.count; i++) {
          end[0] += positions.getX(i) / 6;
          end[1] += positions.getY(i) / 6;
          end[2] += positions.getZ(i) / 6;
        }
        return end;
      });
      let handMeshes = 0;
      g.defuseView.getObjectByName("plant-view-arms")!.traverse((object) => {
        if ((object as import("three").SkinnedMesh).isSkinnedMesh) handMeshes++;
      });
      return {
        visible: g.defuseView.visible && g.defuseView.wires.visible,
        tester: g.defuseView.getObjectByName("defuse-tester")!.visible,
        colors: wires.map((wire) => wire.material.color.getHex()),
        ends,
        bomb: g.bomb!.position.toArray(),
        handMeshes,
        gun: g.gun.visible,
      };
    });
  const bare = await inspect();
  expect(bare.visible).toBe(true);
  expect(bare.tester).toBe(false);
  expect(bare.colors).toEqual([0xffd329, 0x268dff]);
  expect(bare.handMeshes).toBeGreaterThan(0);
  expect(bare.gun).toBe(false);
  for (let i = 0; i < 2; i++) {
    expect(bare.ends[i][0]).toBeCloseTo(bare.bomb[0] + (i ? 0.035 : -0.035), 4);
    expect(bare.ends[i][1]).toBeCloseTo(bare.bomb[1] + 0.085, 4);
    expect(bare.ends[i][2]).toBeCloseTo(bare.bomb[2], 4);
  }
  await page.screenshot({ path: "artifacts/defuse-no-kit-game.png" });
  await page.evaluate(() => {
    window.__game.defuseKit = true;
    window.__game.bomb!.progress = 0;
  });
  await page.waitForFunction(
    () => window.__game.defuseView.getObjectByName("defuse-tester")!.visible,
  );
  const kit = await inspect();
  expect(kit.colors).toEqual([0x30c96b, 0x268dff]);
  await page.screenshot({ path: "artifacts/defuse-kit-game.png" });
  await page.evaluate(() => {
    const g = window.__game;
    g.keys.delete("KeyE");
    g.updateRound(1 / 128);
  });
  await page.waitForFunction(
    () => !window.__game.defuseView.visible && !window.__game.defuseView.wires.visible,
  );
  await page.evaluate(() => {
    const g = window.__game;
    g.keys.add("KeyE");
    g.updateRound(1 / 128);
  });
  await page.waitForFunction(() => window.__game.defuseView.visible);
  await page.evaluate(() => {
    window.__game.dead = 5;
  });
  await page.waitForFunction(
    () => !window.__game.defuseView.visible && !window.__game.defuseView.wires.visible,
  );
  await page.evaluate(() => {
    const g = window.__game;
    g.dead = 0;
    g.keys.add("KeyE");
    g.updateRound(1 / 128);
  });
  await page.waitForFunction(() => window.__game.defuseView.visible);
  await page.evaluate(() => window.__game.endRound("ct", "Bomb defused"));
  await page.waitForFunction(
    () => !window.__game.defuseView.visible && !window.__game.defuseView.wires.visible,
  );
  expect(errors).toEqual([]);
});
