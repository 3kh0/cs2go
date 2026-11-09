import data from "./dust2-buy-zones.json";

type Position = { x: number; y: number; z: number };
export type TriggerHull = { halfWidth: number; height: number };
export type TriggerBox = {
  min: readonly number[];
  max: readonly number[];
  /** Browser-space outward planes: nx*x + ny*y + nz*z <= distance. */
  planes?: readonly (readonly number[])[];
};
export type BuyZone = TriggerBox & { team: "t" | "ct" };
export type MapTriggerData = {
  zones: BuyZone[];
  sites: { site: number; hulls: TriggerBox[] }[];
};

type ConvexShape = { vertices: number[][]; axes: number[][] };
const convexShapes = new WeakMap<TriggerBox, ConvexShape>();
function cross(a: readonly number[], b: readonly number[]) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a: readonly number[], b: readonly number[]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function convexShape(zone: TriggerBox): ConvexShape {
  const cached = convexShapes.get(zone);
  if (cached) return cached;
  const planes = zone.planes!;
  const vertices: number[][] = [];
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const addAxis = (axis: number[]) => {
    const length = Math.hypot(...axis);
    if (length < 1e-8) return;
    const normalized = axis.map((value) => value / length);
    if (!axes.some((existing) => Math.abs(dot(existing, normalized)) > 1 - 1e-7))
      axes.push(normalized);
  };
  for (let i = 0; i < planes.length; i++) {
    const a = planes[i];
    addAxis(a.slice(0, 3));
    for (let j = i + 1; j < planes.length; j++) {
      const b = planes[j],
        edge = cross(a, b);
      for (const axis of [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
      ])
        addAxis(cross(edge, axis));
      for (let k = j + 1; k < planes.length; k++) {
        const c = planes[k],
          bc = cross(b, c),
          determinant = dot(a, bc);
        if (Math.abs(determinant) < 1e-8) continue;
        const ca = cross(c, a),
          ab = cross(a, b);
        const vertex = bc.map(
          (value, n) => (a[3] * value + b[3] * ca[n] + c[3] * ab[n]) / determinant,
        );
        if (planes.every((plane) => dot(plane, vertex) <= plane[3] + 1e-6)) vertices.push(vertex);
      }
    }
  }
  if (!vertices.length) throw new Error("Native map trigger has no valid convex vertices");
  const shape = { vertices, axes };
  convexShapes.set(zone, shape);
  return shape;
}

// Imported axis-aligned boxes use the direct path; arbitrary convex brushes
// retain their native planes. Position is the actor's feet.
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
  const overlapsBounds =
    position.x + radius >= zone.min[0] - epsilon &&
    position.x - radius <= zone.max[0] + epsilon &&
    position.y + height >= zone.min[1] - epsilon &&
    position.y <= zone.max[1] + epsilon &&
    position.z + radius >= zone.min[2] - epsilon &&
    position.z - radius <= zone.max[2] + epsilon;
  if (!overlapsBounds || !zone.planes?.length) return overlapsBounds;
  const { vertices, axes } = convexShape(zone);
  const center = [position.x, position.y + height / 2, position.z];
  // SAT includes native brush face normals, actor face normals and brush-edge /
  // actor-edge cross products. Plane expansion alone leaks at bevelled corners.
  return axes.every((axis) => {
    let min = Infinity,
      max = -Infinity;
    for (const vertex of vertices) {
      const value = dot(axis, vertex);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
    const projected = dot(axis, center);
    const extent =
      radius * (Math.abs(axis[0]) + Math.abs(axis[2])) + (height / 2) * Math.abs(axis[1]);
    return projected + extent >= min - epsilon && projected - extent <= max + epsilon;
  });
}

export const dust2BuyZones = {
  zones: data.zones as BuyZone[],
  contains(position: Position, team: "t" | "ct", hull?: TriggerHull) {
    return this.zones.some((zone) => zone.team === team && touchesBuyZone(position, zone, hull));
  },
};

export const dust2BombSites = {
  sites: data.sites.map((site) => ({
    ...site,
    hulls: site.hulls.map((box) =>
      site.site === 0 ? { ...box, max: [box.max[0], 192 * 0.0254, box.max[2]] } : box,
    ),
  })),
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

export function createMapTriggers(data: MapTriggerData) {
  const buyZones = {
    zones: data.zones,
    contains(position: Position, team: "t" | "ct", hull?: TriggerHull) {
      return data.zones.some((zone) => zone.team === team && touchesBuyZone(position, zone, hull));
    },
  };
  const bombSites = {
    sites: data.sites,
    site(position: Position, hull?: TriggerHull): number {
      return (
        data.sites.find((site) => site.hulls.some((box) => touchesBuyZone(position, box, hull)))
          ?.site ?? -1
      );
    },
    contains(position: Position, hull?: TriggerHull) {
      return this.site(position, hull) !== -1;
    },
  };
  return { buyZones, bombSites };
}

const dust2Triggers = { buyZones: dust2BuyZones, bombSites: dust2BombSites };
const mapTriggerCache = new WeakMap<MapTriggerData, ReturnType<typeof createMapTriggers>>();
export function mapTriggers(map: { id?: string; triggers?: MapTriggerData }) {
  if (!map.triggers) {
    if (!map.id || map.id === "dust2") return dust2Triggers;
    throw new Error(`Native triggers are missing for ${map.id}`);
  }
  let triggers = mapTriggerCache.get(map.triggers);
  if (!triggers) {
    triggers = createMapTriggers(map.triggers);
    mapTriggerCache.set(map.triggers, triggers);
  }
  return triggers;
}
