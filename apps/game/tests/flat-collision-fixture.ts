// Synthetic collision surface for isolated integration checks; never a game map.
import * as T from "three";
import { MapCollision } from "../src/map-collision";
import type { Game } from "../src/game";
export function flatCollisionFixture(game: Game) {
  const floor = new T.Mesh(
    new T.PlaneGeometry(300, 300).rotateX(-Math.PI / 2),
    new T.MeshBasicMaterial(),
  );
  floor.updateMatrixWorld();
  game.world = { ...game.dust!, collision: new MapCollision([floor]), walls: [], solids: [floor] };
}
