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

test("C4 equips with 5 at native draw speed, plants after rounds, and shows carrier/alert HUD", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  const external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:5173") external.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="t"]').click();
  await page.waitForFunction(() => window.__game.locked);
  await page.evaluate(() => {
    const g = window.__game;
    g.simulate = () => {};
    g.freezeTime = 0;
    g.bomb!.carrier = "player";
    g.position.fromArray(g.dust!.navigation.data.sites[1]);
    g.velocity.x = g.velocity.z = 0;
    g.grounded = true;
    g.bots.forEach((bot, i) => bot.group.position.set(200 + i, 500, 200));
    const played: { cue: string; audible: boolean }[] = [];
    const play = g.soundscape.play.bind(g.soundscape);
    g.soundscape.play = (...args) => {
      const voice = play(...args);
      if (args[0] === "bomb-draw" || args[0].startsWith("bomb-key-")) {
        const samples = voice?.buffer?.getChannelData(0);
        played.push({ cue: args[0], audible: !!samples?.some((value) => Math.abs(value) > 0.01) });
      }
      return voice;
    };
    Object.assign(window, { bombAudio: played });
    g.updateUI();
  });
  await expect(page.getByRole("img", { name: "Carrying the bomb", exact: true })).toBeVisible();
  const icon = await page.locator("#bomb-carrier").boundingBox();
  const radar = await page.locator("#radar").boundingBox();
  expect(icon!.y).toBeGreaterThanOrEqual(radar!.y + radar!.height);
  await page.keyboard.press("5");
  await page.waitForFunction(() => window.__game.bombSelected && window.__game.bombView.visible);
  await expect(page.locator('#inventory [aria-label="C4, equipped"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  const pose = () =>
    page.evaluate(() =>
      window.__game.bombView.getObjectByName("vmrig_wpn")!.matrixWorld.elements.slice(),
    );
  const initial = await pose();
  await page.screenshot({ path: "artifacts/c4-native-draw-start.png" });
  for (const [name, dt] of [
    ["middle", 0.6],
    ["late", 0.5],
  ] as const) {
    await page.evaluate((dt) => window.__game.updateRound(dt), dt);
    await page.waitForTimeout(100);
    expect(await pose()).not.toEqual(initial);
    expect(await page.evaluate(() => window.__game.bombDrawTime)).toBeGreaterThan(0);
    expect(await page.evaluate(() => window.__game.bomb!.plantProgress)).toBe(0);
    await page.screenshot({ path: `artifacts/c4-native-draw-${name}.png` });
  }
  await page.evaluate(() => window.__game.updateRound(0.11));
  const ammo = await page.evaluate(() => window.__game.ammo);
  await page.mouse.down();
  await page.evaluate(() => window.__game.updateRound(0.8));
  await expect(page.locator("#bomb-action")).toHaveAttribute("data-action", "plant");
  expect(await page.evaluate(() => window.__game.ammo)).toBe(ammo);
  await page.screenshot({ path: "artifacts/c4-native-keypad.png" });
  await page.mouse.up();
  await page.evaluate(() => window.__game.updateRound(1 / 128));
  expect(await page.evaluate(() => window.__game.bomb!.plantProgress)).toBe(0);
  // Start another plant after a settled round; its result and payout stay settled.
  const settled = await page.evaluate(() => {
    const g = window.__game;
    g.endRound("t", "Counter-Terrorists eliminated");
    return { money: g.money, scores: { ...g.teamScores }, round: g.round };
  });
  await page.mouse.down();
  for (const progress of [0.7, 1.7, 3.05]) {
    await page.evaluate((progress) => {
      const g = window.__game;
      g.updateRound(progress - g.bomb!.plantProgress);
    }, progress);
    await page.waitForTimeout(100);
  }
  expect(await page.evaluate(() => window.__game.planting)).toBe(true);
  await page.screenshot({ path: "artifacts/c4-post-round-placement.png" });
  await page.evaluate(() => window.__game.updateRound(0.16));
  await page.mouse.up();
  expect(await page.evaluate(() => window.__game.bomb!.planted)).toBe(true);
  expect(
    await page.evaluate(() => ({
      money: window.__game.money,
      scores: window.__game.teamScores,
      round: window.__game.round,
    })),
  ).toEqual(settled);
  await expect(page.locator("#bomb-carrier")).toBeHidden();
  await expect(page.locator("#hud-alert")).toHaveAttribute("data-type", "bomb-planted");
  const typography = await page.evaluate(() => {
    const text = getComputedStyle(document.getElementById("hud-alert-text")!);
    const detail = getComputedStyle(document.getElementById("hud-alert-detail")!);
    const label = getComputedStyle(document.getElementById("bomb-action-label")!);
    const countdown = getComputedStyle(document.getElementById("bomb-action-time")!);
    return {
      font: text.fontFamily,
      detailFont: detail.fontFamily,
      label: label.fontFamily,
      countdown: countdown.fontFamily,
      color: text.color,
      detailColor: detail.color,
    };
  });
  expect(typography.font).toBe(typography.detailFont);
  expect(typography.label).toBe(typography.countdown);
  expect(typography.color).toBe("rgb(255, 92, 78)");
  expect(typography.detailColor).toBe(typography.color);
  await page.screenshot({ path: "artifacts/c4-red-planted-alert.png" });
  const audio = await page.evaluate(
    () => (window as unknown as { bombAudio: { cue: string; audible: boolean }[] }).bombAudio,
  );
  expect(audio.filter((entry) => entry.cue === "bomb-draw")).toHaveLength(1);
  expect(audio.slice(-7).map((entry) => entry.cue)).toEqual(
    Array.from({ length: 7 }, (_, i) => `bomb-key-${i + 1}`),
  );
  expect(audio.every((entry) => entry.audible)).toBe(true);
  expect(await page.evaluate(() => window.__game.soundscape.context?.state)).toBe("running");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
