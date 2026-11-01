import { createNativeTree } from "./bomb-field/native-tree";
import {
  staticBlastDirection,
  staticPlayerDamage,
  staticRawDamage,
} from "./bomb-field/native-math";
import type { Vec3 } from "./bomb-field/types";

const unit = 0.0254;
const f = Math.fround;
const toSource = (p: Vec3): Vec3 => ({ x: f(p.x / unit), y: f(-p.z / unit), z: f(p.y / unit) });
const toMeters = (p: Vec3): Vec3 => ({ x: p.x * unit, y: p.z * unit, z: -p.y * unit });
const toSourceDirection = (p: Vec3): Vec3 => ({ x: p.x, y: -p.z, z: p.y });

/** Native second-query arithmetic is float32 in Source coordinates. */
export function groundCorrectedBombSample(sample: Vec3, origin: Vec3, groundY: number): Vec3 {
  const point = toSource(sample);
  const feet = toSource(origin);
  return toMeters({ x: point.x, y: point.y, z: f(f(point.z - feet.z) + f(groundY / unit)) });
}

export interface BombFieldHit {
  damage: number;
  phase: number;
  siteIndex: number;
  positionIndex: number;
  sampleDistanceMeters: number;
  nodePosition: Vec3;
  direction: Vec3;
}

/** Lossless Valve baked field plus a statically reconstructed native KD-tree query.
 * All public positions/directions use this game's meter-based Three coordinates.
 * Caller supplies actual collision-center and optional ground-corrected samples.
 * No radial fallback, inferred timing, or firearm armor multiplier is applied.
 */
export class BakedBombDamage {
  readonly positionCount: number;
  readonly siteCount: number;
  private readonly sites: { min: Vec3; max: Vec3; power: number }[];
  private readonly points: Vec3[];
  private readonly tree: ReturnType<typeof createNativeTree>;
  private readonly records: DataView;

  constructor(buffer: ArrayBuffer) {
    const view = new DataView(buffer);
    if (buffer.byteLength < 16 || view.getUint32(0, true) !== 0x424d4f42)
      throw new Error("Invalid C4 field header");
    const version = view.getUint32(4, true);
    this.siteCount = view.getUint32(8, true);
    this.positionCount = view.getUint32(12, true);
    const siteBytes = this.siteCount * 28;
    const pointBytes = this.positionCount * 6;
    const recordBytes = this.positionCount * this.siteCount * 4;
    if (
      ![1, 2].includes(version) ||
      !this.siteCount ||
      !this.positionCount ||
      buffer.byteLength !== 16 + siteBytes + pointBytes + recordBytes
    )
      throw new Error("Invalid C4 field dimensions");
    this.sites = Array.from({ length: this.siteCount }, (_, i) => {
      const at = 16 + i * 28;
      return {
        min: {
          x: f(view.getFloat32(at, true) - 32),
          y: f(view.getFloat32(at + 4, true) - 32),
          z: f(view.getFloat32(at + 8, true) - 32),
        },
        max: {
          x: f(view.getFloat32(at + 12, true) + 32),
          y: f(view.getFloat32(at + 16, true) + 32),
          z: f(view.getFloat32(at + 20, true) + 32),
        },
        power: view.getFloat32(at + 24, true),
      };
    });
    if (
      this.sites.some(
        (site) =>
          !Number.isFinite(site.power) ||
          (["x", "y", "z"] as const).some(
            (axis) =>
              !Number.isFinite(site.min[axis]) ||
              !Number.isFinite(site.max[axis]) ||
              site.min[axis] > site.max[axis],
          ),
      )
    )
      throw new Error("Invalid C4 site bounds");
    this.points = Array.from({ length: this.positionCount }, (_, i) => {
      const at = 16 + siteBytes + i * 6;
      return {
        x: view.getInt16(at, true),
        y: view.getInt16(at + 2, true),
        z: view.getInt16(at + 4, true),
      };
    });
    this.tree = createNativeTree(this.points);
    this.records = new DataView(buffer, 16 + siteBytes + pointBytes, recordBytes);
  }

  lookup(bombPosition: Vec3, samplePosition: Vec3): BombFieldHit | null {
    const bomb = toSource(bombPosition);
    const sample = toSource(samplePosition);
    const siteIndex = this.sites.findIndex(
      (s) =>
        bomb.x >= s.min.x &&
        bomb.x <= s.max.x &&
        bomb.y >= s.min.y &&
        bomb.y <= s.max.y &&
        bomb.z >= s.min.z &&
        bomb.z <= s.max.z,
    );
    if (siteIndex < 0) return null;
    const nearest = this.tree.nearest(sample);
    if (!nearest) return null;
    const offset = (siteIndex * this.positionCount + nearest.positionIndex) * 4;
    const phase = this.records.getUint16(offset, true);
    const direction = staticBlastDirection(
      this.records.getUint8(offset + 2),
      this.records.getUint8(offset + 3),
    );
    return {
      damage: staticRawDamage(this.sites[siteIndex]!.power, phase),
      phase,
      siteIndex,
      positionIndex: nearest.positionIndex,
      sampleDistanceMeters: Math.sqrt(nearest.distanceSquared) * unit,
      nodePosition: toMeters(this.points[nearest.positionIndex]!),
      direction: { x: direction.x, y: direction.z, z: -direction.y },
    };
  }

  /** Final health-damage byte from the reconstructed player query; do not apply
   * ballistic armor a second time. Native armor depletion and wave timing remain
   * unqualified; see docs/weapon-data.md. Forward must be a unit direction. */
  playerDamage(hit: BombFieldHit, forward: Vec3, crouched: boolean): number {
    return staticPlayerDamage(
      hit.damage,
      toSourceDirection(hit.direction),
      toSourceDirection(forward),
      crouched,
    );
  }
}
