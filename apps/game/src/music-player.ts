import { assetUrl } from "./asset-url";
import {
  defaultMusicKitId,
  loadMusicKits,
  musicKitStorageKey,
  type Music,
  type MusicKit,
  type MusicKitCatalog,
  type MusicKitCue,
} from "./music-kits";
import defaultKit from "./data/default-music-kit.json";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem">;
type Voice = {
  audio: HTMLAudioElement;
  cue: MusicKitCue;
  index: number;
  elapsed: number;
  fade: number;
  preview: boolean;
  stopping: boolean;
};

export function musicTrackIndex(cue: MusicKitCue, random = Math.random()) {
  const weights = cue.weights;
  if (
    weights?.length === cue.tracks.length &&
    weights.every((weight) => Number.isFinite(weight) && weight >= 0)
  ) {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    if (total > 0) {
      let target = random * total;
      for (let i = 0; i < weights.length; i++) {
        target -= weights[i];
        if (target < 0) return i;
      }
      return weights.length - 1;
    }
  }
  return Math.min(cue.tracks.length - 1, Math.floor(random * cue.tracks.length));
}
export function musicEnvelope(cue: MusicKitCue, elapsed: number) {
  const curve = cue.fadeIn;
  if (!curve) return 1;
  const fraction = Math.max(
    0,
    Math.min(1, (elapsed - curve.start) / Math.max(0.001, curve.end - curve.start)),
  );
  return curve.from + (curve.to - curve.from) * fraction;
}

/** Stream only the requested event. A second bounded element preserves the
 * outgoing event's authored fade; no library audio is decoded at startup. */
export class KitMusicPlayer extends EventTarget {
  currentMusic: Music | null = null;
  previewing?: { kitId: string; event: string; track: number };
  private selected = defaultMusicKitId;
  private activeKit = defaultMusicKitId;
  private kitOverride?: string;
  private catalog?: MusicKitCatalog;
  private catalogLoad?: Promise<MusicKitCatalog>;
  private generation = 0;
  private volume = 0.15;
  private active?: Voice;
  private outgoing?: Voice;
  private timer?: ReturnType<typeof setTimeout>;
  private suspended = false;
  private lastTick = 0;
  private idleAudio: HTMLAudioElement;
  private storage: Storage | undefined;
  private loadCatalog: typeof loadMusicKits;
  private createAudio: () => HTMLAudioElement;

  constructor(
    audio: HTMLAudioElement,
    storage: Storage | undefined,
    loadCatalog = loadMusicKits,
    createAudio = () => new Audio(),
  ) {
    super();
    this.idleAudio = audio;
    this.storage = storage;
    this.loadCatalog = loadCatalog;
    this.createAudio = createAudio;
    audio.preload = "none";
    try {
      this.selected = storage?.getItem(musicKitStorageKey) || defaultMusicKitId;
    } catch {
      /* Selection remains available for this session when storage is blocked. */
    }
  }
  get audio() {
    return this.active?.audio ?? this.idleAudio;
  }
  get kitId() {
    return this.selected;
  }
  private changed() {
    this.dispatchEvent(new Event("change"));
  }
  private resolveCatalog() {
    if (this.catalog) return Promise.resolve(this.catalog);
    return (this.catalogLoad ??= this.loadCatalog()
      .then((catalog) => {
        this.catalog = catalog;
        return catalog;
      })
      .finally(() => {
        this.catalogLoad = undefined;
      }));
  }
  private async resolveKit(id: string) {
    if (id === defaultMusicKitId) return defaultKit as MusicKit;
    const catalog = await this.resolveCatalog();
    return catalog.kits.find((entry) => entry.id === id);
  }
  private release(voice: Voice | undefined) {
    if (!voice) return;
    voice.audio.onended = null;
    voice.audio.onloadedmetadata = null;
    voice.audio.onerror = null;
    voice.audio.pause();
    voice.audio.removeAttribute("src");
    voice.audio.load();
  }
  private silence() {
    this.release(this.active);
    this.release(this.outgoing);
    this.active = this.outgoing = undefined;
    clearTimeout(this.timer);
    this.timer = undefined;
  }
  private retire() {
    const voice = this.active;
    if (!voice) return;
    this.release(this.outgoing);
    this.outgoing = undefined;
    this.active = undefined;
    if (voice.preview || !voice.cue.fadeOut || voice.audio.paused) this.release(voice);
    else {
      voice.stopping = true;
      voice.fade = 0;
      this.outgoing = voice;
    }
  }
  private updateVolume(voice: Voice) {
    const fade = voice.stopping
      ? Math.max(0, 1 - voice.fade / Math.max(0.001, voice.cue.fadeOut ?? 0))
      : 1;
    voice.audio.volume = Math.min(
      1,
      Math.max(
        0,
        this.volume * (voice.cue.gain ?? 1) * musicEnvelope(voice.cue, voice.elapsed) * fade,
      ),
    );
  }
  private schedule() {
    if (this.timer !== undefined) return;
    this.lastTick = performance.now();
    this.timer = setTimeout(() => this.tick(), 25);
  }
  private tick() {
    this.timer = undefined;
    const now = performance.now();
    const dt = Math.max(0, (now - this.lastTick) / 1000);
    this.lastTick = now;
    for (const voice of [this.active, this.outgoing]) {
      if (!voice || voice.audio.paused) continue;
      voice.elapsed += dt;
      if (voice.stopping) voice.fade += dt;
      else if (voice.cue.stopAfter !== undefined && voice.elapsed >= voice.cue.stopAfter) {
        // stop_at_time requests an authored fade-out, rather than allowing the
        // remainder of a longer source recording to run during live play.
        this.retire();
        this.currentMusic = null;
        this.changed();
      }
      const start = voice.cue.starts?.[voice.index] ?? 0;
      const end = voice.cue.ends?.[voice.index] || voice.audio.duration;
      if (Number.isFinite(end) && end > start && voice.audio.currentTime >= end) {
        if (voice.cue.loop)
          voice.audio.currentTime = start + ((voice.audio.currentTime - start) % (end - start));
        else {
          voice.audio.pause();
          this.ended(voice);
        }
      }
      this.updateVolume(voice);
    }
    if (
      this.outgoing &&
      (this.outgoing.audio.paused || this.outgoing.fade >= (this.outgoing.cue.fadeOut ?? 0))
    ) {
      this.release(this.outgoing);
      this.outgoing = undefined;
    }
    if ([this.active, this.outgoing].some((voice) => voice && !voice.audio.paused)) this.schedule();
  }
  private ended(voice: Voice) {
    if (voice !== this.active && voice !== this.outgoing) return;
    if (voice.preview) this.stopPreview();
    else if (voice.cue.loop) {
      voice.audio.currentTime = voice.cue.starts?.[voice.index] ?? 0;
      void voice.audio
        .play()
        .then(() => this.schedule())
        .catch(() => {});
    } else {
      if (voice === this.active) {
        this.currentMusic = null;
        this.active = undefined;
        this.changed();
      } else this.outgoing = undefined;
      this.release(voice);
    }
  }
  private begin(cue: MusicKitCue | undefined, track?: number, preview = false, repeatMenu = false) {
    this.retire();
    if (!cue?.tracks.length) {
      this.schedule();
      return;
    }
    const audio = this.outgoing?.audio === this.idleAudio ? this.createAudio() : this.idleAudio;
    this.idleAudio = audio;
    const index = track ?? musicTrackIndex(cue);
    const voice: Voice = { audio, cue, index, elapsed: 0, fade: 0, preview, stopping: false };
    this.active = voice;
    audio.preload = "none";
    audio.src = assetUrl(cue.tracks[index]);
    // Menu repetition is a reconstructed phase policy; Background has no
    // explicit loop_track flag. Authored loop bounds are handled below.
    audio.loop =
      repeatMenu ||
      (cue.loop === true && !((cue.starts?.[index] ?? 0) > 0) && !((cue.ends?.[index] ?? 0) > 0));
    const seek = () => {
      if (this.active !== voice) return;
      const start = cue.starts?.[index] ?? 0;
      if (start > 0 && Number.isFinite(start)) audio.currentTime = start;
    };
    audio.onloadedmetadata = seek;
    if (audio.readyState >= 1) seek();
    audio.onended = () => this.ended(voice);
    audio.onerror = () => {
      if (this.active === voice) this.dispatchEvent(new Event("error"));
    };
    this.updateVolume(voice);
    void audio
      .play()
      .then(() => {
        if (this.active === voice || this.outgoing === voice) this.schedule();
      })
      .catch(() => {
        // Keep the requested event so a later trusted gesture can retry playback.
      });
    this.schedule();
  }
  setVolume(master: number, music: number) {
    this.volume = (master * music) / 10000;
    for (const voice of [this.active, this.outgoing]) if (voice) this.updateVolume(voice);
    if (!this.active && !this.outgoing) this.idleAudio.volume = this.volume;
  }
  async setKit(id: string) {
    const catalog = await this.resolveCatalog();
    if (!catalog.kits.some((entry) => entry.id === id))
      throw new Error("This music kit is unavailable.");
    this.selected = id === catalog.defaultKitId ? defaultMusicKitId : id;
    try {
      this.storage?.setItem(musicKitStorageKey, this.selected);
    } catch {
      /* Session selection remains usable. */
    }
    const name = this.currentMusic;
    this.silence();
    this.previewing = undefined;
    this.currentMusic = null;
    this.play(name, this.kitOverride);
    this.changed();
  }
  suspend() {
    this.suspended = true;
    ++this.generation;
    if (this.previewing) {
      this.silence();
      this.previewing = undefined;
    } else {
      this.active?.audio.pause();
      this.release(this.outgoing);
      this.outgoing = undefined;
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    this.changed();
  }
  resume() {
    this.suspended = false;
    this.play(this.currentMusic, this.kitOverride);
  }
  play(name: Music | null, override?: string) {
    const kitId = override ?? this.selected;
    if (name === this.currentMusic && kitId === this.activeKit && !this.suspended) {
      if (this.previewing || (this.active && !this.active.audio.paused)) return;
      if (name && this.active) {
        void this.active.audio
          .play()
          .then(() => this.schedule())
          .catch(() => {});
        return;
      }
    }
    const generation = ++this.generation;
    if (this.previewing) this.silence();
    this.previewing = undefined;
    this.currentMusic = name;
    this.activeKit = kitId;
    this.kitOverride = override;
    this.changed();
    if (!name || this.suspended) {
      this.silence();
      return;
    }
    if (kitId === defaultMusicKitId) {
      this.begin((defaultKit as MusicKit).events[name], undefined, false, name === "menu");
      return;
    }
    // Stop a stale event immediately while a persisted kit's catalog loads.
    this.retire();
    void this.resolveKit(kitId)
      .then((kit) => {
        if (generation !== this.generation) return;
        if (!kit) {
          this.selected = this.activeKit = defaultMusicKitId;
          try {
            this.storage?.setItem(musicKitStorageKey, this.selected);
          } catch {
            /* Session fallback. */
          }
          kit = defaultKit as MusicKit;
        }
        this.begin(kit.events[name], undefined, false, name === "menu");
      })
      .catch(() => {
        if (generation === this.generation)
          this.begin((defaultKit as MusicKit).events[name], undefined, false, name === "menu");
      });
  }
  preview(kit: MusicKit, event: string, track: number) {
    ++this.generation;
    this.silence();
    this.previewing = { kitId: kit.id, event, track };
    const cue: MusicKitCue =
      event === "extra" ? { tracks: kit.extraTracks ?? [] } : kit.events[event];
    // Inventory previews expose the full source recording, not a live event's
    // stop time or looping segment. Only the native event gain is retained.
    this.begin({ tracks: cue.tracks, gain: cue.gain }, track, true);
    this.changed();
  }
  stopPreview() {
    if (!this.previewing) return;
    const name = this.currentMusic;
    this.silence();
    this.previewing = undefined;
    this.currentMusic = null;
    this.play(name, this.kitOverride);
  }
}
