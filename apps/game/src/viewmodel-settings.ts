import * as T from "three";
import { sourceVerticalFov } from "./source-camera";

export const viewmodelDefaults = {
  viewmodelFov: 60,
  viewmodelOffsetX: 1,
  viewmodelOffsetY: 1,
  viewmodelOffsetZ: -1,
};
export type ViewmodelSettings = typeof viewmodelDefaults;
export const viewmodelRanges = {
  viewmodelFov: [54, 68],
  viewmodelOffsetX: [-2, 2.5],
  viewmodelOffsetY: [-2, 2],
  viewmodelOffsetZ: [-2, 2],
} as const;
export function readViewmodelSettings(saved: Record<string, unknown>): ViewmodelSettings {
  const result = { ...viewmodelDefaults };
  for (const [key, [min, max]] of Object.entries(viewmodelRanges)) {
    const value = saved[key];
    if (typeof value === "number" && Number.isFinite(value))
      result[key as keyof typeof viewmodelRanges] = T.MathUtils.clamp(value, min, max);
  }
  return result;
}
/** Source's horizontal 4:3 reference lens, not Three.js's vertical FOV. */
export const viewmodelVerticalFov = sourceVerticalFov;
export function applyViewmodelCamera(
  camera: T.PerspectiveCamera,
  width: number,
  height: number,
  settings: ViewmodelSettings,
) {
  camera.fov = viewmodelVerticalFov(settings.viewmodelFov);
  camera.aspect = Math.max(1, width) / Math.max(1, height);
  camera.near = 0.01;
  camera.far = 100;
  // Moving the camera oppositely applies Source offsets to every viewmodel,
  // including C4, utility and muzzle flashes, without modifying animation bones.
  camera.position.set(
    -settings.viewmodelOffsetX * 0.0254,
    -settings.viewmodelOffsetZ * 0.0254,
    settings.viewmodelOffsetY * 0.0254,
  );
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
/** Preserve the barrel's screen position under independent lenses and stretch. */
export function viewmodelPointToWorld(
  point: T.Vector3,
  view: T.PerspectiveCamera,
  world: T.PerspectiveCamera,
) {
  point.sub(view.position);
  const scale =
    Math.tan(T.MathUtils.degToRad(world.fov / 2)) / Math.tan(T.MathUtils.degToRad(view.fov / 2));
  point.x *= (scale * world.aspect) / view.aspect;
  point.y *= scale;
  return point.applyQuaternion(world.quaternion).add(world.position);
}
