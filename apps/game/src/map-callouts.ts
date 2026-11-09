export type CalloutHull = { min: number[]; max: number[]; planes: number[][] };
export type MapCallout = { id: string; token: string; name: string; hulls: CalloutHull[] };
export type NativePlaces = { version: 1; mapId: "dust2" | "mirage"; locations: MapCallout[] };

/** Native convex volumes retain vertical separation between stacked floors.
 * Centre-point lookup and source-order arbitration are browser adaptations. */
export function mapCalloutAt(
  locations: readonly MapCallout[],
  position: { x: number; y: number; z: number },
) {
  const x = position.x,
    y = position.y + 0.9,
    z = position.z;
  for (const location of locations)
    for (const hull of location.hulls) {
      if (
        x < hull.min[0] ||
        x > hull.max[0] ||
        y < hull.min[1] ||
        y > hull.max[1] ||
        z < hull.min[2] ||
        z > hull.max[2]
      )
        continue;
      if (
        hull.planes.every(([nx, ny, nz, distance]) => nx * x + ny * y + nz * z <= distance + 0.001)
      )
        return location;
    }
}
