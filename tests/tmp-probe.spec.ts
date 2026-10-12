import { test } from "@playwright/test";
test.setTimeout(90000);
test("probe", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => (window as any).__game.assetsReady);
  const list = () => page.evaluate(() => (window as any).__game.renderer.info.programs.map((p: any) => p.name + "|" + p.cacheKey));
  const a = await list();
  await page.locator("#play").click();
  await page.waitForFunction(() => (window as any).__game.locked);
  const b = await list();
  await page.evaluate(() => new Promise<void>((resolve) => { const g = (window as any).__game; const end = performance.now() + 8000; let worst = 0, at = 0; let last = performance.now(); const tick = (now: number) => { if (now - last > worst) { worst = now - last; at = g.yaw; } last = now; g.yaw += 0.01; if (now < end) requestAnimationFrame(tick); else { (window as any).__worst = [worst, at]; resolve(); } }; requestAnimationFrame(tick); }));
  const c = await list();
  console.log("menu", a.length, "start", b.length, "after", c.length, await page.evaluate(() => (window as any).__worst));
  const diff = (x: string[], y: string[]) => y.filter((k) => !x.includes(k)).map((k) => k.slice(0, 400));
  console.log("NEW AT START\n" + diff(a, b).join("\n---\n"));
  console.log("NEW DURING\n" + diff(b, c).join("\n---\n"));
});
