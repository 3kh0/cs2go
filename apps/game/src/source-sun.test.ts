import * as T from "three";
import { expect, test } from "vitest";
import { fitSourceSunShadow } from "./source-sun";

function sceneAt(elevation: number) {
  const sun = new T.DirectionalLight();
  sun.position.set(-60, 80, 20);
  sun.target.position.set(0, 0, -30);
  const direction = sun.position.clone().sub(sun.target.position).normalize();
  const scenery = new T.Group();
  const roof = new T.Mesh(new T.BoxGeometry(20, 2, 20));
  roof.position.set(-30, elevation + 40, 0);
  roof.castShadow = true;
  scenery.add(roof);
  const areas = [
    {
      corners: [
        [-10, elevation, -10],
        [10, elevation, 10],
      ],
    },
  ];
  fitSourceSunShadow(sun, areas, scenery);
  return { sun, direction, roof, areas };
}

test("sun shadows follow elevated terrain while retaining off-nav roof casters", () => {
  const ground = sceneAt(0),
    elevated = sceneAt(300);
  for (const { sun, direction, roof, areas } of [ground, elevated]) {
    expect(
      sun.position.clone().sub(sun.target.position).normalize().distanceTo(direction),
    ).toBeLessThan(1e-12);
    for (const point of areas[0].corners) {
      const clip = new T.Vector3().fromArray(point).project(sun.shadow.camera);
      expect(Math.max(Math.abs(clip.x), Math.abs(clip.y), Math.abs(clip.z))).toBeLessThan(1);
    }
    const roofDepth = roof.position.clone().project(sun.shadow.camera).z;
    expect(roofDepth).toBeGreaterThan(-1);
    expect(roofDepth).toBeLessThan(1);
  }
  const groundClip = new T.Vector3(0, 0, 0).project(ground.sun.shadow.camera);
  const elevatedClip = new T.Vector3(0, 300, 0).project(elevated.sun.shadow.camera);
  expect(elevatedClip.distanceTo(groundClip)).toBeLessThan(1e-12);
});
