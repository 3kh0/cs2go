import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { mapCalloutAt, type MapCallout, type NativePlaces } from "./map-callouts";

const cube = (name: string, bottom: number, top: number): MapCallout => ({
  id: name,
  token: name,
  name,
  hulls: [
    {
      min: [0, bottom, 0],
      max: [4, top, 4],
      planes: [
        [-1, 0, 0, 0],
        [1, 0, 0, 4],
        [0, -1, 0, -bottom],
        [0, 1, 0, top],
        [0, 0, -1, 0],
        [0, 0, 1, 4],
      ],
    },
  ],
});
test("callouts distinguish vertically stacked rooms and exact convex boundaries", () => {
  const lower = cube("Lower Tunnel", 0, 2);
  const upper = cube("Upper Tunnel", 3, 5);
  expect(mapCalloutAt([lower, upper], { x: 2, y: 0, z: 2 })?.name).toBe("Lower Tunnel");
  expect(mapCalloutAt([lower, upper], { x: 2, y: 3, z: 2 })?.name).toBe("Upper Tunnel");
  expect(mapCalloutAt([lower, upper], { x: 2, y: 1.5, z: 2 })).toBeUndefined();
  lower.hulls[0].planes.push([1, 0, 1, 3]);
  expect(mapCalloutAt([lower], { x: 2, y: 0, z: 2 })).toBeUndefined();
  expect(mapCalloutAt([lower], { x: 1, y: 0, z: 1 })?.name).toBe("Lower Tunnel");
});
for (const map of ["dust2", "mirage"] as const)
  test(`${map} native place volumes label both faction spawn locations`, () => {
    const places: NativePlaces = JSON.parse(
      readFileSync(
        new URL(`../../../packages/assets/public/models/maps/${map}-places.json`, import.meta.url),
        "utf8",
      ),
    );
    const navigation = JSON.parse(
      readFileSync(
        new URL(`../../../packages/assets/public/models/maps/${map}-nav.json`, import.meta.url),
        "utf8",
      ),
    ) as { spawns: Record<"ct" | "t", number[][]> };
    expect(places.mapId).toBe(map);
    for (const team of ["ct", "t"] as const) {
      const [x, y, z] = navigation.spawns[team][0];
      expect(mapCalloutAt(places.locations, { x, y, z })?.token).toBe(
        team === "ct" ? "CTSpawn" : "TSpawn",
      );
    }
  });
