import * as T from "three";

export interface NativeSkyPlacement {
  skyCamera: { scale: number; origin: string | readonly number[] };
  skyboxReference?: { origin?: string | readonly number[]; angles?: string | readonly number[] };
  browserWorldFromSkyBrowser?: readonly number[];
}
const sourceToBrowser = new T.Matrix4().set(
  0.0254,
  0,
  0,
  0,
  0,
  0,
  0.0254,
  0,
  0,
  -0.0254,
  0,
  0,
  0,
  0,
  0,
  1,
);
function vector(value: string | readonly number[] | undefined) {
  const values = typeof value === "string" ? value.trim().split(/\s+/).map(Number) : (value ?? []);
  if (values.length !== 3 || !values.every(Number.isFinite))
    throw new Error("Invalid native sky frame vector");
  return new T.Vector3(...(values as [number, number, number]));
}
/** Geometry is baked in main browser-world metres. Native shader positions,
 * normals, rays and cube boxes must return to their own sky Source frame once.
 * VRF LoadSkybox applies reference rotation and camera origin/scale, while
 * intentionally ignoring camera angles and reference scale. */
export function nativeSkyFrame(placement: NativeSkyPlacement) {
  const scale = placement.skyCamera.scale;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Invalid native sky frame scale");
  const origin = vector(placement.skyCamera.origin),
    reference = vector(placement.skyboxReference?.origin ?? [0, 0, 0]),
    angles = vector(placement.skyboxReference?.angles ?? [0, 0, 0]).multiplyScalar(Math.PI / 180);
  const sourceWorldFromSky = new T.Matrix4()
    .makeTranslation(reference.x, reference.y, reference.z)
    .multiply(new T.Matrix4().makeRotationZ(angles.y))
    .multiply(new T.Matrix4().makeRotationY(angles.x))
    .multiply(new T.Matrix4().makeRotationX(angles.z))
    .multiply(new T.Matrix4().makeScale(scale, scale, scale))
    .multiply(new T.Matrix4().makeTranslation(-origin.x, -origin.y, -origin.z));
  const worldFromSkyBrowser = sourceToBrowser
    .clone()
    .multiply(sourceWorldFromSky)
    .multiply(sourceToBrowser.clone().invert());
  if (placement.browserWorldFromSkyBrowser) {
    const declared = placement.browserWorldFromSkyBrowser;
    if (
      declared.length !== 16 ||
      !declared.every(Number.isFinite) ||
      declared.some((value, index) => Math.abs(value - worldFromSkyBrowser.elements[index]) > 1e-5)
    )
      throw new Error("Native sky baked placement disagrees with authored frame");
  }
  return {
    scale,
    worldFromSkyBrowser,
    skyBrowserFromWorld: worldFromSkyBrowser.clone().invert(),
    skySourceFromMainSource: sourceWorldFromSky.clone().invert(),
  };
}
