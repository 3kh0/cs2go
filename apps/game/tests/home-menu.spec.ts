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
      mixer: T.AnimationMixer;
      index: number;
      weapon: T.Group;
      idleVariation: {
        actions: T.AnimationAction[];
        current?: T.AnimationAction;
        entrance?: T.AnimationAction;
        idle?: T.AnimationAction;
        initialized?: boolean;
        anchor?: T.Object3D;
        returning: boolean;
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
  await expect(page.locator("#home-agent-stage")).toHaveAttribute(
    "data-clip",
    /^(t_buymenu_m4a4|ct_main_menu_rifle_idle)/,
  );
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
  await page.keyboard.press("Escape");
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
    "PRIVATE MATCHMAKING",
  ]);
  await page.getByRole("button", { name: "PRIVATE MATCHMAKING", exact: true }).click();
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
  await expect(page.locator("#home-agent-stage")).toHaveAttribute(
    "data-clip",
    /^(t_buymenu_m4a4|ct_main_menu_rifle_idle)/,
  );
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
    return {
      fog: !!scene.fog,
      backdropCount: scene.getObjectByName("home-haze")!.children.length,
      shadowLights,
    };
  });
  expect(atmosphere.fog).toBe(true);
  expect(atmosphere.backdropCount).toBe(15); // 14 native backdrops plus ground dust.
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

test("homepage preserves authored native body poses and weapon anchors", async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  for (const team of ["ct", "t"] as const) {
    await selectHomeTeam(page, team);
    await page.waitForFunction(
      (team) => {
        const state = (window.__game.homeScene as unknown as IdleScene).previews.get(
          team,
        )?.idleVariation;
        return state?.initialized;
      },
      team,
      { timeout: 60_000 },
    );
    const kinds = await page.evaluate((team) => {
      const state = (window.__game.homeScene as unknown as IdleScene).previews.get(
        team,
      )!.idleVariation;
      return ["idle", "walkup", ...state.actions.map((action) => action.getClip().name)];
    }, team);
    for (const kind of kinds) {
      for (const fraction of [0.15, 0.45, 0.8]) {
        const result = await page.evaluate(
          async ({ team, kind, fraction }) => {
            const { acquireAgentAnimation, ensureAgentAnimationBones } =
              await import("../src/agent-animations");
            const preview = (window.__game.homeScene as unknown as IdleScene).previews.get(team)!;
            const state = preview.idleVariation;
            const action =
              kind === "idle"
                ? state.idle!
                : kind === "walkup"
                  ? state.entrance!
                  : state.actions.find((action) => action.getClip().name === kind)!;
            // Exercise the actual body mixer with one absolute native pose.
            preview.mixer.stopAllAction();
            state.current = kind === "idle" ? undefined : action;
            state.wait = 100;
            state.returning = false;
            action.reset().setEffectiveWeight(1).play();
            action.paused = true;
            action.time = action.getClip().duration * fraction;
            preview.mixer.update(0);
            const catalog = await (await import("../src/agent-animations")).loadAgentAnimations();
            const definition = catalog.find((clip) => clip.name === action.getClip().name)!;
            const source = await acquireAgentAnimation(definition.id);
            const reference = preview.soldier.model.clone(true);
            ensureAgentAnimationBones(reference, source.pack.scene);
            const Mixer = preview.mixer.constructor as typeof T.AnimationMixer;
            const sourceMixer = new Mixer(reference);
            sourceMixer.clipAction(source.clip).play();
            sourceMixer.update(action.time);
            let positionError = 0,
              rotationError = 0;
            for (const name of [
              "pelvis",
              "head_0",
              "arm_upper_R",
              "arm_lower_R",
              "hand_R",
              "hand_L",
              "ankle_L",
              "ankle_R",
              "wpn",
            ]) {
              const actual = preview.soldier.model.getObjectByName(name)!;
              const expected = reference.getObjectByName(name)!;
              positionError = Math.max(
                positionError,
                actual.position.distanceTo(expected.position),
              );
              rotationError = Math.max(
                rotationError,
                actual.quaternion
                  .clone()
                  .normalize()
                  .angleTo(expected.quaternion.clone().normalize()),
              );
            }
            sourceMixer.stopAllAction();
            sourceMixer.uncacheRoot(reference);
            source.release();
            const allowedPacks = await (
              await import("../src/agent-animations")
            ).agentWeaponAnimationPacks(preview.index);
            return {
              positionError,
              rotationError,
              weaponCompatible:
                allowedPacks.includes(definition.pack) && definition.equipped === "weapon",
            };
          },
          { team, kind, fraction },
        );
        expect(result.weaponCompatible).toBe(true);
        expect(result.positionError).toBeLessThan(0.0001);
        expect(result.rotationError).toBeLessThan(0.0001);
        await page.waitForTimeout(100);
        const attachmentError = await page.evaluate((team) => {
          const preview = (window.__game.homeScene as unknown as IdleScene).previews.get(team)!;
          const anchor = preview.idleVariation.anchor!;
          const matrix = preview.weapon.matrixWorld
            .clone()
            .multiply(
              preview.weapon.matrixWorld.clone().fromArray(preview.weapon.userData.buyGrip),
            );
          const position = preview.weapon.position.clone().setFromMatrixPosition(matrix);
          const hand = preview.soldier.model.getObjectByName("hand_R")!;
          const grip = preview.soldier.model.getObjectByName("wpnHand_R")!;
          return {
            anchor: position.distanceTo(anchor.getWorldPosition(position.clone())),
            hand: hand
              .getWorldPosition(position.clone())
              .distanceTo(grip.getWorldPosition(position.clone())),
          };
        }, team);
        expect(attachmentError.anchor).toBeLessThan(0.001);
        expect(attachmentError.hand).toBeLessThan(0.12);
        if (fraction === 0.45)
          await page.screenshot({
            path: `artifacts/native-pose-${team}-${kind.replaceAll(/[^a-z0-9_-]/gi, "_")}.png`,
          });
      }
    }
  }
  expect(errors).toEqual([]);
});
