import * as T from "three";
import type { MapCollision } from "./map-collision";
import type { Navigation } from "./navigation";
import { movement, SOURCE_UNIT } from "./physics";

type PreviewWorld = {
  config: { teamCamera?: { position: number[]; target: number[] } };
  navigation: Navigation;
  collision: Pick<MapCollision, "intersections" | "blocked" | "visible">;
  scenery: T.Object3D;
};

/** Keep authored cameras exact. Spawn-based fallbacks must put both previews
 * on actual map geometry, including elevated or narrow spawn platforms. */
export function teamPreviewGround(
  camera: T.PerspectiveCamera,
  world: PreviewWorld,
  aspect: number,
) {
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  const caster = new T.Raycaster();
  const sample = (floorHeight?: number) => {
    camera.updateMatrixWorld(true);
    if (
      world.collision.blocked(
        camera.position.x,
        camera.position.z,
        camera.position.y - 0.15,
        0.15,
        0.3,
      )
    )
      return [];
    return [-0.48, 0.48].map((x) => {
      caster.setFromCamera(new T.Vector2(x, -0.86), camera);
      const ground = world.collision.intersections(caster.ray, 12)[0];
      if (
        !ground ||
        (ground.face?.normal.y ?? 0) <= 0.7 ||
        (floorHeight !== undefined && Math.abs(ground.point.y - floorHeight) > 18 * SOURCE_UNIT) ||
        world.collision.blocked(
          ground.point.x,
          ground.point.z,
          ground.point.y + 0.005,
          movement.hullRadius,
          movement.standingHeight,
        )
      )
        return undefined;
      for (const height of [0.1, movement.standingEye]) {
        const visiblePoint = ground.point.clone();
        visiblePoint.y += height;
        if (!world.collision.visible(camera.position, visiblePoint)) return undefined;
      }
      return ground;
    });
  };
  const complete = (grounds: (T.Intersection | undefined)[]) => {
    if (grounds.length !== 2 || !grounds.every((ground) => ground)) return false;
    // Collision can contain invisible support. Require the same first floor
    // in the visible world export, within one Source unit of collision, and
    // anchor feet to that rendered surface rather than its simplified hull.
    for (const [i, ground] of grounds.entries()) {
      caster.setFromCamera(new T.Vector2(i === 0 ? -0.48 : 0.48, -0.86), camera);
      caster.far = 12;
      const rendered = caster.intersectObject(world.scenery, true).find((hit) => {
        for (let object: T.Object3D | null = hit.object; object; object = object.parent)
          if (!object.visible) return false;
        const mesh = hit.object as T.Mesh;
        const material = Array.isArray(mesh.material)
          ? mesh.material[hit.face?.materialIndex ?? 0]
          : mesh.material;
        return material?.visible && !material.transparent && material.alphaTest === 0;
      });
      if (
        !rendered?.face ||
        rendered.point.distanceTo(ground!.point) > SOURCE_UNIT ||
        rendered.face.normal
          .clone()
          .applyNormalMatrix(new T.Matrix3().getNormalMatrix(rendered.object.matrixWorld)).y <= 0.7
      )
        return false;
      ground!.point.copy(rendered.point);
      ground!.distance = rendered.distance;
    }
    return true;
  };
  const authored = world.config.teamCamera;
  if (authored) {
    camera.position.fromArray(authored.position);
    camera.lookAt(new T.Vector3().fromArray(authored.target));
    const grounds = sample();
    if (complete(grounds)) return grounds as T.Intersection[];
  } else {
    const { navigation } = world;
    const spawn = new T.Vector3().fromArray(navigation.data.spawns.ct[0]);
    const area = navigation.nearest(spawn);
    const targets = [
      new T.Vector3().fromArray(navigation.areas[area]?.center ?? spawn.toArray()),
      spawn,
      ...navigation.areas
        .map((entry) => new T.Vector3().fromArray(entry.center))
        .sort((a, b) => a.distanceToSquared(spawn) - b.distanceToSquared(spawn))
        .slice(0, 32),
    ];
    const facing = navigation.data.spawnAngles?.ct[0] ?? 0;
    for (const target of targets)
      for (const turn of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2])
        for (const distance of [6, 4, 3]) {
          camera.position
            .copy(target)
            .add(
              new T.Vector3(
                Math.sin(facing + turn) * distance,
                2.2,
                Math.cos(facing + turn) * distance,
              ),
            );
          camera.lookAt(target.clone().add(new T.Vector3(0, 0.8, 0)));
          const grounds = sample(target.y);
          if (complete(grounds)) return grounds as T.Intersection[];
        }
  }
  throw new Error("Team preview floor unavailable");
}
