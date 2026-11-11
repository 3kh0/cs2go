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

function acceptContact(
  t: number,
  point: Vector3,
  from: Vector3,
  delta: Vector3,
  normal: Vector3,
  best: number,
) {
  if (t < -1e-8 || t > 1 || t >= best) return best;
  relative.copy(from).addScaledVector(delta, Math.max(0, t)).sub(point);
  if (relative.lengthSq() < 1e-16) relative.copy(n);
  relative.normalize();
  if (relative.dot(delta) >= -1e-10) return best;
  normal.copy(relative);
  return Math.max(0, t);
}

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
  triangle.closestPointToPoint(from, closest);
  if (from.distanceToSquared(closest) <= radius * radius + 1e-12)
    best = acceptContact(0, closest, from, delta, normal, best);
  const distance = n.dot(p.subVectors(from, a)),
    rate = n.dot(delta);
  if (Math.abs(rate) > 1e-12)
    for (let side = -1; side <= 1; side += 2) {
      const t = (side * radius - distance) / rate;
      if (t < 0 || t > 1 || t >= best) continue;
      p.copy(from)
        .addScaledVector(delta, t)
        .addScaledVector(n, -side * radius);
      if (triangle.containsPoint(p)) best = acceptContact(t, p, from, delta, normal, best);
    }
  // Capsule edges, including spherical endcaps. The quadratic uses an
  // unnormalised displacement, so the roots already lie in tick fractions.
  for (let i = 0; i < 3; i++) {
    const start = i === 0 ? a : i === 1 ? b : c;
    const end = i === 0 ? b : i === 1 ? c : a;
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
        best = acceptContact(t, closest, from, delta, normal, best);
      }
    }
    const av = delta.lengthSq(),
      bv = p.dot(delta),
      cv = p.lengthSq() - radius * radius;
    const dv = bv * bv - av * cv;
    if (av > 1e-16 && dv >= 0)
      best = acceptContact((-bv - Math.sqrt(dv)) / av, start, from, delta, normal, best);
  }
  return best;
}
