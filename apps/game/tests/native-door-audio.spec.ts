import { expect, test } from "@playwright/test";

test("all native door WAVs decode from the startup bank with their original frames and channels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/src/audio-bank.ts",
      { loadAudioClip } = await import(path);
    const manifest = await (await fetch("/audio/source/map-door-sounds.json")).json();
    return Promise.all(
      manifest.clips.map(
        async (clip: {
          name: string;
          path: string;
          channels: number;
          sampleRate: number;
          durationSeconds: number;
        }) => {
          const audio = await loadAudioClip(clip.path);
          return {
            name: clip.name,
            frames: audio.length,
            expectedFrames: Math.round(clip.durationSeconds * clip.sampleRate),
            channels: audio.numberOfChannels,
            expectedChannels: clip.channels,
            sampleRate: audio.sampleRate,
            expectedRate: clip.sampleRate,
          };
        },
      ),
    );
  });
  expect(results).toHaveLength(20);
  for (const clip of results) {
    expect(clip.frames, clip.name).toBe(clip.expectedFrames);
    expect(clip.channels, clip.name).toBe(clip.expectedChannels);
    expect(clip.sampleRate, clip.name).toBe(clip.expectedRate);
  }
  expect(errors).toEqual([]);
});
