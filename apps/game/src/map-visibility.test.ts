import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "vitest";
import * as T from "three";
import { Navigation, type NavArea } from "./navigation";
import { encodeVisibilityBits, MapVisibility, type MapVisibilityData } from "./map-visibility";

const area = (id: number, x: number): NavArea => ({
  id,
  center: [x, 0, 0],
  rect: [x - 1, -1, x + 1, 1],
  corners: [],
  flags: 0,
  cover: [],
  place: "",
  links: [],
});

function world() {
  const scenery = new T.Group();
  const wall = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  wall.name = "wall";
  const geometry = new T.BoxGeometry();
  geometry.clearGroups();
  geometry.addGroup(0, 12, 0);
  geometry.addGroup(12, 12, 1);
  const building = new T.Mesh(geometry, [new T.MeshBasicMaterial(), new T.MeshBasicMaterial()]);
  building.name = "building";
  const door = new T.Mesh(new T.BoxGeometry(), new T.MeshBasicMaterial());
  door.name = "door";
  scenery.add(wall, building, door);
  const navigation = new Navigation({
    areas: [area(1, 0), area(2, 4)],
    spawns: { t: [], ct: [] },
    sites: [],
    bounds: [],
  });
  // Area 1 sees everything; area 2 sees only the building's second slot.
  const data: MapVisibilityData = {
    version: 1,
    map: "dust2",
    sources: {},
    heights: [1.63],
    units: ["wall#0", "building#0", "building#1"],
    areas: [1, 2],
    sets: encodeVisibilityBits(new Uint8Array([0b111, 0b100])),
  };
  return { scenery, wall, building, door, navigation, data };
}

test("culls baked-hidden draws for one render and restores them afterwards", () => {
  const { scenery, wall, building, door, navigation, data } = world();
  const visibility = MapVisibility.create(data, scenery, navigation, [door])!;
  const groups = building.geometry.groups;
  let during: unknown;
  visibility.render(new T.Vector3(4, 1.63, 0), () => {
    during = {
      wall: wall.visible,
      groups: building.geometry.groups.map((group) => group.materialIndex),
      door: door.visible,
    };
  });
  expect(during).toEqual({ wall: false, groups: [1], door: true });
  expect(visibility.culled).toBe(2);
  expect(wall.visible).toBe(true);
  expect(building.geometry.groups).toBe(groups);

  visibility.render(new T.Vector3(0, 1.63, 0), () => {
    during = wall.visible && building.geometry.groups.length;
  });
  expect(during).toBe(2);
  // Outside the baked eye-height range nothing is culled.
  visibility.render(new T.Vector3(4, 8, 0), () => (during = wall.visible));
  expect(during).toBe(true);
});

test("vertex-expanded draws keep their baked key but are never culled", () => {
  const { scenery, wall, door, navigation, data } = world();
  wall.userData.visibilityExempt = true;
  const visibility = MapVisibility.create(data, scenery, navigation, [door])!;
  let during: unknown;
  visibility.render(new T.Vector3(4, 1.63, 0), () => (during = wall.visible));
  expect(during).toBe(true);
});

test("a bake whose occluders no longer exist as opaque draws is rejected", () => {
  const { scenery, wall, door, navigation, data } = world();
  (wall.material as T.Material).transparent = true;
  expect(MapVisibility.create(data, scenery, navigation, [door])).toBeUndefined();
});

test("checked-in bakes match the current scenery assets", () => {
  const root = new URL("../../../packages/assets/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8")) as {
    files: Record<string, { sha256: string }>;
  };
  const maps = new URL("public/models/maps/", root);
  for (const name of readdirSync(maps).filter((file) => file.endsWith("-visibility.json"))) {
    const data = JSON.parse(readFileSync(new URL(name, maps), "utf8")) as MapVisibilityData;
    const map = name.slice(0, -"-visibility.json".length);
    expect(data.map).toBe(map);
    const current = Object.entries(manifest.files).filter(
      ([path]) =>
        path.startsWith(`models/maps/${map}`) &&
        /\.glb(\.gz)?$/.test(path) &&
        !path.endsWith("-physics.glb.gz"),
    );
    for (const [path, entry] of current)
      expect(data.sources[path], `${name} is stale; rerun scripts/bake-visibility.mjs`).toBe(
        entry.sha256,
      );
    for (const [path, sha256] of Object.entries(data.sources))
      expect(manifest.files[path]?.sha256, `${name}: ${path}`).toBe(sha256);
  }
});
