import { test } from "@playwright/test";
test.use({ deviceScaleFactor: 2 });
test("map shot", async ({ page }) => {
  await page.goto("/");
  await page.locator("#play").click();
  await page.waitForFunction(() => (window as any).__game.locked);
  const name = process.env.SHOT ?? "x";
  const fmt = await page.evaluate(() => {
    const g = (window as any).__game,
      formats: Record<string, number> = {};
    g.scene.traverse((o: any) => {
      const m = o.material;
      if (m?.map)
        formats[m.map.isCompressedTexture ? "compressed:" + m.map.format : "rgba"] =
          (formats[m.map.isCompressedTexture ? "compressed:" + m.map.format : "rgba"] ?? 0) + 1;
    });
    return formats;
  });
  console.log(name, JSON.stringify(fmt));
  const start = process.env.POS ? JSON.parse(process.env.POS) : null;
  const pos = start ?? (await page.evaluate(() => (window as any).__game.position.toArray()));
  console.log("POS", JSON.stringify(pos));
  for (const [i, yaw, pitch] of [
    [0, 0, -0.05],
    [1, 1.6, -0.05],
    [2, 3.1, -0.05],
    [3, 0.6, -0.6],
  ] as const) {
    await page.evaluate(
      ([yaw, pitch, pos]: any) => {
        const g = (window as any).__game;
        for (const b of g.bots) b.group.visible = false;
        g.yaw = yaw;
        g.pitch = pitch;
        g.position.fromArray(pos);
      },
      [yaw, pitch, pos] as any,
    );
    await page.waitForTimeout(700);
    await page.screenshot({ path: `artifacts/map-${name}-${i}.png` });
  }
});
