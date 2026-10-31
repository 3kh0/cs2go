import data from "./dust2-buy-zones.json";

type Position = { x: number; y: number; z: number };
export type TriggerHull = { halfWidth: number; height: number };
export type TriggerBox = {
  min: readonly number[];
  max: readonly number[];
};
export type BuyZone = TriggerBox & { team: "t" | "ct" };

// The importer proves each native trigger is exactly this box, rather than
// substituting an AABB for an arbitrary brush. Position is the actor's feet.
// Supplying the actor hull tests contact, including partially entered zones.
// Omitting it tests a point; callers supply their own collision posture.
export function touchesBuyZone(position: Position, zone: TriggerBox, hull?: TriggerHull) {
  const radius = hull?.halfWidth ?? 0;
  const height = hull?.height ?? 0;
  if (
    !Number.isFinite(position.x + position.y + position.z + radius + height) ||
    radius < 0 ||
    height < 0
  )
    return false;
  const epsilon = 1e-7;
  return (
    position.x + radius >= zone.min[0] - epsilon &&
    position.x - radius <= zone.max[0] + epsilon &&
    position.y + height >= zone.min[1] - epsilon &&
    position.y <= zone.max[1] + epsilon &&
    position.z + radius >= zone.min[2] - epsilon &&
    position.z - radius <= zone.max[2] + epsilon
  );
}

export const dust2BuyZones = {
  zones: data.zones as BuyZone[],
  contains(position: Position, team: "t" | "ct", hull?: TriggerHull) {
    return this.zones.some((zone) => zone.team === team && touchesBuyZone(position, zone, hull));
  },
};

export const dust2BombSites = {
  sites: data.sites,
  site(position: Position, hull?: TriggerHull): number {
    return (
      this.sites.find((site) => site.hulls.some((box) => touchesBuyZone(position, box, hull)))
        ?.site ?? -1
    );
  },
  contains(position: Position, hull?: TriggerHull) {
    return this.site(position, hull) !== -1;
  },
};
