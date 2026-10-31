import * as T from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

let reflections: T.Texture | undefined;

/** Shared local reflection lighting, retained for the lifetime of the armory. */
export function armoryReflections(renderer: T.WebGLRenderer) {
  if (!reflections) {
    const room = new RoomEnvironment();
    const pmrem = new T.PMREMGenerator(renderer);
    reflections = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
  }
  return reflections;
}
