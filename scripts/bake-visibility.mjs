// Bakes models/maps/<map>-visibility.json, the per-NAV-area potentially
// visible sets used for occlusion culling. It renders the real dev build in
// Chromium, so run it after any map geometry or material change:
//   bun scripts/bake-visibility.mjs [map ...]
// BAKE_URL reuses a running dev server instead of starting one.
import { spawn } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("../", import.meta.url));
const maps = `${root}packages/assets/public/models/maps/`;
const requested = process.argv.slice(2);
const available = (await readdir(maps))
  .filter((name) => name.endsWith("-nav.json"))
  .map((name) => name.slice(0, -"-nav.json".length));
const targets = requested.length ? requested : available;
for (const map of targets) if (!available.includes(map)) throw new Error(`Unknown map: ${map}`);

const manifest = JSON.parse(await readFile(`${root}packages/assets/manifest.json`, "utf8"));
/** Every scenery model the map can load, keyed by asset path. */
async function sources(map) {
  const config = JSON.parse(await readFile(`${maps}${map}-config.json`, "utf8").catch(() => "{}"));
  const model = (config.model ?? `/models/maps/${map}.glb.gz`).slice(1);
  const result = {};
  for (const [path, entry] of Object.entries(manifest.files))
    if (
      path === model ||
      (path.startsWith(`models/maps/${map}`) &&
        /\.glb(\.gz)?$/.test(path) &&
        !path.endsWith("-physics.glb.gz"))
    )
      result[path] = entry.sha256;
  if (!result[model]) throw new Error(`${model} is missing from the asset manifest`);
  return result;
}

// Loading a map is slow while other bakes share the GPU and dev server.
const LOAD_TIMEOUT = 20 * 60_000;
let server;
const url = process.env.BAKE_URL ?? "http://127.0.0.1:5198";
if (!process.env.BAKE_URL) {
  server = spawn("bun", ["run", "dev", "--host", "127.0.0.1", "--port", "5198", "--strictPort"], {
    cwd: `${root}apps/game`,
    stdio: "ignore",
  });
  for (let i = 0; ; i++) {
    if (
      await fetch(url).then(
        (response) => response.ok,
        () => false,
      )
    )
      break;
    if (i > 120) throw new Error("Dev server did not start");
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
const browser = await chromium.launch({ channel: "chromium" });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on("pageerror", (error) => console.error(error));
  page.on("console", (message) => {
    if (message.type() === "error") console.error(`console: ${message.text().slice(0, 300)}`);
  });
  await page.exposeFunction("bakeProgress", (map, done, total) =>
    process.stdout.write(`\r${map}: ${done}/${total} areas`),
  );
  for (const map of targets) {
    const started = performance.now();
    await page.goto(url, { waitUntil: "load" });
    await page.waitForFunction(() => window.__game?.assetsReady, null, { timeout: LOAD_TIMEOUT });
    console.log(`${map}: assets ready`);
    await page.locator("#home-play").click();
    await page.locator('[data-session="single"]').click();
    await page.locator(`[data-map="${map}"]`).first().click();
    await page.locator("#play").click();
    await page.locator('#team-select [data-team="ct"]').click({ timeout: LOAD_TIMEOUT });
    await page.waitForFunction(() => window.__game.active && !window.__game.matchLoading, null, {
      timeout: LOAD_TIMEOUT,
    });
    console.log(`${map}: match started`);
    const { data, report } = await page.evaluate(async (map) => {
      const bake = await import("/src/map-visibility-bake.ts");
      const game = window.__game;
      const data = await bake.bakeMapVisibility(game, {
        progress: (done, total) => window.bakeProgress(map, done, total),
      });
      const visibility = bake.MapVisibility.create(
        data,
        game.world.scenery,
        game.world.navigation,
        [...game.world.doorView.objects(), ...game.world.breakableView.objects()],
      );
      if (!visibility) throw new Error("The fresh bake does not match the loaded scenery");
      const report = await bake.validateMapVisibility(game, visibility, { views: 400 });
      return { data, report };
    }, map);
    data.sources = await sources(map);
    const out = `${maps}${map}-visibility.json`;
    await writeFile(out, JSON.stringify(data) + "\n");
    const minutes = ((performance.now() - started) / 60_000).toFixed(1);
    console.log(
      `\n${map}: ${data.units.length} draws, ${data.areas.length} areas, ${minutes} min; ` +
        `${(report.culledShare * 100).toFixed(0)}% culled on average, ` +
        `${report.failing}/${report.views - report.offNav} validation views lost pixels`,
    );
    for (const view of report.worst.slice(0, 5)) console.log(JSON.stringify(view));
  }
} finally {
  await browser.close();
  server?.kill();
}
console.log("Run `bun run assets:prepare` to add the bakes to the asset manifest.");
