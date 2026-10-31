import { Vector3, type Camera } from "three";
import { NativeAcoustics, roomImpulse } from "./room-acoustics";

export type SoundRange = {
  refDistance: number;
  maxDistance: number;
  curve?: readonly (readonly [number, number])[];
  occlusion?: number;
};
// An inverse panner clamps attenuation at maxDistance; this envelope fades to
// actual silence instead of leaving distant voices at a constant audible gain.
export function audibleGain(distance: number, range: SoundRange) {
  if (range.curve) {
    if (distance >= range.maxDistance) return 0;
    const points = range.curve;
    if (distance <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i],
        [previousX, previousY] = points[i - 1];
      if (distance <= x)
        return previousY + ((y - previousY) * (distance - previousX)) / (x - previousX);
    }
    return 0;
  }

  const t = Math.max(0, (distance - range.refDistance) / (range.maxDistance - range.refDistance));
  return Math.max(0, 1 - t * t) ** 2;
}

// Native path connectivity supports obstructed sounds; HRTF direction, spectral
// diffraction and geometry-driven convolution sends are browser reconstructions.
export class SpatialAudio {
  position = new Vector3();
  native?: NativeAcoustics;
  useNativeProbes = false;
  private listenerProbe = -1;
  private nextProbe = 0;
  private probe = 0;
  private enclosure = [false, false, false, false, false, false];
  private probeEnd = new Vector3();
  private bend = new Vector3();
  private rooms?: {
    context: AudioContext;
    output: AudioNode;
    sends: GainNode[];
    convolvers: ConvolverNode[];
  };
  get roomState() {
    const walls = this.enclosure.slice(2).filter(Boolean).length / 4;
    const enclosed = this.enclosure[1] ? 1 : 0;
    const small = this.enclosure[0] ? 0.6 + walls * 0.4 : walls * 0.35;
    return {
      short: 0.012 + walls * 0.025 + enclosed * small * 0.15,
      long: enclosed * (1 - small * 0.6) * 0.12,
    };
  }
  private updateRoom(context: AudioContext) {
    if (context.currentTime < this.nextProbe || !this.obstructed) return;
    this.nextProbe = context.currentTime + 0.06;
    const directions = [
      [0, 4, 0],
      [0, 12, 0],
      [6, 0, 0],
      [-6, 0, 0],
      [0, 0, 6],
      [0, 0, -6],
    ];
    this.probeEnd.copy(this.position).add(new Vector3(...directions[this.probe]));
    this.enclosure[this.probe] = this.obstructed(this.position, this.probeEnd);
    this.probe = (this.probe + 1) % directions.length;
    this.listenerProbe = this.useNativeProbes ? (this.native?.nearest(this.position) ?? -1) : -1;
    const state = this.roomState;
    this.rooms?.sends.forEach((send, index) =>
      send.gain.setTargetAtTime(index ? state.long : state.short, context.currentTime, 0.18),
    );
  }
  connectRoom(context: AudioContext, input: AudioNode, output: AudioNode) {
    if (!this.rooms || this.rooms.context !== context || this.rooms.output !== output) {
      if (this.rooms) this.resetRooms();
      const convolvers = [false, true].map((large) => {
        const convolver = context.createConvolver();
        convolver.normalize = false;
        convolver.buffer = roomImpulse(context, large);
        convolver.connect(output);
        return convolver;
      });
      const state = this.roomState;
      const sends = convolvers.map((convolver, index) => {
        const send = context.createGain();
        send.gain.value = index ? state.long : state.short;
        send.connect(convolver);
        return send;
      });
      this.rooms = { context, output, convolvers, sends };
    }
    for (const send of this.rooms.sends) input.connect(send);
  }
  resetRooms() {
    for (const node of this.rooms?.convolvers ?? []) node.disconnect();
    for (const node of this.rooms?.sends ?? []) node.disconnect();
    this.rooms = undefined;
    this.enclosure.fill(false);
    this.nextProbe = 0;
  }
  get convolverCount() {
    return this.rooms?.convolvers.length ?? 0;
  }
  private forward = new Vector3();
  private up = new Vector3();
  private voices = new Set<{
    position: Vector3;
    filter: BiquadFilterNode;
    gain: GainNode;
    panner: PannerNode;
    nextCheck: number;
    sourceProbe: number;
    range: SoundRange;
  }>();
  obstructed?: (from: Vector3, to: Vector3) => boolean;
  update(context: AudioContext, camera: Camera) {
    camera.getWorldPosition(this.position);
    camera.getWorldDirection(this.forward);
    this.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
    const listener = context.listener;
    for (const [parameter, value] of [
      [listener.positionX, this.position.x],
      [listener.positionY, this.position.y],
      [listener.positionZ, this.position.z],
      [listener.forwardX, this.forward.x],
      [listener.forwardY, this.forward.y],
      [listener.forwardZ, this.forward.z],
      [listener.upX, this.up.x],
      [listener.upY, this.up.y],
      [listener.upZ, this.up.z],
    ] as const)
      parameter.value = value;
    this.updateRoom(context);
    // One room trace plus at most eleven voice/path traces per frame. Probe
    // sampling is spread over 360 ms, voice refreshes over 125 ms.
    let budget = 11;
    for (const voice of this.voices) {
      if (budget <= 0) break;
      if (voice.nextCheck > context.currentTime) continue;
      budget--;
      voice.nextCheck = context.currentTime + 0.125;
      const blocked = this.obstructed?.(this.position, voice.position) ?? false;
      let level = blocked ? 0.065 : 1;
      let cutoff = blocked ? 700 : 18000;
      let apparent = voice.position;
      if (blocked) {
        const path = this.useNativeProbes
          ? this.native?.path(this.listenerProbe, voice.sourceProbe)
          : undefined;
        if (path && path.ratio > 0) {
          // Native connectivity/distortion metadata, authored perceptual mapping.
          level = (0.28 * Math.sqrt(path.ratio)) / (1 + path.deviation * 0.1);
          cutoff = 2400 / (1 + path.deviation * 0.25);
        }
        const dx = voice.position.x - this.position.x,
          dz = voice.position.z - this.position.z;
        const distance = Math.hypot(dx, dz) || 1;
        for (const offset of [2, -2, 5, -5]) {
          if (budget < 2) break;
          budget -= 2;
          this.bend.copy(this.position).lerp(voice.position, 0.5);
          this.bend.x += (-dz / distance) * offset;
          this.bend.z += (dx / distance) * offset;
          if (
            this.obstructed?.(this.position, this.bend) ||
            this.obstructed?.(this.bend, voice.position)
          )
            continue;
          const detour = this.position.distanceTo(this.bend) + this.bend.distanceTo(voice.position);
          const excess = detour - this.position.distanceTo(voice.position);
          level = Math.max(level, 0.38 / (1 + excess * 0.2));
          cutoff = 2800 / (1 + excess * 0.15);
          // Preserve source distance attenuation while direction follows the
          // visible bend, rather than making the hidden source sound closer.
          this.bend.sub(this.position).normalize().multiplyScalar(detour).add(this.position);
          apparent = this.bend;
          break;
        }
      }
      voice.panner.positionX.setTargetAtTime(apparent.x, context.currentTime, 0.04);
      voice.panner.positionY.setTargetAtTime(apparent.y, context.currentTime, 0.04);
      voice.panner.positionZ.setTargetAtTime(apparent.z, context.currentTime, 0.04);
      voice.filter.frequency.setTargetAtTime(cutoff, context.currentTime, 0.04);
      voice.gain.gain.setTargetAtTime(
        level * audibleGain(this.position.distanceTo(voice.position), voice.range),
        context.currentTime,
        0.04,
      );
    }
  }
  connect(
    context: AudioContext,
    input: AudioNode,
    output: AudioNode,
    position: Vector3,
    loud: boolean | SoundRange = false,
  ) {
    const panner = context.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    const range =
      typeof loud === "object"
        ? loud
        : { refDistance: loud ? 5 : 1.5, maxDistance: loud ? 150 : 35 };
    panner.refDistance = range.refDistance;
    panner.maxDistance = range.maxDistance;
    panner.rolloffFactor = range.curve ? 0 : 1;
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 18000;
    const gain = context.createGain();
    const blocked = this.obstructed?.(this.position, position) ?? false;
    filter.frequency.value = blocked ? 700 : 18000;
    gain.gain.value =
      (blocked ? 0.065 : 1) * audibleGain(this.position.distanceTo(position), range);
    input.connect(filter).connect(gain).connect(panner).connect(output);
    this.connectRoom(context, panner, output);
    const voice = {
      position: position.clone(),
      range,
      filter,
      gain,
      panner,
      nextCheck: 0,
      sourceProbe: this.useNativeProbes ? (this.native?.nearest(position) ?? -1) : -1,
    };
    this.voices.add(voice);
    return () => {
      this.voices.delete(voice);
      filter.disconnect();
      gain.disconnect();
      panner.disconnect();
    };
  }
  get voiceCount() {
    return this.voices.size;
  }
}
