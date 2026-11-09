import graph from "./data/character-locomotion.json";

export type CharacterMotion = { name: string; weight: number; duration: number };
const stances = graph.stances.map((stance) => {
  const points = stance.points.map(
    ([x, y, name, duration]) => [Number(x), Number(y), String(name), Number(duration)] as const,
  );
  const triangles = [];
  for (let i = 0; i < stance.triangles.length; i += 3) {
    const [a, b, c] = stance.triangles.slice(i, i + 3);
    const p = points[a],
      q = points[b],
      r = points[c];
    triangles.push({
      a,
      b,
      c,
      x: r[0],
      y: r[1],
      u: q[1] - r[1],
      v: r[0] - q[0],
      w: r[1] - p[1],
      z: p[0] - r[0],
      area: (q[1] - r[1]) * (p[0] - r[0]) + (r[0] - q[0]) * (p[1] - r[1]),
    });
  }
  return { points, triangles, hull: stance.hull };
});

// Installed worldmodel_locomotion graph: Source units/s, authored triangulation,
// idle DurationScale=1s, and original directional clip durations. Keep the
// browser and authoritative capsule evaluator on the same blend/time inputs.
function blend(stance: (typeof stances)[number], x: number, y: number) {
  const points = stance.points;
  let samples: [number, number][] | undefined;
  for (const t of stance.triangles) {
    const u = (t.u * (x - t.x) + t.v * (y - t.y)) / t.area;
    const v = (t.w * (x - t.x) + t.z * (y - t.y)) / t.area;
    const w = 1 - u - v;
    if (Math.min(u, v, w) >= -1e-7) {
      samples = [
        [t.a, Math.min(1, Math.max(0, u))],
        [t.b, Math.min(1, Math.max(0, v))],
        [t.c, Math.min(1, Math.max(0, w))],
      ];
      break;
    }
  }
  // Speeds outside the authored hull clamp to its nearest edge, preserving
  // direction rather than extrapolating negative animation weights.
  if (!samples) {
    let nearest = Infinity;
    for (let i = 1; i < stance.hull.length; i++) {
      const a = stance.hull[i - 1],
        b = stance.hull[i];
      const p = points[a],
        q = points[b];
      const px = p[0],
        py = p[1];
      const dx = q[0] - px,
        dy = q[1] - py;
      const t = Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy)));
      const distance = (x - px - t * dx) ** 2 + (y - py - t * dy) ** 2;
      if (distance < nearest) {
        nearest = distance;
        samples = [
          [a, 1 - t],
          [b, t],
        ];
      }
    }
  }
  return samples!
    .filter(([, weight]) => weight > 1e-7)
    .map(([index, weight]) => ({
      point: points[index],
      weight,
    }));
}

export function characterLocomotion(speed: number, moveX: number, moveZ: number, crouch: number) {
  const length = Math.hypot(moveX, moveZ);
  const scale = length > 0.01 ? Math.max(0, speed) / (length * 0.0254) : 0;
  const duck = Math.max(0, Math.min(1, crouch));
  return stances.flatMap((stance, i) =>
    blend(stance, moveZ * scale, -moveX * scale).flatMap(({ point, weight }) => {
      weight *= i ? duck : 1 - duck;
      return weight > 1e-7 ? [{ name: point[2], weight, duration: point[3] }] : [];
    }),
  );
}

/** Synchronized normalized phase; clip seconds remain unmodified. */
export function characterPhase(phase: number, dt: number, samples: readonly CharacterMotion[]) {
  const duration = samples.reduce((sum, sample) => sum + sample.duration * sample.weight, 0);
  return duration > 0 ? (phase + Math.max(0, dt) / duration) % 1 : phase;
}
