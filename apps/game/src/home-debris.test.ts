import * as T from "three";
import { expect, test } from "vitest";
import { HomeDebris } from "./home-debris";
import { MapCollision } from "./map-collision";

test("windblown paper sweeps into static wall geometry instead of passing through it", () => {
  const background = new T.Group();
  const wall = new T.Mesh(new T.BoxGeometry(0.02, 3, 3), new T.MeshBasicMaterial());
  wall.position.x = 0.1;
  background.add(wall);
  background.updateMatrixWorld(true);
  const model = new T.Group();
  model.add(new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial()));
  const collision = new MapCollision([wall]);
  wall.raycast = () => {
    throw new Error("Paper must use the spatial collision index");
  };
  const debris = new HomeDebris(
    [model],
    new T.ShaderMaterial(),
    new T.Group(),
    new T.Group(),
    background,
    0,
    104,
    collision,
  );
  const position = new T.Vector3(0.08, 1, 0),
    velocity = new T.Vector3(1.4, 0, 0);
  // A deterministic live particle isolates a wall crossing from emitter RNG.
  const state = debris as unknown as { papers: object[] };
  state.papers = [
    {
      position,
      velocity,
      age: 0,
      life: 10,
      radius: 0.1,
      phase: 0,
      floor: 0,
      emitter: 0,
      model: 0,
      spin: 0,
      color: new T.Color(),
      force: 0,
      trace: position.clone(),
      traceTime: 0,
    },
  ];
  debris.update(1 / 60);
  expect(position.x).toBeLessThan(0.08);
  expect(velocity.x).toBeLessThan(0);
  expect(Number.isFinite(position.y)).toBe(true);
  debris.dispose();
  wall.geometry.dispose();
  wall.material.dispose();
});
