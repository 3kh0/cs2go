import * as T from "three";

export type NativeSkyPanorama = {
  /** Native Source QAngle: pitch, yaw, roll in degrees. */
  angles: readonly number[];
  brightness: number;
  /** Native Color32 channels normalized to [0,1], before brightness. */
  tint: readonly number[];
};

/** VRF20.1 WorldLoader env_sky rotation/tint, adapted to browser axes. The
 * existing half-turn aligns the exported panorama with Three's sphere UVs. */
export function nativeSkyPanorama(config?: NativeSkyPanorama) {
  const angles = config?.angles ?? [0, 0, 0],
    tint = config?.tint ?? [1, 1, 1],
    brightness = config?.brightness ?? 1;
  if (
    angles.length !== 3 ||
    !angles.every(Number.isFinite) ||
    tint.length !== 3 ||
    !tint.every((value) => Number.isFinite(value) && value >= 0 && value <= 1) ||
    !Number.isFinite(brightness) ||
    brightness < 0
  )
    throw new Error("Invalid native sky panorama environment");
  const [pitch, yaw, roll] = angles.map(T.MathUtils.degToRad);
  const rotation = new T.Matrix4()
    .makeRotationY(yaw)
    .multiply(new T.Matrix4().makeRotationZ(-pitch))
    .multiply(new T.Matrix4().makeRotationX(roll))
    .multiply(new T.Matrix4().makeRotationY(Math.PI));
  return { rotation, color: new T.Color(tint[0], tint[1], tint[2]).multiplyScalar(brightness) };
}
