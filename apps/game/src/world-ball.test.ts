import { expect, test } from "vitest";
import * as T from "three";
import { WorldBall } from "./world-ball";
import { MapCollision } from "./map-collision";
import native from "@cs2go/simulation/world-ball-data";
test("dynamic ball bounces off cover, sleeps and resets to its native position", () => {
  const root = new T.Group();
  const material = new T.MeshStandardMaterial();
  material.name = "soccerball001_color";
  const radius = native.sphereRadiusSource * 0.0254;
  const model = new T.Mesh(new T.SphereGeometry(radius, 12, 8), material);
  model.geometry.setAttribute(
    "sourceUv",
    new T.Float32BufferAttribute(new Float32Array(model.geometry.attributes.position.count * 3), 3),
  );
  model.geometry.setAttribute(
    "sourceProbe",
    new T.Float32BufferAttribute(new Float32Array(model.geometry.attributes.position.count * 4), 4),
  );
  model.position.set(0, radius, 0);
  root.add(model);
  const ground = new T.Mesh(new T.BoxGeometry(10, 0.2, 10));
  ground.position.y = -0.1;
  const wall = new T.Mesh(new T.BoxGeometry(0.2, 4, 10));
  wall.position.x = 1;
  ground.updateMatrixWorld(true);
  wall.updateMatrixWorld(true);
  const ball = new WorldBall(root, new MapCollision([ground, wall]));
  expect(ball.mesh).toBeDefined();
  expect(ball.mesh!.material).not.toBe(material);
  expect(ball.mesh!.geometry.hasAttribute("sourceUv")).toBe(false);
  expect(ball.mesh!.geometry.hasAttribute("sourceProbe")).toBe(false);
  expect(model.geometry.hasAttribute("sourceProbe")).toBe(true);
  expect(model.visible).toBe(false);
  expect(ball.shoot(new T.Ray(new T.Vector3(-1, radius, 0), new T.Vector3(1, 0, 0)), 0.5)).toBe(
    false,
  );
  expect(ball.shoot(new T.Ray(new T.Vector3(-1, radius, 0), new T.Vector3(1, 0, 0)), 2)).toBe(true);
  let maximum = -Infinity;
  for (let i = 0; i < 1024; i++) {
    ball.update(1 / 128);
    maximum = Math.max(maximum, ball.mesh!.position.x);
  }
  expect(maximum).toBeLessThanOrEqual(0.9 - radius + 0.001);
  expect(ball.sleeping).toBe(true);
  ball.reset();
  expect(ball.mesh!.position.distanceTo(ball.origin)).toBe(0);
  ball.touch(new T.Vector3(-0.25, 0, 0), 3, 0, 1 / 128);
  expect(ball.sleeping).toBe(false);
  expect(ball.velocity.x).toBeGreaterThan(0);
});
