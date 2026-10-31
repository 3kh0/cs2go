/** Dynamic actor hulls use the same meter-space dimensions as browser movement. */
export type ActorHull = {
  x: number;
  y: number;
  z: number;
  height: number;
  radius: number;
  id?: number;
};
export function actorSupport(
  x: number,
  z: number,
  previousFeet: number,
  nextFeet: number,
  actors: readonly ActorHull[],
  radius = 0.3,
  grounded = false,
) {
  let floor = -Infinity;
  for (const actor of actors) {
    const top = actor.y + actor.height;
    if (
      Math.abs(x - actor.x) >= radius + actor.radius ||
      Math.abs(z - actor.z) >= radius + actor.radius
    )
      continue;
    // Never step up an actor's torso. Only land from above or retain a top contact.
    if (previousFeet >= top - (grounded ? 0.04 : 0.001) && nextFeet <= top + 0.04)
      floor = Math.max(floor, top);
  }
  return floor;
}
/** Continuous horizontal AABB contacts; slide without tunnelling through an actor. */
export function slideActors(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  height: number,
  actors: readonly ActorHull[],
  radius = 0.3,
) {
  let x = start.x,
    z = start.z,
    dx = end.x - x,
    dz = end.z - z;
  let hitX = false,
    hitZ = false;
  for (let pass = 0; pass < 4 && Math.abs(dx) + Math.abs(dz) > 1e-9; pass++) {
    let first = 1,
      axis = 0;
    for (const actor of actors) {
      if (end.y >= actor.y + actor.height - 0.001 || end.y + height <= actor.y + 0.001) continue;
      const r = radius + actor.radius;
      const minX = actor.x - r,
        maxX = actor.x + r,
        minZ = actor.z - r,
        maxZ = actor.z + r;
      if (x > minX && x < maxX && z > minZ && z < maxZ) continue; // Existing overlap may escape.
      const tx0 = dx ? ((dx > 0 ? minX : maxX) - x) / dx : -Infinity;
      const tx1 = dx ? ((dx > 0 ? maxX : minX) - x) / dx : Infinity;
      const tz0 = dz ? ((dz > 0 ? minZ : maxZ) - z) / dz : -Infinity;
      const tz1 = dz ? ((dz > 0 ? maxZ : minZ) - z) / dz : Infinity;
      if ((!dx && (x <= minX || x >= maxX)) || (!dz && (z <= minZ || z >= maxZ))) continue;
      const entry = Math.max(tx0, tz0),
        exit = Math.min(tx1, tz1);
      if (entry >= 0 && entry < first && entry < exit) {
        first = entry;
        axis = tx0 > tz0 ? 1 : 2;
      }
    }
    const travel = axis ? Math.max(0, first - 1e-5) : 1;
    x += dx * travel;
    z += dz * travel;
    dx *= 1 - travel;
    dz *= 1 - travel;
    if (!axis) break;
    if (axis === 1) {
      dx = 0;
      hitX = true;
    } else {
      dz = 0;
      hitZ = true;
    }
  }
  end.x = x;
  end.z = z;
  return { hitX, hitZ };
}

/** Find a head crossed by a falling hull at the time of vertical contact. */
export function actorLanding(
  start: { x: number; y: number; z: number },
  end: { x: number; y: number; z: number },
  actors: readonly ActorHull[],
  radius = 0.3,
) {
  if (end.y > start.y) return -Infinity;
  let floor = -Infinity;
  const descent = start.y - end.y;
  for (const actor of actors) {
    const top = actor.y + actor.height;
    if (start.y < top - 0.001 || end.y > top) continue;
    const time = descent > 0 ? Math.max(0, Math.min(1, (start.y - top) / descent)) : 0;
    const x = start.x + (end.x - start.x) * time;
    const z = start.z + (end.z - start.z) * time;
    if (
      Math.abs(x - actor.x) < radius + actor.radius &&
      Math.abs(z - actor.z) < radius + actor.radius
    )
      floor = Math.max(floor, top);
  }
  return floor;
}

/** A known carrier may change posture without opening a gap under its rider. */
export function actorCarry(
  position: { x: number; y: number; z: number },
  previousTop: number,
  actor: ActorHull | undefined,
  radius = 0.3,
) {
  if (
    !actor ||
    Math.abs(position.y - previousTop) > 0.04 ||
    Math.abs(position.x - actor.x) >= radius + actor.radius ||
    Math.abs(position.z - actor.z) >= radius + actor.radius
  )
    return undefined;
  return actor.y + actor.height;
}
