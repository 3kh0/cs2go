import { expect, it } from "vitest";
import * as T from "three";
import { ballistics, penetrate, rangeDamage } from "./ballistics";
import { fleshThickness, hitgroupMultiplier, meshThickness, solveBullet } from "./bullet-solver";
import type { BulletSurface } from "./bullet-solver";
const surface = (
  distance: number,
  thickness: number,
  material: BulletSurface<string>["material"],
  id?: string,
): BulletSurface<string> => ({ distance, thickness, material, id, data: id ?? material });

it("orders cover and flesh, attenuates full travel distance, and hits an actor once per pellet", () => {
  const wall = surface(3, 0.12, "wood", "wall");
  const first = surface(8, 0.28, "flesh", "first");
  const second = surface(10, 0.28, "flesh", "second");
  const shot = solveBullet(ballistics[3], [
    second,
    first,
    surface(8.03, 0.3, "flesh", "first"),
    wall,
  ]);
  expect(shot.contacts.map((contact) => contact.surface.data)).toEqual(["wall", "first", "second"]);
  const woodExit = penetrate(rangeDamage(115, 3, 0.99), 2.5, 0.12, "wood");
  const firstDamage = rangeDamage(woodExit, 5, 0.99);
  expect(shot.contacts[1].damage).toBeCloseTo(firstDamage);
  expect(shot.contacts[2].damage).toBeCloseTo(
    rangeDamage(penetrate(firstDamage, 2.5, 0.28, "flesh"), 2, 0.99),
  );
  expect(shot.contacts[1].passed).toBe(true);
  expect(solveBullet(ballistics[3], [first]).contacts[0].damage).toBeGreaterThan(firstDamage);
});
it("stops at thick cover and at the fifth barrier", () => {
  expect(
    solveBullet(ballistics[3], [surface(2, 3, "wood"), surface(8, 0.3, "flesh", "target")])
      .contacts,
  ).toHaveLength(1);
  const layers = Array.from({ length: 5 }, (_, index) =>
    surface(2 + index, 0.01, "glass", `layer${index}`),
  );
  const shot = solveBullet(ballistics[3], [...layers, surface(10, 0.3, "flesh", "target")]);
  expect(shot.contacts).toHaveLength(5);
  expect(shot.remaining).toBe(0);
  expect(shot.contacts.some((contact) => contact.surface.data === "target")).toBe(false);
});
it("does not skip cover touching a body or count entry/exit faces twice", () => {
  const shot = solveBullet(ballistics[3], [
    surface(2, 0.44, "flesh", "first"),
    surface(2.2, 3, "concrete"),
    surface(3, 0.3, "flesh", "second"),
  ]);
  expect(shot.contacts.map((contact) => contact.surface.data)).toEqual(["first", "concrete"]);
  const thin = solveBullet(ballistics[3], [
    surface(2, 0.2, "wood"),
    surface(2.1, 0.1, "wood"),
    surface(3, 0.3, "flesh", "target"),
  ]);
  expect(thin.contacts).toHaveLength(2);
});
it("respects weapon range and teammate hard stops", () => {
  expect(solveBullet(ballistics[10], [surface(100, 0.3, "flesh", "target")]).contacts).toHaveLength(
    0,
  );
  const friendly = { ...surface(3, 0.3, "flesh", "friend"), stop: true };
  expect(
    solveBullet(ballistics[3], [friendly, surface(6, 0.3, "flesh", "enemy")]).contacts,
  ).toHaveLength(1);
});
it("uses common head/stomach/leg multipliers and angle-dependent flesh thickness", () => {
  expect(hitgroupMultiplier(true, 1.5, 4)).toBe(4);
  expect(hitgroupMultiplier(false, 1, 4)).toBe(1.25);
  expect(hitgroupMultiplier(false, 0.7, 4)).toBe(0.75);
  expect(fleshThickness(new T.Vector3(0, 0, -1), 0, false)).toBeCloseTo(0.28);
  expect(fleshThickness(new T.Vector3(1, 0, 0), 0, false)).toBeCloseTo(0.44);
});
it("range boxes measure full material thickness along an oblique ray", () => {
  const box = new T.Mesh(new T.BoxGeometry(2, 2, 0.2), new T.MeshBasicMaterial());
  box.position.z = -3;
  box.updateMatrixWorld();
  const caster = new T.Raycaster(new T.Vector3(), new T.Vector3(0.1, 0, -1).normalize());
  const hit = caster.intersectObject(box)[0];
  expect(meshThickness(hit, caster.ray)).toBeCloseTo(0.2 / Math.abs(caster.ray.direction.z));
});

it("native triangle collision entry/exit faces count as one thin barrier", async () => {
  const { MapCollision } = await import("./map-collision");
  const wood = new T.Mesh(new T.BoxGeometry(3, 3, 0.12), new T.MeshBasicMaterial());
  wood.position.set(0, 1.3, -3);
  const collision = new MapCollision([wood]);
  const ray = new T.Ray(new T.Vector3(0, 1.2, 0), new T.Vector3(0, 0, -1));
  const surfaces = collision.intersections(ray, 20).map((hit) => ({
    ...surface(hit.distance, collision.thickness(hit, ray.direction), "wood"),
    exit: hit.face!.normal.dot(ray.direction) > 0,
  }));
  expect(surfaces.some((hit) => hit.exit)).toBe(true);
  const shot = solveBullet(ballistics[3], [...surfaces, surface(8, 0.3, "flesh", "enemy")]);
  expect(shot.contacts.map((contact) => contact.surface.data)).toEqual(["wood", "enemy"]);
  expect(shot.contacts[1].damage).toBeGreaterThan(80);
});

it("only probes exits of traversed surfaces, keeping map work within the barrier budget", () => {
  let probes = 0;
  const surfaces = Array.from({ length: 20 }, (_, index) => ({
    ...surface(index + 1, 0.01, "glass"),
    thickness: () => {
      probes++;
      return 0.01;
    },
  }));
  solveBullet(ballistics[3], surfaces);
  expect(probes).toBe(4);
});
