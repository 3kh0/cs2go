import { expect, test } from "@playwright/test";
import type { MusicKitCatalog } from "../src/music-kits";

test("music kits load on demand, preview variants, equip and persist without downloading the library", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const failed: string[] = [];
  const musicRequests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/audio/music-kits/")) musicRequests.push(path);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && response.url().includes("/audio/music-kits/"))
      failed.push(response.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  expect(musicRequests).toEqual([]);
  await page.locator("#skins-button").click();
  await page.locator("#inventory-music-kits").click();
  const catalog = await page.evaluate(
    async () =>
      (await (await fetch("/audio/music-kits/catalog.json")).json()) as Promise<MusicKitCatalog>,
  );
  await expect(page.locator("[data-music-kit]")).toHaveCount(catalog.kits.length);
  await expect(page.locator('[data-music-kit="valve_cs2_01"]')).toHaveAttribute(
    "data-equipped",
    "true",
  );
  await page.locator("#music-kit-search").fill("ALRT");
  await page.locator('[data-music-kit="alrt_01"]').click();
  await page.locator('[data-music-event="mvp"][data-music-track="1"]').click();
  const rareTrack = catalog.kits.find((kit) => kit.id === "alrt_01")!.events.mvp.tracks[1];
  await expect
    .poll(() =>
      page.evaluate(() => {
        const audio = window.__game.soundscape.music;
        return {
          path: new URL(audio.src).pathname,
          playing: !audio.paused && audio.readyState >= 2,
        };
      }),
    )
    .toEqual({ path: rareTrack, playing: true });
  await expect(page.locator('[data-music-event="mvp"][data-music-track="1"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("#stop-music-kit").click();
  await expect
    .poll(() => page.evaluate(() => new URL(window.__game.soundscape.music.src).pathname))
    .toBe("/audio/music-kits/valve_cs2_01/mainmenu.mp3");
  await page.locator("#equip-music-kit").click();
  await expect(page.locator('[data-music-kit="alrt_01"]')).toHaveAttribute("data-equipped", "true");
  expect(await page.evaluate(() => localStorage.getItem("cs2go-music-kit"))).toBe("alrt_01");
  await page.screenshot({ path: "artifacts/music-kits-equipped.png" });
  await page.reload();
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#settings-button").click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const audio = window.__game.soundscape.music;
        return {
          path: audio.src ? new URL(audio.src).pathname : "",
          playing: !audio.paused && audio.readyState >= 2,
        };
      }),
    )
    .toEqual({ path: "/audio/music-kits/alrt_01/mainmenu.mp3", playing: true });
  const audio = musicRequests.filter((path) => /\.(mp3|flac)$/.test(path));
  expect([...new Set(audio)].sort()).toEqual(
    [
      "/audio/music-kits/alrt_01/mainmenu.mp3",
      rareTrack,
      "/audio/music-kits/valve_cs2_01/mainmenu.mp3",
    ].sort(),
  );
  expect(failed).toEqual([]);
  expect(errors).toEqual([]);
});

test("native lossless tracks and unassigned alternate recordings remain available to preview", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#skins-button").click();
  await page.locator("#inventory-music-kits").click();
  await page.locator("#music-kit-search").fill("Noisia");
  await page.locator('[data-music-kit="noisia_01"]').click();
  await page.locator('[data-music-event="match"][data-music-track="0"]').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const audio = window.__game.soundscape.music;
        return (
          !!audio.src &&
          new URL(audio.src).pathname.endsWith(".flac") &&
          !audio.paused &&
          audio.readyState >= 2 &&
          audio.duration > 0
        );
      }),
    )
    .toBe(true);
  await page.locator("#music-kit-search").fill("Hotline");
  await page.locator('[data-music-kit="hotlinemiami_01"]').click();
  await expect(page.locator('[data-music-event="extra"]')).not.toHaveCount(0);
  await page.locator('[data-music-event="extra"]').first().click();
  await expect
    .poll(() => page.evaluate(() => window.__game.soundscape.musicKits.previewing?.event))
    .toBe("extra");
  await page.locator("#close-music-kits").click();
  await expect(page.locator("#skin-menu")).toBeHidden();
  expect(await page.evaluate(() => window.__game.soundscape.musicKits.previewing)).toBeUndefined();
  expect(errors).toEqual([]);
});

test("round phases select native start, action, warnings, MVP and match-end events", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#settings-button").click();
  const result = await page.evaluate(() => {
    const g = window.__game;
    g.start("casual", { lock: false });
    const transitions: { event: string | null; source: string }[] = [];
    const sample = () =>
      transitions.push({
        event: g.soundscape.currentMusic,
        source: new URL(g.soundscape.music.src).pathname,
      });
    sample();
    g.freezeTime = 0.01;
    g.updateRound(0.02);
    sample();
    g.time = 10.01;
    g.updateRound(0.02);
    sample();
    g.team = "t";
    g.position.set(1100 * 0.0254, 140 * 0.0254, -2500 * 0.0254);
    g.grounded = true;
    g.bomb!.carrier = "player";
    g.bombSelected = true;
    g.bombAutoSelected = true;
    g.bombDrawTime = 0;
    g.keys.add("KeyE");
    g.updateRound(4);
    g.keys.clear();
    sample();
    g.bomb!.timer = 10.01;
    g.updateRound(0.02);
    sample();
    g.kills++;
    g.endRound("t", "Counter-Terrorists eliminated");
    sample();
    g.finish();
    sample();
    g.menu();
    return transitions;
  });
  expect(result.map((state) => state.event)).toEqual([
    "start",
    "action",
    "countdown",
    "bomb",
    "bomb-countdown",
    "mvp",
    "end",
  ]);
  expect(result.map((state) => state.source)).toEqual([
    "/audio/music-kits/valve_cs2_01/startround_01.mp3",
    expect.stringMatching(/\/audio\/music-kits\/valve_cs2_01\/startaction_0[12]\.mp3$/),
    "/audio/music-kits/valve_cs2_01/roundtenseccount.mp3",
    "/audio/music-kits/valve_cs2_01/bombplanted.mp3",
    "/audio/music-kits/valve_cs2_01/bombtenseccount.mp3",
    "/audio/music-kits/valve_cs2_01/roundmvpanthem_01.mp3",
    "/audio/music-kits/valve_cs2_01/endofmatch.mp3",
  ]);
  expect(errors).toEqual([]);
});
