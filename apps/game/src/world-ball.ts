import * as T from "three";
import type { MapCollision } from "./map-collision";
import { registerActorLighting } from "./actor-lighting";
import { WorldBallPhysics } from "@cs2go/simulation/world-ball";
export class WorldBall extends WorldBallPhysics {
  declare mesh?: T.Mesh;
  constructor(root: T.Group, collision: MapCollision) {
    super(collision, new T.Vector3());
    this.mesh = undefined;
    root.updateMatrixWorld(true);
    const sources: T.Mesh[] = [];
    root.traverse((object) => {
      if (
        object instanceof T.Mesh &&
        !Array.isArray(object.material) &&
        /soccerball/.test(object.material.name)
      )
        sources.push(object);
    });
    // Do not accidentally detach a batch containing multiple unrelated props.
    if (sources.length !== 1) return;
    const source = sources[0];
    if (!(source.material instanceof T.MeshStandardMaterial)) return;
    const geometry = source.geometry.clone();
    const original = geometry.getAttribute("position");
    const positions = new T.Float32BufferAttribute(new Float32Array(original.count * 3), 3);
    for (let i = 0; i < original.count; i++)
      positions.setXYZ(i, original.getX(i), original.getY(i), original.getZ(i));
    geometry.setAttribute("position", positions);
    geometry.applyMatrix4(source.matrixWorld);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    bounds.getCenter(this.origin);
    const size = bounds.getSize(new T.Vector3());
    if (size.length() > 1 || size.length() < 0.05) {
      geometry.dispose();
      return;
    }
    // Collision uses the native PHYS sphere, not decorative mesh bounds.
    geometry.translate(-this.origin.x, -this.origin.y, -this.origin.z);
    geometry.computeBoundingSphere();
    // The prop moves independently of the static map's baked irradiance/sun.
    geometry.deleteAttribute("sourceUv");
    geometry.deleteAttribute("sourceProbe");
    const material = source.material.clone();
    material.onBeforeCompile = () => {};
    material.customProgramCacheKey = () => "dynamic-ball-v1";
    this.mesh = new T.Mesh(geometry, material);
    registerActorLighting(this.mesh);
    this.mesh.name = "Dust II soccer ball";
    this.mesh.position.copy(this.origin);
    source.visible = false;
    root.add(this.mesh);
  }
}
