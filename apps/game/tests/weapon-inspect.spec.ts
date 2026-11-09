import { expect, test } from "@playwright/test";

function projectedWeaponExtent() {
  const game = window.__game;
  const preview = game.weaponInspectPreview as unknown as {
    model: import("three").Group;
    pivot: import("three").Group;
    camera: import("three").PerspectiveCamera;
    requestedZoom: number;
    render(
      renderer: import("three").WebGLRenderer,
      capture?: () => void,
      environment?: import("three").Texture | null,
      dt?: number,
    ): boolean;
  };
  // Advance the real render clock through the authored opening before testing
  // the tighter settled camera at every user angle and zoom.
  for (let i = 0; i < 13; i++)
    preview.render(game.renderer, undefined, game.homeScene.inspectionEnvironment, 0.1);
  const saved = preview.pivot.rotation.clone();
  const savedZoom = preview.requestedZoom;
  const point = preview.camera.position.clone();
  let maximum = 0;
  let depthExtent = 0;
  let zoomVariation = 0;
  for (const zoom of [1, 4])
    for (const pitch of [-Math.PI / 2, 0, Math.PI / 2])
      for (const yaw of [0, Math.PI / 4, Math.PI / 2, Math.PI * 0.75]) {
        preview.requestedZoom = zoom;
        preview.pivot.rotation.set(pitch, yaw, 0);
        preview.render(game.renderer, undefined, game.homeScene.inspectionEnvironment);
        const expectedZoom =
          Number(document.getElementById("weapon-inspect-stage")!.dataset.baseZoom) * zoom;
        zoomVariation = Math.max(zoomVariation, Math.abs(preview.camera.zoom - expectedZoom));
        preview.model.traverseVisible((object) => {
          const mesh = object as import("three").Mesh;
          if (!mesh.isMesh) return;
          const skinned = mesh as import("three").SkinnedMesh;
          if (skinned.isSkinnedMesh) skinned.computeBoundingBox();
          else mesh.geometry.computeBoundingBox();
          const bounds = skinned.isSkinnedMesh ? skinned.boundingBox! : mesh.geometry.boundingBox!;
          for (let corner = 0; corner < 8; corner++) {
            point.set(
              corner & 1 ? bounds.max.x : bounds.min.x,
              corner & 2 ? bounds.max.y : bounds.min.y,
              corner & 4 ? bounds.max.z : bounds.min.z,
            );
            point.applyMatrix4(mesh.matrixWorld).project(preview.camera);
            maximum = Math.max(maximum, Math.abs(point.x), Math.abs(point.y));
            depthExtent = Math.max(depthExtent, Math.abs(point.z));
          }
        });
      }
  preview.pivot.rotation.copy(saved);
  preview.requestedZoom = savedZoom;
  preview.render(game.renderer, undefined, game.homeScene.inspectionEnvironment);
  return { maximum, depthExtent, zoomVariation };
}

test("all 56 inventory weapons zoom past screen edges without internal clipping or leaking geometry", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  const failures: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "cs2go-local-inventory",
      JSON.stringify([
        ...Array.from({ length: 56 }, (_, weapon) => ({ weapon, id: "", wear: 0.01, seed: 1 })),
        { weapon: 42, id: "508_44", wear: 0.01, seed: 1 },
      ]),
    ),
  );
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#skins-button").click();
  const storedBefore = await page.evaluate(() => localStorage.getItem("cs2go-skins-v1"));
  for (let weapon = 0; weapon < 56; weapon++) {
    await page.locator("#inventory-weapon").selectOption(String(weapon));
    await page.locator(`[data-item-weapon="${weapon}"][data-skin=""]`).click();
    await page.locator("#weapon-action-inspect").click();
    const stage = page.locator("#weapon-inspect-stage");
    await expect(stage).toHaveAttribute("data-weapon", String(weapon), { timeout: 30_000 });
    await expect(page.locator("#weapon-inspect-loading")).toHaveText("");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    if (weapon === 3 || weapon === 37 || weapon === 38) {
      const initialDistance = await page.evaluate(
        () =>
          (
            window.__game.weaponInspectPreview as unknown as {
              camera: import("three").PerspectiveCamera;
            }
          ).camera.position.z,
      );
      await expect(stage).toHaveAttribute("data-intro", "settled", { timeout: 5000 });
      if (weapon === 37 || weapon === 38) {
        const settledDistance = await page.evaluate(
          () =>
            (
              window.__game.weaponInspectPreview as unknown as {
                camera: import("three").PerspectiveCamera;
              }
            ).camera.position.z,
        );
        expect(initialDistance).toBeGreaterThan(settledDistance * 1.1);
        await stage.click();
        const size = await page.evaluate(() => {
          const preview = window.__game.weaponInspectPreview as unknown as {
            model: import("three").Group;
            camera: import("three").PerspectiveCamera;
          };
          const point = preview.camera.position.clone();
          let left = Infinity,
            right = -Infinity,
            top = -Infinity,
            bottom = Infinity;
          preview.model.traverseVisible((object) => {
            const mesh = object as import("three").Mesh;
            if (!mesh.isMesh) return;
            for (let i = 0; i < mesh.geometry.getAttribute("position").count; i++) {
              mesh
                .getVertexPosition(i, point)
                .applyMatrix4(mesh.matrixWorld)
                .project(preview.camera);
              left = Math.min(left, point.x);
              right = Math.max(right, point.x);
              bottom = Math.min(bottom, point.y);
              top = Math.max(top, point.y);
            }
          });
          return { width: (right - left) / 2, height: (top - bottom) / 2 };
        });
        expect(size.width).toBeGreaterThan(0.33);
        expect(size.width).toBeLessThan(0.65);
        expect(size.height).toBeGreaterThan(0.09);
        await page.screenshot({ path: `artifacts/weapon-inspect-default-knife-${weapon}.png` });
      }
    }
    if (weapon === 3) {
      const widthFraction = await page.evaluate(() => {
        const preview = window.__game.weaponInspectPreview as unknown as {
          model: import("three").Group;
          camera: import("three").PerspectiveCamera;
        };
        const point = preview.camera.position.clone();
        let minimum = Infinity,
          maximum = -Infinity;
        preview.model.traverseVisible((object) => {
          const mesh = object as import("three").Mesh;
          if (!mesh.isMesh) return;
          for (let i = 0; i < mesh.geometry.getAttribute("position").count; i++) {
            mesh.getVertexPosition(i, point).applyMatrix4(mesh.matrixWorld).project(preview.camera);
            minimum = Math.min(minimum, point.x);
            maximum = Math.max(maximum, point.x);
          }
        });
        return (maximum - minimum) / 2;
      });
      // Native capture is 2560x1440; this fixture is 1440x900. Its authored
      // vertical FOV stays fixed, so compare at the reference aspect ratio.
      const viewport = (await stage.boundingBox())!;
      const referenceWidth = (widthFraction * (viewport.width / viewport.height)) / (16 / 9);
      expect(referenceWidth).toBeGreaterThanOrEqual(0.64);
      expect(referenceWidth).toBeLessThanOrEqual(0.72);
    }
    if (weapon === 0) {
      const yaw = await stage.getAttribute("data-yaw");
      await page.waitForTimeout(350);
      expect(await stage.getAttribute("data-yaw")).not.toBe(yaw);
      await stage.click();
      const frozen = await stage.getAttribute("data-yaw");
      await page.waitForTimeout(350);
      expect(await stage.getAttribute("data-yaw")).toBe(frozen);
      await stage.press("Home");
      const restarted = await stage.getAttribute("data-yaw");
      await page.waitForTimeout(350);
      expect(await stage.getAttribute("data-yaw")).not.toBe(restarted);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await stage.press("Home");
      const reduced = await stage.getAttribute("data-yaw");
      await page.waitForTimeout(350);
      expect(await stage.getAttribute("data-yaw")).toBe(reduced);
      await page.emulateMedia({ reducedMotion: "no-preference" });
    }
    // Real pointer input freezes native idle before testing explicit rotations.
    await stage.click();
    const projected = await page.evaluate(projectedWeaponExtent);
    expect(
      projected.depthExtent,
      `weapon ${weapon} must not cross near/far clip planes`,
    ).toBeLessThan(1);
    expect(
      projected.zoomVariation,
      `weapon ${weapon} zoom must stay fixed while rotating`,
    ).toBeLessThan(0.000001);
    if ([0, 3, 25].includes(weapon)) expect(projected.maximum).toBeGreaterThan(1);
    const viewport = await stage.boundingBox();
    expect(viewport).toEqual({ x: 0, y: 0, ...page.viewportSize()! });

    if ([0, 3, 4, 42, 55].includes(weapon)) {
      const yaw = await stage.getAttribute("data-yaw");
      const bounds = (await stage.boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      await page.mouse.down();
      await page.mouse.move(bounds.x + bounds.width / 2 + 90, bounds.y + bounds.height / 2 + 24, {
        steps: 6,
      });
      await page.mouse.up();
      expect(await stage.getAttribute("data-yaw")).not.toBe(yaw);
      await stage.press("Home");
      await page.screenshot({ path: `artifacts/weapon-inspect-${weapon}.png` });
    }
    if (weapon === 25) {
      for (let i = 0; i < 8; i++) await stage.press("ArrowRight");
      for (let i = 0; i < 8; i++) await stage.press("ArrowUp");
      await page.screenshot({ path: "artifacts/weapon-inspect-g3sg1-diagonal.png" });
    }
    await page.locator("#close-item-details").click();
    await expect(page.locator("#skin-form")).toBeHidden();
  }
  await page.locator("#inventory-weapon").selectOption("42");
  await page.locator('[data-item-weapon="42"][data-skin="508_44"]').click();
  await page.locator("#weapon-action-customize").click();
  await page.locator("#skin-float").fill("0.123456");
  await page.locator("#skin-seed").fill("661");
  await expect(page.locator("#weapon-inspect-stage")).toHaveAttribute("data-seed", "661");
  // Inspect the rendered material, not just the selected UI state: custom
  // finishes supply reconstructed 1024px DataTextures instead of native KTX maps.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const preview = window.__game.weaponInspectPreview as unknown as {
            model?: import("three").Group;
          };
          let painted = 0;
          preview.model?.traverseVisible((object) => {
            const mesh = object as import("three").Mesh;
            if (!mesh.isMesh) return;
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
              const map = (material as import("three").MeshStandardMaterial).map;
              const texture = map as import("three").DataTexture | null;
              if (texture?.isDataTexture && texture.image.width === 1024) painted++;
            }
          });
          return painted;
        }),
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
  await page.locator("#weapon-inspect-customize").click();
  await expect(page.locator("#weapon-inspect-certificate")).toBeHidden();
  await expect(page.locator("#weapon-inspect-condition")).toHaveCount(0);
  await page.locator("#weapon-inspect-info").hover();
  await expect(page.locator("#weapon-inspect-certificate")).toContainText("Finish Style: Patina");
  await expect(page.locator("#weapon-inspect-certificate")).toContainText("Finish Catalog: 44");
  await expect(page.locator("#weapon-inspect-certificate")).toContainText("Pattern Template: 661");
  await expect(page.locator("#weapon-inspect-certificate")).toContainText(
    "Wear Rating: 0.123456001",
  );
  await page.screenshot({ path: "artifacts/weapon-inspect-case-hardened.png" });
  await page.locator("#weapon-inspect-stage").hover();
  await expect(page.locator("#weapon-inspect-certificate")).toBeHidden();
  await page.locator("#close-item-details").click();
  expect(await page.evaluate(() => localStorage.getItem("cs2go-skins-v1"))).toBe(storedBefore);
  const memory = () => page.evaluate(() => window.__game.renderer.info.memory.geometries);
  const baseline = await memory();
  for (let i = 0; i < 4; i++) {
    await page.locator("#inventory-weapon").selectOption("3");
    await page.locator('[data-item-weapon="3"][data-skin=""]').click();
    await page.locator("#weapon-action-inspect").click();
    await expect(page.locator("#weapon-inspect-stage")).toHaveAttribute("data-weapon", "3");
    await page.locator("#weapon-inspect-stage").press("Escape");
    await expect(page.locator("#skin-form")).toBeHidden();
  }
  await expect.poll(memory).toBeLessThanOrEqual(baseline + 2);
  expect(failures).toEqual([]);
  expect(errors).toEqual([]);
});

test("G3SG1 High Seas reframes the arriving legacy body and reveals its native certificate only on demand", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.addInitScript(() =>
    localStorage.setItem(
      "cs2go-local-inventory",
      JSON.stringify([{ weapon: 25, id: "11_712", wear: 0.123456, seed: 661 }]),
    ),
  );
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#skins-button").click();
  await page.locator("#inventory-weapon").selectOption("25");
  await page.locator('[data-item-weapon="25"][data-skin="11_712"]').click();
  await page.locator("#weapon-action-inspect").click();
  await expect(page.locator("#weapon-inspect-collection")).toHaveText("The Horizon Collection");
  await expect(page.locator("#weapon-inspect-description")).toContainText(
    "nautical theme and decorative brass metal work",
  );
  await expect(page.locator("#weapon-inspect-description em")).toHaveText(
    "Let dead reckoning be your guide",
  );
  await expect(page.locator("#weapon-inspect-stage")).toHaveAttribute("data-weapon", "25", {
    timeout: 30_000,
  });
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const preview = window.__game.weaponInspectPreview as unknown as {
            model?: import("three").Group;
          };
          const legacy = preview.model?.getObjectByName("skin-legacy");
          let painted = false;
          legacy?.traverseVisible((object) => {
            const mesh = object as import("three").Mesh;
            if (!mesh.isMesh) return;
            for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
              if (
                (
                  (material as import("three").MeshStandardMaterial)
                    .map as import("three").DataTexture
                )?.isDataTexture
              )
                painted = true;
            }
          });
          return (
            !!legacy?.visible && !preview.model?.getObjectByName("skin-hd")?.visible && painted
          );
        }),
      { timeout: 45_000 },
    )
    .toBe(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.locator("#weapon-inspect-stage").hover();
  await page.mouse.wheel(0, -10000);
  await expect(page.locator("#weapon-inspect-stage")).toHaveAttribute("data-requested-zoom", "4");
  const projected = await page.evaluate(projectedWeaponExtent);
  expect(projected.maximum).toBeGreaterThan(1);
  expect(projected.depthExtent).toBeLessThan(1);
  expect(projected.zoomVariation).toBeLessThan(0.000001);
  await expect(page.locator("#weapon-inspect-certificate")).toBeHidden();
  const stage = page.locator("#weapon-inspect-stage");
  for (let i = 0; i < 8; i++) await stage.press("ArrowRight");
  for (let i = 0; i < 8; i++) await stage.press("ArrowUp");
  await page.screenshot({ path: "artifacts/weapon-inspect-high-seas-diagonal.png" });
  await page.locator("#weapon-inspect-info").hover();
  await expect(page.locator("#weapon-inspect-certificate")).toContainText("Finish Style: Gunsmith");
  await expect(page.locator("#weapon-inspect-certificate")).toContainText("Finish Catalog: 712");
  await expect(page.locator("#weapon-inspect-certificate")).toContainText("Pattern Template: 661");
  await expect(page.locator("#weapon-inspect-certificate")).toContainText(
    "Wear Rating: 0.123456001",
  );
  await page.screenshot({ path: "artifacts/weapon-inspect-high-seas-certificate.png" });
  await stage.hover();
  await expect(page.locator("#weapon-inspect-certificate")).toBeHidden();
  await page.locator("#close-item-details").click();
  await expect(page.locator("#skin-form")).toBeHidden();
});
