import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

// A repeatable rendering workload, not live battle FPS or a portable timing gate.
test("native casual render workload with animated actors and overlapping smoke", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const compare = process.env.CS2GO_RENDER_COMPARE === "1";
  if (compare) {
    await mkdir("artifacts", { recursive: true });
    // Keep source-local imports valid when the committed renderer is copied
    // into the ignored fixture directory for the optional same-pose comparison.
    const committed = execFileSync("git", ["show", "HEAD:apps/game/src/smoke-renderer.ts"], {
      encoding: "utf8",
    });
    await writeFile(
      "artifacts/render-baseline.ts",
      committed.replace(/from (["'])\.\//g, "from $1/src/"),
    );
  }
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toBeHidden();
  const results = await page.evaluate(async (compare) => {
    const g = window.__game;
    g.start("casual", { lock: false });
    g.assetsReady = false; // Suspend automatic rendering/simulation during manual sampling.
    const point = g.dust!.navigation.site(0);
    point.y = g.dust!.collision.floor(point.x, point.z, point.y + 3, point.y - 8) + 0.08;
    g.position.copy(point).add(point.clone().set(0, 5, 14));
    g.yaw = 0;
    g.pitch = -0.3;
    g.updateAimCamera();
    for (const [index, bot] of g.bots.entries()) {
      bot.group.position
        .copy(point)
        .add(point.clone().set((index % 5) * 2 - 4, 0, -Math.floor(index / 5) * 2));
      bot.group.visible = true;
      bot.speed = 2;
      bot.health = 100;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
    const sceneUpdate = g.scene.updateMatrixWorld;
    let sceneUpdates = 0;
    g.scene.updateMatrixWorld = function (force) {
      sceneUpdates++;
      return sceneUpdate.call(this, force);
    };
    const skeletons = new Set<import("three").Skeleton>();
    g.scene.traverse((object) => {
      if ("skeleton" in object) skeletons.add((object as import("three").SkinnedMesh).skeleton);
    });
    // Bodies and carried equipment have distinct palettes. Count both groups
    // instead of assuming that every actor owns only one skeleton.
    const bodySkeletons = new Set<import("three").Skeleton>();
    for (const bot of g.bots)
      bot.rig.model.traverse((object) => {
        if ("skeleton" in object)
          bodySkeletons.add((object as import("three").SkinnedMesh).skeleton);
      });
    const versions = () =>
      [...skeletons].reduce((sum, skeleton) => sum + (skeleton.boneTexture?.version ?? 0), 0);
    const output = [];
    const optimized = g.utility.smokeComposite;
    const baselinePath = "/artifacts/render-baseline.ts";
    const baseline = compare ? new (await import(baselinePath)).SmokeComposite() : undefined;
    try {
      for (const clouds of [0, 6]) {
        g.utility.reset();
        for (let index = 0; index < clouds; index++) {
          const position = point
            .clone()
            .add(point.clone().set((index % 3) * 2 - 2, 0, -Math.floor(index / 3) * 2));
          g.utility.launch("smoke", "player", g.team, position, position.clone().set(0, 0, 0), 0);
          const projectile = g.utility.projectiles.pop()!;
          g.utility.detonate(projectile);
          g.utility.removeProjectile(projectile);
        }
        g.utility.effects.forEach((effect) => {
          effect.age = 2;
        });
        g.utility.renderEffects();
        const runs = (baseline ? [baseline, optimized] : [optimized]).map((composite) => ({
          composite,
          cpu: [] as number[],
          total: [] as number[],
          calls: [] as number[],
          updates: 0,
          paletteUpdates: 0,
          bodyPaletteUpdates: 0,
          maxBodyPaletteUpdates: 0,
          equipmentPaletteUpdates: 0,
          maxEquipmentPaletteUpdates: 0,
        }));
        const warmup = compare ? 24 : 6;
        const samples = compare ? 96 : 48;
        // Measure both implementations at each identical pose. Reverse their
        // order every frame to reduce shader warm-up and host-clock bias.
        for (let frame = 0; frame < warmup + samples; frame++) {
          g.bots.forEach((bot) => {
            bot.anim = 1 / 60;
            bot.rig.time = frame / 60;
            bot.rig.stride = 2 / 2.1;
          });
          g.animateBots();
          for (let index = 0; index < runs.length; index++) {
            const run = runs[(index + frame) % runs.length];
            g.utility.smokeComposite = run.composite;
            const beforeUpdates = sceneUpdates,
              beforeVersions = versions();
            const paletteVersions = [...skeletons].map(
              (skeleton) => [skeleton, skeleton.boneTexture?.version ?? 0] as const,
            );
            g.renderer.info.autoReset = false;
            g.renderer.info.reset();
            const before = performance.now();
            g.renderer.clear();
            g.utility.renderWorld();
            const submitted = performance.now();
            g.renderer.getContext().finish();
            if (frame >= warmup) {
              run.cpu.push(submitted - before);
              run.total.push(performance.now() - before);
              run.calls.push(g.renderer.info.render.calls);
              run.updates += sceneUpdates - beforeUpdates;
              run.paletteUpdates += versions() - beforeVersions;
              for (const [skeleton, version] of paletteVersions) {
                const updates = (skeleton.boneTexture?.version ?? 0) - version;
                if (bodySkeletons.has(skeleton)) {
                  run.bodyPaletteUpdates += updates;
                  run.maxBodyPaletteUpdates = Math.max(run.maxBodyPaletteUpdates, updates);
                } else {
                  run.equipmentPaletteUpdates += updates;
                  run.maxEquipmentPaletteUpdates = Math.max(
                    run.maxEquipmentPaletteUpdates,
                    updates,
                  );
                }
              }
            }
            g.renderer.info.autoReset = true;
          }
        }
        for (const run of runs) {
          const percentile = (values: number[], fraction: number) =>
            [...values].sort((a, b) => a - b)[Math.floor(values.length * fraction)];
          output.push({
            implementation: run.composite === optimized ? "optimized" : "baseline",
            clouds,
            actors: g.bots.length,
            samples: run.cpu.length,
            medianSubmitMs: percentile(run.cpu, 0.5),
            p95SubmitMs: percentile(run.cpu, 0.95),
            medianCompletedMs: percentile(run.total, 0.5),
            p95CompletedMs: percentile(run.total, 0.95),
            medianCalls: percentile(run.calls, 0.5),
            sceneUpdatesPerFrame: run.updates / run.cpu.length,
            paletteUpdatesPerFrame: run.paletteUpdates / run.cpu.length,
            bodySkeletons: bodySkeletons.size,
            bodyPaletteUpdatesPerFrame: run.bodyPaletteUpdates / run.cpu.length,
            maxBodyPaletteUpdatesPerFrame: run.maxBodyPaletteUpdates,
            equipmentSkeletons: skeletons.size - bodySkeletons.size,
            equipmentPaletteUpdatesPerFrame: run.equipmentPaletteUpdates / run.cpu.length,
            maxEquipmentPaletteUpdatesPerFrame: run.maxEquipmentPaletteUpdates,
          });
        }
      }
      return output;
    } finally {
      g.scene.updateMatrixWorld = sceneUpdate;
      g.utility.smokeComposite = optimized;
      baseline?.target?.dispose();
      g.assetsReady = true;
    }
  }, compare);
  console.log("RENDER_WORKLOAD", JSON.stringify(results));
  await mkdir("artifacts", { recursive: true });
  await writeFile("artifacts/render-workload.json", JSON.stringify(results, null, 2));
  await page.screenshot({ path: "artifacts/render-workload.png" });
  expect(
    results.every((result) => result.actors === 19 && result.samples === (compare ? 96 : 48)),
  ).toBe(true);
  for (const result of results.filter((result) => result.implementation === "optimized")) {
    expect(result.sceneUpdatesPerFrame).toBe(1);
    expect(result.bodySkeletons).toBe(result.actors);
    expect(result.bodyPaletteUpdatesPerFrame).toBeGreaterThan(0);
    expect(result.bodyPaletteUpdatesPerFrame).toBeLessThanOrEqual(result.bodySkeletons);
    expect(result.maxBodyPaletteUpdatesPerFrame).toBeLessThanOrEqual(1);
    expect(result.equipmentSkeletons).toBeGreaterThan(0);
    expect(result.equipmentPaletteUpdatesPerFrame).toBeGreaterThan(0);
    expect(result.equipmentPaletteUpdatesPerFrame).toBeLessThanOrEqual(result.equipmentSkeletons);
    expect(result.maxEquipmentPaletteUpdatesPerFrame).toBeLessThanOrEqual(1);
  }
  expect(errors).toEqual([]);
});
