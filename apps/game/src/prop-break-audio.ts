import type { Vector3 } from "three";
import type { NativeBreakableDefinition } from "@cs2go/simulation/breakables";
import type { Soundscape } from "./soundscape";
import type { SoundRange } from "./spatial-audio";

export interface NativePropBreakCue {
  clips: readonly (string | null)[];
  gain: number;
  pitch: number;
  pitchRandom: readonly number[];
  /** Authored distance/gain keypoints, converted from Source units once. */
  curve: readonly (readonly number[])[];
  occlusionMix: number;
}
/** Explicit VSURF events take precedence over coarse legacy material sounds.
 * Original clips, gain, pitch and envelope keypoints are source-backed; curve
 * interpolation, event mixing and room acoustics retain the browser transport. */
export class NativePropBreakAudio {
  private readonly events = new Map<string, NativePropBreakCue & { range: SoundRange }>();
  constructor(catalog: Readonly<Record<string, NativePropBreakCue>>) {
    for (const [event, cue] of Object.entries(catalog)) {
      if (
        !event ||
        !Array.isArray(cue.clips) ||
        cue.clips.some((clip) => clip !== null && (typeof clip !== "string" || !clip)) ||
        ![cue.gain, cue.pitch, ...cue.pitchRandom, cue.occlusionMix].every(Number.isFinite) ||
        cue.gain < 0 ||
        cue.pitchRandom.length !== 2 ||
        cue.pitch + cue.pitchRandom[0] <= 0 ||
        cue.pitchRandom[1] < cue.pitchRandom[0] ||
        cue.occlusionMix < 0 ||
        cue.occlusionMix > 1 ||
        cue.curve.length < 2 ||
        cue.curve.some(
          (point, index) =>
            point.length !== 2 ||
            !point.every(Number.isFinite) ||
            point[0] < 0 ||
            point[1] < 0 ||
            (index > 0 && point[0] <= cue.curve[index - 1][0]),
        )
      )
        throw new Error(`Invalid native prop break event: ${event}`);
      const curve = cue.curve.map(([distance, gain]) => [distance, gain] as const);
      this.events.set(event, {
        ...cue,
        range: {
          refDistance: curve[0][0],
          maxDistance: curve.at(-1)![0],
          curve,
          occlusionMix: cue.occlusionMix,
        },
      });
    }
  }
  validate(definitions: readonly NativeBreakableDefinition[]) {
    for (const definition of definitions)
      if (definition.breakSoundEvent && !this.events.has(definition.breakSoundEvent))
        throw new Error(`Native prop break event not imported: ${definition.breakSoundEvent}`);
  }
  play(
    soundscape: Soundscape,
    definition: NativeBreakableDefinition,
    position: Vector3,
    random = Math.random,
  ) {
    const event = definition.breakSoundEvent;
    if (event === undefined)
      return soundscape.play(
        definition.material === "glass"
          ? "map-break-glass"
          : definition.material === "wood"
            ? "map-break-wood"
            : "map-break-metal",
        false,
        "concrete",
        position,
      );
    if (!event) return;
    const cue = this.events.get(event);
    if (!cue) throw new Error(`Native prop break event not imported: ${event}`);
    if (
      !cue.clips.length ||
      !cue.gain ||
      soundscape.spatial.position.distanceTo(position) >= cue.range.maxDistance
    )
      return;
    const clip = cue.clips[Math.min(cue.clips.length - 1, Math.floor(random() * cue.clips.length))];
    if (clip === null) return;
    const pitch =
      cue.pitch + cue.pitchRandom[0] + random() * (cue.pitchRandom[1] - cue.pitchRandom[0]);
    return soundscape.play(`prop-break-${event}`, false, "concrete", position, {
      clip,
      gain: cue.gain,
      pitch,
      range: cue.range,
    });
  }
}
