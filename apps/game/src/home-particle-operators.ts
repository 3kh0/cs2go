// ambient_ground_dust.vpcf, installed build2000942. Operator semantics follow
// VRF9e2e6c7 BasicMovement/FadeInSimple/NumericBias; not the Source particle VM.
export const dustForceCurve = [
  [0, 1.35, -0.126449],
  [0.194165, 1.325448, -0.576202],
  [0.474514, 1.076584, -1.067879],
  [0.835039, 0.641072, -1.572991],
  [1, 0.25, -2.370694],
] as const;

/** Native curve knots carry derivatives in domain units, not segment fractions. */
export function particleCurve(t: number, points: readonly (readonly [number, number, number])[]) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x, y, slope] = points[i];
    if (t > x) continue;
    const [previous, value, derivative] = points[i - 1];
    const width = x - previous,
      u = (t - previous) / width;
    return (
      (2 * u ** 3 - 3 * u ** 2 + 1) * value +
      (u ** 3 - 2 * u ** 2 + u) * width * derivative +
      (-2 * u ** 3 + 3 * u ** 2) * y +
      (u ** 3 - u ** 2) * width * slope
    );
  }
  return points.at(-1)![1];
}

export const particleDrag = (drag: number, dt: number) =>
  Math.pow(1 - Math.max(0, Math.min(0.9999999, drag)), 30 * dt);

/** InitFloat's standard bias parameter is -1..1; operator radius bias is 0..1. */
export function particleBias(value: number, parameter: number) {
  const bias = Math.max(0, Math.min(1, (parameter + 1) / 2));
  return bias <= 0 ? 0 : bias >= 1 ? 1 : value / ((1 / bias - 2) * (1 - value) + 1);
}

export const dustFade = (age: number, life: number) =>
  Math.max(0, Math.min(1, age / (life * 0.5), (1 - age / life) / 0.5));
