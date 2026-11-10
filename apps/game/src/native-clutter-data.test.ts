import { expect, it } from "vitest";
import { NativeClutterData, type NativeClutterFields } from "./native-clutter-data";
function fixture() {
  const bounds = {
    m_vMinBounds: [-1, -2, -3] as [number, number, number],
    m_vMaxBounds: [1, 2, 3] as [number, number, number],
  };
  const fields: NativeClutterFields = {
    version: 1,
    scope: "main",
    placements: { count: 1, stride: 24, bytes: 24 },
    groups: [
      {
        id: "main:0",
        nativeGroupIndex: 0,
        nativeResource: "source",
        templateNativeSha256: "pin",
        materialGroup: "",
        firstInstance: 0,
        instanceCount: 1,
        nativeLayer: 0,
        nativeFlags: "OBJECT_TYPE_NONE",
        nativeBeginCullSize: 0.02,
        nativeEndCullSize: 0.01,
        nativeBounds: bounds,
        nativeTiles: [{ m_nFirstInstance: 0, m_nLastInstance: 1, m_BoundsWs: bounds }],
      },
    ],
  };
  const bytes = new ArrayBuffer(24),
    view = new DataView(bytes);
  view.setFloat32(0, 100, true);
  view.setFloat32(4, 200, true);
  view.setFloat32(8, 300, true);
  view.setFloat32(12, 1.6045646667480469, true);
  view.setUint32(16, 1735371784, true);
  for (let i = 20; i < 23; i++) view.setUint8(i, 255);
  return { fields, bytes, view };
}
it("retains source IEEE scale and quaternion fields before browser placement", () => {
  const { fields, bytes } = fixture(),
    data = new NativeClutterData(fields, bytes);
  expect(data.source(0)).toEqual({
    xyz: [100, 200, 300],
    scale: 1.6045646667480469,
    quaternion: 1735371784,
    tint: [255, 255, 255],
  });
  expect(data.source(0).scale).not.toBe(Math.fround(1.604565));
  expect(data.matrix(0).elements.slice(12, 15)).toEqual([2.54, 7.62, -5.08]);
});
it("uses pinned packed quaternion equation without normalization", () => {
  const { fields, bytes, view } = fixture();
  view.setUint32(16, 0, true);
  const data = new NativeClutterData(fields, bytes);
  expect(data.matrix(0).elements[0]).toBe(-3 * data.source(0).scale);
});
it("rejects incomplete exclusive tiles and invalid source fields", () => {
  const { fields, bytes, view } = fixture();
  fields.groups[0].nativeTiles[0].m_nLastInstance = 0;
  expect(() => new NativeClutterData(fields, bytes)).toThrow("tile coverage");
  fields.groups[0].nativeTiles[0].m_nLastInstance = 1;
  view.setFloat32(12, NaN, true);
  expect(() => new NativeClutterData(fields, bytes)).toThrow("placement fields");
});
