import { Ray, Vector3 } from "three";

const axis = new Vector3(),
  offset = new Vector3(),
  nearest = new Vector3();
/** Exact forward interval through a finite cylinder and its two hemispherical caps.
 * Input rays use unit directions; inside starts retain a zero entry distance. */
export function rayCapsuleInterval(ray: Ray, start: Vector3, end: Vector3, radius: number) {
  axis.subVectors(end, start);
  offset.subVectors(ray.origin, start);
  const length = axis.lengthSq(),
    r2 = radius * radius;
  nearest
    .copy(start)
    .addScaledVector(axis, length ? Math.max(0, Math.min(1, offset.dot(axis) / length)) : 0);
  let entry = nearest.distanceToSquared(ray.origin) <= r2 ? 0 : Infinity,
    exit = -Infinity;
  const accept = (t: number) => {
    if (t >= 0) {
      entry = Math.min(entry, t);
      exit = Math.max(exit, t);
    }
  };
  if (length > 1e-12) {
    const dot = axis.dot(ray.direction),
      projected = axis.dot(offset);
    const a = length - dot * dot,
      b = length * ray.direction.dot(offset) - projected * dot;
    const c = length * (offset.lengthSq() - r2) - projected * projected,
      d = b * b - a * c;
    if (a > 1e-12 && d >= 0)
      for (let sign = -1; sign <= 1; sign += 2) {
        const t = (-b + sign * Math.sqrt(d)) / a;
        const h = projected + t * dot;
        if (h >= 0 && h <= length) accept(t);
      }
  }
  for (let cap = 0; cap < 2; cap++) {
    offset.subVectors(ray.origin, cap ? end : start);
    const b = offset.dot(ray.direction),
      d = b * b - offset.lengthSq() + r2;
    if (d >= 0) {
      accept(-b - Math.sqrt(d));
      accept(-b + Math.sqrt(d));
    }
  }
  return Number.isFinite(entry) && exit >= entry ? { entry, exit } : null;
}
export function rayCapsule(ray: Ray, start: Vector3, end: Vector3, radius: number) {
  return rayCapsuleInterval(ray, start, end, radius)?.entry ?? Infinity;
}
