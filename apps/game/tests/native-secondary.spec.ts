import { expect, test } from "@playwright/test";

test("native world reload keeps body and skinned magazine on the same authored clock", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.evaluate(async () => {
    const three = "/tests/three-fixture.ts";
    const T = (await import(three)) as typeof import("three");
    const home = window.__game.homeScene!;
    await home.playAnimation("ct", "world/rifle/rifle_ak::reload_ak");
    const preview = (
      home as unknown as {
        previews: Map<
          string,
          { action: import("three").AnimationAction; soldier: { group: import("three").Group } }
        >;
      }
    ).previews.get("ct")!;
    preview.action.paused = true;
    // The native home camera looks nearly down the muzzle. Keep the real
    // renderer/actor/attachment path, but photograph the upper body from the
    // side so magazine removal and the two hand contacts are actually visible.
    const fixture = home as unknown as {
      cameraPosition: import("three").Vector3;
      cameraRotation: import("three").Quaternion;
      framing: WeakMap<object, import("three").Box3>;
    };
    const target = preview.soldier.group.getWorldPosition(new T.Vector3());
    target.y += 1.2;
    const offset = fixture.cameraPosition
      .clone()
      .sub(target)
      .setY(0)
      .normalize()
      .applyAxisAngle(T.Object3D.DEFAULT_UP, T.MathUtils.degToRad(65))
      .multiplyScalar(3);
    const camera = home.backgroundCamera;
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    fixture.cameraPosition.copy(camera.position);
    fixture.cameraRotation.copy(camera.quaternion);
    fixture.framing.delete(preview);
  });
  const frames = [];
  for (const time of [0, 0.4333274066, 0.7666561604, 1.2, 2.3, 0]) {
    const sample = await page.evaluate(async (time) => {
      const path = "/src/weapon-motion.ts",
        three = "/tests/three-fixture.ts";
      const { nativeWorldRig } = (await import(path)) as typeof import("../src/weapon-motion");
      const T = (await import(three)) as typeof import("three");
      const home = window.__game.homeScene!;
      const preview = (
        home as unknown as {
          previews: Map<
            string,
            {
              action: import("three").AnimationAction;
              mixer: import("three").AnimationMixer;
              weapon: import("three").Group;
              secondary: { update(): void };
            }
          >;
        }
      ).previews.get("ct")!;
      preview.action.time = time;
      preview.mixer.update(0);
      // Render the actual application path, including animated wpn attachment.
      home.render(window.__game.renderer, "ct", 0);
      const rig = nativeWorldRig(preview.weapon)!;
      const magazine = rig.model.getObjectByName("clip")!;
      const position = preview.weapon.worldToLocal(magazine.getWorldPosition(new T.Vector3()));
      const size = new T.Box3().setFromObject(preview.weapon, true).getSize(new T.Vector3());
      let skinned = 0;
      rig.model.traverse((node) => {
        if (node instanceof T.SkinnedMesh) skinned++;
      });
      return {
        time: preview.action.time,
        magazine: position.toArray(),
        scale: magazine.getWorldScale(new T.Vector3()).toArray(),
        size: size.toArray(),
        skinned,
      };
    }, time);
    frames.push(sample);
    expect(sample.skinned).toBeGreaterThan(0);
    expect(sample.size.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...sample.size)).toBeLessThan(2);
    if (time !== 0 || frames.length === 1)
      await page.screenshot({ path: `artifacts/native-world-reload-${frames.length - 1}.png` });
  }
  const distance = (a: number[], b: number[]) => Math.hypot(...a.map((value, i) => value - b[i]));
  expect(distance(frames[0].magazine, frames[2].magazine)).toBeCloseTo(0.7107803839, 4);
  expect(distance(frames[0].magazine, frames.at(-1)!.magazine)).toBeLessThan(1e-5);
  expect(distance(frames[0].scale, frames.at(-1)!.scale)).toBeLessThan(1e-5);
  await page.evaluate(async () => {
    const home = window.__game.homeScene!;
    await home.playAnimation("ct", "world/pistol/pistol_elite::reload_elite");
    const preview = (
      home as unknown as { previews: Map<string, { action: import("three").AnimationAction }> }
    ).previews.get("ct")!;
    preview.action.paused = true;
  });
  const dual = [];
  for (const time of [0, 0.9000079036, 2.9000253677]) {
    dual.push(
      await page.evaluate(async (time) => {
        const path = "/src/weapon-motion.ts",
          three = "/tests/three-fixture.ts";
        const { nativeWorldRig } = (await import(path)) as typeof import("../src/weapon-motion");
        const T = (await import(three)) as typeof import("three");
        const home = window.__game.homeScene!;
        const preview = (
          home as unknown as {
            previews: Map<
              string,
              {
                action: import("three").AnimationAction;
                mixer: import("three").AnimationMixer;
                weapon: import("three").Group;
              }
            >;
          }
        ).previews.get("ct")!;
        preview.action.time = time;
        preview.mixer.update(0);
        home.render(window.__game.renderer, "ct", 0);
        const rig = nativeWorldRig(preview.weapon)!;
        return ["weapon_hand_l", "weapon_hand_r"].map((name) =>
          preview.weapon
            .worldToLocal(rig.model.getObjectByName(name)!.getWorldPosition(new T.Vector3()))
            .toArray(),
        );
      }, time),
    );
    await page.screenshot({ path: `artifacts/native-world-elite-reload-${dual.length - 1}.png` });
  }
  expect(distance(dual[0][1], dual[1][1])).toBeCloseTo(0.4196650179, 4);
  expect(distance(dual[0][0], dual[2][0])).toBeCloseTo(0.3268550022, 4);
  expect(errors).toEqual([]);
});
