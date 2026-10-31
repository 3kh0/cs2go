import { Vector3, Triangle } from "three";

const a = new Vector3(),
  b = new Vector3(),
  c = new Vector3(),
  n = new Vector3(),
  p = new Vector3();
const edge = new Vector3(),
  relative = new Vector3(),
  closest = new Vector3();
const triangle = new Triangle(a, b, c);
/** Earliest continuous contact with a triangle's face, edges or vertices.
 * Writes a unit normal and returns a fraction of the displacement, or Infinity. */
export function sweepSphereTriangle(
  from: Vector3,
  delta: Vector3,
  radius: number,
  vertices: Float32Array,
  offset: number,
  normal: Vector3,
) {
  a.fromArray(vertices, offset);
  b.fromArray(vertices, offset + 3);
  c.fromArray(vertices, offset + 6);
  triangle.getNormal(n);
  let best = Infinity;
  const accept = (t: number, point: Vector3) => {
    if (t < -1e-8 || t > 1 || t >= best) return;
    relative.copy(from).addScaledVector(delta, Math.max(0, t)).sub(point);
    if (relative.lengthSq() < 1e-16) relative.copy(n);
    relative.normalize();
    if (relative.dot(delta) >= -1e-10) return;
    normal.copy(relative);
    best = Math.max(0, t);
  };
  triangle.closestPointToPoint(from, closest);
  if (from.distanceToSquared(closest) <= radius * radius + 1e-12) accept(0, closest);
  const distance = n.dot(p.subVectors(from, a)),
    rate = n.dot(delta);
  if (Math.abs(rate) > 1e-12)
    for (const side of [-1, 1]) {
      const t = (side * radius - distance) / rate;
      if (t < 0 || t > 1 || t >= best) continue;
      p.copy(from)
        .addScaledVector(delta, t)
        .addScaledVector(n, -side * radius);
      if (triangle.containsPoint(p)) accept(t, p);
    }
  // Capsule edges, including spherical endcaps. The quadratic uses an
  // unnormalised displacement, so the roots already lie in tick fractions.
  for (const [start, end] of [
    [a, b],
    [b, c],
    [c, a],
  ]) {
    edge.subVectors(end, start);
    p.subVectors(from, start);
    const length = edge.lengthSq(),
      along = p.dot(edge),
      speed = delta.dot(edge);
    const aa = delta.lengthSq() - (length ? (speed * speed) / length : 0);
    const bb = p.dot(delta) - (length ? (along * speed) / length : 0);
    const cc = p.lengthSq() - (length ? (along * along) / length : 0) - radius * radius;
    const disc = bb * bb - aa * cc;
    if (length && aa > 1e-16 && disc >= 0) {
      const t = (-bb - Math.sqrt(disc)) / aa,
        s = (along + t * speed) / length;
      if (s >= 0 && s <= 1) {
        closest.copy(start).addScaledVector(edge, s);
        accept(t, closest);
      }
    }
    const av = delta.lengthSq(),
      bv = p.dot(delta),
      cv = p.lengthSq() - radius * radius;
    const dv = bv * bv - av * cv;
    if (av > 1e-16 && dv >= 0) accept((-bv - Math.sqrt(dv)) / av, start);
  }
  return best;
}
