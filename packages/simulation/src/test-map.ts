// Small collision fixtures for rule tests; not a selectable or rendered map.
import * as T from "three";
import { MapCollision } from "./map-collision";
import type { DustMap } from "./dust-map";
export function testMap(): DustMap {
  const floor = new T.Mesh(
    new T.PlaneGeometry(300, 300).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial(),
  );
  floor.updateMatrixWorld();
  return { collision: new MapCollision([floor]), spawns: { ct: [[4, 0, -61]], t: [[-20, 0, 20]] } };
}
