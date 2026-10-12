import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";
test.setTimeout(120000);
test.use({
  deviceScaleFactor: Number(process.env.DPR ?? 2),
  launchOptions: { args: ["--disable-gpu-vsync", "--disable-frame-rate-limit"] },
});
test("perf profile", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.waitForFunction(() => (window as any).__game.locked);
  const gl = await page.evaluate(() => {
    const g = (window as any).__game;
    const ctx = g.renderer.getContext();
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    return ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "?";
  });
  await page.evaluate(() => {
    const g = (window as any).__game,
      r = g.renderer,
      orig = r.render.bind(r);
    (window as any).__main = {};
    r.render = (scene: any, cam: any) => {
      orig(scene, cam);
      if (scene === g.scene) (window as any).__main = { ...r.info.render };
    };
  });
  await page.waitForTimeout(1500);
  const client = await page.context().newCDPSession(page);
  await client.send("Profiler.enable");
  await client.send("Profiler.setSamplingInterval", { interval: 200 });
  await client.send("Profiler.start");
  const frames = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const g = (window as any).__game;
        const out: number[] = [];
        let last = performance.now();
        const end = last + 8000;
        let t0 = 0;
        const tick = (now: number) => {
          out.push(now - last);
          last = now;
          g.yaw += 0.01; // sweep view across the map
          if (now < end) requestAnimationFrame(tick);
          else resolve(out);
        };
        requestAnimationFrame(tick);
        void t0;
      }),
  );
  const { profile } = await client.send("Profiler.stop");
  const info = await page.evaluate(() => {
    const g = (window as any).__game;
    const r = g.renderer;
    let tex = 0,
      texBytes = 0,
      skinned = 0,
      meshes = 0,
      tris = 0;
    const seen = new Set();
    g.scene.traverse((o: any) => {
      if (o.isSkinnedMesh) skinned++;
      if (o.isMesh) meshes++;
      const m = o.material;
      for (const mat of Array.isArray(m) ? m : m ? [m] : [])
        for (const k of Object.keys(mat)) {
          const t = mat[k];
          if (t && t.isTexture && t.image && !seen.has(t)) {
            seen.add(t);
            tex++;
            texBytes += (t.image.width || 0) * (t.image.height || 0) * 4 * 1.33;
          }
        }
    });
    void tris;
    return {
      render: r.info.render,
      memory: r.info.memory,
      programs: r.info.programs?.length,
      tex,
      texMB: Math.round(texBytes / 1e6),
      skinned,
      meshes,
      pixelRatio: r.getPixelRatio(),
      heapMB: Math.round((performance as any).memory?.usedJSHeapSize / 1e6),
      bots: g.bots.length,
      main: (window as any).__main,
      size: [g.renderer.domElement.width, g.renderer.domElement.height],
    };
  });
  const sorted = [...frames].sort((a, b) => a - b);
  const pct = (p: number) => sorted[Math.floor(sorted.length * p)].toFixed(2);
  // self time per function
  const self = new Map<string, number>();
  const byId = new Map<number, any>(profile.nodes.map((n: any) => [n.id, n]));
  const dts = profile.timeDeltas;
  profile.samples.forEach((id: number, i: number) => {
    const n = byId.get(id);
    const cf = n.callFrame;
    const key = `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (dts[i] ?? 0) / 1000);
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 35);
  const report = {
    gl,
    frames: frames.length,
    avg: (frames.reduce((a, b) => a + b, 0) / frames.length).toFixed(2),
    p50: pct(0.5),
    p95: pct(0.95),
    p99: pct(0.99),
    max: sorted[sorted.length - 1].toFixed(1),
    over20: frames.filter((f) => f > 20).length,
    info,
    totalMs: total.toFixed(0),
    top: top.map(
      ([k, v]) => `${v.toFixed(0).padStart(6)}ms ${((v / total) * 100).toFixed(1)}% ${k}`,
    ),
  };
  writeFileSync(
    `artifacts/perf/${process.env.TAG ?? "base"}.json`,
    JSON.stringify(report, null, 2),
  );
  writeFileSync(`artifacts/perf/${process.env.TAG ?? "base"}.cpuprofile`, JSON.stringify(profile));
});
