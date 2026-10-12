export type Cue =
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
export type Music = "menu" | "start" | "deathcam" | "win" | "lose" | "mvp" | "countdown";
export class Soundscape {
  buffers = new Map<string, AudioBuffer>();
  context?: AudioContext;
  master?: GainNode;
  effects?: GainNode;
  voices = new Set<AudioBufferSourceNode>();
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
  async load() {
    const response = await fetch("/audio/source/manifest.json");
    if (!response.ok) throw new Error("Sound manifest unavailable");
    const manifest = (await response.json()) as { clips: { name: string }[] };
    const decoder = new OfflineAudioContext(1, 1, 44100);
    await Promise.all(
      manifest.clips
        .filter((c) => !c.name.startsWith("music-"))
        .map(async ({ name }) => {
          const clip = await fetch(`/audio/source/${name}.ogg`);
          if (!clip.ok) throw new Error(`Sound unavailable: ${name}`);
          this.buffers.set(name, await decoder.decodeAudioData(await clip.arrayBuffer()));
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
  play(cue: Cue, quiet = false, surface: "sand" | "concrete" = "sand") {
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
    if (this.voices.size >= 16) {
      const oldest = this.voices.values().next().value;
      if (oldest) {
        this.voices.delete(oldest);
        oldest.stop();
      }
    }
    const source = this.context.createBufferSource(),
      gain = this.context.createGain();
    source.buffer = buffer;
    gain.gain.value = (cue === "hover" ? 0.1 : cue === "step" ? 0.3 : 0.45) * (quiet ? 0.25 : 1);
    source.connect(gain).connect(this.effects);
    this.voices.add(source);
    this.lastCue = name;
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  }
  playMusic(name: Music | null) {
    if (name === this.currentMusic && !this.music.paused) return;
    this.music.pause();
    this.currentMusic = name;
    if (!name) return;
    this.music.src = `/audio/source/music-${name}.ogg`;
    this.music.loop = name === "menu";
    this.music.volume = (this.volume * this.musicVolume) / 10000;
    void this.music.play().catch(() => {
      /* A later user gesture retries blocked playback. */
    });
  }
}
