import { expect, test } from "@playwright/test";
import { joinLobby, lobbyPin } from "./multiplayer-helpers";

test("C4 source recordings remain audible across actual crate cover and crowded footsteps", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const soundPath = "/src/soundscape.ts",
      threePath = "/tests/spatial-audio-fixture.ts";
    const { Soundscape } = await import(soundPath);
    const { Vector3, auditC4Cover } = await import(threePath);
    const cover = await auditC4Cover();
    const loaded = new Soundscape();
    await loaded.load();
    async function render(cue: string, listener: number[], crowd = false) {
      const context = new OfflineAudioContext(2, 144000, 48000);
      const sound = new Soundscape();
      sound.buffers = loaded.buffers;
      sound.attach(context as unknown as AudioContext);
      sound.spatial.position.fromArray(listener);
      context.listener.positionX.value = listener[0];
      context.listener.positionY.value = listener[1];
      context.listener.positionZ.value = listener[2];
      sound.spatial.obstructed = cover.obstructed;
      const voice = sound.play(cue, false, "concrete", new Vector3().fromArray(cover.bomb));
      if (!voice) throw new Error(`Missing decoded native C4 ${cue}`);
      if (crowd) for (let i = 0; i < 64; i++) sound.play("step");
      const survives = sound.voices.has(voice),
        peak = sound.voices.size;
      for (const other of sound.voices) if (other !== voice) other.stop();
      const buffer = await context.startRendering();
      let energy = 0;
      for (let channel = 0; channel < 2; channel++)
        for (const sample of buffer.getChannelData(channel)) energy += sample * sample;
      return { energy, survives, peak, seconds: voice.buffer!.duration };
    }
    const near = await render("bomb-beep", cover.open),
      blocked = await render("bomb-beep", cover.blocked, true);
    const defuse = await render("bomb-defuse-start", cover.blocked, true);
    const fast = await render("bomb-beep-fast", cover.blocked);
    return {
      near,
      blocked,
      defuse,
      fast,
      crate: cover.crate,
      clear: cover.clear,
      occluded: cover.occluded,
      rawFloorOccluded: cover.rawFloorOccluded,
    };
  });
  console.log("C4 measured native-crate audio", JSON.stringify(result));
  expect(result.clear).toBe(true);
  expect(result.occluded).toBe(true);
  expect(result.near.energy).toBeGreaterThan(0.01);
  expect(result.blocked.energy / result.near.energy).toBeGreaterThan(0.2);
  expect(result.defuse.energy).toBeGreaterThan(0.01);
  expect(result.fast.energy).toBeGreaterThan(0.001);
  expect(result.fast.seconds).toBeLessThan(result.near.seconds);
  expect(result.blocked.survives && result.defuse.survives).toBe(true);
  expect(result.blocked.peak).toBeLessThanOrEqual(16);
});

test("nearby multiplayer clients hear each CT defuse attempt and the complete plant sequence", async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const contexts = [await browser.newContext(), await browser.newContext()];
  const [ct, t] = await Promise.all(contexts.map((c) => c.newPage()));
  const room = `c4-native-${Date.now()}`;
  const errors: string[] = [];
  for (const page of [ct, t]) page.on("pageerror", (e) => errors.push(e.message));
  const command = async (op: string) => {
    const r = await request.post("http://127.0.0.1:3004", { data: { room: lobbyPin(room), op } });
    expect(r.ok()).toBe(true);
  };
  try {
    await joinLobby(ct, room, "ct");
    await joinLobby(t, room, "t");
    for (const page of [ct, t])
      await page.evaluate(() => {
        const sound = window.__game.soundscape,
          play = sound.play.bind(sound);
        const heard: { cue: string; seconds: number; position: boolean }[] = [];
        sound.play = (...args) => {
          const voice = play(...args);
          if (voice && args[0].startsWith("bomb-"))
            heard.push({ cue: args[0], seconds: voice.buffer!.duration, position: !!args[3] });
          return voice;
        };
        Object.assign(window, { c4Heard: heard });
      });
    await command("plant");
    await t.bringToFront();
    if (!(await t.evaluate(() => window.__game.locked))) await t.locator("#game").click();
    await t.keyboard.press("5");
    await t.waitForFunction(() => window.__game.bombSelected && window.__game.bombDrawTime === 0);
    await t.mouse.down();
    await t.waitForFunction(() => window.__game.bomb?.planted, null, { timeout: 10000 });
    await t.mouse.up();
    await ct.waitForFunction(() => window.__game.bomb?.planted);
    for (const page of [ct, t]) {
      const heard = await page.evaluate(() =>
        (window as unknown as { c4Heard: { cue: string }[] }).c4Heard.map((x) => x.cue),
      );
      expect(heard).toContain("bomb-initiate");
      expect(heard.filter((x) => x.startsWith("bomb-key-"))).toHaveLength(7);
      expect(heard).toContain("bomb-plant");
    }
    await command("defuse");
    await ct.bringToFront();
    if (!(await ct.evaluate(() => window.__game.locked))) await ct.locator("#game").click();
    await ct.keyboard.down("KeyE");
    await ct.waitForFunction(() => (window.__game.bomb?.progress ?? 0) > 0.3);
    await ct.keyboard.up("KeyE");
    await ct.waitForFunction(() => window.__game.bomb?.defuser === null);
    await ct.waitForTimeout(550);
    await ct.keyboard.down("KeyE");
    await ct.waitForFunction(() => (window.__game.bomb?.progress ?? 0) > 0.3);
    await ct.keyboard.up("KeyE");
    for (const page of [ct, t]) {
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as unknown as { c4Heard: { cue: string }[] }).c4Heard.filter(
                (x) => x.cue === "bomb-defuse-start",
              ).length,
          ),
        )
        .toBe(2);
      const clips = await page.evaluate(() =>
        (
          window as unknown as { c4Heard: { cue: string; seconds: number; position: boolean }[] }
        ).c4Heard.filter((x) => x.cue === "bomb-defuse-start"),
      );
      expect(clips.every((x) => x.seconds > 1 && x.position)).toBe(true);
      const energy = await page.evaluate(async () => {
        const path = "/src/soundscape.ts";
        const { Soundscape } = await import(path);
        const g = window.__game,
          context = new OfflineAudioContext(2, 144000, 48000);
        const sound = new Soundscape();
        sound.buffers = g.soundscape.buffers;
        sound.attach(context as unknown as AudioContext);
        sound.spatial.position.copy(g.camera.position);
        context.listener.positionX.value = g.camera.position.x;
        context.listener.positionY.value = g.camera.position.y;
        context.listener.positionZ.value = g.camera.position.z;
        sound.spatial.obstructed = (from: import("three").Vector3, to: import("three").Vector3) =>
          !g.visible(from, to);
        sound.play("bomb-defuse-start", false, "concrete", g.bomb!.position);
        const output = await context.startRendering();
        let energy = 0;
        for (let channel = 0; channel < 2; channel++)
          for (const sample of output.getChannelData(channel)) energy += sample * sample;
        return energy;
      });
      expect(energy).toBeGreaterThan(0.01);
    }
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
  }
});
