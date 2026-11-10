import * as T from "three";
import type { NativeBakedLocalLight } from "./native-local-light-kernel";

/** Adapted from pinned VRF SceneLight.cs / WorldLoader.cs (MIT).
 * Copyright (c) 2015 ValveResourceFormat Contributors. Full notice:
 * packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt.
 * Qualified host reconstruction.
 * This does not establish Valve's private entity-to-GPU packing. All distances
 * and matrices remain Source units. No temperature/unit conversion is inferred:
 * the reference reads authored color and brightness_lumens directly for CS2. */
export interface VrfLocalLightBridgeOptions {
  /** Optional diagnostic override; default is the pinned reference decoder. */
  linearizeSrgb?: (color: readonly number[]) => readonly number[];
  /** Independently joined VWRLD light+map hash record, not an entity guess. */
  compiledShadowChannel?: number;
  /** Exact logical resource identity; native private 3D atlas packing is not inferred. */
  cookie?: { resource: string; layer: number };
}
/** Pinned VRF 9e2e6c7 ColorSpace.cs:33–48. Float32 arithmetic and the
 * reference's Exp-zero correction are retained. JS scalar log/exp may differ
 * from .NET SIMD transcendental approximation in its final bits. */
export function vrfLocalLightSrgbToLinear(color: readonly number[]) {
  const f = Math.fround;
  const a = f(1 / f(1.055)),
    b = f(f(0.055) / f(1.055));
  return color.map((value) => {
    const c = f(value);
    if (!Number.isFinite(c) || c < 0 || c > 1) throw new Error("Invalid VRF sRGB color");
    if (c <= f(0.04045)) return f(c / f(12.92));
    // Two binary32 operands multiply exactly within binary64 precision; one
    // final round implements the reference fused multiply-add here.
    const affine = f(c * a + b);
    return f(f(Math.exp(f(f(2.4) * f(Math.log(affine))))) - f(0.0000001));
  });
}
function numeric(entity: Record<string, unknown>, key: string, fallback?: number) {
  const value = entity[key] === undefined ? fallback : Number(entity[key]);
  if (value === undefined || !Number.isFinite(value))
    throw new Error(`Invalid qualified VRF local-light ${key}`);
  return value;
}
function vector(entity: Record<string, unknown>, key: string, size: number) {
  const raw = entity[key];
  const value = Array.isArray(raw) ? raw.map(Number) : String(raw).trim().split(/\s+/).map(Number);
  if (value.length !== size || value.some((x) => !Number.isFinite(x)))
    throw new Error(`Invalid qualified VRF local-light ${key}`);
  return value;
}
function rotation(angles: readonly number[]) {
  const [pitch, yaw, roll] = angles.map(T.MathUtils.degToRad);
  return new T.Matrix4()
    .makeRotationZ(yaw)
    .multiply(new T.Matrix4().makeRotationY(pitch))
    .multiply(new T.Matrix4().makeRotationX(roll));
}
function triangle(a: T.Vector3, b: T.Vector3, c: T.Vector3) {
  const x = Math.acos(T.MathUtils.clamp(b.dot(c), -1, 1));
  const y = Math.acos(T.MathUtils.clamp(a.dot(c), -1, 1));
  const z = Math.acos(T.MathUtils.clamp(a.dot(b), -1, 1));
  if (x === 0 || y === 0 || z === 0) return 0;
  const s = (x + y + z) / 2,
    sin = Math.sin(s);
  const sa = Math.sin(s - x),
    sb = Math.sin(s - y),
    sc = Math.sin(s - z);
  return (
    2 *
      (Math.atan(Math.sqrt(Math.max(0, (sc * sa) / (sin * sb)))) +
        Math.atan(Math.sqrt(Math.max(0, (sa * sb) / (sin * sc)))) +
        Math.atan(Math.sqrt(Math.max(0, (sb * sc) / (sin * sa))))) -
    Math.PI
  );
}

export function buildQualifiedVrfLocalBarn(
  entity: Record<string, unknown>,
  options: VrfLocalLightBridgeOptions,
) {
  const kind = entity.classname;
  if (kind !== "light_barn" && kind !== "light_rect")
    throw new Error("Qualified VRF bridge supports barn/rect only");
  if (entity.enabled === false || numeric(entity, "enabled", 1) === 0)
    throw new Error("Qualified VRF light is disabled");
  if (entity.parentname || entity.light_style || entity.useLocalOffset)
    throw new Error("Qualified VRF bridge requires an unparented unanimated cookie-free light");
  const cookie = options.cookie;
  if (
    entity.lightcookie &&
    (!cookie ||
      cookie.resource !== entity.lightcookie ||
      !Number.isInteger(cookie.layer) ||
      cookie.layer < 0)
  )
    throw new Error("Qualified VRF cookie requires exact recovered logical resource");
  if (cookie && !entity.lightcookie)
    throw new Error("Cookie binding has no native entity resource");
  const scale = vector(entity, "scales", 3);
  if (scale.some((x) => x !== 1))
    throw new Error("Qualified VRF bridge requires unit entity scale");
  const mode = numeric(entity, "directlight", 2);
  if (mode !== 2 && mode !== 3)
    throw new Error("Qualified VRF bridge requires runtime direct light");
  const channel = options.compiledShadowChannel;
  if (
    mode === 3 &&
    (channel === undefined || channel < 0 || channel > 3 || !Number.isInteger(channel))
  )
    throw new Error("Qualified VRF stationary light requires compiled shadow-channel proof");
  if (mode === 2 && channel !== undefined)
    throw new Error("Dynamic light cannot use a baked channel");
  if (numeric(entity, "precomputedfieldsvalid", 0) !== 1)
    throw new Error("Qualified VRF bridge requires authored illumination OBB");
  const origin = new T.Vector3().fromArray(vector(entity, "origin", 3));
  const orient = rotation(vector(entity, "angles", 3));
  const forward = new T.Vector3(1, 0, 0).transformDirection(orient);
  const up = new T.Vector3(0, 0, 1).transformDirection(orient);
  const right = new T.Vector3().crossVectors(up, forward).normalize();
  const [sx, sy, sz] = vector(entity, "size_params", 3);
  const range = numeric(entity, "range", 512);
  if (sx <= 0 || sy <= 0 || range <= 0) throw new Error("Invalid qualified VRF light dimensions");
  const [shearX, shearY] = entity.shear === undefined ? [0, 0] : vector(entity, "shear", 2);
  const nearSkirt = kind === "light_rect" ? 0 : numeric(entity, "skirt_near", 0.05);
  const farSkirt = numeric(entity, "skirt", 0.1);
  let eye = origin.clone(),
    radius = 0,
    nearFade = 0,
    farFade = 0,
    divisor: number;
  let projection: T.Matrix4;
  if (sz > 0) {
    const near = 1 / sz,
      far = near + range;
    const cx = (shearX / range) * near,
      cy = (shearY / range) * near;
    eye.addScaledVector(forward, -near).addScaledVector(right, -cx).addScaledVector(up, -cy);
    radius = cx * cx + cy * cy + near * near;
    // System.Numerics left-handed off-center projection, transposed for GLSL.
    projection = new T.Matrix4().set(
      near / sx,
      0,
      -cx / sx,
      0,
      0,
      near / sy,
      -cy / sy,
      0,
      0,
      0,
      far / range,
      (-near * far) / range,
      0,
      0,
      1,
      0,
    );
    nearFade = nearSkirt > 0 ? (near + nearSkirt * range) / (far * nearSkirt) : 0;
    farFade = farSkirt > 0 ? (near + (1 - farSkirt) * range) / (near * farSkirt) : 0;
    const rays = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ].map(([x, y]) =>
      right
        .clone()
        .multiplyScalar(cx + x * sx)
        .addScaledVector(up, cy + y * sy)
        .addScaledVector(forward, near)
        .normalize(),
    );
    divisor =
      ((triangle(rays[0], rays[1], rays[2]) + triangle(rays[0], rays[2], rays[3])) * radius) /
      (4 * Math.PI * 10);
  } else {
    projection = new T.Matrix4().set(
      1 / sx,
      0,
      -shearX / (range * sx),
      0,
      0,
      1 / sy,
      -shearY / (range * sy),
      0,
      0,
      0,
      1 / range,
      0,
      0,
      0,
      0,
      1,
    );
    nearFade = nearSkirt > 0 ? 1 / nearSkirt : 0;
    farFade = farSkirt > 0 ? 1 / farSkirt : 0;
    divisor = (sx * sy) / (Math.PI * 10);
  }
  const view = new T.Matrix4().set(
    right.x,
    right.y,
    right.z,
    -right.dot(eye),
    up.x,
    up.y,
    up.z,
    -up.dot(eye),
    forward.x,
    forward.y,
    forward.z,
    -forward.dot(eye),
    0,
    0,
    0,
    1,
  );
  projection.multiply(view);
  const center = new T.Vector3().fromArray(vector(entity, "precomputedobborigin", 3));
  const extents = vector(entity, "precomputedobbextent", 3);
  if (extents.some((x) => x <= 0)) throw new Error("Invalid qualified VRF illumination extent");
  const obb = rotation(vector(entity, "precomputedobbangles", 3))
    .setPosition(center)
    .invert();
  obb.premultiply(
    new T.Matrix4().makeScale(0.999 / extents[0], 0.999 / extents[1], 0.999 / extents[2]),
  );
  const srgb = vector(entity, "color", 3).map((x) => x / 255);
  const linear = (options.linearizeSrgb ?? vrfLocalLightSrgbToLinear)(srgb);
  if (linear.length !== 3 || linear.some((x) => !Number.isFinite(x) || x < 0))
    throw new Error("Invalid qualified VRF color decoder output");
  const intensity =
    divisor > 0.000001
      ? (numeric(entity, "brightness_lumens", 224) * numeric(entity, "brightnessscale", 1)) /
        divisor
      : 0;
  const direction = forward
    .clone()
    .multiplyScalar(range)
    .addScaledVector(right, shearX)
    .addScaledVector(up, shearY)
    .normalize()
    .negate();
  const weights = [0, 0, 0, 0];
  if (channel !== undefined) weights[channel] = 1;
  const record: NativeBakedLocalLight = {
    projection: projection.toArray(),
    worldToBounds: obb.toArray(),
    positionRadius: sz > 0 ? [...eye.toArray(), radius] : [...direction.toArray(), 0],
    depthFalloff: [1, 0, nearFade, farFade],
    color: linear.map((x) => x * intensity),
    rotation: new T.Quaternion().setFromRotationMatrix(orient).toArray(),
    angularLine: [1, 0, 0],
    barn: [
      1 - (kind === "light_rect" ? 0 : numeric(entity, "soft_x", 0.25)),
      1 - (kind === "light_rect" ? 0 : numeric(entity, "soft_y", 0.25)),
      numeric(entity, "shape", 0),
    ],
    shadowWeights: weights,
    minimumRoughness: Math.max(0.04, numeric(entity, "minroughness", 0.04)),
    cookieKind: cookie ? 1 : 0,
    ...(cookie
      ? {
          cookieLayer: cookie.layer,
          cookieResource: cookie.resource,
          cookieTransform: [0, 0, 1, 1],
        }
      : {}),
  };
  return {
    record,
    intensity,
    divisor,
    qualification: {
      host: "Pinned VRF CS2 photometric reconstruction; not Valve private host records",
      sourceColor: entity.color,
      sourceColorMode: entity.colormode,
      sourceTemperature: entity.colortemperature,
      sourceBrightnessUnits: entity.brightness_units,
      sourceLumens: entity.brightness_lumens,
      liveShadow: "Not represented by pre-live-shadow kernel",
      cookie: cookie
        ? "Native planar projection/UV, exact image in logical 2D array; private 3D atlas packing replaced. sRGB sampling follows qualified pinned VRF host."
        : "none",
      colorDecoder: options.linearizeSrgb
        ? "Explicit supplied diagnostic decoder"
        : "Pinned VRF float32 FMA/Exp/Log minus1e-7; scalar transcendental last bits qualified",
    },
  };
}
