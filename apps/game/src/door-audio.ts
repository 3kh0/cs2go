import { Vector3 } from "three";
import type { DoorState } from "@cs2go/protocol";
import {
  nativeDoorDestroyed,
  type DoorSoundKind,
  type NativeDoorDefinition,
} from "@cs2go/simulation/doors";
import type { Soundscape } from "./soundscape";

/** Cues follow authoritative poses, not the interpolated render cadence.
 * Initial/late-join and reset poses establish a silent baseline. Native event
 * clips/parameters are retained; engine event timing remains reconstructed. */
export class DoorAudio {
  private previous = new Map<string, { angle: number; target: number }>();
  private position = new Vector3();
  private voices = new Map<string, AudioBufferSourceNode>();
  private lastPlayed = new Map<string, { at: number; position: Vector3 }>();
  reset() {
    this.previous.clear();
    for (const source of this.voices.values()) source.stop();
    this.voices.clear();
    this.lastPlayed.clear();
  }
  observe(
    definitions: readonly NativeDoorDefinition[],
    states: readonly DoorState[],
    emit: (definition: NativeDoorDefinition, kind: DoorSoundKind) => void,
    silent = false,
  ) {
    for (const definition of definitions) {
      const state = states.find((candidate) => candidate.id === definition.id);
      if (!state) continue;
      const previous = this.previous.get(state.id);
      const closed = definition.startAngle ?? 0;
      if (previous && !silent && !nativeDoorDestroyed(definition, state)) {
        const moving = Math.abs(state.angle - state.target) > 1e-5;
        const wasMoving = Math.abs(previous.angle - previous.target) > 1e-5;
        const targetChanged = Math.abs(state.target - previous.target) > 1e-5;
        if ((targetChanged || (!wasMoving && moving)) && moving) {
          const start = Math.abs(state.target - closed) < 1e-5 ? "startClose" : "startOpen";
          if (definition.sounds?.[start]) emit(definition, start);
          else if (definition.sounds?.move) emit(definition, "move");
        }
        // A sparse snapshot may contain both a new target and its completed pose.
        if (!moving && (wasMoving || targetChanged))
          emit(definition, Math.abs(state.angle - closed) < 1e-5 ? "fullClose" : "fullOpen");
      }
      if (previous) {
        previous.angle = state.angle;
        previous.target = state.target;
      } else this.previous.set(state.id, { angle: state.angle, target: state.target });
    }
  }
  play(soundscape: Soundscape, definition: NativeDoorDefinition, kind: DoorSoundKind) {
    const event = definition.sounds?.[kind];
    if (!event?.clips.length || event.curve.length < 2) return;
    const clip = event.clips[Math.floor(Math.random() * event.clips.length)];
    this.position.set(
      definition.pivot[0] + event.offset[0],
      definition.pivot[1] + event.offset[1],
      definition.pivot[2] + event.offset[2],
    );
    const now = soundscape.context?.currentTime;
    if (now === undefined) return;
    if (this.position.distanceTo(soundscape.spatial.position) >= event.curve.at(-1)![0]) return;
    const previous = this.lastPlayed.get(event.event);
    if (
      previous &&
      now - previous.at < (event.blockSeconds ?? 0) &&
      previous.position.distanceTo(this.position) <= (event.blockDistance ?? Infinity)
    )
      return;
    if (event.instances === 1) this.voices.get(event.event)?.stop();
    const source = soundscape.play(`map-door-${clip}`, false, "concrete", this.position, {
      gain: event.gain,
      pitch: event.pitch,
      range: {
        refDistance: 1,
        maxDistance: event.curve.at(-1)![0],
        curve: event.curve,
        occlusionMix: event.occlusionMix,
      },
    });
    if (source) {
      this.lastPlayed.set(event.event, { at: now, position: this.position.clone() });
      this.voices.set(event.event, source);
      source.addEventListener(
        "ended",
        () => {
          if (this.voices.get(event.event) === source) this.voices.delete(event.event);
        },
        { once: true },
      );
    }
  }
}
