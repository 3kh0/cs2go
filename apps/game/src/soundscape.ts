import c4Audio from "./data/c4-audio.json";
import { bombPlantCues, type BombPlantCue } from "./bomb-presentation";
import { assetFetch } from "./asset-url";
import { KitMusicPlayer } from "./music-player";
import { defaultMusicKitId, type Music } from "./music-kits";
export type { Music } from "./music-kits";
import { utilityAudio, type UtilityCue } from "./utility-audio";
import { loadAudioClip } from "./audio-bank";
import type { Vector3 } from "three";
import { SpatialAudio, type SoundRange } from "./spatial-audio";
import { NativeAcoustics } from "./room-acoustics";
import { fetchGzipped } from "./gltf";
import uiCues from "./data/ui-cues.json";
import type { UiInteraction } from "./ui-audio";
export type Cue =
  | `map-door-${string}`
  | `prop-break-${string}`
  | BombPlantCue
  | UtilityCue
  | `ui-${UiInteraction}`
  | "dry-fire"
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
  | "map-break-wood"
  | "map-break-metal"
  | "map-break-glass"
  | "bomb-plant"
  | "bomb-beep-fast"
  | "bomb-beep"
  | "bomb-defuse-start"
  | "bomb-defuse"
  | "bomb-explode"
  | "ready"
  | "healthshot-prepare"
  | "healthshot-thud"
  | "healthshot-success"
  | "dm-bonus-start"
  | "dm-bonus-end"
  | "dm-bonus-kill";
// Shipped surface sound events: Wood_Furniture.Break, Breakable.Metal, Glass.Break.
const mapBreakAudio = {
  "map-break-wood": { variants: 2, volume: 0.799805, pitch: 0.99 },
  "map-break-metal": { variants: 3, volume: 1, pitch: 1 },
  "map-break-glass": { variants: 3, volume: 0.699707, pitch: 1 },
};
function musicStorage() {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}
export class Soundscape {
  spatial = new SpatialAudio();
  buffers = new Map<string, AudioBuffer>();
  private nativeCueSettings = new Map<string, { gain: number; pitch: number }>();
  context?: AudioContext;
  master?: GainNode;
  effects?: GainNode;
  voices = new Set<AudioBufferSourceNode>();
  private objectiveVoices = new Map<string, AudioBufferSourceNode>();
  private objectiveLastPlayed = new Map<string, number>();
  private protectedVoices = new Set<AudioBufferSourceNode>();
  private uiVoices = new Map<string, AudioBufferSourceNode>();
  private uiLastPlayed = new Map<string, number>();
  readonly musicKits = new KitMusicPlayer(new Audio(), musicStorage());
  get music() {
    return this.musicKits.audio;
  }
  get currentMusic() {
    return this.musicKits.currentMusic;
  }
  lastCue = "";
  step = 0;
  volume = 60;
  musicVolume = 25;
  effectsVolume = 100;
  stop() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
    this.uiVoices.clear();
    this.uiLastPlayed.clear();
    this.protectedVoices.clear();
    this.objectiveVoices.clear();
    this.objectiveLastPlayed.clear();
    this.spatial.resetRooms();
  }
  async load() {
    const [pathing, response] = await Promise.all([
      fetchGzipped("/audio/acoustics/dust2-pathing.bin.gz"),
      assetFetch("/audio/source/manifest.json"),
    ]);
    this.spatial.native = new NativeAcoustics(pathing);
    if (!response.ok) throw new Error("Sound manifest unavailable");
    const manifest = (await response.json()) as {
      clips: { name: string; path?: string; sourceEventGain?: number; sourceEventPitch?: number }[];
    };
    await Promise.all(
      utilityAudio.map(async (name) => {
        this.buffers.set(name, await loadAudioClip(`/audio/${name}.ogg`));
      }),
    );
    await Promise.all(
      manifest.clips
        .filter((c) => !c.name.startsWith("music-"))
        .map(async ({ name, path, sourceEventGain, sourceEventPitch }) => {
          this.buffers.set(name, await loadAudioClip(path ?? `/audio/source/${name}.ogg`));
          if (Number.isFinite(sourceEventGain))
            this.nativeCueSettings.set(name, {
              gain: sourceEventGain!,
              pitch: sourceEventPitch ?? 1,
            });
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
    this.musicKits.setVolume(master, music);
  }
  playBombPlant(previous: number, elapsed: number, position?: Vector3) {
    if (elapsed <= 0 || elapsed <= previous) return;
    for (const { time, cue } of bombPlantCues) {
      // The shipped keypad event explicitly sets localplayeronly. Initiate and
      // completion retain positional playback for nearby observers.
      if (position && cue.startsWith("bomb-key-")) continue;
      if ((time === 0 ? previous === 0 : previous < time) && elapsed >= time)
        this.play(cue, false, "concrete", position);
    }
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
    playback?: { gain: number; pitch: number; range?: SoundRange; clip?: string },
  ) {
    if (!this.context || !this.effects || !this.volume || !this.effectsVolume) return;
    const breaking = cue.startsWith("map-break-")
      ? mapBreakAudio[cue as keyof typeof mapBreakAudio]
      : undefined;
    const variant = 1 + Math.floor(Math.random() * (breaking?.variants ?? 3));
    const name =
      playback?.clip ??
      (breaking
        ? cue + (variant === 1 ? "" : `-${variant}`)
        : cue === "dry-fire"
          ? "revolver-prepare"
          : cue === "step"
            ? `step-${surface}-${(this.step++ % 4) + 1}`
            : ["damage", "death", "gear"].includes(cue)
              ? `${cue}-${variant}`
              : cue);
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const c4 = c4Audio[name as keyof typeof c4Audio];
    if (
      c4?.blockSeconds &&
      this.context.currentTime - (this.objectiveLastPlayed.get(name) ?? -Infinity) < c4.blockSeconds
    )
      return;
    if (c4?.instances === 1) this.objectiveVoices.get(name)?.stop();
    playback ??= c4 ?? this.nativeCueSettings.get(name);
    const blast =
      cue === "bomb-explode" ||
      cue === "utility-he-explode" ||
      cue === "utility-flash-explode" ||
      cue === "utility-decoy-explode";
    if (this.voices.size >= 16) {
      const oldest =
        [...this.voices].find((voice) => !this.protectedVoices.has(voice)) ??
        (blast ? this.voices.values().next().value : undefined);
      if (!oldest) return;
      this.voices.delete(oldest);
      this.protectedVoices.delete(oldest);
      oldest.stop();
    }
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value =
      (playback?.gain ??
        (breaking ? 0.45 * breaking.volume : cue === "hover" ? 0.1 : cue === "step" ? 0.3 : 0.45)) *
      (quiet ? 0.25 : 1);
    source.playbackRate.value =
      playback?.pitch ?? (breaking ? breaking.pitch + (Math.random() - 0.5) * 0.02 : 1);
    source.connect(gain);
    const disconnectSpatial = position
      ? this.spatial.connect(
          this.context,
          gain,
          this.effects,
          c4 ? position.clone().setY(position.y + c4.height) : position,
          playback?.range ??
            (c4
              ? {
                  refDistance: 1,
                  maxDistance: c4.curve.at(-1)![0] * 0.0254,
                  curve: c4.curve.map(([x, y]) => [x * 0.0254, y] as const),
                  occlusionMix: c4.occlusionMix,
                }
              : blast),
        )
      : undefined;
    if (!disconnectSpatial) {
      gain.connect(this.effects);
      if (["step", "jump", "land", "gear", "knife-swing1", "knife-swing2"].includes(cue))
        this.spatial.connectRoom(this.context, gain, this.effects);
    }
    this.voices.add(source);
    if (c4) {
      this.objectiveLastPlayed.set(name, this.context.currentTime);
      if (c4.instances === 1) this.objectiveVoices.set(name, source);
    }
    if (blast || cue.startsWith("bomb-")) this.protectedVoices.add(source);
    this.lastCue = name;
    source.onended = () => {
      this.voices.delete(source);
      this.protectedVoices.delete(source);
      if (this.objectiveVoices.get(name) === source) this.objectiveVoices.delete(name);
      if (this.uiVoices.get(name) === source) this.uiVoices.delete(name);
      source.disconnect();
      gain.disconnect();
      disconnectSpatial?.();
    };
    source.start();
    return source;
  }
  pauseMusic() {
    this.musicKits.suspend();
  }
  resumeMusic() {
    this.musicKits.resume();
  }
  playRoundMusic(won: boolean, mvp: "local" | "other" | null) {
    // Native MVPAnthem blocks WonRound/LostRound. Bots and remote players whose
    // kit selection is not synchronized use the default kit's anthem.
    this.musicKits.play(
      mvp ? "mvp" : won ? "win" : "lose",
      mvp === "other" ? defaultMusicKitId : undefined,
    );
  }
  playMusic(name: Music | null) {
    this.musicKits.play(name);
  }
}
