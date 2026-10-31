import * as T from "three";
import { MapCollision } from "./map-collision";
import type { BakedBombDamage } from "./bomb-damage";
export type DustMap = {
  collision: MapCollision;
  grenadeCollision?: MapCollision;
  spawns: Record<"t" | "ct", number[][]>;
  spawnAngles?: Record<"t" | "ct", number[]>;
  bombDamage?: BakedBombDamage;
};
/** Identical native movement and bullet filtering in the browser and server. */
export function dustCollision(scene: T.Object3D) {
  const meshes: T.Mesh[] = [],
    movementOnly: T.Mesh[] = [],
    grenadeOnly: T.Mesh[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    let metadata: T.Object3D = object;
    while (metadata.parent && !metadata.userData.InteractAs) metadata = metadata.parent;
    const interactions = metadata.userData.InteractAs as string[] | undefined;
    if (interactions?.includes("csgo_grenadeclip")) {
      grenadeOnly.push(object);
      return;
    }
    if (interactions?.includes("sky")) return;
    const surface = String(metadata.userData.SurfaceProperty || "concrete");
    object.userData.bulletMaterial = /glass|chainlink/.test(surface)
      ? "glass"
      : /wood/.test(surface)
        ? "wood"
        : /metal/.test(surface)
          ? "metal"
          : "concrete";
    if (interactions?.some((flag) => ["playerclip", "npcclip", "passbullets"].includes(flag)))
      movementOnly.push(object);
    else meshes.push(object);
  });
  if (!meshes.length || !movementOnly.length)
    throw new Error("Dust II native physics could not load");
  return {
    collision: new MapCollision(meshes, movementOnly),
    grenadeCollision: grenadeOnly.length ? new MapCollision(grenadeOnly) : undefined,
  };
}
