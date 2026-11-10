import type { SourceFoliageSway } from "./source-foliage-wind";

/** Conservative per-axis own-browser envelope of sourceFoliageSwayPoint.
 * Requires normalized wind direction, UNORM noise in [0,1], clamped controls
 * and nonnegative mask powers. Those are explicit admission inputs, not a
 * guessed view distance or density threshold. */
export function nativeClutterSwayPadding(
  parameters: SourceFoliageSway,
  maximumWindStrength: number,
) {
  const values = [
    parameters.swayAmount,
    parameters.flutterAmount,
    parameters.swayFalloff,
    parameters.flutterFalloff,
    maximumWindStrength,
  ];
  if (
    values.some((v) => !Number.isFinite(v)) ||
    parameters.swayFalloff < 0 ||
    parameters.flutterFalloff < 0 ||
    maximumWindStrength < 0
  )
    throw new Error("Native clutter sway envelope requires bounded source inputs");
  // swayDir.xy<=.5, z<=.25; normalized direction components<=1.
  // mask and pow(clamped controls, nonnegative power) are each in [0,1].
  const swayXY = 1.5 * 150 * Math.abs(parameters.swayAmount),
    swayZ = 1.25 * 150 * Math.abs(parameters.swayAmount);
  const flutterXY = 1.5 * 25 * Math.abs(parameters.flutterAmount),
    flutterZ = 1.25 * 25 * Math.abs(parameters.flutterAmount);
  // Both terms also bend down by .314*length(their own XY displacement).
  const xy = swayXY + flutterXY,
    z = swayZ + flutterZ + Math.SQRT2 * (swayXY + flutterXY) * 0.314;
  return Math.max(xy, z) * maximumWindStrength * 0.0254;
}
