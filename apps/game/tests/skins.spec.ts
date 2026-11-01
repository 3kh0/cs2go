import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
declare global {
  interface Window {
    __game: Game;
  }
}

test("skin catalog customizes wear and seed, persists, and restores default", async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [],
    foreign: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:5173"))
      foreign.push(r.url());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#skins-button").click();
  await page.locator("#skin-search").fill("Case Hardened");
  const thumbnail = await page.locator('[data-skin="7_44"] img').elementHandle();
  await page.locator('[data-skin="7_44"]').click();
  await page.locator("#skin-float").fill("0.012345");
  await page.locator("#skin-seed").fill("661");
  await page.locator("#apply-skin").click();
  await expect(page.locator("#skin-status")).toContainText("Applied", { timeout: 30000 });
  expect(
    await page
      .locator('[data-skin="7_44"] img')
      .evaluate((image, original) => image === original, thumbnail),
  ).toBe(true);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cs2go-skins-v1")!)[0])).toEqual(
    { id: "7_44", wear: 0.012345, seed: 661 },
  );
  await page.screenshot({ path: "artifacts/skin-catalog.png" });
  await page.reload();
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#skins-button").click();
  await expect(page.locator("#skin-title")).toHaveText("Case Hardened");
  await expect(page.locator("#skin-float")).toHaveValue("0.012345");
  await expect(page.locator("#skin-seed")).toHaveValue("661");
  await page.locator("#close-skins").click();
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => window.__game.buy(0));
  await page.waitForFunction(() => {
    let found = false;
    window.__game.gun.traverse((o) => {
      if (
        o.type === "SkinnedMesh" &&
        (o as any).material.name === "ak47" &&
        (o as any).material.map?.isDataTexture
      )
        found = true;
    });
    return found;
  });
  await page.waitForFunction(() => window.__game.drawTime === 0);
  await page.keyboard.press("f");
  await page.waitForTimeout(700);
  await page.screenshot({ path: "artifacts/skin-case-hardened-inspect.png" });
  await page.evaluate(() => document.exitPointerLock());
  await page.locator("#pause-skins").click();
  await page.locator('[data-skin=""]').click();
  await page.locator("#apply-skin").click();
  await expect(page.locator("#skin-status")).toContainText("Applied");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cs2go-skins-v1")!)[0].id)).toBe(
    "",
  );
  await page.locator("#close-skins").click();
  await page.locator("#resume").click();
  await page.waitForFunction(() => window.__game.locked);
  const ammo = await page.evaluate(() => window.__game.ammo);
  await page.mouse.click(700, 450);
  expect(await page.evaluate(() => window.__game.ammo)).toBeLessThan(ammo);
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test("every bundled skin bakes locally and wear and pattern visibly change textures", async ({
  page,
}) => {
  test.setTimeout(900000);
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  const result = await page.evaluate(async () => {
    // Account for real WebGPU allocations, including destroyed temporaries.
    const probe = await (await navigator.gpu.requestAdapter())!.requestDevice();
    const proto = Object.getPrototypeOf(probe) as GPUDevice;
    // oxlint-disable-next-line typescript/unbound-method -- Invoked with the original device via call below.
    const createTexture = proto.createTexture;
    probe.destroy();
    const live = new Map<GPUTexture, number>();
    proto.createTexture = function (descriptor) {
      const texture = createTexture.call(this, descriptor);
      live.set(
        texture,
        texture.width * texture.height * (texture.format === "rgba16float" ? 8 : 4),
      );
      const destroy = texture.destroy.bind(texture);
      texture.destroy = () => {
        live.delete(texture);
        destroy();
      };
      return texture;
    };
    let retained = 0;
    const modulePath = "/src/skin-baker.ts";
    const { bakeSkin } = (await import(modulePath)) as typeof import("../src/skin-baker");
    const catalog = await (await fetch("/skins/catalog.json")).json();
    const failures: string[] = [];
    let count = 0;
    const perWeapon: Record<number, number> = {};
    for (const skin of catalog) {
      try {
        const paint = await (await fetch(`/skins/paints/${skin.id}.json`)).json();
        const baked = await bakeSkin(paint, 661, 0.15);
        if (!baked.length || baked.some((t) => !t.maps.g_tColor.some((v) => v > 0)))
          throw new Error("Empty paint");
        retained = Math.max(
          retained,
          [...live.values()].reduce((sum, bytes) => sum + bytes, 0),
        );
        count++;
        perWeapon[skin.weapon] = (perWeapon[skin.weapon] ?? 0) + 1;
      } catch (e) {
        failures.push(`${skin.id} ${skin.name}: ${String(e)}`);
      }
    }
    const variations = [];
    for (const item of [7, 500, 515, 507]) {
      const paint = await (await fetch(`/skins/paints/${item}_44.json`)).json();
      const fresh = (await bakeSkin(paint, 661, 0.01))[0].maps.g_tColor;
      const worn = (await bakeSkin(paint, 661, 0.95))[0].maps.g_tColor;
      const other = (await bakeSkin(paint, 321, 0.01))[0].maps.g_tColor;
      const again = (await bakeSkin(paint, 661, 0.01))[0].maps.g_tColor;
      const difference = (a: Uint8Array, b: Uint8Array) =>
        a.reduce((n, v, i) => n + Number(v !== b[i]), 0);
      variations.push({
        item,
        wear: difference(fresh, worn),
        seed: difference(fresh, other),
        repeat: difference(fresh, again),
      });
    }
    proto.createTexture = createTexture;
    return {
      count,
      failures,
      variations,
      retained,
      perWeapon,
      unique: new Set(catalog.map((skin: { id: string }) => skin.id)).size,
    };
  });
  expect(result.failures).toEqual([]);
  expect(result.count).toBe(1551);
  expect(result.unique).toBe(1551);
  expect(
    Object.keys(result.perWeapon)
      .map(Number)
      .sort((a, b) => a - b),
  ).toEqual(Array.from({ length: 37 }, (_, i) => i));
  expect([7, 8, 9, 10, 11].map((index) => result.perWeapon[index])).toEqual([59, 45, 52, 47, 47]);
  expect([13, 21, 36].map((index) => result.perWeapon[index])).toEqual([58, 46, 25]);
  expect(result.retained).toBeLessThanOrEqual(64 * 1024 * 1024);
  for (const variation of result.variations) {
    expect(variation.wear, `wear for ${variation.item}`).toBeGreaterThan(10000);
    expect(variation.seed, `seed for ${variation.item}`).toBeGreaterThan(10000);
    expect(variation.repeat, `repeat for ${variation.item}`).toBe(0);
  }
});

test("knife finishes persist independently, animate, and restore their defaults", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [],
    foreign: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:5173"))
      foreign.push(r.url());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#skins-button").click();
  for (const [index, item, name] of [
    [4, 500, "Bayonet"],
    [5, 515, "Butterfly Knife"],
    [6, 507, "Karambit"],
  ] as const) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("#skin-grid button")).toHaveCount(35);
    await page.locator("#skin-search").fill("Doppler");
    await expect(page.locator("#skin-grid button")).toHaveCount(12);
    await expect(page.locator("#skin-grid")).toContainText("Gamma Doppler | Emerald");
    await page.locator("#skin-search").fill("Case Hardened");
    await page.locator(`[data-skin="${item}_44"]`).click();
    await page.locator("#skin-float").fill("0.123456");
    await page.locator("#skin-seed").fill(String(400 + index));
    await page.locator("#apply-skin").click();
    await expect(page.locator("#skin-status")).toContainText("Applied", { timeout: 30000 });
  }
  await page.screenshot({ path: "artifacts/knife-skin-catalog.png" });
  await page.reload();
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#play").evaluate((b) => {
    b.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  for (const [index, item, material] of [
    [4, 500, "weapon_knife_bayonet"],
    [5, 515, "weapon_knife_butterfly"],
    [6, 507, "weapon_knife_karambit"],
  ] as const) {
    await page.evaluate((index) => {
      window.__game.buy(index);
    }, index);
    await page.waitForFunction((material) => {
      let painted = false;
      window.__game.gun.traverse((o) => {
        if ((o as any).material?.name === material && (o as any).material.map?.isDataTexture)
          painted = true;
      });
      return painted;
    }, material);
    await expect.poll(() => page.evaluate(() => window.__game.drawTime)).toBe(0);
    await page.mouse.click(700, 400);
    await expect.poll(() => page.evaluate(() => window.__game.knifeTime)).toBeGreaterThan(0);
    await expect.poll(() => page.evaluate(() => window.__game.cooldown)).toBe(0);
    await page.keyboard.press("f");
    await expect.poll(() => page.evaluate(() => window.__game.inspectTime)).toBeGreaterThan(0);
    await page.waitForTimeout(650);
    await page.screenshot({ path: `artifacts/skin-knife-${index}-inspect.png` });
    await page.evaluate(() => document.exitPointerLock());
    await page.locator("#pause-skins").click();
    await page.locator(`[data-skin-weapon="${index}"]`).click();
    await expect(page.locator("#skin-title")).toHaveText("Case Hardened");
    await expect(page.locator("#skin-float")).toHaveValue("0.123456");
    await expect(page.locator("#skin-seed")).toHaveValue(String(400 + index));
    expect(
      await page.evaluate(
        (index) => JSON.parse(localStorage.getItem("cs2go-skins-v1")!)[index].id,
        index,
      ),
    ).toBe(`${item}_44`);
    await page.locator('[data-skin=""]').click();
    await page.locator("#apply-skin").click();
    await expect(page.locator("#skin-status")).toContainText("Applied");
    const restored = await page.evaluate((material) => {
      let restored = false;
      window.__game.gun.traverse((o) => {
        if ((o as any).material?.name === material)
          restored = !(o as any).material.map?.isDataTexture;
      });
      return restored;
    }, material);
    expect(restored).toBe(true);
    await page.locator("#close-skins").click();
    await page.locator("#resume").click();
    await page.waitForFunction(() => window.__game.locked);
  }
  expect(errors).toEqual([]);
  expect(foreign).toEqual([]);
});

test("skin edits reuse inputs and failed loads remain retryable", async ({ page }) => {
  test.setTimeout(60000);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/skins/")) requests.push(request.url());
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  const apply = (wear: number) =>
    page.evaluate(async (value) => {
      const path = "/src/skins.ts";
      const { setSkin } = (await import(path)) as typeof import("../src/skins");
      await setSkin(0, { id: "7_44", seed: 661, wear: value });
    }, wear);
  // Reject one required input, then retry without reloading the page.
  let failed = false;
  await page.route("**/skins/textures/*", async (route) => {
    if (!failed) {
      failed = true;
      await route.abort();
    } else await route.continue();
  });
  await expect(apply(0.01)).rejects.toThrow();
  await page.unroute("**/skins/textures/*");
  await apply(0.01);
  requests.length = 0;
  await apply(0.2);
  expect(requests).toEqual([]);
  await apply(0.2);
  expect(requests).toEqual([]);
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem("cs2go-skins-v1")!)[0].wear),
  ).toBe(0.2);
});

test("new gun finishes persist independently and paint both model variants", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith("http://127.0.0.1:5173/"))
      errors.push(`External request: ${request.url()}`);
  });
  await page.goto("/");
  await page.waitForFunction(() => window.__game?.assetsReady);
  const variants = await page.evaluate(async () => {
    const catalog = (await (
      await fetch("/skins/catalog.json")
    ).json()) as import("../src/skins").Skin[];
    return [7, 8, 9, 10, 11, 13, 21, 36].flatMap((weapon) =>
      ["legacy", "hd"].map((body) => {
        const skin = catalog.find((entry) => entry.weapon === weapon && entry.body === body);
        if (!skin) throw new Error(`Missing ${body} finishes for weapon ${weapon}`);
        return skin;
      }),
    );
  });
  await page.locator("#skins-button").click();
  await expect(page.locator("[data-skin-weapon]")).toHaveCount(56);
  for (const skin of variants.filter((entry) => entry.body === "legacy")) {
    await page.locator(`[data-skin-weapon="${skin.weapon}"]`).click();
    // The default preview must load for all expanded slots, including at desktop widths.
    expect(
      await page.locator("#skin-image").evaluate(async (element) => {
        const image = element as HTMLImageElement;
        await image.decode();
        return image.naturalWidth;
      }),
    ).toBeGreaterThan(0);
    await page.locator(`[data-skin="${skin.id}"]`).click();
    await page.locator("#skin-float").fill((skin.weapon / 100).toFixed(6));
    await page.locator("#skin-seed").fill(String(610 + skin.weapon));
    await page.locator("#apply-skin").click();
    await expect(page.locator("#skin-status")).toContainText("Applied", { timeout: 30000 });
  }
  await page.reload();
  await page.waitForFunction(() => window.__game?.assetsReady);
  await page.locator("#play").evaluate((button) => {
    button.onclick = () => window.__game.start("practice");
  });
  await page.locator("#play").click();
  await page.waitForFunction(() => window.__game.locked);
  for (const skin of variants) {
    await page.evaluate((weapon) => window.__game.buy(weapon), skin.weapon);
    await page.evaluate(() => document.exitPointerLock());
    await page.locator("#pause-skins").click();
    await page.locator(`[data-skin-weapon="${skin.weapon}"]`).click();
    if (skin.body === "legacy") {
      await expect(page.locator("#skin-title")).toHaveText(skin.name);
      await expect(page.locator("#skin-float")).toHaveValue(String(skin.weapon / 100));
      await expect(page.locator("#skin-seed")).toHaveValue(String(610 + skin.weapon));
      expect(
        await page.evaluate(
          (weapon) => JSON.parse(localStorage.getItem("cs2go-skins-v1")!)[weapon],
          skin.weapon,
        ),
      ).toEqual({ id: skin.id, wear: skin.weapon / 100, seed: 610 + skin.weapon });
    } else {
      await page.locator(`[data-skin="${skin.id}"]`).click();
      await page.locator("#apply-skin").click();
      await expect(page.locator("#skin-status")).toContainText("Applied", { timeout: 30000 });
    }
    const targets = await page.evaluate(async (id) => {
      const paint = await (await fetch(`/skins/paints/${id}.json`)).json();
      return paint.targets.map((target: { target_vmat: string }) =>
        target.target_vmat
          .split("/")
          .at(-1)!
          .replace(/\.vmat$/, ""),
      ) as string[];
    }, skin.id);
    await expect
      .poll(
        () =>
          page.evaluate(
            ({ body, targets }) => {
              const root = window.__game.gun.getObjectByName(`skin-${body}`);
              if (!root?.visible) return [];
              const painted = new Set<string>();
              root.traverseVisible((object) => {
                const material = (object as any).material;
                for (const entry of Array.isArray(material) ? material : [material]) {
                  if (entry?.map?.isDataTexture) painted.add(entry.name);
                }
              });
              return targets.filter((target) => painted.has(target));
            },
            { body: skin.body, targets },
          ),
        `${skin.id} maps on visible ${skin.body} body`,
      )
      .toEqual(targets);
    await page.locator("#close-skins").click();
    await page.locator("#resume").click();
    await page.waitForFunction(() => window.__game.locked && window.__game.drawTime === 0);
    await page.keyboard.press("f");
    await page.waitForTimeout(650);
    await page.screenshot({ path: `artifacts/skin-gun-${skin.weapon}-${skin.body}.png` });
    if (skin.body === "hd") {
      await page.evaluate(() => document.exitPointerLock());
      await page.locator("#pause-skins").click();
      await page.locator('[data-skin=""]').click();
      await page.locator("#apply-skin").click();
      await expect(page.locator("#skin-status")).toContainText("Applied");
      expect(
        await page.evaluate(() => {
          const root = window.__game.gun;
          let painted = false;
          root.traverse((object) => {
            const material = (object as any).material;
            for (const entry of Array.isArray(material) ? material : [material])
              if (entry?.map?.isDataTexture) painted = true;
          });
          return {
            painted,
            legacy: root.getObjectByName("skin-legacy")?.visible,
            hd: root.getObjectByName("skin-hd")?.visible,
          };
        }),
      ).toEqual({ painted: false, legacy: true, hd: false });
      expect(
        await page.evaluate(
          (weapon) => JSON.parse(localStorage.getItem("cs2go-skins-v1")!)[weapon].id,
          skin.weapon,
        ),
      ).toBe("");
      await page.locator("#close-skins").click();
      await page.locator("#resume").click();
      await page.waitForFunction(() => window.__game.locked);
    }
  }
  expect(errors).toEqual([]);
});
