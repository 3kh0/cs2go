import { Vector3 } from "three";

export class NativeAcoustics {
  readonly probes: Float32Array;
  readonly ratio: Uint8Array;
  readonly deviation: Uint8Array;
  readonly count: number;
  constructor(data: ArrayBuffer) {
    const header = new DataView(data);
    this.count = header.getUint32(0, true);
    const pairs = header.getUint32(4, true);
    if (
      pairs !== (this.count * (this.count - 1)) / 2 ||
      data.byteLength !== 8 + this.count * 16 + pairs * 2
    )
      throw new Error("Invalid native acoustic probe data");
    this.probes = new Float32Array(data, 8, this.count * 4);
    this.ratio = new Uint8Array(data, 8 + this.count * 16, pairs);
    this.deviation = new Uint8Array(data, 8 + this.count * 16 + pairs, pairs);
  }
  nearest(position: Vector3) {
    let best = -1,
      distance = 144;
    for (let i = 0; i < this.count; i++) {
      const k = i * 4;
      const d =
        (this.probes[k] - position.x) ** 2 +
        (this.probes[k + 1] - position.y) ** 2 +
        (this.probes[k + 2] - position.z) ** 2;
      if (d < distance) {
        distance = d;
        best = i;
      }
    }
    return best;
  }
  path(a: number, b: number) {
    if (a < 0 || b < 0) return undefined;
    if (a === b) return { ratio: 1, deviation: 0 };
    const i = Math.min(a, b),
      j = Math.max(a, b);
    const index = (i * (2 * this.count - i - 1)) / 2 + j - i - 1;
    return { ratio: this.ratio[index] / 255, deviation: (this.deviation[index] * 12) / 255 };
  }
}

// Authored, deterministic stereo responses: geometric early reflections followed
// by a diffuse, progressively low-passed decay. Not a captured Valve impulse.
export function roomImpulse(context: BaseAudioContext, large: boolean) {
  const duration = large ? 1 : 0.45;
  const buffer = context.createBuffer(
    2,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  );
  const rt60 = large ? 0.7 : 0.25;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    let seed = 1977 + channel * 3121,
      previous = 0;
    for (let i = 0; i < data.length; i++) {
      const time = i / context.sampleRate;
      if (time < 0.012) continue;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const noise = (seed / 4294967296) * 2 - 1;
      previous += (noise - previous) * (large ? 0.22 : 0.4);
      data[i] = previous * Math.exp((-6.908 * time) / rt60) * 0.025;
    }
    for (const [delay, gain] of [
      [0.014, 0.3],
      [0.026, 0.2],
      [0.041, 0.14],
      [0.063, 0.08],
    ]) {
      const index = Math.round((delay * (large ? 1.8 : 1) + channel * 0.0017) * context.sampleRate);
      data[index] += gain;
    }
  }
  return buffer;
}
