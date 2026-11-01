import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
import type * as T from "three";
declare global {
  interface Window {
    __game: Game;
  }
}

test("full-page native settings and saved showcase weapons share equipped legacy and HD skins", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const hdRequests: string[] = [];
  page.on("request", (request) => {
    if (/-hd\.glb(?:\.gz)?$/.test(new URL(request.url()).pathname)) hdRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  expect(hdRequests).toEqual([]);
  await page.locator("#settings-button").click();
  const bounds = (await page.locator("#settings .settings").boundingBox())!;
  expect(bounds.x).toBe(0);
  expect(bounds.width).toBe(1440);
  expect(bounds.y).toBeLessThan(70);
  expect(bounds.y + bounds.height).toBe(900);
  await page.screenshot({ path: "artifacts/settings-full-page.png" });
  await page.getByRole("tab", { name: "Audio", exact: true }).click();
  await page.screenshot({ path: "artifacts/settings-full-page-audio.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings")).toBeHidden();
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-showcase-team").selectOption("t");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "0");
  await page.locator("#home-showcase-weapon").selectOption("7");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "7");
  await page.locator("#home-scenery-button").click();
  await page.screenshot({ path: "artifacts/home-showcase-glock.png" });
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-showcase-weapon").selectOption("0");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "0");
  await page.locator("#home-scenery-button").click();
  for (const id of ["7_44", "7_1466", ""]) {
    await page.locator("#skins-button").click();
    await page.locator("#skin-search").fill("");
    await page.locator(`[data-skin="${id}"]`).click();
    if (id) {
      await page.locator("#skin-float").fill("0.012345");
      await page.locator("#skin-seed").fill("661");
    }
    await page.locator("#apply-skin").click();
    await expect(page.locator("#skin-status")).toContainText("Applied", { timeout: 30_000 });
    await page.locator("#close-skins").click();
    const proof = await page.evaluate(async (id) => {
      const scene = window.__game.homeScene as unknown as {
        previews: Map<string, { weapon: T.Group }>;
      };
      const root = scene.previews.get("t")!.weapon;
      const body =
        (
          (await (await fetch("/skins/catalog.json")).json()) as { id: string; body: string }[]
        ).find((skin) => skin.id === id)?.body ?? "legacy";
      const materialProof: string[] = [];
      let painted = 0,
        visibleMeshes = 0;
      root.traverseVisible((object) => {
        const mesh = object as T.Mesh;
        if (!mesh.isMesh) return;
        visibleMeshes++;
        for (const material of (Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material]) as T.MeshStandardMaterial[]) {
          materialProof.push(
            `${material.name}:${material.map?.type}:${(material.map as T.DataTexture)?.isDataTexture}`,
          );
          if ((material.map as T.DataTexture)?.isDataTexture) painted++;
        }
      });
      return {
        materialProof,
        painted,
        visibleMeshes,
        body,
        hdVisible: root.getObjectByName("skin-hd")?.visible ?? false,
        legacyVisible: root.getObjectByName("skin-legacy")!.visible,
      };
    }, id);
    if (id === "7_44") expect(hdRequests).toEqual([]);
    if (id === "7_1466") expect(hdRequests).toHaveLength(1);
    expect(proof.visibleMeshes).toBeGreaterThan(0);
    expect(proof.hdVisible).toBe(proof.body === "hd");
    expect(proof.legacyVisible).toBe(proof.body !== "hd");
    if (id) expect(proof.painted, JSON.stringify({ id, proof })).toBeGreaterThan(0);
    else expect(proof.painted).toBe(0);
    if (id) await page.screenshot({ path: `artifacts/home-skin-${id}.png` });
    if (id === "7_1466") {
      await page.reload();
      await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
      await page.getByRole("button", { name: "Show Terrorist", exact: true }).click();
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const scene = window.__game.homeScene as unknown as {
                previews: Map<string, { weapon: T.Group }>;
              };
              const hd = scene.previews.get("t")?.weapon.getObjectByName("skin-hd");
              let painted = false;
              hd?.traverse((object) => {
                if ((object as T.Mesh).isMesh)
                  for (const material of [
                    (object as T.Mesh).material,
                  ].flat() as T.MeshStandardMaterial[])
                    if ((material.map as T.DataTexture)?.isDataTexture) painted = true;
              });
              return !!hd?.visible && painted;
            }),
          { timeout: 30_000 },
        )
        .toBe(true);
      await page.locator("#play").evaluate((button) => {
        button.onclick = () => window.__game.start("practice");
      });
      await page.locator("#home-play").click();
      await page.locator("#play").click();
      await page.waitForFunction(() => window.__game.locked);
      await page.evaluate(() => {
        window.__game.invulnerable = 100;
        window.__game.buy(0);
      });
      await expect
        .poll(() => page.evaluate(() => window.__game.gun.getObjectByName("skin-hd")?.visible), {
          timeout: 30_000,
        })
        .toBe(true);
      await page.waitForFunction(() => window.__game.drawTime === 0);
      await page.screenshot({ path: "artifacts/hd-skin-restored-in-game.png" });
      await page.evaluate(() => window.__game.menu());
    }
  }
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-showcase-weapon").selectOption("3");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "3");
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.getByRole("button", { name: "Show Terrorist", exact: true }).click();
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "3");
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator("#settings-button").click();
  await page.getByRole("tab", { name: "Controls", exact: true }).click();
  await page.screenshot({ path: "artifacts/settings-full-page-controls-720.png" });
  await expect(page.locator("#reset-bindings")).toBeVisible();
  expect(errors).toEqual([]);
});
