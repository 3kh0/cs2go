import { Vector3 } from "three";
import type { MatchEvent } from "@cs2go/protocol";
import type { Soundscape } from "./soundscape";
import { audibleGain, type SoundRange } from "./spatial-audio";

export interface NativeFootstepCue {
  clips: readonly (string | null)[];
  gain: number;
  gainRandom: readonly [number, number];
  pitch: number;
  pitchRandom: readonly [number, number];
  curve: readonly (readonly [number, number])[];
  occlusionMix: number;
  height: number;
  blockSeconds: number;
}
export interface NativeFootstepCatalog {
  /** Exact team-table strings, including authored cross-team/right-foot names.
   * Parent/default resolution and run-to-walk selection remain reconstruction
   * until separately corroborated in the installed engine. */
  bindings: Readonly<
    Record<string, { ct: readonly [string, string]; t: readonly [string, string] }>
  >;
  events: Readonly<Record<string, NativeFootstepCue>>;
}
export type FootstepEvent = Omit<Extract<MatchEvent, { kind: "footstep" }>, "kind">;
export class NativeFootstepAudio {
  private readonly events = new Map<string, NativeFootstepCue & { range: SoundRange }>();
  private readonly lastPlayed = new Map<string, number>();
  private readonly bindings: NativeFootstepCatalog["bindings"];
  constructor(catalog: NativeFootstepCatalog) {
    this.bindings = catalog.bindings;
    for (const [name, cue] of Object.entries(catalog.events)) {
      if (
        !name ||
        !cue.clips.length ||
        cue.clips.some((clip) => clip !== null && (typeof clip !== "string" || !clip)) ||
        ![
          cue.gain,
          ...cue.gainRandom,
          cue.pitch,
          ...cue.pitchRandom,
          cue.occlusionMix,
          cue.height,
          cue.blockSeconds,
        ].every(Number.isFinite) ||
        cue.gainRandom.length !== 2 ||
        cue.pitchRandom.length !== 2 ||
        cue.gain + cue.gainRandom[0] < 0 ||
        cue.gainRandom[1] < cue.gainRandom[0] ||
        cue.pitch + cue.pitchRandom[0] <= 0 ||
        cue.pitchRandom[1] < cue.pitchRandom[0] ||
        cue.occlusionMix < 0 ||
        cue.occlusionMix > 1 ||
        cue.blockSeconds < 0 ||
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
        throw new Error(`Invalid native footstep event: ${name}`);
      this.events.set(name, {
        ...cue,
        range: {
          refDistance: cue.curve[0][0],
          maxDistance: cue.curve.at(-1)![0],
          curve: cue.curve,
          occlusionMix: cue.occlusionMix,
        },
      });
    }
    for (const [surface, teams] of Object.entries(this.bindings))
      for (const team of ["ct", "t"] as const)
        if (
          !surface ||
          teams[team].length !== 2 ||
          teams[team].some((name) => !this.events.has(name))
        )
          throw new Error(`Native footstep binding has no imported event: ${surface}/${team}`);
  }
  reset() {
    this.lastPlayed.clear();
  }
  play(soundscape: Soundscape, step: FootstepEvent, firstPerson = false, random = Math.random) {
    const binding =
      this.bindings[step.surface?.toLowerCase() ?? "default"] ?? this.bindings.default;
    if (!binding) return;
    const name = binding[step.team][step.side === "left" ? 0 : 1];
    const cue = this.events.get(name)!;
    const point = new Vector3(step.point.x, step.point.y + cue.height, step.point.z);
    if (
      !firstPerson &&
      point.distanceToSquared(soundscape.spatial.position) >= cue.range.maxDistance ** 2
    )
      return;
    const now = soundscape.context?.currentTime;
    if (now === undefined) return;
    // Native matching is actor/event scoped. This bounded browser map retains
    // one timestamp per recent actor/event instead of accumulating voices.
    const key = `${step.actor}\0${name}`;
    if (now - (this.lastPlayed.get(key) ?? -Infinity) < cue.blockSeconds) return;
    const clip = cue.clips[Math.min(cue.clips.length - 1, Math.floor(random() * cue.clips.length))];
    if (clip === null) return;
    const gain = cue.gain + cue.gainRandom[0] + random() * (cue.gainRandom[1] - cue.gainRandom[0]);
    const pitch =
      cue.pitch + cue.pitchRandom[0] + random() * (cue.pitchRandom[1] - cue.pitchRandom[0]);
    const voice = soundscape.play("step", false, "concrete", firstPerson ? undefined : point, {
      clip,
      gain: gain * (firstPerson ? audibleGain(0, cue.range) : 1),
      pitch,
      range: cue.range,
    });
    if (voice) {
      this.lastPlayed.delete(key);
      this.lastPlayed.set(key, now);
      if (this.lastPlayed.size > 128) this.lastPlayed.delete(this.lastPlayed.keys().next().value!);
    }
    return voice;
  }
}
