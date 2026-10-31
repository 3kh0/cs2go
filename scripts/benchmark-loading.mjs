import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({ channel: "chromium" });
const runs = [];
for (let i = 0; i < 3; i++) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (process.env.THROTTLE)
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 40,
      downloadThroughput: (20 * 1024 * 1024) / 8,
      uploadThroughput: (5 * 1024 * 1024) / 8,
    });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    performance.setResourceTimingBufferSize(5000);
    window.loadingLongTasks = [];
    new PerformanceObserver((list) =>
      window.loadingLongTasks.push(
        ...list.getEntries().map((e) => ({ start: e.startTime, duration: e.duration })),
      ),
    ).observe({ type: "longtask", buffered: true });
  });
  await page.goto(process.env.CACHE_URL || "http://127.0.0.1:5188");
  await page.locator("#play").waitFor({ state: "attached" });
  await page.waitForFunction(
    () => !document.querySelector("#play").disabled,
    {},
    { timeout: 180000 },
  );
  if (!(await page.locator("#play").innerText()).includes("PLAY"))
    throw new Error("Startup did not complete");
  const result = await page.evaluate(() => ({
    readyMs: performance.now(),
    resources: performance.getEntriesByType("resource").map((e) => ({
      url: new URL(e.name).pathname,
      start: e.startTime,
      end: e.responseEnd,
      duration: e.duration,
      transfer: e.transferSize,
      bytes: e.encodedBodySize,
    })),
    longTasks: window.loadingLongTasks,
  }));
  result.errors = errors;
  runs.push(result);
  console.log(
    JSON.stringify({
      run: i + 1,
      readyMs: Math.round(result.readyMs),
      requests: result.resources.length,
      transferMiB: +(result.resources.reduce((n, e) => n + e.transfer, 0) / 1048576).toFixed(2),
      longTaskMs: Math.round(result.longTasks.reduce((n, e) => n + e.duration, 0)),
      errors,
    }),
  );
  await context.close();
}
await writeFile(
  process.argv[2] || "artifacts/loading-benchmark.json",
  JSON.stringify(runs, null, 2),
);
await browser.close();
