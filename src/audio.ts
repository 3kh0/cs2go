export type WeaponSound =
  | "shot"
  | "bot"
  | "reload"
  | "reloadIn"
  | "bolt"
  | "boltForward"
  | "scope"
  | "draw";
const kits = [
  {
    shot: "ak47-1",
    reload: "ak47_clipout",
    reloadIn: "ak47_clipin",
    bolt: "ak47_boltpull",
    boltForward: "ak47_boltpull",
    draw: "ak47_draw",
  },
  {
    shot: "m4a1-1-single",
    reload: "m4a1_clipout",
    reloadIn: "m4a1_clipin",
    bolt: "m4a1_silencer_boltback",
    boltForward: "m4a1_silencer_boltforward",
    draw: "m4a1_draw",
  },
  {
    shot: "usp1",
    reload: "usp_clipout",
    reloadIn: "usp_clipin",
    bolt: "usp_slideback",
    boltForward: "usp_sliderelease",
    draw: "usp_slideback",
  },
  {
    shot: "awp1",
    reload: "awp_clipout",
    reloadIn: "awp_clipin",
    bolt: "awp_boltback",
    boltForward: "awp_boltforward",
    draw: "awp_boltforward",
  },
];
export class WeaponAudio {
  buffers = new Map<string, AudioBuffer>();
  voices = new Set<AudioBufferSourceNode>();
  lastClip = "";
  output?: AudioNode;
  async load() {
    // Decode before enabling Play; the live audio context still starts on the user's click.
    const decoder = new OfflineAudioContext(1, 1, 44100);
    const names = new Set([...kits.flatMap((kit) => Object.values(kit)), "zoom", "ak47-1-distant"]);
    await Promise.all(
      [...names].map(async (name) => {
        const response = await fetch(`/audio/${name}.ogg`);
        if (!response.ok) throw new Error(`Weapon audio unavailable: ${name}`);
        this.buffers.set(name, await decoder.decodeAudioData(await response.arrayBuffer()));
      }),
    );
  }
  play(
    context: AudioContext,
    kind: WeaponSound,
    weapon: number,
    volume: number,
    pan = 0,
    distance = 0,
  ) {
    const name =
      kind === "scope"
        ? "zoom"
        : kind === "bot"
          ? weapon === 0
            ? "ak47-1-distant"
            : kits[weapon]?.shot
          : kits[weapon]?.[kind];
    if (!name) return;
    const buffer = this.buffers.get(name);
    if (!buffer || !volume) return;
    if (this.voices.size >= 32) {
      const oldest = this.voices.values().next().value;
      if (oldest) {
        this.voices.delete(oldest);
        oldest.stop();
      }
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const panner = context.createStereoPanner();
    source.buffer = buffer;
    gain.gain.value =
      (volume / 100) *
      (kind === "shot" ? 0.65 : kind === "bot" ? 0.42 / (1 + distance * 0.09) : 0.4);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source
      .connect(gain)
      .connect(panner)
      .connect(this.output || context.destination);
    this.voices.add(source);
    this.lastClip = name;
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
    source.start();
  }
}
