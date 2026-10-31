import { test, expect } from "@playwright/test";

test("rendered spatial audio follows listener direction, distance, and obstruction", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // Load a tiny same-origin document; this test does not need the map or GPU.
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/spatial-audio-fixture.ts";
    const { renderProbe } = await import(path);
    return {
      right: await renderProbe(3, 3, false),
      turned: await renderProbe(3, 3, false, -Math.PI / 2),
      near: await renderProbe(0, 3, false),
      far: await renderProbe(0, 24, false),
      blocked: await renderProbe(0, 3, true),
    };
  });
  expect(result.right.energy[1]).toBeGreaterThan(result.right.energy[0] * 1.2);
  expect(result.turned.energy[0]).toBeGreaterThan(result.turned.energy[1] * 1.2);
  const total = (probe: { energy: number[] }) => probe.energy[0] + probe.energy[1];
  expect(total(result.near)).toBeGreaterThan(total(result.far) * 20);
  expect(total(result.near)).toBeGreaterThan(total(result.blocked) * 5);
  expect(Object.values(result).every((probe) => probe.voices === 0)).toBe(true);
  expect(errors).toEqual([]);
});

test("expanded firearm clips decode locally and voices stay bounded", async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
  });
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const audioPath = "/src/audio.ts";
    const spatialPath = "/src/spatial-audio.ts";
    const { WeaponAudio } = await import(audioPath);
    const { SpatialAudio } = await import(spatialPath);
    const bank = new WeaponAudio();
    await bank.load();
    const context = new AudioContext();
    bank.spatial = new SpatialAudio();
    const clips: string[] = [];
    for (const weapon of [7, 8, 9, 10, 11]) {
      bank.play(context, "shot", weapon, 100);
      clips.push(bank.lastClip);
    }
    for (let i = 0; i < 100; i++) bank.play(context, "bot", 7, 100);
    const peak = bank.voices.size;
    bank.stop();
    await context.close();
    return {
      clips,
      peak,
      remaining: bank.voices.size,
      decoded: [...bank.buffers.values()].every(
        (buffer: AudioBuffer) => buffer.duration > 0 && buffer.numberOfChannels === 1,
      ),
    };
  });
  expect(result.clips).toEqual(["glock18-1", "deagle-1", "m4a1-1", "nova-1", "mp9-1"]);
  expect(result.decoded).toBe(true);
  expect(result.peak).toBeLessThanOrEqual(32);
  expect(result.remaining).toBe(0);
  expect(external).toEqual([]);
});

test("pooled room convolution produces distinct tails, stops on pause, and diffracts around open corners", async ({
  page,
}) => {
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/spatial-audio-fixture.ts";
    const { renderEnvironment, renderCorner } = await import(path);
    return {
      outside: await renderEnvironment("outside"),
      small: await renderEnvironment("small"),
      large: await renderEnvironment("large"),
      reset: await renderEnvironment("large", true),
      corner: await renderCorner(true),
      wall: await renderCorner(false),
    };
  });
  expect(result.small.tail).toBeGreaterThan(result.outside.tail * 10);
  expect(result.large.late).toBeGreaterThan(result.small.late * 2);
  expect(result.large.convolvers).toBe(2);
  expect(result.reset.convolvers).toBe(0);
  expect(result.reset.tail).toBeLessThan(result.large.tail * 0.001);
  expect(result.corner.energy).toBeGreaterThan(result.wall.energy * 3);
  expect(result.corner.traces).toBeLessThanOrEqual(12);
  expect(result.wall.traces).toBeLessThanOrEqual(12);
});

test("native Dust II acoustic probe coordinates and path matrix agree with map collision", async ({
  page,
}) => {
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/spatial-audio-fixture.ts";
    const { auditNativePathing } = await import(path);
    return auditNativePathing();
  });
  expect(result.probes).toBe(1197);
  expect(result.floorMatches).toBeGreaterThan(160);
  expect(result.upperAgreement / result.count).toBeGreaterThan(0.95);
  expect((result.upperAgreement - result.lowerAgreement) / result.count).toBeGreaterThan(0.08);
});

test("all native CS2 player and UI effects decode from the local startup bank", async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin) external.push(request.url());
  });
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/src/soundscape.ts";
    const { Soundscape } = await import(path);
    const soundscape = new Soundscape();
    await soundscape.load();
    const report = await (await fetch("/audio/cs2-effects-source.json")).json();
    return report.clips.map(({ name }: { name: string }) => {
      const buffer = soundscape.buffers.get(name) as AudioBuffer;
      return {
        name,
        audible:
          buffer.duration > 0 &&
          buffer.numberOfChannels === 1 &&
          buffer.getChannelData(0).some((sample) => Math.abs(sample) > 0.001),
      };
    });
  });
  expect(result).toHaveLength(43);
  expect(result.filter((clip: { audible: boolean }) => !clip.audible)).toEqual([]);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("HE blast carries at distance and survives a burst of quieter cues", async ({ page }) => {
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const soundPath = "/src/soundscape.ts",
      threePath = "/tests/spatial-audio-fixture.ts";
    const { Soundscape } = await import(soundPath);
    const { Vector3 } = await import(threePath);
    const loaded = new Soundscape();
    await loaded.load();
    async function render(distance: number) {
      const offline = new OfflineAudioContext(2, 48000, 48000);
      const sound = new Soundscape();
      sound.buffers = loaded.buffers;
      sound.attach(offline as unknown as AudioContext);
      sound.play("utility-he-explode", false, "sand", new Vector3(0, 0, -distance));
      const blast = [...sound.voices][0];
      for (let i = 0; i < 32; i++) sound.play("step");
      sound.play("death");
      const survives = sound.voices.has(blast);
      const bounded = sound.voices.size <= 16;
      // Isolate the explosion for the audible output measurement.
      for (const voice of sound.voices) if (voice !== blast) voice.stop();
      const output = await offline.startRendering();
      let energy = 0;
      for (let c = 0; c < 2; c++)
        for (const sample of output.getChannelData(c)) energy += sample * sample;
      return { energy, survives, bounded };
    }
    return { near: await render(1), far: await render(8) };
  });
  expect(result.near.survives && result.far.survives).toBe(true);
  expect(result.near.bounded && result.far.bounded).toBe(true);
  expect(result.near.energy).toBeGreaterThan(0.01);
  expect(result.far.energy / result.near.energy).toBeGreaterThan(0.2);
});

test("suppressed USP shots fade out nearby and cannot leak across Dust II or through walls on attack", async ({
  page,
}) => {
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/spatial-audio-fixture.ts";
    const { renderWeaponRange } = await import(path);
    return {
      near: await renderWeaponRange(3, true, false),
      edge: await renderWeaponRange(25, true, false),
      distant: await renderWeaponRange(70, true, false),
      loud: await renderWeaponRange(70, false, false),
      blocked: await renderWeaponRange(3, true, true),
    };
  });
  expect(result.near.energy).toBeGreaterThan(0.01);
  expect(result.edge.energy).toBeLessThan(result.near.energy * 0.001);
  expect(result.distant).toEqual({ energy: 0, attack: 0, allocated: 0 });
  expect(result.loud.energy).toBeGreaterThan(0.001);
  expect(result.blocked.attack).toBeLessThan(result.near.attack * 0.01);
});
