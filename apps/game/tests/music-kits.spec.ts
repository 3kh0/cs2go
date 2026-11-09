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
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/audio/music-kits/")) musicRequests.push(path);
  });
  page.on("response", (response) => {
    if (
      response.status() >= 400 &&
      /\/(?:audio\/music-kits|models\/music-kit)\//.test(response.url())
    )
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
  await page.locator("#inspect-music-kit").click();
  await expect(page.locator("#music-kit-stage")).toHaveAttribute("data-kit", "alrt_01", {
    timeout: 30_000,
  });
  await expect
    .poll(() => page.evaluate(() => window.__game.soundscape.musicKits.previewing?.event))
    .toBe("menu");
  const stage = page.locator("#music-kit-stage");
  const initialYaw = await stage.getAttribute("data-yaw");
  const bounds = (await stage.boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 120, bounds.y + bounds.height / 2 + 35, {
    steps: 8,
  });
  await page.mouse.up();
  expect(await stage.getAttribute("data-yaw")).not.toBe(initialYaw);
  await stage.press("Home");
  await page.screenshot({ path: "artifacts/music-kit-3d-inspect.png" });
  await page.locator("#music-kit-audio").click();
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
  await page.locator("#close-music-kit-inspect").click();
  await expect(page.locator("#music-kit-inspect")).toBeHidden();
  await expect
    .poll(() => page.evaluate(() => new URL(window.__game.soundscape.music.src).pathname))
    .toBe("/audio/music-kits/valve_cs2_01/mainmenu.mp3");
  await page.locator('[data-music-kit="alrt_01"]').click();
  await page.locator("#equip-music-kit").click();
  await expect(page.locator('[data-music-kit="alrt_01"]')).toHaveAttribute("data-equipped", "true");
  expect(await page.evaluate(() => localStorage.getItem("cs2go-music-kit"))).toBe("alrt_01");
  await page.screenshot({ path: "artifacts/music-kits-equipped.png" });
  await page.reload();
  await page.waitForFunction(() => window.__game?.assetsReady, null, { timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
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
  const audio = musicRequests.filter((path) => /\.(mp3|opus)$/.test(path));
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

test("Opus tracks decode and seek, native loop bounds remain intact, and alternate recordings preview", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await page.locator("#skins-button").click();
  await page.locator("#inventory-music-kits").click();
  await page.locator("#music-kit-search").fill("Noisia");
  await page.locator('[data-music-kit="noisia_01"]').click();
  await page.locator("#inspect-music-kit").click();
  await page.locator("#music-kit-audio").click();
  await page.locator('[data-music-event="match"][data-music-track="0"]').click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const audio = window.__game.soundscape.music;
        return (
          !!audio.src &&
          new URL(audio.src).pathname.endsWith(".opus") &&
          !audio.paused &&
          audio.readyState >= 2 &&
          audio.duration > 0 &&
          audio.currentTime > 0.1
        );
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    window.__game.soundscape.music.currentTime = 2;
  });
  await expect
    .poll(() => page.evaluate(() => window.__game.soundscape.music.currentTime))
    .toBeGreaterThan(2.1);
  // Converted tracks do not declare native loops. Exercise an unchanged MP3
  // round-start segment to ensure catalog rewriting preserves authored bounds.
  const loop = await page.evaluate(async () => {
    const catalog = (await (
      await fetch("/audio/music-kits/catalog.json")
    ).json()) as MusicKitCatalog;
    const kit = catalog.kits.find((entry) => entry.id === "noisia_01")!;
    await window.__game.soundscape.musicKits.setKit(kit.id);
    window.__game.soundscape.playMusic("start");
    return kit.events.start;
  });
  await expect
    .poll(() =>
      page.evaluate((tracks) => {
        const audio = window.__game.soundscape.music;
        return (
          tracks.includes(new URL(audio.src).pathname) && !audio.paused && audio.readyState >= 2
        );
      }, loop.tracks),
    )
    .toBe(true);
  const bounds = await page.evaluate(({ tracks, starts, ends }) => {
    const audio = window.__game.soundscape.music;
    const index = tracks.indexOf(new URL(audio.src).pathname);
    const start = starts![index],
      end = ends![index];
    audio.currentTime = end - 0.02;
    return { start, end };
  }, loop);
  await expect
    .poll(() =>
      page.evaluate(({ start }) => {
        const audio = window.__game.soundscape.music;
        return !audio.paused && audio.currentTime >= start && audio.currentTime < start + 2;
      }, bounds),
    )
    .toBe(true);
  await page.locator("#close-music-kit-inspect").click();
  await page.locator("#music-kit-search").fill("Hotline");
  await page.locator('[data-music-kit="hotlinemiami_01"]').click();
  await page.locator("#inspect-music-kit").click();
  await page.locator("#music-kit-audio").click();
  await expect(page.locator('[data-music-event="extra"]')).not.toHaveCount(0);
  await page.locator('[data-music-event="extra"]').first().click();
  await expect
    .poll(() => page.evaluate(() => window.__game.soundscape.musicKits.previewing?.event))
    .toBe("extra");
  await page.keyboard.press("Escape");
  await expect(page.locator("#music-kit-inspect")).toBeHidden();
  await expect(page.locator("#skin-menu")).toBeVisible();
  await page.keyboard.press("Escape");
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
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
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
