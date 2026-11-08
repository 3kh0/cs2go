import { selectHomeTeam } from "./home-controls";
import { test, expect } from "@playwright/test";
import type * as T from "three";
import type { Game } from "../src/game";
type IdleScene = {
  previews: Map<
    string,
    {
      soldier: { model: T.Group };
      action: T.AnimationAction;
      weapon: T.Group;
      idleVariation: {
        actions: T.AnimationAction[];
        current?: T.AnimationAction;
        entrance?: T.AnimationAction;
        last: number;
        wait: number;
      };
    }
  >;
  clearPreview(team: string): void;
};
declare global {
  interface Window {
    __game: Game;
  }
}

test("home weapon menu shows equipped finishes and rarity", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("cs2go-skins-v1", JSON.stringify([{ id: "7_1466", wear: 0.01, seed: 1 }]));
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await selectHomeTeam(page, "t");
  await page.locator("#home-scenery-button").click();
  await page.getByRole("button", { name: "Change Weapon", exact: true }).click();
  const weapon = page.locator('[data-home-weapon="0"]');
  await expect(weapon).toHaveText("AK-47 | Consequence of the Jinn");
  await expect(weapon).toHaveCSS("border-left-color", "rgb(235, 75, 75)");
  await page.screenshot({ path: "artifacts/home-weapon-finishes.png" });
});

test("native homepage presents both agents, local navigation and a working match round trip", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    if (
      /^https?:/.test(request.url()) &&
      new URL(request.url()).origin !== new URL(baseURL!).origin
    )
      external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await expect(page.locator(".home-match-card")).toBeHidden();
  await expect(page.locator("#play")).toBeHidden();
  await expect(page.locator(".home-nav button")).toHaveText([
    "INVENTORY",
    "LOADOUT",
    "PLAY",
    "STORE",
    "NEWS",
  ]);
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-clip", "t_buymenu_m4a4");
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain(
    "Stratum2",
  );
  expect(await page.evaluate(() => document.fonts.check('700 16px "Stratum2 Monodigit"'))).toBe(
    true,
  );
  const animationTime = () =>
    page.evaluate(() => {
      const scene = window.__game.homeScene as unknown as {
        previews: Map<string, { mixer: { time: number } }>;
      };
      return scene.previews.get(window.__game.team)!.mixer.time;
    });
  const before = await animationTime();
  await expect.poll(animationTime).toBeGreaterThan(before + 0.1);
  await page.screenshot({ path: "artifacts/home-ct-1440.png" });
  await selectHomeTeam(page, "t");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-clip", /^t_main_menu_/);
  await page.screenshot({ path: "artifacts/home-t-1440.png" });
  await page.locator("#inventory-button").click();
  await expect(page.locator("#loadout-editor")).toBeVisible();
  await page.locator("#home-button").click();
  await page.locator("#skins-button").click();
  await expect(page.locator("#skin-menu")).toBeVisible();
  await page.locator("#close-skins").click();
  await page.locator("#store-button").click();
  await expect(page.locator("#home-panel-title")).toHaveText("Store unavailable");
  await expect(page.locator("#home-panel-content p")).toHaveText(
    "The Store is not available in this version.",
  );
  await page.screenshot({ path: "artifacts/home-store-unavailable.png" });
  await page.locator("#home-panel-close").click();
  await expect(page.locator("#store-button")).toBeFocused();
  await page.locator("#news-button").click();
  await expect(page.locator("#home-panel-title")).toHaveText("News unavailable");
  await page.keyboard.press("Escape");
  await expect(page.locator("#home-panel")).toBeHidden();
  await expect(page.locator("#news-button")).toBeFocused();
  await page.locator("#home-scenery-button").click();
  await expect(page.locator("#home-showcase-agent")).toHaveCount(0);
  await expect(page.locator("#home-scenery")).toBeVisible();
  await page.screenshot({ path: "artifacts/home-context-menu.png" });
  await page.getByRole("button", { name: "Change Weapon", exact: true }).click();
  await expect(page.locator("#home-weapon-options")).toBeVisible();
  await page.screenshot({ path: "artifacts/home-context-weapons.png" });
  await page
    .locator("#home-weapon-options")
    .getByRole("button", { name: "AK-47", exact: true })
    .click();
  await expect(page.locator("#home-scenery")).toBeHidden();
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-showcase-weapon", "0");
  await page.locator("#home-scenery-button").click();
  await page.getByRole("button", { name: "Change Main Menu Scenery", exact: true }).click();
  await page
    .locator("#home-background-options")
    .getByRole("button", { name: "Dust II - Close-up", exact: true })
    .click();
  await expect(page.locator("#home-scenery")).toBeHidden();
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-switch-team").click();
  await expect(page.locator("#home-scenery")).toBeHidden();
  await page.locator("#home-scenery-button").click();
  await expect(page.locator("#home-switch-team")).toHaveText("Show Equipped T Agent");
  await page.keyboard.press("Escape");
  await expect(page.locator("#home-scenery")).toBeHidden();
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-switch-team").click();
  await page.locator("#home-scenery-button").click();
  await page.locator("#home-view-loadout").click();
  await expect(page.locator('.loadout-team[data-team="t"]')).toBeVisible();
  await page.locator("#home-button").click();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: "artifacts/home-t-close-1280.png" });
  const nav = await page.locator(".home-nav").boundingBox();
  const tools = await page.locator(".home-tools").boundingBox();
  expect(nav!.x).toBeGreaterThan(tools!.x + tools!.width);
  expect(nav!.x + nav!.width).toBeLessThan(1280 - 52);
  await page.locator("#home-play").click();
  await expect(page.locator("#menu")).toHaveAttribute("data-page", "play");
  await expect(page.locator(".home-match-card")).toBeVisible();
  await expect(page.locator("#home-scenery-button")).toBeHidden();
  await expect(page.locator("#home-scenery")).toBeHidden();
  await expect(page.getByRole("group", { name: "Session type" }).getByRole("button")).toHaveText([
    "OFFLINE",
    "ONLINE",
  ]);
  await page.getByRole("button", { name: "ONLINE", exact: true }).click();
  await expect(page.locator("#multiplayer-options")).toBeVisible();
  await page.getByRole("button", { name: "OFFLINE", exact: true }).click();
  await expect(page.locator("#multiplayer-options")).toBeHidden();
  await page.screenshot({ path: "artifacts/home-play-1280.png" });
  await page.locator("#home-play").click();
  await page.locator('[data-mode="competitive"]').click();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="ct"]').click();
  await page
    .waitForFunction(() => window.__game.locked, undefined, { timeout: 15_000 })
    .catch(async (error) => {
      throw new Error(
        `${error} state=${JSON.stringify(await page.evaluate(() => ({ active: window.__game.active, ready: window.__game.assetsReady, locked: window.__game.locked, pointer: !!document.pointerLockElement })))}, errors=${JSON.stringify(errors)}`,
      );
    });
  await expect(page.locator("#menu")).toBeHidden();
  await page.waitForTimeout(250);
  await page.evaluate(() => document.exitPointerLock());
  await expect(page.locator("#pause")).toBeVisible();
  await page.locator("#leave").click();
  await expect(page.locator("#leave-confirm")).toBeVisible();
  await page.locator("#leave-yes").click();
  await expect(page.locator("#menu")).toBeVisible();
  await expect(page.locator("#menu")).toHaveAttribute("data-page", "home");
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-clip", "t_buymenu_m4a4");
  expect(
    await page.evaluate(
      () =>
        (window.__game.homeScene as unknown as { previews: Map<string, unknown> }).previews.size,
    ),
  ).toBe(2);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("reduced motion holds the native homepage idle without advancing its clock", async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#home-agent-stage")).toHaveAttribute("data-clip", "t_buymenu_m4a4");
  const clock = () =>
    page.evaluate(
      () =>
        (
          window.__game.homeScene as unknown as {
            previews: Map<string, { mixer: { time: number } }>;
          }
        ).previews.get("ct")!.mixer.time,
    );
  const before = await clock();
  await page.waitForTimeout(200);
  expect(await clock()).toBe(before);
  await page.screenshot({ path: "artifacts/home-reduced-motion.png" });
});

test("homepage keeps pointer motion horizontal and presents player identity", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await expect(page.locator("[data-home-team]")).toHaveCount(0);
  await expect(page.locator("#home-agent-name")).toHaveCount(0);
  await expect(page.locator("#home-player-avatar")).toBeVisible();
  const avatarBounds = (await page.locator("#home-player-avatar").boundingBox())!;
  const nameBounds = (await page.locator("#home-player-name").boundingBox())!;
  expect(avatarBounds.y).toBeGreaterThanOrEqual(nameBounds.y + nameBounds.height);
  const atmosphere = await page.evaluate(() => {
    const scene = window.__game.homeScene.graphicsRoot;
    const shadowLights: string[] = [];
    scene.traverse((object) => {
      if ((object as T.Light).isLight && (object as T.Light).castShadow)
        shadowLights.push(object.type);
    });
    return { fog: !!scene.fog && "isFogExp2" in scene.fog, shadowLights };
  });
  expect(atmosphere.fog).toBe(true);
  expect(atmosphere.shadowLights).toEqual(["DirectionalLight"]);
  await expect(page.locator("#home-play .nav-cell").first()).toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  const camera = () =>
    page.evaluate(() => {
      const home = window.__game.homeScene as unknown as {
        camera: {
          position: { x: number; y: number; z: number };
          fov: number;
          quaternion: { x: number; y: number; z: number; w: number };
        };
      };
      return {
        position: { ...home.camera.position },
        fov: home.camera.fov,
        rotation: {
          x: home.camera.quaternion.x,
          y: home.camera.quaternion.y,
          z: home.camera.quaternion.z,
          w: home.camera.quaternion.w,
        },
      };
    });
  await page.mouse.move(50, 200);
  await page.waitForTimeout(1800);
  const left = await camera();
  await page.mouse.move(50, 700);
  await page.waitForTimeout(1800);
  const down = await camera();
  expect(down.position).toEqual(left.position);
  expect(down.fov).toBeCloseTo(left.fov, 8);
  for (const key of Object.keys(down.rotation) as (keyof typeof down.rotation)[])
    expect(down.rotation[key]).toBeCloseTo(left.rotation[key], 6);
  await page.mouse.move(1350, 700);
  await page.waitForTimeout(1800);
  const right = await camera();
  expect(right.position).toEqual(left.position);
  expect(right.fov).toBeCloseTo(left.fov, 8);
  expect(right.rotation).not.toEqual(left.rotation);
  await page.screenshot({ path: "artifacts/home-depth-and-profile.png" });
  expect(errors).toEqual([]);
});

test("homepage native idle gestures move the body and return to idle", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.waitForFunction(
    () => {
      const preview = (window.__game.homeScene as unknown as IdleScene).previews.get("ct")!;
      return preview?.idleVariation?.actions.length === 3;
    },
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForFunction(() => {
    const state = (window.__game.homeScene as unknown as IdleScene).previews.get(
      "ct",
    )!.idleVariation;
    return state.current === state.entrance && !!state.entrance;
  });
  await page.screenshot({ path: "artifacts/home-walkup.png" });
  await page.waitForFunction(
    () =>
      !(window.__game.homeScene as unknown as IdleScene).previews.get("ct")!.idleVariation.current,
    undefined,
    { timeout: 20_000 },
  );
  const weaponScale = () =>
    page.evaluate(() => {
      const weapon = (window.__game.homeScene as unknown as IdleScene).previews.get("ct")!.weapon;
      return weapon.getWorldScale(weapon.position.clone()).length();
    });
  const restingScale = await weaponScale();
  const stance = () =>
    page.evaluate(() => {
      const preview = (window.__game.homeScene as unknown as IdleScene).previews.get("ct")!;
      preview.action.paused = true;
      return ["pelvis", "ankle_L", "ankle_R"].map((name) => {
        const bone = preview.soldier.model.getObjectByName(name)!;
        return bone.getWorldPosition(bone.position.clone()).toArray();
      });
    });
  for (const kind of ["lookat", "shouldershrug", "weightshift"]) {
    const planted = await stance();
    await page.evaluate((kind) => {
      const preview = (window.__game.homeScene as unknown as IdleScene).previews.get("ct")!;
      const state = preview.idleVariation;
      const index = state.actions.findIndex((action: T.AnimationAction) =>
        action.getClip().name.includes(kind),
      );
      state.last = -1;
      // Exercise the normal random scheduler with a single eligible gesture.
      state.actions = [state.actions[index]!];
      state.wait = 0;
    }, kind);
    await page.waitForFunction(
      () =>
        (window.__game.homeScene as unknown as IdleScene).previews.get("ct")!.idleVariation.current,
    );
    await page.waitForTimeout(2000);
    expect(await weaponScale()).toBeCloseTo(restingScale, 3);
    const during = await stance();
    for (let bone = 0; bone < planted.length; bone++)
      for (let axis = 0; axis < 3; axis++)
        expect(during[bone]![axis]).toBeCloseTo(planted[bone]![axis]!, 5);
    await page.screenshot({ path: `artifacts/home-idle-${kind}.png` });
    await page.waitForFunction(
      () =>
        !(window.__game.homeScene as unknown as IdleScene).previews.get("ct")!.idleVariation
          .current,
      undefined,
      { timeout: 20_000 },
    );
    // Reload the preview to recover its complete native gesture pool.
    if (kind !== "weightshift") {
      await page.evaluate(() =>
        (window.__game.homeScene as unknown as IdleScene).clearPreview("ct"),
      );
      await page.waitForFunction(
        () =>
          (window.__game.homeScene as unknown as IdleScene).previews.get("ct")?.idleVariation
            ?.actions.length === 3,
      );
    }
  }
  expect(errors).toEqual([]);
});
