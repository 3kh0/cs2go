import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

for (const profile of ["balanced", "performance", "cpu4x"] as const) {
  test(`casual battle stress and single-pass utility rendering: ${profile}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto("/");
    await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
    await expect(page.locator("#startup")).toBeHidden({ timeout: 20_000 });
    if (profile === "performance") {
      await page.locator("#settings-button").click();
      await page.locator("#quality").selectOption("performance");
      await page.locator("#close-settings").click();
    }
    const captureCPU = process.env.CS2GO_CPU_PROFILE === "1";
    const cdp = await page.context().newCDPSession(page);
    if (profile === "cpu4x") {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    if (captureCPU) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
      await page.exposeFunction("__cs2goStartCPUProfile", () => cdp.send("Profiler.start"));
    }
    const result = await page.evaluate(async () => {
      const g = window.__game;
      g.start("casual", { lock: false });
      g.freezeTime = 0;
      g.locked = true;
      g.settings.fpsCap = 0;
      g.settings.menuFpsCap = 0;
      g.invulnerable = 60;
      const point = g.dust!.navigation.site(0);
      point.y = g.dust!.collision.floor(point.x, point.z, point.y + 3, point.y - 8) + 0.08;
      const eye = point.clone().add(point.clone().set(0, 5, 12));
      g.position.copy(eye);
      g.yaw = 0;
      g.pitch = -0.3;
      g.updateAimCamera();
      // Keep combatants in the same arena, while retaining real bot AI and damage.
      g.bots.forEach((bot, i) => {
        const angle = (i / g.bots.length) * Math.PI * 2;
        bot.group.position
          .copy(point)
          .add(point.clone().set(Math.sin(angle) * 8, 0, Math.cos(angle) * 8));
        bot.memory.copy(point);
        bot.alert = 5;
        bot.nav = 0;
      });
      const detonate = (kind: "smoke" | "molotov" | "incendiary" | "he", i: number) => {
        const position = point
          .clone()
          .add(point.clone().set((i % 4) * 2 - 3, 0, -Math.floor(i / 4) * 3));
        // Fire away from the smoke, so smoke extinguishing does not remove the load.
        if (kind === "molotov" || kind === "incendiary") position.x += 10;
        g.utility.launch(
          kind,
          i % g.bots.length,
          i % 2 ? "t" : "ct",
          position,
          position.clone().set(0, 0, 0),
          0,
        );
        const projectile = g.utility.projectiles.pop();
        if (projectile) {
          g.utility.detonate(projectile);
          g.utility.removeProjectile(projectile);
        }
      };
      for (let i = 0; i < 6; i++) detonate("smoke", i);
      for (let i = 0; i < 8; i++) detonate(i % 2 ? "molotov" : "incendiary", i);
      g.utility.effects.forEach((effect) => {
        effect.age = 1;
      });
      g.utility.renderEffects();
      // Isolate utility draw calls using an otherwise unused camera layer.
      // No simulation or changed camera between these paired renders.
      const visuals = g.utility.effects.flatMap((effect) => (effect.visual ? [effect.visual] : []));
      const cameraMask = g.camera.layers.mask;
      const shadows = g.renderer.shadowMap.autoUpdate;
      g.renderer.shadowMap.autoUpdate = false;
      g.renderer.shadowMap.needsUpdate = false;
      g.camera.layers.set(30);
      const isolated = g.scene.clone(false);
      isolated.background = null;
      const parents = visuals.map((visual) => visual.mesh.parent!);
      for (const visual of visuals) {
        visual.mesh.layers.set(30);
        isolated.add(visual.mesh);
      }
      const count = (single: boolean) => {
        for (const visual of visuals) {
          const material = visual.mesh.material;
          if (!Array.isArray(material)) material.forceSinglePass = single;
        }
        g.renderer.info.autoReset = false;
        g.renderer.info.reset();
        g.renderer.render(isolated, g.camera);
        const calls = g.renderer.info.render.calls;
        g.renderer.info.autoReset = true;
        return calls;
      };
      count(false); // Warm shadow maps and shader programs before either sample.
      const doubleCalls = count(false);
      const singleCalls = count(true);
      g.camera.layers.mask = cameraMask;
      visuals.forEach((visual, i) => {
        visual.mesh.layers.set(0);
        parents[i].add(visual.mesh);
      });
      g.renderer.shadowMap.autoUpdate = shadows;
      const samples: number[] = [];
      const initialBots = g.bots.length;
      let peakEffects = g.utility.effects.length;
      let peakTracers = 0;
      let bursts = 0;
      let actualBotShots = 0;
      let minimumLivingBots = initialBots;
      const worldSound = g.worldSound.bind(g);
      g.worldSound = (kind, position, weapon, suppressed) => {
        if (kind === "bot") actualBotShots++;
        worldSound(kind, position, weapon, suppressed);
      };
      await (
        window as typeof window & {
          __cs2goStartCPUProfile?: () => Promise<void>;
        }
      ).__cs2goStartCPUProfile?.();
      const start = performance.now();
      let previous = start;
      await new Promise<void>((resolve) => {
        const frame = (now: number) => {
          samples.push(now - previous);
          previous = now;
          if (now - start > bursts * 1000 && bursts < 20) {
            detonate("he", bursts + 12);
            if (bursts > 0 && bursts % 7 === 0) {
              for (let i = 0; i < 6; i++) detonate("smoke", i);
              for (let i = 0; i < 8; i++) detonate(i % 2 ? "molotov" : "incendiary", i);
            }
            // Force suppressive combat bursts through the real ammo, hitscan,
            // recoil and audio path, alongside autonomous AI combat.
            g.bots.forEach((bot) => {
              if (bot.health <= 0) return;
              bot.lastSight.copy(point).y += 1.4;
              bot.aim.copy(bot.lastSight);
              bot.suppressTime = 2;
              bot.suppressShots = 3;
              bot.shot = bot.speed = bot.reaction = 0;
              g.botCombat(bot, undefined, 1 / 128);
            });
            bursts++;
          }
          minimumLivingBots = Math.min(
            minimumLivingBots,
            g.bots.filter((bot) => bot.health > 0).length,
          );
          peakEffects = Math.max(peakEffects, g.utility.effects.length);
          peakTracers = Math.max(peakTracers, g.tracers.length);
          if (now - start < 20000 && g.active) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
      samples.sort((a, b) => a - b);
      const percentile = (fraction: number) =>
        samples[Math.min(samples.length - 1, Math.floor(samples.length * fraction))];
      return {
        initialBots,
        minimumLivingBots,
        actualBotShots,
        peakEffects,
        peakTracers,
        bursts,
        doubleCalls,
        singleCalls,
        utilityDrawsSaved: doubleCalls - singleCalls,
        fireClouds: visuals.length,
        nonemptyFireClouds: visuals.filter((visual) => visual.mesh.count > 0).length,
        frames: samples.length,
        medianFrameMs: percentile(0.5),
        p95FrameMs: percentile(0.95),
        p99FrameMs: percentile(0.99),
        framesOver33ms: samples.filter((ms) => ms > 33.34).length,
        elapsedMs: performance.now() - start,
        renderer: (() => {
          const gl = g.renderer.getContext();
          const extension = gl.getExtension("WEBGL_debug_renderer_info");
          return gl.getParameter(extension?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER);
        })(),
      };
    });
    if (captureCPU) {
      const { profile: cpuProfile } = await cdp.send("Profiler.stop");
      const path = `artifacts/casual-stress-${profile}.cpuprofile`;
      await mkdir("artifacts", { recursive: true });
      await writeFile(path, JSON.stringify(cpuProfile));
      await testInfo.attach("casual-stress-cpu-profile", { path, contentType: "application/json" });
      await cdp.send("Profiler.disable");
    }
    console.log("CASUAL_STRESS", profile, JSON.stringify(result));
    await testInfo.attach("casual-stress", {
      body: JSON.stringify(result, null, 2),
      contentType: "application/json",
    });
    await page.screenshot({ path: `artifacts/casual-stress-${profile}.png` });
    // Separate visual inspection fixture after all timed work has finished.
    await page.evaluate(() => {
      const g = window.__game;
      const fire = g.utility.effects.find((effect) => effect.visual && effect.cells.length > 0);
      if (!fire) return;
      for (const effect of g.utility.effects.filter((effect) => effect.smoke)) {
        g.utility.removeEffect(effect);
        g.utility.effects.splice(g.utility.effects.indexOf(effect), 1);
      }
      fire.age = 1;
      g.position.copy(fire.position).add(fire.position.clone().set(0, 2, 5));
      g.yaw = 0;
      g.pitch = -0.25;
      g.updateAimCamera();
    });
    await page.waitForTimeout(100);
    await page.screenshot({ path: `artifacts/casual-stress-fire-${profile}.png` });
    expect(result.initialBots).toBe(19);
    expect(result.fireClouds).toBe(8);
    expect(result.nonemptyFireClouds).toBeGreaterThan(0);
    expect(result.doubleCalls).toBe(result.nonemptyFireClouds * 2);
    expect(result.singleCalls).toBe(result.nonemptyFireClouds);
    expect(result.bursts).toBe(20);
    expect(result.actualBotShots).toBeGreaterThan(0);
    expect(errors).toEqual([]);
  });
}
