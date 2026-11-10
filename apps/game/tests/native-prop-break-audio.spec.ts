import { expect, test } from "@playwright/test";

test("native prop PCM clips decode from the mixed startup bank without encoding or channel loss", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/src/audio-bank.ts",
      { loadAudioClip } = await import(path);
    const native = await (await fetch("/audio/source/prop-break-sounds.json")).json();
    return Promise.all(
      native.clips.map(
        async (clip: {
          path: string;
          channels: number;
          sampleRate: number;
          sampleFrames: number;
        }) => {
          const decoded = await loadAudioClip(clip.path);
          return {
            path: clip.path,
            channels: decoded.numberOfChannels,
            expectedChannels: clip.channels,
            rate: decoded.sampleRate,
            duration: decoded.duration,
            expectedDuration: clip.sampleFrames / clip.sampleRate,
          };
        },
      ),
    );
  });
  expect(results.length).toBeGreaterThan(0);
  for (const row of results) {
    expect(row.channels, row.path).toBe(row.expectedChannels);
    expect(row.rate).toBe(44100);
    expect(Math.abs(row.duration - row.expectedDuration), row.path).toBeLessThanOrEqual(1 / 44100);
  }
  expect(errors).toEqual([]);
});
