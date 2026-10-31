import { loadAudioClip } from "./audio-bank";
import type { Vector3 } from "three";
import type { SpatialAudio, SoundRange } from "./spatial-audio";
export type WeaponSound =
  | `silencerscrew${"onstart" | "offend" | 1 | 2 | 3 | 4 | 5}`
  | "shot"
  | "bot"
  | "reload"
  | "reloadIn"
  | "reloadSlide"
  | "reloadLeft"
  | "reloadRight"
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
    draw: "usp_draw",
  },
  {
    shot: "awp1",
    reload: "awp_clipout",
    reloadIn: "awp_clipin",
    bolt: "awp_boltback",
    boltForward: "awp_boltforward",
    draw: "awp_draw",
  },
  undefined,
  undefined,
  undefined,
  {
    shot: "glock18-1",
    reload: "glock_clipout",
    reloadIn: "glock_clipin",
    bolt: "glock_slideback",
    boltForward: "glock_sliderelease",
    draw: "glock_draw",
  },
  {
    shot: "deagle-1",
    reload: "de_clipout",
    reloadIn: "de_clipin",
    bolt: "de_slideback",
    boltForward: "de_slideforward",
    draw: "de_draw",
  },
  {
    shot: "m4a1-1",
    reload: "m4a1_clipout",
    reloadIn: "m4a1_clipin",
    bolt: "m4a1_boltback",
    boltForward: "m4a1_boltforward",
    draw: "m4a1_draw",
  },
  {
    shot: "nova-1",
    reload: "nova_insertshell",
    reloadIn: "nova_insertshell",
    bolt: "nova_pump",
    boltForward: "nova_pump",
    draw: "nova_draw",
  },
  {
    shot: "mp9-1",
    reload: "mp9_clipout",
    reloadIn: "mp9_clipin",
    bolt: "mp9_boltback",
    boltForward: "mp9_boltforward",
    draw: "mp9_draw",
  },
  {
    shot: "hkp2000-1",
    reload: "hkp2000_clipout",
    reloadIn: "hkp2000_clipin",
    bolt: "hkp2000_slideback",
    boltForward: "hkp2000_sliderelease",
    draw: "hkp2000_draw",
  },
  {
    shot: "p250-1",
    reload: "p250_clipout",
    reloadIn: "p250_clipin",
    bolt: "p250_slideback",
    boltForward: "p250_sliderelease",
    draw: "p250_draw",
  },
  {
    shot: "fiveseven-1",
    reload: "fiveseven_clipout",
    reloadIn: "fiveseven_clipin",
    bolt: "fiveseven_slideback",
    boltForward: "fiveseven_sliderelease",
    draw: "fiveseven_draw",
  },
  {
    shot: "tec9-1",
    reload: "tec9_clipout",
    reloadIn: "tec9_clipin",
    bolt: "tec9_boltpull",
    boltForward: "tec9_boltrelease",
    draw: "tec9_draw",
  },
  {
    shot: "cz75a-1",
    reload: "p250_clipout",
    reloadIn: "cz75_clipin",
    bolt: "p250_slideback",
    boltForward: "p250_sliderelease",
    draw: "p250_draw",
  },
  {
    shot: "revolver-1_01",
    reload: "revolver_clipout",
    reloadIn: "revolver_clipin",
    bolt: "revolver_sideback",
    boltForward: "revolver_siderelease",
    draw: "revolver_draw",
  },
  {
    shot: "elite-1",
    reload: "elite_clipout",
    // Legacy filename: this is Weapon_ELITE.Clipin, not Weapon_ELITE.Lclipin.
    reloadIn: "elite_leftclipin",
    reloadSlide: "galil_clipin",
    reloadLeft: "elite_lclipin",
    reloadRight: "elite_rclipin",
    bolt: "elite_sliderelease",
    boltForward: "elite_sliderelease",
    draw: "elite_draw",
  },
  {
    shot: "famas-1",
    reload: "famas_clipout",
    reloadIn: "famas_clipin",
    bolt: "famas_boltback",
    boltForward: "famas_boltforward",
    draw: "famas_draw",
  },
  {
    shot: "galil-1",
    reload: "galil_clipout",
    reloadIn: "galil_clipin",
    bolt: "galil_boltback",
    boltForward: "galil_boltforward",
    draw: "galil_draw",
  },
  {
    shot: "aug-1",
    scope: "aug_zoom",
    reload: "aug_clipout",
    reloadIn: "aug_clipin",
    bolt: "aug_boltpull",
    boltForward: "aug_boltrelease",
    draw: "aug_draw",
  },
  {
    shot: "sg556-1",
    scope: "sg556_zoom",
    reload: "sg556_clipout",
    reloadIn: "sg556_clipin",
    bolt: "sg556_boltback",
    boltForward: "sg556_boltforward",
    draw: "sg556_draw",
  },
  {
    shot: "ssg08-1",
    scope: "ssg08_zoom",
    reload: "ssg08_clipout",
    reloadIn: "ssg08_clipin",
    bolt: "ssg08_boltback",
    boltForward: "ssg08_boltforward",
    draw: "ssg08_draw",
  },
  {
    shot: "scar20_01",
    scope: "scar20_zoom",
    reload: "scar20_clipout",
    reloadIn: "scar20_clipin",
    bolt: "scar20_boltback",
    boltForward: "scar20_boltforward",
    draw: "scar20_draw",
  },
  {
    shot: "g3sg1-1",
    scope: "g3sg1_zoom",
    reload: "g3sg1_clipout",
    reloadIn: "g3sg1_clipin",
    bolt: "g3sg1_slideback",
    boltForward: "g3sg1_slideforward",
    draw: "g3sg1_draw",
  },
  {
    shot: "mac10-1",
    reload: "mac10_clipout",
    reloadIn: "mac10_clipin",
    bolt: "mac10_boltback",
    boltForward: "mac10_boltforward",
    draw: "mac10_draw",
  },
  {
    shot: "mp7-1",
    reload: "mp7_clipout",
    reloadIn: "mp7_clipin",
    bolt: "mp7_slideback",
    boltForward: "mp7_slideforward",
    draw: "mp7_draw",
  },
  {
    shot: "mp5_01",
    reload: "mp5_clipout",
    reloadIn: "mp5_clipin",
    bolt: "mp5_slideback",
    boltForward: "mp5_slideforward",
    draw: "mp5_draw",
  },
  {
    shot: "ump45-1",
    reload: "ump45_clipout",
    reloadIn: "ump45_clipin",
    bolt: "ump45_boltback",
    boltForward: "ump45_boltforward",
    draw: "ump45_draw",
  },
  {
    shot: "p90-1",
    reload: "p90_clipout",
    reloadIn: "p90_clipin",
    bolt: "p90_boltback",
    boltForward: "p90_boltforward",
    draw: "p90_draw",
  },
  {
    shot: "bizon-1",
    reload: "bizon_clipout",
    reloadIn: "bizon_clipin",
    bolt: "bizon_boltback",
    boltForward: "bizon_boltforward",
    draw: "bizon_draw",
  },
  {
    shot: "xm1014-1",
    reload: "xm1014_insertshell",
    reloadIn: "xm1014_insertshell",
    bolt: "xm1014_pump",
    boltForward: "xm1014_pump",
    draw: "xm1014_draw",
  },
  {
    shot: "mag7-1",
    reload: "mag7_clipout",
    reloadIn: "mag7_clipin",
    bolt: "mag7_pump_back",
    boltForward: "mag7_pump_forward",
    draw: "mag7_draw",
  },
  {
    shot: "sawedoff-1",
    reload: "sawedoff_insertshell",
    reloadIn: "sawedoff_insertshell",
    bolt: "sawedoff_pump",
    boltForward: "sawedoff_pump",
    draw: "sawedoff_draw",
  },
  {
    shot: "m249-1",
    reload: "m249_boxout",
    reloadIn: "m249_boxin",
    bolt: "m249_pump",
    boltForward: "m249_pump",
    draw: "m249_draw",
  },
  {
    shot: "negev-1",
    reload: "negev_boxout",
    reloadIn: "negev_boxin",
    bolt: "negev_pump",
    boltForward: "negev_pump",
    draw: "negev_draw",
  },
];
/** Browser mix tuning in meters; these are not extracted Source 2 attenuation curves. */
export function weaponSoundRange(weapon: number, suppressed: boolean): SoundRange {
  if (weapon === 2 && suppressed) return { refDistance: 1.5, maxDistance: 26 };
  if ((weapon === 1 && suppressed) || kits[weapon]?.shot === "mp5_01")
    return { refDistance: 2, maxDistance: 45 };
  return { refDistance: 5, maxDistance: 150 };
}
export class WeaponAudio {
  buffers = new Map<string, AudioBuffer>();
  voices = new Set<AudioBufferSourceNode>();
  lastClip = "";
  output?: AudioNode;
  spatial?: SpatialAudio;
  stop() {
    for (const voice of this.voices) voice.stop();
    this.voices.clear();
  }
  async load() {
    // Decode before enabling Play; the live audio context still starts on the user's click.
    const names = new Set([
      ...kits.flatMap((kit) => (kit ? [kit.shot] : [])),
      "zoom",
      ...[1, 2].flatMap((id) =>
        [
          "single",
          "silencerscrewonstart",
          "silencerscrewoffend",
          ...[1, 2, 3, 4, 5].map((n) => `silencerscrew${n}`),
        ].map((cue) => `suppressor-${id}-${cue}`),
      ),
      ...kits.flatMap((kit) => (kit ? Object.values(kit) : [])),
    ]);
    await Promise.all(
      [...names].map(async (name) => {
        this.buffers.set(name, await loadAudioClip(`/audio/${name}.ogg`));
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
    position?: Vector3,
    suppressed = true,
  ) {
    const range = weaponSoundRange(weapon, suppressed);
    if (
      position &&
      this.spatial &&
      position.distanceToSquared(this.spatial.position) >= range.maxDistance ** 2
    )
      return;
    const name = kind.startsWith("silencerscrew")
      ? `suppressor-${weapon}-${kind}`
      : !suppressed && (weapon === 1 || weapon === 2) && (kind === "shot" || kind === "bot")
        ? `suppressor-${weapon}-single`
        : kind === "scope"
          ? (kits[weapon]?.scope ?? "zoom")
          : kind === "bot"
            ? kits[weapon]?.shot
            : kits[weapon]?.[
                kind as
                  | "shot"
                  | "reload"
                  | "reloadIn"
                  | "reloadSlide"
                  | "reloadLeft"
                  | "reloadRight"
                  | "bolt"
                  | "boltForward"
                  | "draw"
              ];
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
      (kind === "shot"
        ? 0.65
        : kind === "bot"
          ? position
            ? 0.65
            : 0.42 / (1 + distance * 0.09)
          : 0.4);
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain);
    const disconnectSpatial =
      position && this.spatial
        ? this.spatial.connect(context, gain, this.output || context.destination, position, range)
        : undefined;
    if (!disconnectSpatial) {
      gain.connect(panner).connect(this.output || context.destination);
      if (kind === "shot")
        this.spatial?.connectRoom(context, gain, this.output || context.destination);
    }
    this.voices.add(source);
    this.lastClip = name;
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      gain.disconnect();
      panner.disconnect();
      disconnectSpatial?.();
    };
    source.start();
  }
}
