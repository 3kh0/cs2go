import { expect, test } from "@playwright/test";
import type * as T from "three";
import type { Game } from "../src/game";
import type { Soldier } from "../src/soldier";
declare global {
  interface Window {
    __game: Game;
  }
}

for (const agent of ["agent-4751-ct", "agent-4772-ct"])
  test(`buy preview keeps weapon, helmet and toes inside the stage for ${agent}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors: string[] = [],
      failed: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("response", (response) => {
      if (response.status() >= 400) failed.push(response.url());
    });
    await page.addInitScript(
      (agent) =>
        localStorage.setItem("cs2go-agents", JSON.stringify({ ct: agent, t: "default-t" })),
      agent,
    );
    await page.goto("/");
    await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
    await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-agent", agent, {
      timeout: 45_000,
    });
    await page.evaluate(async () => {
      const path = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .reverse()
        .find((url) => new URL(url).pathname === "/src/skins.ts")!;
      const { setSkin } = (await import(path)) as typeof import("../src/skins");
      await setSkin(3, { id: "9_838", wear: 0.02, seed: 1 });
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
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1280, height: 1100 },
    ]) {
      await page.setViewportSize(viewport);
      for (const weapon of [3, 9, 2]) {
        await page.locator(`#loadout [data-weapon="${weapon}"]`).hover();
        await expect(page.locator("#buy-preview-stage")).toHaveAttribute(
          "data-item",
          String(weapon),
        );
        await page.waitForLoadState("networkidle");
        const extent = await page.evaluate(() => {
          const preview = window.__game.buyPreview as unknown as {
            soldier: Soldier;
            item: T.Group;
            camera: T.PerspectiveCamera;
          };
          let x = 0,
            y = 0,
            z = 0,
            vertices = 0;
          const point = window.__game.position.clone();
          for (const root of [preview.soldier.group, preview.item]) {
            root.updateWorldMatrix(true, true);
            root.traverseVisible((object) => {
              const mesh = object as T.Mesh;
              if (!mesh.isMesh) return;
              const count = mesh.geometry.getAttribute("position").count;
              for (let i = 0; i < count; i++) {
                mesh
                  .getVertexPosition(i, point)
                  .applyMatrix4(mesh.matrixWorld)
                  .project(preview.camera);
                x = Math.max(x, Math.abs(point.x));
                y = Math.max(y, Math.abs(point.y));
                z = Math.max(z, Math.abs(point.z));
                vertices++;
              }
            });
          }
          return { x, y, z, vertices };
        });
        expect(extent.vertices).toBeGreaterThan(1000);
        expect(extent.x, `${agent}/${weapon} horizontal clipping`).toBeLessThan(0.98);
        expect(extent.y, `${agent}/${weapon} helmet or toe clipping`).toBeLessThan(0.98);
        expect(extent.z).toBeLessThan(1);
        if (weapon === 3)
          await page.screenshot({ path: `artifacts/buy-framing-${agent}-${viewport.width}.png` });
      }
    }
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
