import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { expect, test } from "vitest";
import { BakedBombDamage } from "./bomb-damage";

const directory = "../../packages/assets/public/models/maps/";
const metadata = JSON.parse(readFileSync(directory + "mirage-bomb-source.json", "utf8")) as {
  resourceVersion: number;
  positions: number;
  bombsites: number[][];
  runtime: { sha256: string; decodedSha256: string };
};
const compressed = readFileSync(directory + "mirage-bomb.bin.gz");
const decoded = Uint8Array.from(gunzipSync(compressed)).buffer;
const field = new BakedBombDamage(decoded);
const meters = (x: number, y: number, z: number) => ({
  x: x * 0.0254,
  y: z * 0.0254,
  z: -y * 0.0254,
});

test("Mirage native version-2 C4 field retains its exact extracted bytes and both site powers", () => {
  expect(createHash("sha256").update(compressed).digest("hex")).toBe(metadata.runtime.sha256);
  expect(createHash("sha256").update(new Uint8Array(decoded)).digest("hex")).toBe(
    metadata.runtime.decodedSha256,
  );
  expect(new DataView(decoded).getUint32(4, true)).toBe(2);
  expect(metadata.resourceVersion).toBe(2);
  expect(field.positionCount).toBe(68279);
  expect(field.siteCount).toBe(2);
  expect(metadata.bombsites.map((site) => site[6])).toEqual([1795, 2228]);
});

test("Mirage chooses each native site and deals lethal blast damage near its center", () => {
  for (const [index, site] of metadata.bombsites.entries()) {
    const bomb = meters((site[0] + site[3]) / 2, (site[1] + site[4]) / 2, (site[2] + site[5]) / 2);
    const hit = field.lookup(bomb, { ...bomb, y: bomb.y + 0.8 });
    expect(hit?.siteIndex).toBe(index);
    expect(field.playerDamage(hit!, { x: 0, y: 0, z: -1 }, false)).toBeGreaterThanOrEqual(100);
  }
  // Dust II locations must not accidentally query Mirage's unrelated site field.
  expect(field.lookup(meters(1100, 2500, 140), meters(1100, 2500, 180))).toBeNull();
});
