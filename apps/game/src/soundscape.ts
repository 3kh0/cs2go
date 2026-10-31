import { assetFetch, assetUrl } from "./asset-url";
import { utilityAudio, type UtilityCue } from "./utility-audio";
import { loadAudioClip } from "./audio-bank";
import type { Vector3 } from "three";
import { SpatialAudio } from "./spatial-audio";
import { NativeAcoustics } from "./room-acoustics";
import { fetchGzipped } from "./gltf";
import uiCues from "./data/ui-cues.json";
import type { UiInteraction } from "./ui-audio";
export type Cue =
  | UtilityCue
  | `ui-${UiInteraction}`
  | "revolver-prepare"
  | "knife-deploy"
  | "knife-stab"
  | "butterfly-draw"
  | `butterfly-look${1 | 2 | 3}-${"a" | "b"}`
  | "step"
  | "jump"
  | "land"
  | "damage"
  | "death"
  | "gear"
  | "click"
  | "hover"
  | "buy"
  | "hit"
  | "head"
  | "knife-swing1"
  | "knife-swing2"
  | "knife-hit"
  | "knife-wall"
  | "bomb-plant"
  | "bomb-beep"
  | "bomb-defuse"
  | "bomb-explode"
  | "ready";
export type Music =
  | "menu"
  | "start"
  | "deathcam"
  | "win"
  | "lose"
  | "mvp"
  | "countdown"
  | "bomb"
  | "bomb-countdown"
  | "match"
  | "end";
export class Soundscape {
  spatial = new SpatialAudio();
  buffers = new Map<string, AudioBuffer>();
  context?: AudioContext;
  master?: GainNode;
  effects?: GainNode;
  voices = new Set<AudioBufferSourceNode>();
  private blasts = new Set<AudioBufferSourceNode>();
  private uiVoices = new Map<string, AudioBufferSourceNode>();
  private uiLastPlayed = new Map<string, number>();
  music = new Audio();
  currentMusic: Music | null = null;
  lastCue = "";
  step = 0;
  volume = 60;
  musicVolume = 25;
  effectsVolume = 100;
  constructor() {
    this.music.preload = "none";
    this.music.onended = () => {
      if (this.currentMusic === "win") this.playMusic("mvp");
      else this.currentMusic = null;
    };
  }
  stop() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    this.uiVoices.clear();
    this.uiLastPlayed.clear();
    this.blasts.clear();
    this.spatial.resetRooms();
  }
  async load() {
    const [pathing, response] = await Promise.all([
      fetchGzipped("/audio/acoustics/dust2-pathing.bin.gz"),
      assetFetch("/audio/source/manifest.json"),
    ]);
    this.spatial.native = new NativeAcoustics(pathing);
    if (!response.ok) throw new Error("Sound manifest unavailable");
    const manifest = (await response.json()) as { clips: { name: string }[] };
    await Promise.all(
      utilityAudio.map(async (name) => {
        this.buffers.set(name, await loadAudioClip(`/audio/${name}.ogg`));
      }),
    );
    await Promise.all(
      manifest.clips
        .filter((c) => !c.name.startsWith("music-"))
        .map(async ({ name }) => {
          this.buffers.set(name, await loadAudioClip(`/audio/source/${name}.ogg`));
        }),
    );
  }
  attach(context: AudioContext) {
    if (this.context) return;
    this.context = context;
    this.master = context.createGain();
    this.effects = context.createGain();
    this.effects.connect(this.master).connect(context.destination);
    this.setVolume(this.volume, this.musicVolume, this.effectsVolume);
  }
  setVolume(master: number, music: number, effects: number) {
    this.volume = master;
    this.musicVolume = music;
    this.effectsVolume = effects;
    if (this.context) {
      for (const [node, value] of [
        [this.master, master],
        [this.effects, effects],
      ] as const) {
        if (!node) continue;
        node.gain.cancelScheduledValues(this.context.currentTime);
        node.gain.value = value / 100;
      }
    }
    this.music.volume = (master * music) / 10000;
  }
  playUi(kind: UiInteraction) {
    if (!this.context || !this.volume || !this.effectsVolume) return;
    const setting = uiCues[kind];
    const previous = this.uiLastPlayed.get(setting.clip) ?? -Infinity;
    if (this.context.currentTime - previous < setting.blockSeconds || setting.gain <= 0) return;
    this.uiVoices.get(setting.clip)?.stop();
    const source = this.play(setting.clip as Cue, false, "sand", undefined, setting);
    if (!source) return;
    this.uiVoices.set(setting.clip, source);
    this.uiLastPlayed.set(setting.clip, this.context.currentTime);
    for (const child of setting.children) this.playUi(child as UiInteraction);
  }
  play(
    cue: Cue,
    quiet = false,
    surface: "sand" | "concrete" = "sand",
    position?: Vector3,
    playback?: { gain: number; pitch: number },
  ) {
    if (!this.context || !this.effects || !this.volume || !this.effectsVolume) return;
    const variant = 1 + Math.floor(Math.random() * 3);
    const name =
      cue === "step"
        ? `step-${surface}-${(this.step++ % 4) + 1}`
        : ["damage", "death", "gear"].includes(cue)
          ? `${cue}-${variant}`
          : cue;
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const blast =
      cue === "bomb-explode" ||
      cue === "utility-he-explode" ||
      cue === "utility-flash-explode" ||
      cue === "utility-decoy-explode";
    if (this.voices.size >= 16) {
      const oldest =
        [...this.voices].find((voice) => !this.blasts.has(voice)) ??
        (blast ? this.voices.values().next().value : undefined);
      if (!oldest) return;
      this.voices.delete(oldest);
      this.blasts.delete(oldest);
      oldest.stop();
    }
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value =
      (playback?.gain ?? (cue === "hover" ? 0.1 : cue === "step" ? 0.3 : 0.45)) *
      (quiet ? 0.25 : 1);
    source.playbackRate.value = playback?.pitch ?? 1;
    source.connect(gain);
    const disconnectSpatial = position
      ? this.spatial.connect(this.context, gain, this.effects, position, blast)
      : undefined;
    if (!disconnectSpatial) {
      gain.connect(this.effects);
      if (["step", "jump", "land", "gear", "knife-swing1", "knife-swing2"].includes(cue))
        this.spatial.connectRoom(this.context, gain, this.effects);
    }
    this.voices.add(source);
    if (blast) this.blasts.add(source);
    this.lastCue = name;
    source.onended = () => {
      this.voices.delete(source);
      this.blasts.delete(source);
      if (this.uiVoices.get(name) === source) this.uiVoices.delete(name);
      source.disconnect();
      gain.disconnect();
      disconnectSpatial?.();
    };
    source.start();
    return source;
  }
  playMusic(name: Music | null) {
    if (name === this.currentMusic && !this.music.paused) return;
    this.music.pause();
    this.currentMusic = name;
    if (!name) return;
    this.music.src = assetUrl(`/audio/source/music-${name}.ogg`);
    this.music.loop = name === "menu";
    this.music.volume = (this.volume * this.musicVolume) / 10000;
    void this.music.play().catch(() => {
      /* A later user gesture retries blocked playback. */
    });
  }
}
