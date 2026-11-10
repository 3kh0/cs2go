import * as T from "three";

export interface NativeClutterBounds {
  m_vMinBounds: [number, number, number];
  m_vMaxBounds: [number, number, number];
}
export interface NativeClutterGroup {
  id: string;
  nativeGroupIndex: number;
  nativeResource: string;
  templateNativeSha256: string;
  materialGroup: string;
  firstInstance: number;
  instanceCount: number;
  nativeLayer: number;
  nativeFlags: string;
  nativeBeginCullSize: number;
  nativeEndCullSize: number;
  nativeBounds: NativeClutterBounds;
  nativeTiles: {
    m_nFirstInstance: number;
    m_nLastInstance: number;
    m_BoundsWs: NativeClutterBounds;
  }[];
}
export interface NativeClutterFields {
  version: 1;
  scope: "main" | "sky";
  placements: { count: number; stride: number; bytes: number };
  groups: NativeClutterGroup[];
}

export function nativeClutterBounds(bounds: NativeClutterBounds) {
  const lo = bounds.m_vMinBounds,
    hi = bounds.m_vMaxBounds;
  if (
    lo.length !== 3 ||
    hi.length !== 3 ||
    lo.some((v, i) => !Number.isFinite(v) || !Number.isFinite(hi[i]) || v > hi[i])
  )
    throw new Error("Invalid native clutter bounds");
  return new T.Box3(
    new T.Vector3(lo[0], lo[2], -hi[1]).multiplyScalar(0.0254),
    new T.Vector3(hi[0], hi[2], -lo[1]).multiplyScalar(0.0254),
  );
}

/** Retains the original float32 fields and packed rotation. Matrix construction
 * follows VRF WorldNode's 11/10/10-bit equation without quaternion normalization;
 * JavaScript intermediate arithmetic is not a claim of native float32 matrix bytes. */
export class NativeClutterData {
  private readonly view: DataView;
  readonly count: number;
  readonly fields: NativeClutterFields;
  constructor(fields: NativeClutterFields, bytes: ArrayBuffer) {
    this.fields = fields;
    const { count, stride } = fields.placements;
    if (
      fields.version !== 1 ||
      !Number.isSafeInteger(count) ||
      count < 0 ||
      stride !== 24 ||
      bytes.byteLength !== count * stride ||
      fields.placements.bytes !== bytes.byteLength
    )
      throw new Error("Invalid native clutter placement layout");
    this.count = count;
    this.view = new DataView(bytes);
    let cursor = 0;
    const ids = new Set<string>();
    for (const group of fields.groups) {
      if (
        ids.has(group.id) ||
        group.firstInstance !== cursor ||
        !Number.isSafeInteger(group.instanceCount) ||
        group.instanceCount < 0 ||
        cursor + group.instanceCount > count
      )
        throw new Error("Invalid native clutter group range");
      ids.add(group.id);
      nativeClutterBounds(group.nativeBounds);
      let tileCursor = 0;
      for (const tile of group.nativeTiles) {
        if (
          tile.m_nFirstInstance !== tileCursor ||
          !Number.isSafeInteger(tile.m_nLastInstance) ||
          tile.m_nLastInstance < tileCursor ||
          tile.m_nLastInstance > group.instanceCount
        )
          throw new Error("Invalid native clutter exclusive tile range");
        nativeClutterBounds(tile.m_BoundsWs);
        tileCursor = tile.m_nLastInstance;
      }
      if (tileCursor !== group.instanceCount)
        throw new Error("Incomplete native clutter tile coverage");
      cursor += group.instanceCount;
    }
    if (cursor !== count) throw new Error("Incomplete native clutter group coverage");
    for (let i = 0; i < count; i++) {
      const p = this.source(i);
      if (p.xyz.some((v) => !Number.isFinite(v)) || !Number.isFinite(p.scale) || p.scale <= 0)
        throw new Error("Invalid native clutter placement fields");
    }
  }
  source(index: number) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.count)
      throw new Error("Native clutter placement index outside source stream");
    const offset = index * 24,
      v = this.view;
    return {
      xyz: [
        v.getFloat32(offset, true),
        v.getFloat32(offset + 4, true),
        v.getFloat32(offset + 8, true),
      ],
      scale: v.getFloat32(offset + 12, true),
      quaternion: v.getUint32(offset + 16, true),
      tint: [v.getUint8(offset + 20), v.getUint8(offset + 21), v.getUint8(offset + 22)],
    };
  }
  matrix(index: number, target = new T.Matrix4()) {
    const p = this.source(index),
      x = (p.quaternion & 2047) * (2 / 2047) - 1,
      y = ((p.quaternion >>> 11) & 1023) * (2 / 1023) - 1,
      z = ((p.quaternion >>> 21) & 1023) * (2 / 1023) - 1,
      w = Math.sqrt(1 - Math.min(0.999999, x * x + y * y + z * z)) * (p.quaternion >>> 31 ? -1 : 1);
    return target.compose(
      new T.Vector3(p.xyz[0], p.xyz[2], -p.xyz[1]).multiplyScalar(0.0254),
      new T.Quaternion(x, z, -y, w),
      new T.Vector3().setScalar(p.scale),
    );
  }
}
