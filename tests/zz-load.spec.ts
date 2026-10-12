import { test } from "@playwright/test";
test("load time", async ({ page }) => {
  const t0 = Date.now();
  await page.goto("/");
  await page.waitForFunction(
    () => !(document.getElementById("play") as HTMLButtonElement).disabled,
    null,
    { timeout: 60000 },
  );
  const ready = Date.now() - t0;
  await page.locator("#play").click();
  await page.waitForFunction(() => (window as any).__game.locked);
  const t1 = Date.now();
  await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
  );
  console.log(
    process.env.TAG,
    "ready",
    ready,
    "first frames",
    Date.now() - t1,
    "heap",
    await page.evaluate(() => Math.round((performance as any).memory.usedJSHeapSize / 1e6)),
  );
});
