import { afterEach, expect, test, vi } from "vitest";
import { KitMusicPlayer, musicEnvelope, musicTrackIndex } from "./music-player";
import { defaultMusicKitId, type MusicKitCatalog } from "./music-kits";

const players: KitMusicPlayer[] = [];
afterEach(() => {
  for (const player of players.splice(0)) player.play(null);
  vi.useRealTimers();
});

const catalog: MusicKitCatalog = {
  version: 1,
  defaultKitId: "valve_cs2_01",
  kits: [
    {
      id: "valve_cs2_01",
      name: "CS2",
      image: "/default.png",
      events: {
        menu: { tracks: ["/audio/default-menu.mp3"], loop: true },
        win: { tracks: ["/audio/default-win.mp3"] },
      },
    },
    {
      id: "other",
      name: "Another kit",
      image: "/other.png",
      events: {
        menu: { tracks: ["/audio/other-menu.mp3"], loop: true },
        deathcam: { tracks: ["/audio/other-death.mp3"] },
        mvp: { tracks: ["/audio/anthem-a.mp3", "/audio/anthem-b.mp3"] },
      },
    },
  ],
};
function fixture(saved?: string, loader = async () => catalog) {
  const createAudio = () => {
    const audio = {
      src: "",
      paused: true,
      loop: false,
      volume: 1,
      preload: "",
      currentTime: 0,
      duration: 100,
      readyState: 1,
      onended: null as (() => void) | null,
      play: vi.fn(() => {
        audio.paused = false;
        return Promise.resolve();
      }),
      pause: vi.fn(() => {
        audio.paused = true;
      }),
      removeAttribute: vi.fn(() => {
        audio.src = "";
      }),
      load: vi.fn(),
    };
    return audio;
  };
  const audio = createAudio();
  const created = [audio];
  const storage = { getItem: vi.fn(() => saved ?? null), setItem: vi.fn() };
  const load = vi.fn(loader);
  const player = new KitMusicPlayer(audio as unknown as HTMLAudioElement, storage, load, () => {
    const next = createAudio();
    created.push(next);
    return next as unknown as HTMLAudioElement;
  });
  players.push(player);
  return { player, audio, storage, load, created };
}
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

test("default menu starts synchronously without fetching the kit library", () => {
  const { player, audio, load } = fixture();
  player.play("menu");
  expect(load).not.toHaveBeenCalled();
  expect(audio.src).toBe("/audio/music-kits/valve_cs2_01/mainmenu.mp3");
  expect(audio.loop).toBe(true);
  expect(audio.play).toHaveBeenCalledOnce();
  player.play("menu");
  expect(audio.play).toHaveBeenCalledOnce();
});

test("late catalog loading cannot resurrect a superseded music event", async () => {
  let ready!: (value: MusicKitCatalog) => void;
  const { player, audio, load } = fixture(
    "other",
    () =>
      new Promise((resolve) => {
        ready = resolve;
      }),
  );
  player.play("menu");
  player.play("deathcam");
  expect(load).toHaveBeenCalledOnce();
  expect(audio.play).not.toHaveBeenCalled();
  ready(catalog);
  await settle();
  expect(audio.src).toBe("/audio/other-death.mp3");
  expect(audio.play).toHaveBeenCalledOnce();
  expect(player.currentMusic).toBe("deathcam");
});

test("preview variants share one player and restore the equipped background when closed", async () => {
  const { player, audio } = fixture();
  player.setVolume(80, 50);
  player.play("menu");
  player.preview(catalog.kits[1], "mvp", 1);
  expect(audio.src).toBe("/audio/anthem-b.mp3");
  expect(audio.loop).toBe(false);
  expect(audio.volume).toBeCloseTo(0.4);
  expect(player.currentMusic).toBe("menu");
  // Generic menu gestures must not interrupt an active inventory preview.
  player.play("menu");
  expect(audio.src).toBe("/audio/anthem-b.mp3");
  player.stopPreview();
  expect(audio.src).toBe("/audio/music-kits/valve_cs2_01/mainmenu.mp3");
  expect(player.previewing).toBeUndefined();
  player.preview(catalog.kits[1], "mvp", 0);
  audio.onended!();
  expect(audio.src).toBe("/audio/music-kits/valve_cs2_01/mainmenu.mp3");
});

test("new gameplay events cancel previews, while missing optional events stay silent", async () => {
  const { player, audio } = fixture("other");
  player.play("menu");
  await settle();
  player.preview(catalog.kits[1], "mvp", 1);
  player.play("deathcam");
  await settle();
  expect(player.previewing).toBeUndefined();
  expect(audio.src).toBe("/audio/other-death.mp3");
  player.play("bomb");
  await settle();
  expect(audio.paused).toBe(true);
  expect(audio.src).toBe("");
  player.play("bomb");
  await settle();
  expect(audio.paused).toBe(true);
  expect(audio.src).toBe("");
});

test("equipping persists native kit ID and replaces the active event without starting other tracks", async () => {
  const { player, audio, storage } = fixture();
  player.play("menu");
  await player.setKit("other");
  await settle();
  expect(player.kitId).toBe("other");
  expect(storage.setItem).toHaveBeenLastCalledWith("cs2go-music-kit", "other");
  expect(audio.src).toBe("/audio/other-menu.mp3");
  await player.setKit(catalog.defaultKitId);
  await settle();
  expect(player.kitId).toBe(defaultMusicKitId);
  expect(audio.src).toBe("/audio/music-kits/valve_cs2_01/mainmenu.mp3");
});

test("round win does not automatically play an MVP anthem, and silence aborts the current stream", () => {
  const { player, audio } = fixture();
  player.play("win");
  audio.paused = true;
  audio.onended!();
  expect(player.currentMusic).toBeNull();
  expect(audio.src).toBe("");
  player.play(null);
  expect(audio.src).toBe("");
  expect(audio.paused).toBe(true);
});

test("native variant weights and fade envelopes retain their authored proportions", () => {
  const cue = {
    tracks: ["a", "b"],
    weights: [0.8, 0.2],
    fadeIn: { start: 4, end: 12, from: 1, to: 0.2 },
  };
  expect(musicTrackIndex(cue, 0.799)).toBe(0);
  expect(musicTrackIndex(cue, 0.8)).toBe(1);
  expect(musicEnvelope(cue, 0)).toBe(1);
  expect(musicEnvelope(cue, 8)).toBeCloseTo(0.6);
  expect(musicEnvelope(cue, 20)).toBeCloseTo(0.2);
});

test("authored loop bounds and stop times do not play the unused recording tail", async () => {
  vi.useFakeTimers();
  const timed = structuredClone(catalog);
  timed.kits[1].events.start = {
    tracks: ["/audio/loop.mp3"],
    loop: true,
    starts: [0.5],
    ends: [3],
    stopAfter: 5,
  };
  const { player, audio } = fixture("other", async () => timed);
  player.play("start");
  await settle();
  expect(audio.currentTime).toBe(0.5);
  audio.currentTime = 3.1;
  await vi.advanceTimersByTimeAsync(30);
  expect(audio.currentTime).toBeCloseTo(0.6);
  await vi.advanceTimersByTimeAsync(5000);
  expect(player.currentMusic).toBeNull();
  expect(audio.paused).toBe(true);
  expect(audio.src).toBe("");
});

test("crossfades stay bounded to two streams and previews cancel every outgoing voice", async () => {
  vi.useFakeTimers();
  const { player, audio, created } = fixture();
  player.play("start");
  player.play("action");
  expect(created.filter((item) => !item.paused)).toHaveLength(2);
  expect(audio.src).toBe("/audio/music-kits/valve_cs2_01/startround_01.mp3");
  await vi.advanceTimersByTimeAsync(1600);
  expect(audio.src).toBe("");
  expect(audio.paused).toBe(true);
  player.play("bomb");
  expect(created.filter((item) => !item.paused)).toHaveLength(2);
  player.preview(catalog.kits[1], "mvp", 0);
  expect(created.filter((item) => !item.paused)).toHaveLength(1);
  expect(player.audio.src).toBe("/audio/anthem-a.mp3");
  player.stopPreview();
  expect(player.audio.src).toBe("/audio/music-kits/valve_cs2_01/bombplanted.mp3");
  player.suspend();
  expect(created.every((item) => item.paused)).toBe(true);
});

test("offset loops without an explicit endpoint return to the authored start, including natural ended fallback", async () => {
  vi.useFakeTimers();
  const timed = structuredClone(catalog);
  timed.kits[1].events.action = { tracks: ["/audio/offset-loop.mp3"], loop: true, starts: [0.51] };
  const { player, audio } = fixture("other", async () => timed);
  player.play("action");
  await settle();
  expect(audio.loop).toBe(false);
  expect(audio.currentTime).toBe(0.51);
  audio.currentTime = 100.01;
  await vi.advanceTimersByTimeAsync(30);
  expect(audio.currentTime).toBeCloseTo(0.52);
  audio.currentTime = 100;
  audio.paused = true;
  audio.onended!();
  expect(audio.currentTime).toBe(0.51);
  expect(audio.paused).toBe(false);
  expect(player.currentMusic).toBe("action");
});

test("hidden playback stays silent while phase changes and resumes the latest event", async () => {
  const { player, audio } = fixture("other");
  player.play("menu");
  await settle();
  player.suspend();
  expect(audio.paused).toBe(true);
  player.play("deathcam");
  await settle();
  expect(audio.paused).toBe(true);
  expect(audio.src).toBe("");
  expect(player.currentMusic).toBe("deathcam");
  player.resume();
  await settle();
  expect(audio.src).toBe("/audio/other-death.mp3");
  expect(audio.paused).toBe(false);
});

test("outgoing looped cues keep their authored bounds while fading", async () => {
  vi.useFakeTimers();
  const timed = structuredClone(catalog);
  timed.kits[1].events.start = {
    tracks: ["/audio/loop.mp3"],
    loop: true,
    starts: [0.5],
    ends: [3],
    fadeOut: 1,
  };
  const { player, audio } = fixture("other", async () => timed);
  player.play("start");
  await settle();
  audio.currentTime = 2.9;
  player.play("deathcam");
  await settle();
  audio.currentTime = 3.1;
  await vi.advanceTimersByTimeAsync(30);
  expect(audio.currentTime).toBeCloseTo(0.6);
  expect(audio.paused).toBe(false);
  await vi.advanceTimersByTimeAsync(1100);
  expect(audio.paused).toBe(true);
  expect(audio.src).toBe("");
});
