// @ts-expect-error The Node test runner provides fs; browser source excludes Node typings.
import { readFileSync } from "node:fs";
// @ts-expect-error The Node test runner provides zlib; browser source excludes Node typings.
import { gunzipSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BakedBombDamage, loadBombDamage } from "./bomb-damage";
import { createNativeTree } from "./bomb-field/native-tree";
import {
  staticRawDamage,
  staticBlastDirection,
  staticPlayerDamage,
} from "./bomb-field/native-math";

const data = Uint8Array.from(
  gunzipSync(readFileSync("../../packages/assets/public/models/maps/dust2-bomb.bin.gz")),
).buffer;
const field = new BakedBombDamage(data);
const meters = (x: number, y: number, z: number) => ({
  x: x * 0.0254,
  y: z * 0.0254,
  z: -y * 0.0254,
});
const siteA = meters(1100, 2500, 140);
const siteB = meters(-1500, 2650, 40);

describe("native Dust II baked C4 field", () => {
  it("imports every sample losslessly and selects native site-major records", () => {
    expect(field.positionCount).toBe(85697);
    expect(field.siteCount).toBe(2);
    const position = meters(1535, 2655, 95);
    const a = field.lookup(siteA, position)!;
    const b = field.lookup(siteB, position)!;
    expect(a.positionIndex).toBe(0);
    expect(b.positionIndex).toBe(0);
    expect(a.sampleDistanceMeters).toBe(0);
    expect(a.siteIndex).toBe(0);
    expect(b.siteIndex).toBe(1);
    expect(a.phase).toBe(294);
    expect(b.phase).toBe(5985);
    expect(a.damage).toBe(255);
    expect(b.damage).toBe(0);
    expect(a.nodePosition).toEqual(position);
  });
  it("uses expanded native site bounds and rejects unknown bomb locations without radial fallback", () => {
    expect(field.lookup(meters(976 - 32, 2336, 96), meters(1535, 2655, 95))).not.toBeNull();
    expect(field.lookup(meters(976 - 32.1, 2336, 96), meters(1535, 2655, 95))).toBeNull();
    expect(field.lookup(meters(0, 0, 0), meters(0, 0, 0))).toBeNull();
    expect(field.lookup(siteA, { x: NaN, y: 0, z: 0 })).toBeNull();
  });
  it("reconstructs byte truncation, saturation and the actual current site powers", () => {
    expect(staticRawDamage(1929, 100)).toBe(255);
    expect(staticRawDamage(1929, 1929)).toBe(100);
    expect(staticRawDamage(1929, 2829)).toBe(50);
    expect(staticRawDamage(1929, 4000)).toBe(0);
    expect(staticRawDamage(3234, 3234)).toBe(100);
    expect(staticRawDamage(3234, 0)).toBe(100);
  });
  it("keeps native leaf tie order and returns the exact nearest point", () => {
    const tree = createNativeTree([
      { x: -1, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
    ]);
    expect(tree.nearest({ x: 0, y: 0, z: 0 })?.positionIndex).toBe(0);
    expect(tree.nearest({ x: 0.9, y: 0, z: 0 })?.positionIndex).toBe(1);
  });
  it("applies stance and facing to sublethal damage without reapplying ballistic armor", () => {
    const dir = staticBlastDirection(0, 0);
    const toward = staticPlayerDamage(50, dir, { x: 1, y: 0, z: 0 }, false);
    const away = staticPlayerDamage(50, dir, { x: -1, y: 0, z: 0 }, false);
    const ducked = staticPlayerDamage(50, dir, { x: 1, y: 0, z: 0 }, true);
    expect(toward).toBeLessThan(away);
    expect(ducked).toBeLessThan(toward);
    expect(staticPlayerDamage(150, dir, { x: 1, y: 0, z: 0 }, true)).toBe(150);
    const hit = field.lookup(siteA, meters(1535, 2655, 95))!;
    expect(field.playerDamage(hit, { x: 0, y: 0, z: -1 }, false)).toBeGreaterThanOrEqual(0);
  });
  it("rejects corrupt field dimensions before reading native records", () => {
    expect(() => new BakedBombDamage(new ArrayBuffer(8))).toThrow();
    const damaged = data.slice(0);
    new DataView(damaged).setUint32(12, 1, true);
    expect(() => new BakedBombDamage(damaged)).toThrow();
  });
});

afterEach(() => vi.unstubAllGlobals());
it("loads both server-decoded and raw gzip responses", async () => {
  for (const body of [
    data,
    Uint8Array.from(readFileSync("../../packages/assets/public/models/maps/dust2-bomb.bin.gz"))
      .buffer,
  ]) {
    vi.stubGlobal("fetch", async () => new Response(body));
    expect((await loadBombDamage()).positionCount).toBe(85697);
  }
});
