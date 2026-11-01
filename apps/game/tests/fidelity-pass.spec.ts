import { test, expect } from "@playwright/test";
import type { Group } from "three";

async function ready(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100000 });
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 15000 });
}

test("quick crouch taps always accept input and recover, and native grenade hulls use remaining bounce time", async ({
  page,
}) => {
  await ready(page);
  const result = await page.evaluate(async () => {
    const g = window.__game;
    g.start("practice");
    g.locked = true;
    g.freezeTime = 0;
    g.roundPause = 0;
    g.keys.clear();
    g.eye = 1.65;
    g.duckCooldown = 0;
    g.duckHeld = false;
    g.keys.add("ControlLeft");
    const first = g.updateDuckInput(1 / 128);
    g.keys.clear();
    g.updateDuckInput(1 / 128);
    g.keys.add("ControlLeft");
    const repeat = g.updateDuckInput(1 / 128),
      slowed = g.duckTransitionRate;
    g.keys.clear();
    g.updateDuckInput(0.5);
    const recovered = g.duckTransitionRate;
    const { MapCollision } = await import("../src/map-collision");
    const threePath: string = "/node_modules/.vite/deps/three.js";
    const { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } = (await import(
      threePath
    )) as typeof import("three");
    const walls = [-0.2, 0.2].map((x) => {
      const m = new Mesh(new BoxGeometry(0.01, 2, 2), new MeshBasicMaterial());
      m.position.set(x, 1, 0);
      m.updateMatrixWorld(true);
      return m;
    });
    const old = g.world.collision;
    g.world.collision = new MapCollision(walls);
    g.utility.launch("he", "player", "ct", new Vector3(0, 0.5, 0), new Vector3(120, 0, 0), 2);
    const projectile = g.utility.projectiles.at(-1)!;
    g.utility.update(1 / 128);
    const position = projectile.position.toArray(),
      velocity = projectile.velocity.toArray();
    g.utility.reset();
    g.world.collision = old;
    return { first, repeat, slowed, recovered, position, velocity };
  });
  expect(result.first).toBe(true);
  expect(result.repeat).toBe(true);
  expect(result.slowed).toBeLessThan(15);
  expect(result.recovered).toBe(15);
  expect(result.position[0]).toBeLessThan(0.145);
  expect(result.position[0]).toBeGreaterThan(-0.145);
  expect(result.velocity[0]).toBeGreaterThan(0); // two contacts within one tick
});

test("loadout is a full page with separate team previews, starting pistol choices and saved swaps", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.locator("#inventory-button").click();
  await expect(page.locator(".loadout-slot")).toHaveCount(30);
  await page
    .locator('[data-preview-team="ct"][data-category="Pistols"][data-inventory-slot="0"]')
    .click();
  await expect(page.locator("[data-loadout-weapon]")).toHaveCount(2);
  await page.locator('[data-loadout-weapon="12"]').click();
  await expect(
    page.locator('[data-preview-team="ct"][data-category="Pistols"][data-inventory-slot="0"]'),
  ).toHaveAttribute("data-weapon", "12");
  await expect(page.locator("#loadout-agent-ct")).toHaveAttribute("data-item", /\d+/);
  await page.screenshot({ path: "artifacts/cs2-loadout-page.png" });
  const saved = await page.evaluate(() => window.__game.groundInventory.loadouts.ct);
  expect(saved.filter((id) => id === 2 || id === 12)).toEqual([12]);
  await page.locator("#close-loadout-editor").click();
  await page.evaluate(() => {
    window.__game.team = "ct";
    window.__game.start("competitive");
  });
  expect(await page.evaluate(() => window.__game.secondary)).toBe(12);
  expect(errors).toEqual([]);
});

test("hovered buy weapons use saved finishes at metre scale", async ({ page }) => {
  await ready(page);
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.keyboard.press("b");
  await page.evaluate(async () => {
    const skinModule: string = "/src/skins.ts";
    const { setSkin } = (await import(skinModule)) as typeof import("../src/skins");
    await setSkin(0, { id: "7_44", wear: 0.12, seed: 661 });
  });
  await page.locator('#loadout [data-weapon="0"]').hover();
  await expect(page.locator("#buy-preview-stage")).toHaveAttribute("data-item", "0");
  const result = await page.evaluate(() => {
    const g = window.__game;
    const p = g.buyPreview as unknown as { item: Group };
    const item = p.item;
    item.updateMatrixWorld(true);
    let painted = false;
    const maps: string[] = [];
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    item.traverse((o) => {
      const mesh = o as import("three").Mesh;
      if (!mesh.geometry || !mesh.visible) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      maps.push(
        ...materials.map(
          (m) =>
            `${m.name}:${(m as import("three").MeshStandardMaterial).map?.type}:${((m as import("three").MeshStandardMaterial).map as import("three").DataTexture)?.isDataTexture}`,
        ),
      );
      painted ||= materials.some(
        (m) =>
          ((m as import("three").MeshStandardMaterial).map as import("three").DataTexture | null)
            ?.isDataTexture === true,
      );
      const pos = mesh.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i++) {
        const v = g.position.clone().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
        v.toArray().forEach((n, k) => {
          min[k] = Math.min(min[k], n);
          max[k] = Math.max(max[k], n);
        });
      }
    });
    return { painted, maps, scale: item.scale.toArray(), size: max.map((n, i) => n - min[i]) };
  });
  console.log("Buy AK dimensions", result);
  expect(result.painted).toBe(true);
  expect(Math.max(...result.size)).toBeLessThan(1.4);
  await page.screenshot({ path: "artifacts/cs2-buy-skinned-ak.png" });
});

test("signed-in inventory renders owned items as a searchable rarity grid", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const profile = {
    steamId: "76561199528285628",
    name: "Inventory fixture",
    avatar: null,
    profileUrl: "https://steamcommunity.com/profiles/76561199528285628/",
  };
  await page.route("**/api/steam?*", (route) => {
    const action = new URL(route.request().url()).searchParams.get("action");
    return route.fulfill({
      json:
        action === "sync"
          ? {
              reportedTotal: 36,
              items: Array.from({ length: 36 }, (_, i) => ({
                assetId: String(i + 1),
                name:
                  i % 3 === 0
                    ? "AK-47 | Case Hardened"
                    : i % 3 === 1
                      ? "Weapon Case"
                      : "Sticker | Crown",
                weaponName: i % 3 === 0 ? "AK-47" : "",
                finish: i % 3 === 0 ? "Case Hardened" : "",
                wear: i % 3 === 0 ? 0.12 : null,
                seed: i % 3 === 0 ? 661 : null,
                type: i % 3 === 0 ? "Rifle" : i % 3 === 1 ? "Container" : "Sticker",
                rarity: "Classified",
                color: i % 3 === 0 ? "#d32ce6" : "#b0c3d9",
                image: "/skins/thumbs/7_44.webp",
              })),
            }
          : { profile },
    });
  });
  await ready(page);
  await page.locator("#skins-button").click();
  await expect(page.locator("#steam-account")).toBeVisible();
  await expect(page.locator(".steam-item")).toHaveCount(36);
  const bounds = (await page.locator(".steam-account-page").boundingBox())!;
  expect(bounds.width).toBe(1440);
  expect(bounds.y).toBeLessThan(70);
  await page.screenshot({ path: "artifacts/cs2-owned-inventory.png" });
  await page.locator('[data-item-filter="Containers"]').click();
  await expect(page.locator(".steam-item")).toHaveCount(12);
  await page.locator('[data-item-filter="Everything"]').click();
  await page.locator("#steam-item-search").fill("Crown");
  await expect(page.locator(".steam-item")).toHaveCount(12);
  await page.locator("#steam-item-search").fill("nothing matched");
  await expect(page.locator(".steam-inventory-empty")).toBeVisible();
  await page.locator("#steam-item-search").fill("");
  await page.locator("#steam-item-sort").selectOption("name");
  await expect(page.locator(".steam-item")).toHaveCount(36);
  await page.locator("#inventory-button").click();
  await expect(page.locator("#steam-account")).toBeHidden();
  await expect(page.locator("#loadout-editor")).toBeVisible();
  await page.locator("#home-button").click();
  await expect(page.locator("#loadout-editor")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("native idle motion continues with non-default showcase weapons and fire renders without spherical placeholders", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await ready(page);
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-showcase-team").selectOption("t");
  await page.locator("#home-showcase-weapon").selectOption("7");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "7");
  const idle = await page.evaluate(() => {
    const home = window.__game.homeScene as unknown as {
      previews: Map<string, { soldier: { model: Group }; mixer: import("three").AnimationMixer }>;
    };
    const p = home.previews.get("t")!,
      head = p.soldier.model.getObjectByName("head_0")!;
    const before = head.quaternion.clone();
    p.mixer.update(3);
    return before.angleTo(head.quaternion);
  });
  expect(idle).toBeGreaterThan(0.001);
  await page.locator("#home-scenery-button").click();
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  const fire = await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.invulnerable = 100;
    g.freezeTime = 0;
    g.position.set(-17, 0, 17);
    g.yaw = 0;
    g.pitch = -0.1;
    g.updateAimCamera();
    const p = g.position.clone().set(-17, 0.05, 12);
    g.utility.launch("molotov", "player", "ct", p, p.clone().set(0, 0, 0), 2);
    g.utility.detonate(g.utility.projectiles.at(-1)!);
    const effect = g.utility.effects.at(-1)!;
    effect.age = 0.6;
    g.utility.renderEffects();
    return { cells: effect.cells.length, instances: effect.visual?.mesh.count };
  });
  expect(fire.cells).toBeGreaterThan(5);
  expect(fire.instances).toBe(fire.cells * 3);
  await page.waitForTimeout(100);
  await page.screenshot({ path: "artifacts/cs2-fire-cards.png" });
  expect(errors).toEqual([]);
});
