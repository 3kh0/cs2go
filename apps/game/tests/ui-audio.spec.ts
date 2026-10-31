import { expect, test } from "@playwright/test";
import type { Game } from "../src/game";
import cues from "../src/data/ui-cues.json";
declare global {
  interface Window {
    __game: Game;
    uiCalls: string[];
  }
}

test("native UI cues route trusted nested, forwarded and keyboard actions once and honor mute", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 100_000 });
  await page.evaluate(() => {
    const sounds = window.__game.soundscape;
    window.uiCalls = [];
    const original = sounds.playUi.bind(sounds);
    sounds.playUi = (kind) => {
      window.uiCalls.push(kind);
      original(kind);
    };
  });
  await page.locator("#home-loadout strong").click();
  await expect(page.locator("#loadout-editor")).toBeVisible();
  expect(await page.evaluate(() => window.uiCalls.filter((cue) => cue === "loadout"))).toEqual([
    "loadout",
  ]);
  await page.locator("#close-loadout-editor").click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(80);
  await page.evaluate(() => {
    window.uiCalls = [];
  });
  await page.locator("#settings-button img").hover();
  const settingsBox = (await page.locator("#settings-button").boundingBox())!;
  await page.mouse.move(settingsBox.x + 3, settingsBox.y + 3);
  expect(await page.evaluate(() => window.uiCalls.filter((cue) => cue === "main-hover"))).toEqual([
    "main-hover",
  ]);
  await page.evaluate(() => {
    window.uiCalls = [];
  });
  await page.locator("#settings-button img").click();
  await expect(page.locator("#settings")).toBeVisible();
  expect(await page.evaluate(() => window.uiCalls.filter((cue) => cue === "settings"))).toEqual([
    "settings",
  ]);
  expect(await page.evaluate(() => window.uiCalls.includes("settings-layer"))).toBe(true);
  await page.locator('[role="tab"]').filter({ hasText: "Audio" }).click();
  await page.evaluate(() => {
    window.uiCalls = [];
  });
  await page.locator("#musicVolume").focus();
  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => window.uiCalls.filter((cue) => cue === "change"))).toEqual([
    "change",
  ]);
  await page.locator("#close-settings").click();
  await page.evaluate(() => {
    window.uiCalls = [];
    document.getElementById("skins-button")!.focus();
  });
  await page.keyboard.press("Enter");
  await expect(page.locator("#skin-menu")).toBeVisible();
  expect(await page.evaluate(() => window.uiCalls.filter((cue) => cue === "inventory"))).toEqual([
    "inventory",
  ]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#skin-menu")).toBeHidden();
  expect(
    await page.evaluate(() => window.uiCalls.filter((cue) => cue === "inspect-close")),
  ).toEqual(["inspect-close"]);
  const proof = await page.evaluate((definitions) => {
    const s = window.__game.soundscape;
    s.stop();
    s.setVolume(60, 0, 100);
    const played = Object.entries(definitions).map(([kind, setting]) => {
      const buffer = s.buffers.get(setting.clip)!;
      let peak = 0;
      for (const value of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(value));
      return { kind, channels: buffer.numberOfChannels, duration: buffer.duration, peak };
    });
    const source = s.play("hover", false, "sand", undefined, definitions.hover)!;
    const pitch = source.playbackRate.value;
    s.stop();
    s.setVolume(60, 0, 0);
    s.playUi("select");
    const effectsMuted = s.voices.size;
    s.setVolume(0, 0, 100);
    s.playUi("select");
    const masterMuted = s.voices.size;
    window.uiCalls = [];
    // Forwarded/programmatic clicks must never become a second native activation.
    document.getElementById("home-button")!.click();
    return {
      played,
      pitch,
      effectsMuted,
      masterMuted,
      synthetic: window.uiCalls,
      state: s.context?.state,
    };
  }, cues);
  expect(proof.state).toBe("running");
  expect(proof.pitch).toBeCloseTo(1.4);
  expect(proof.effectsMuted).toBe(0);
  expect(proof.masterMuted).toBe(0);
  expect(proof.synthetic).toEqual([]);
  for (const clip of proof.played) {
    expect(clip.duration, clip.kind).toBeGreaterThan(0);
    expect(clip.peak, clip.kind).toBeGreaterThan(0.001);
  }
  expect(proof.played.find((clip) => clip.kind === "settings")?.channels).toBe(2);
  expect(errors).toEqual([]);
});
