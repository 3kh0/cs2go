import { expect, test } from "@playwright/test";
import type * as T from "three";
import type { Game } from "../src/game";

test("home agent and weapon receive native Dust II probes and reflections", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.waitForFunction(() => {
    const home = (window as unknown as { __game: Game }).__game.homeScene as unknown as {
      previews: Map<string, { soldier: { model: T.Group } }>;
    };
    let ready = false;
    home.previews.get("ct")?.soldier.model.traverse((object) => {
      if ((object as T.Mesh).isMesh) {
        const material = (object as T.Mesh).material as T.MeshStandardMaterial;
        if (material.isMeshStandardMaterial && material.envMap) ready = true;
      }
    });
    return ready;
  });
  const lighting = await page.evaluate(async () => {
    const g = (window as unknown as { __game: Game }).__game;
    const home = g.homeScene as unknown as {
      previews: Map<string, { soldier: { model: T.Group }; weapon: T.Group }>;
    };
    const preview = home.previews.get("ct")!;
    const samples: { probe: T.IUniform; world: T.IUniform }[] = [];
    for (const root of [preview.soldier.model, preview.weapon]) {
      let material: T.MeshStandardMaterial | undefined;
      root.traverse((object) => {
        if (material || !(object as T.Mesh).isMesh) return;
        const value = (object as T.Mesh).material;
        const candidate = Array.isArray(value) ? value[0]! : value;
        if ((candidate as T.MeshStandardMaterial).isMeshStandardMaterial)
          material = candidate as T.MeshStandardMaterial;
      });
      if (!material) throw new Error("Missing home actor material");
      const original = material.onBeforeCompile.bind(material);
      const key = material.customProgramCacheKey();
      material.onBeforeCompile = function (shader, renderer) {
        original(shader, renderer);
        samples.push({
          probe: shader.uniforms.sourceActorProbeEnabled!,
          world: shader.uniforms.sourceActorWorldEnabled!,
        });
      };
      material.customProgramCacheKey = () => key + ":home-lighting-regression";
      material.needsUpdate = true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      enabled: samples.map((sample) => ({ probe: sample.probe.value, world: sample.world.value })),
      toneMapping: g.renderer.toneMapping,
    };
  });
  expect(lighting.enabled).toHaveLength(2);
  expect(lighting.enabled).toEqual([
    { probe: 1, world: 1 },
    { probe: 1, world: 1 },
  ]);
  expect(lighting.toneMapping).toBe(5); // CustomToneMapping: pinned Dust II curve.
  expect(requests.some((url) => /lighting\/reflection-\d+\.hdr\.gz/.test(url))).toBe(true);
  expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: "artifacts/home-native-lighting.png" });
});
