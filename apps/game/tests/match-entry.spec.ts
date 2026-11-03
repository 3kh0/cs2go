import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await expect(page.locator("#startup")).toHaveCount(0, { timeout: 100_000 });
  await page.locator("#home-play").click();
});

test("map cards and team selection remain usable across resize, cancel and reopen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const canvasCount = await page.locator("canvas").count();
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 720 },
    { width: 1600, height: 1200 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("button", { name: "Dust II, selected" })).toBeVisible();
    await expect(page.locator("#home-scenery-button")).toBeHidden();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const panel = document.querySelector(".home-match-card")!.getBoundingClientRect();
          const rail = document.querySelector(".home-social")!.getBoundingClientRect();
          return Math.abs(panel.right - rail.left);
        }),
      )
      .toBeLessThan(0.5);
    await page.locator("#play").click();
    await expect(page.locator("#team-select")).toBeVisible();
    await expect(page.locator("#team-auto")).toBeEnabled();
    expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
    expect(await page.locator("#menu").evaluate((node) => (node as HTMLElement).inert)).toBe(true);
    await expect(page.locator("canvas")).toHaveCount(canvasCount);
    const feet = await page.evaluate(async () => {
      const { previewBounds } = await import("../src/preview-framing.ts");
      const game = window.__game;
      const agents = game.scene.getObjectByName("Team selection agents")!;
      return agents.children.map((agent) => {
        const bounds = previewBounds([agent.children[0]!]);
        const center = bounds.getCenter(agent.position.clone());
        const floor = game.dust!.collision.floor(center.x, center.z, bounds.min.y + 0.2);
        return { feet: bounds.min.y, floor };
      });
    });
    expect(feet).toHaveLength(2);
    for (const agent of feet) expect(Math.abs(agent.feet - agent.floor)).toBeLessThan(0.035);
    await page.keyboard.press("Escape");
    await expect(page.locator("#team-select")).toHaveCount(0);
    await expect(page.locator("#play")).toBeFocused();
    expect(await page.evaluate(() => window.__game.teamPreview === undefined)).toBe(true);
    expect(
      await page.evaluate(
        () => window.__game.scene.getObjectByName("Team selection agents") === undefined,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("cancelling preparation releases pointer lock and allows a fresh match", async ({ page }) => {
  await page.evaluate(() => {
    const game = window.__game;
    const warm = game.warmUp.bind(game);
    game.warmUp = async (signal) => {
      game.warmUp = warm;
      document.getElementById("match-loading")!.dataset.testWarming = "true";
      await new Promise<void>((resolve) => {
        signal!.addEventListener("abort", () => resolve(), { once: true });
      });
      signal!.throwIfAborted();
    };
  });
  await page.locator("#play").click();
  await expect(page.locator("#match-loading")).toHaveAttribute("data-test-warming", "true");
  await expect(page.locator("#team-select")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.locator("#match-loading")).toHaveCount(0);
  await expect(page.locator("#menu")).toBeVisible();
  expect(
    await page.evaluate(() => ({
      active: window.__game.active,
      loading: window.__game.matchLoading,
      pointer: !!document.pointerLockElement,
    })),
  ).toEqual({ active: false, loading: false, pointer: false });
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator('#team-select [data-team="t"]').click();
  await page.waitForFunction(
    () => window.__game.active && window.__game.locked && !window.__game.matchLoading,
  );
});

test("preparation errors have a keyboard exit and a successful retry", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.evaluate(() => {
    const game = window.__game;
    const warm = game.warmUp.bind(game);
    game.warmUp = async () => {
      game.warmUp = warm;
      throw new Error("Simulated preparation failure");
    };
  });
  await page.locator("#play").click();
  await expect(page.locator("#match-loading")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#team-select")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "BACK TO MENU" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#match-loading")).toHaveCount(0);
  await expect(page.locator("#home-play")).toBeFocused();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator("#team-auto").click();
  await page.waitForFunction(
    () => window.__game.active && window.__game.locked && !window.__game.matchLoading,
  );
  expect(errors).toEqual([]);
});

test("cancelling a pending native pose load does not leave stale previews on reopen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let release!: () => void;
  let requested!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestStarted = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route("**/agents/inspects/animations/weapon/knife.glb", async (route) => {
    requested();
    await pending;
    await route.continue();
  });
  await page.locator("#play").click();
  await requestStarted;
  await expect(page.locator("#team-select")).toHaveCount(0);
  await expect(page.locator("#match-loading")).toBeVisible();
  await expect(page.getByRole("button", { name: "CANCEL · ESC" })).toBeEnabled();
  await page.keyboard.press("Escape");
  await expect(page.locator("#match-loading")).toHaveCount(0);
  expect(await page.evaluate(() => window.__game.teamPreview === undefined)).toBe(true);
  release();
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await expect(page.locator("#team-auto")).toBeEnabled({ timeout: 30_000 });
  await page.locator('#team-select [data-team="ct"]').click();
  await page.waitForFunction(
    () => window.__game.active && window.__game.locked && !window.__game.matchLoading,
  );
  expect(errors).toEqual([]);
});

for (const team of ["t", "ct"] as const)
  test(`the prepared selector enters ${team} spawn in the selection click without another loader`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.evaluate(() => {
      const game = window.__game;
      const warm = game.warmUp.bind(game);
      game.warmUp = async (signal) => {
        document.getElementById("match-loading")!.dataset.testWarming = "true";
        await new Promise((resolve) => setTimeout(resolve, 250));
        await warm(signal);
      };
    });
    await page.locator("#play").click();
    await expect(page.locator("#match-loading")).toHaveAttribute("data-test-warming", "true");
    await expect(page.locator("#team-select")).toHaveCount(0);
    await expect(page.locator("#team-auto")).toBeEnabled();
    await expect(page.locator("#match-loading")).toHaveCount(0);
    await expect(page.getByText("Loading agents…", { exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => window.__game.active)).toBe(false);
    const choice = page.locator(`#team-select [data-team="${team}"]`);
    await choice.evaluate((button) => {
      window.__game.warmUp = async () => {
        throw new Error("Warm-up after selection");
      };
      button.addEventListener(
        "click",
        () => {
          const game = window.__game;
          button.setAttribute(
            "data-entry",
            JSON.stringify({
              active: game.active,
              loading: game.matchLoading,
              loader: !!document.getElementById("match-loading"),
              selector: !!document.getElementById("team-select"),
              team: game.team,
              bots: game.bots.length,
              position: game.position.toArray(),
              spawn: game.dust!.navigation.data.spawns[game.team][0],
            }),
          );
          document.body.dataset.testEntry = button.getAttribute("data-entry")!;
        },
        { once: true },
      );
    });
    await choice.click();
    const entry = await page.evaluate(() => JSON.parse(document.body.dataset.testEntry!));
    expect(entry).toMatchObject({
      active: true,
      loading: false,
      loader: false,
      selector: false,
      team,
      bots: 19,
    });
    expect(entry.position[0]).toBe(entry.spawn[0]);
    expect(entry.position[2]).toBe(entry.spawn[2]);
    await page.waitForFunction(() => window.__game.locked);
    await expect(page.locator("#hud")).toBeVisible();
    expect(errors).toEqual([]);
  });

test("native selection preserves both wrists, clip timing and dagger contacts", async ({
  page,
}) => {
  const poses = await page.evaluate(async () => {
    const { createSoldier, disposeSoldier } = await import("../src/soldier.ts");
    const { prepareTeamAgent } = await import("../src/team-pose.ts");
    const { knifeDefinitions } = await import("../src/physics.ts");
    const { previewBounds } = await import("../src/preview-framing.ts");
    const knives = [
      window.__game.knife,
      knifeDefinitions.find((knife) => knife.token === "knife_push")!.id,
    ];
    const results = [];
    for (const knife of knives)
      for (const team of ["t", "ct"] as const) {
        const soldier = createSoldier(-1, team);
        const pose = await prepareTeamAgent(soldier, knife, new AbortController().signal);
        try {
          const wrists: number[] = [];
          const knifeDistances: number[] = [];
          const sampleWrists = () => {
            if (knife === knives[0]) {
              const center = previewBounds([soldier.weapon]).getCenter(
                soldier.weapon.position.clone(),
              );
              knifeDistances.push(
                Math.min(
                  ...[soldier.leftHand, soldier.rightHand].map((hand) =>
                    center.distanceTo(hand.getWorldPosition(hand.position.clone())),
                  ),
                ),
              );
            }
            if (team !== "ct" || knife !== knives[0]) return;
            for (const [side, hand] of [
              ["L", soldier.leftHand],
              ["R", soldier.rightHand],
            ] as const) {
              const target = soldier.model.getObjectByName(`wpnHand_${side}`)!;
              wrists.push(
                target
                  .getWorldPosition(target.position.clone())
                  .distanceTo(hand.getWorldPosition(hand.position.clone())),
              );
            }
          };
          sampleWrists();
          const started = soldier.mixer.time;
          pose.update(0.5);
          sampleWrists();
          const elapsed = soldier.mixer.time - started;
          const contacts = [];
          for (const side of ["l", "r"]) {
            const helper = soldier.weapon.getObjectByName(`weapon_hand_${side}`);
            if (helper) {
              const hand = side === "l" ? soldier.leftHand : soldier.rightHand;
              contacts.push(
                helper
                  .getWorldPosition(helper.position.clone())
                  .distanceTo(hand.getWorldPosition(hand.position.clone())),
              );
            }
          }
          const moved = soldier.head.quaternion.toArray();
          pose.update(1);
          sampleWrists();
          const animationMoves = soldier.head.quaternion
            .toArray()
            .some((value, i) => Math.abs(value - moved[i]!) > 0.00001);
          pose.update(3);
          sampleWrists();
          pose.update(60);
          sampleWrists();
          const held = soldier.head.quaternion.toArray();
          pose.update(1);
          results.push({
            name: pose.name,
            elapsed,
            animationMoves,
            contacts,
            wrists,
            knifeDistances,
            held,
            ended: soldier.head.quaternion.toArray(),
          });
        } finally {
          pose.release();
          disposeSoldier(soldier);
        }
      }
    return results;
  });
  for (const pose of poses) {
    expect(pose.elapsed).toBeCloseTo(0.5, 5);
    expect(pose.animationMoves).toBe(true);
    expect(pose.ended).toEqual(pose.held);
    for (const distance of pose.knifeDistances)
      expect(distance, `${pose.name}: knife stays in hand`).toBeLessThan(0.25);
    for (const distance of [...pose.contacts, ...pose.wrists])
      expect(distance, pose.name).toBeLessThan(0.001);
  }
});
