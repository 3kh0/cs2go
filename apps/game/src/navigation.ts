import * as T from "three";
import type { MapId } from "@cs2go/protocol";
import { touchesBuyZone, type MapTriggerData } from "@cs2go/simulation/buy-zones";
import type { NativeLadder } from "@cs2go/simulation/ladder";
import { ladderNormal } from "@cs2go/simulation/ladder";
export type NavArea = {
  id: number;
  flags: number;
  center: number[];
  rect: number[];
  corners: number[][];
  links: number[];
  cover: number[][];
  place: string;
  portals?: Record<number, number[]>;
};
export type MapNavigation = {
  mapId?: MapId;
  worldBallOrigin?: readonly [number, number, number];
  triggers?: MapTriggerData;
  ladders?: NativeLadder[];
  areas: NavArea[];
  spawns: Record<"t" | "ct", number[][]>;
  spawnAngles?: Record<"t" | "ct", number[]>;
  sites: number[][];
  bounds: number[];
  polygons?: boolean;
};
const navCell = 4;
// The original Source navigation graph preserves stacked tunnels, ramps and
// one-way connections. A* searches this graph rather than a flattened grid.
export class Navigation {
  readonly areas: NavArea[];
  readonly index = new Map<number, number>();
  readonly data: MapNavigation;
  // Areas with links in either direction; empty when the graph has no links.
  private readonly connected: Uint8Array;
  private readonly anyConnected: boolean;
  // Dense 4 m grid of area indices in CSR form, keyed by floor(x / 4).
  private readonly x0: number;
  private readonly z0: number;
  private readonly width: number;
  private readonly depth: number;
  private readonly cellOffsets: Int32Array;
  private readonly cellAreas: Int32Array;
  // Areas whose rectangles cannot be gridded are always scanned.
  private readonly loose: number[] = [];
  private readonly linkOffsets: Int32Array;
  private readonly linkTargets: Int32Array;
  private readonly seen: Int32Array;
  private stamp = 0;
  private readonly sites = new Map<number, NavArea[]>();
  private readonly ladderEdges = new Map<string, { ladder: NativeLadder; up: boolean }>();
  // Reused A* buffers; path() is not re-entrant.
  private readonly costs: Float32Array;
  private readonly previous: Int32Array;
  private readonly closed: Uint8Array;
  private readonly heapArea: Int32Array;
  private readonly heapScore: Float64Array;
  constructor(data: MapNavigation) {
    this.data = data;
    const areas = (this.areas = data.areas),
      count = areas.length;
    areas.forEach((area, i) => this.index.set(area.id, i));
    const extra = new Map<number, Set<number>>();
    for (const ladder of data.ladders ?? []) {
      const top = [...new Set(ladder.areaConnections.slice(0, 4))].filter((id) =>
        this.index.has(id),
      );
      const bottom = [...new Set(ladder.areaConnections.slice(4))].filter((id) =>
        this.index.has(id),
      );
      for (const lower of bottom)
        for (const upper of top) {
          for (const [from, to, up] of [
            [lower, upper, true],
            [upper, lower, false],
          ] as const) {
            if (from === to) continue;
            this.ladderEdges.set(`${from}:${to}`, { ladder, up });
            const targets = extra.get(from) ?? new Set<number>();
            targets.add(to);
            extra.set(from, targets);
          }
        }
    }
    const adjacent = areas.map((area) => [
      ...new Set([...area.links, ...(extra.get(area.id) ?? [])]),
    ]);
    const connected = (this.connected = new Uint8Array(count));
    let links = 0;
    for (let i = 0; i < count; i++) {
      if (adjacent[i].length) connected[i] = 1;
      for (const id of adjacent[i]) {
        const j = this.index.get(id);
        if (j !== undefined) connected[j] = 1;
      }
      links += adjacent[i].length;
    }
    this.anyConnected = connected.includes(1);
    this.linkOffsets = new Int32Array(count + 1);
    this.linkTargets = new Int32Array(links);
    for (let i = 0, n = 0; i < count; i++) {
      for (const id of adjacent[i]) this.linkTargets[n++] = this.index.get(id) ?? -1;
      this.linkOffsets[i + 1] = n;
    }
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity;
    const gridded = areas.map(
      ({ rect: [x0, z0, x1, z1] }) => Number.isFinite(x0 + z0 + x1 + z1) && x0 <= x1 && z0 <= z1,
    );
    for (let i = 0; i < count; i++) {
      if (!gridded[i]) {
        this.loose.push(i);
        continue;
      }
      const [x0, z0, x1, z1] = areas[i].rect;
      minX = Math.min(minX, Math.floor(x0 / navCell));
      maxX = Math.max(maxX, Math.floor(x1 / navCell));
      minZ = Math.min(minZ, Math.floor(z0 / navCell));
      maxZ = Math.max(maxZ, Math.floor(z1 / navCell));
    }
    this.x0 = minX <= maxX ? minX : 0;
    this.z0 = minZ <= maxZ ? minZ : 0;
    this.width = minX <= maxX ? maxX - minX + 1 : 0;
    this.depth = minZ <= maxZ ? maxZ - minZ + 1 : 0;
    const cells = this.width * this.depth,
      offsets = (this.cellOffsets = new Int32Array(cells + 1));
    const each = (visit: (cell: number, i: number) => void) => {
      for (let i = 0; i < count; i++) {
        if (!gridded[i]) continue;
        const rect = areas[i].rect;
        for (let z = Math.floor(rect[1] / navCell); z <= Math.floor(rect[3] / navCell); z++)
          for (let x = Math.floor(rect[0] / navCell); x <= Math.floor(rect[2] / navCell); x++)
            visit((z - this.z0) * this.width + x - this.x0, i);
      }
    };
    each((cell) => offsets[cell + 1]++);
    for (let c = 0; c < cells; c++) offsets[c + 1] += offsets[c];
    const cursor = offsets.slice(0, cells);
    this.cellAreas = new Int32Array(offsets[cells]);
    each((cell, i) => (this.cellAreas[cursor[cell]++] = i));
    this.seen = new Int32Array(count);
    this.costs = new Float32Array(count);
    this.previous = new Int32Array(count);
    this.closed = new Uint8Array(count);
    this.heapArea = new Int32Array(links + 1);
    this.heapScore = new Float64Array(links + 1);
  }
  private cell(x: number, z: number) {
    const cx = Math.floor(x / navCell) - this.x0,
      cz = Math.floor(z / navCell) - this.z0;
    return cx >= 0 && cz >= 0 && cx < this.width && cz < this.depth ? cz * this.width + cx : -1;
  }
  support(x: number, z: number, ceiling: number, bottom: number, from?: NavArea) {
    let best: NavArea | undefined,
      height = -Infinity;
    const cell = this.cell(x, z);
    if (cell < 0) return undefined;
    for (let e = this.cellOffsets[cell], end = this.cellOffsets[cell + 1]; e < end; e++) {
      const i = this.cellAreas[e],
        area = this.areas[i];
      if (this.anyConnected && !this.connected[i]) continue;
      if (from && area.id !== from.id && !from.links.includes(area.id)) continue;
      if (
        x < area.rect[0] - 0.025 ||
        x > area.rect[2] + 0.025 ||
        z < area.rect[1] - 0.025 ||
        z > area.rect[3] + 0.025
      )
        continue;
      if (!this.contains(area, x, z)) continue;
      const y = this.height(area, x, z);
      if (y <= ceiling + 0.01 && y >= bottom && y > height) {
        best = area;
        height = y;
      }
    }
    return best ? { area: best, height } : undefined;
  }
  private height(area: NavArea, x: number, z: number) {
    if (this.data.polygons) {
      const a = area.corners[0];
      for (let i = 1; i + 1 < area.corners.length; i++) {
        const b = area.corners[i],
          c = area.corners[i + 1];
        const determinant = (b[0] - a[0]) * (c[2] - a[2]) - (c[0] - a[0]) * (b[2] - a[2]);
        if (Math.abs(determinant) < 1e-8) continue;
        const u = ((x - a[0]) * (c[2] - a[2]) - (z - a[2]) * (c[0] - a[0])) / determinant;
        const v = ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) / determinant;
        return a[1] + u * (b[1] - a[1]) + v * (c[1] - a[1]);
      }
      return area.center[1];
    }
    if (area.corners.length !== 4) return area.center[1];
    const [x0, z0, x1, z1] = area.rect;
    const u = T.MathUtils.clamp((x - x0) / Math.max(0.0001, x1 - x0), 0, 1),
      v = T.MathUtils.clamp((z - z0) / Math.max(0.0001, z1 - z0), 0, 1);
    return T.MathUtils.lerp(
      T.MathUtils.lerp(area.corners[3][1], area.corners[2][1], u),
      T.MathUtils.lerp(area.corners[0][1], area.corners[1][1], u),
      v,
    );
  }
  private contains(area: NavArea, x: number, z: number) {
    if (!this.data.polygons) return true;
    let positive = false,
      negative = false;
    for (let i = 0; i < area.corners.length; i++) {
      const a = area.corners[i],
        b = area.corners[(i + 1) % area.corners.length];
      const cross = (b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0]);
      const tolerance = 0.025 * Math.hypot(b[0] - a[0], b[2] - a[2]);
      positive ||= cross > tolerance;
      negative ||= cross < -tolerance;
    }
    return !(positive && negative);
  }
  nearest(point: T.Vector3) {
    let best = 0,
      distance = Infinity,
      connectedBest = 0,
      connectedDistance = Infinity;
    const stamp = ++this.stamp,
      { areas, connected, seen, cellOffsets, cellAreas, width, depth } = this;
    // Ties resolve to the lowest area index, as a linear scan would.
    const consider = (i: number) => {
      if (seen[i] === stamp) return;
      seen[i] = stamp;
      const area = areas[i],
        [x0, z0, x1, z1] = area.rect;
      let dx = Math.max(x0 - point.x, 0, point.x - x1);
      let dz = Math.max(z0 - point.z, 0, point.z - z1);
      if (this.data.polygons && !this.contains(area, point.x, point.z)) {
        let squared = Infinity;
        for (let edge = 0; edge < area.corners.length; edge++) {
          const a = area.corners[edge],
            b = area.corners[(edge + 1) % area.corners.length];
          const ex = b[0] - a[0],
            ez = b[2] - a[2];
          const t = T.MathUtils.clamp(
            ((point.x - a[0]) * ex + (point.z - a[2]) * ez) / Math.max(1e-10, ex * ex + ez * ez),
            0,
            1,
          );
          squared = Math.min(
            squared,
            (point.x - a[0] - ex * t) ** 2 + (point.z - a[2] - ez * t) ** 2,
          );
        }
        dx = Math.sqrt(squared);
        dz = 0;
      }
      const dy = point.y - this.height(area, point.x, point.z);
      const cost = dx * dx + dz * dz + dy * dy * 3;
      if (
        connected[i] &&
        (cost < connectedDistance || (cost === connectedDistance && i < connectedBest))
      ) {
        connectedDistance = cost;
        connectedBest = i;
      }
      if (cost < distance || (cost === distance && i < best)) {
        distance = cost;
        best = i;
      }
    };
    for (const i of this.loose) consider(i);
    // Search rings of grid cells outward. Areas outside the searched square
    // are at least its edge distance away horizontally, which bounds their cost.
    const cx = Math.floor(point.x / navCell) - this.x0,
      cz = Math.floor(point.z / navCell) - this.z0;
    const rings = Math.max(
      Math.abs(cx),
      Math.abs(width - 1 - cx),
      Math.abs(cz),
      Math.abs(depth - 1 - cz),
    );
    for (let r = 0; r <= rings && width && depth; r++) {
      if (r > 0) {
        const gap =
          Math.min(
            point.x - (cx + this.x0 - r + 1) * navCell,
            (cx + this.x0 + r) * navCell - point.x,
            point.z - (cz + this.z0 - r + 1) * navCell,
            (cz + this.z0 + r) * navCell - point.z,
          ) - 1e-6;
        const bound = gap > 0 ? gap * gap : 0;
        if (
          bound > distance &&
          (connected[best] || bound > Math.min(connectedDistance, distance + 2))
        )
          break;
      }
      for (let z = Math.max(0, cz - r); z <= Math.min(depth - 1, cz + r); z++) {
        // Interior rows of the ring contribute only their two end cells.
        const step = z === cz - r || z === cz + r ? 1 : 2 * r;
        for (let x = cx - r; x <= cx + r; x += step) {
          if (x < 0 || x >= width) continue;
          const cell = z * width + x;
          for (let e = cellOffsets[cell], end = cellOffsets[cell + 1]; e < end; e++)
            consider(cellAreas[e]);
        }
      }
    }
    // Native NAV files retain orphaned regions overlapping spawn floors. Use
    // an adjacent connected region when it is on the same physical floor.
    return !connected[best] && connectedDistance - distance < 2 ? connectedBest : best;
  }
  site(index: number, offsetX = 0, offsetZ = 0) {
    const center = this.data.sites[index];
    const goal = new T.Vector3().fromArray(center);
    goal.x += offsetX;
    goal.z += offsetZ;
    // Bomb trigger centers are above the ground. Prefer the site's ordinary
    // walking areas rather than nearby one-way jump links on top of crates.
    let candidates = this.sites.get(index);
    if (!candidates) {
      const label = index === 0 ? "BombsiteA" : "BombsiteB";
      candidates = this.areas.filter(
        (area) => area.place === label && !(area.flags & 2) && !(area.center[1] > center[1] - 0.3),
      );
      // Source 2 polygon NAV exports may omit place labels. Resolve the native
      // trigger center onto an ordinary connected floor rather than using its
      // airborne brush center as a planting goal.
      if (!candidates.length && this.data.mapId === "mirage") {
        const touchingSite = this.data.triggers?.sites.find((site) => site.site === index);
        candidates = this.areas.filter((area) => {
          if (!area.links.length || area.flags & 2) return false;
          const [x, y, z] = area.center;
          return touchingSite?.hulls.some((hull) =>
            touchesBuyZone({ x, y, z }, hull, { halfWidth: 0.3, height: 1.7 }),
          );
        });
        if (!candidates.length) candidates = [this.areas[this.nearest(goal)]];
      }
      this.sites.set(index, candidates);
    }
    let cost = Infinity,
      best: NavArea | undefined;
    for (const area of candidates) {
      const distance = Math.hypot(area.center[0] - goal.x, area.center[2] - goal.z);
      if (distance < cost) {
        cost = distance;
        best = area;
      }
    }
    return best ? goal.fromArray(best.center) : goal;
  }
  private smooth(from: T.Vector3, points: T.Vector3[]) {
    const clear = (a: T.Vector3, b: T.Vector3) => {
      let ground = this.support(a.x, a.z, a.y + 0.6, a.y - 1);
      if (!ground) return false;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.3));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        ground = this.support(
          T.MathUtils.lerp(a.x, b.x, t),
          T.MathUtils.lerp(a.z, b.z, t),
          ground.height + 0.46,
          ground.height - 0.46,
          ground.area,
        );
        if (!ground) return false;
      }
      return Math.abs(ground.height - b.y) < 0.5;
    };
    const route: T.Vector3[] = [];
    for (let i = 0; i < points.length;) {
      let next = Math.min(i + 15, points.length - 1);
      while (next > i && !clear(from, points[next])) next--;
      route.push(points[next]);
      from = points[next];
      i = next + 1;
    }
    return route;
  }
  path(
    from: T.Vector3,
    goal: T.Vector3,
    avoid: T.Vector3[] = [],
    blocked?: ReadonlySet<number>,
    smooth = true,
    startArea?: NavArea,
  ) {
    // A hull can overhang its current NAV polygon at an edge or during a
    // jump. Retain that physical connection instead of snapping the route's
    // start across a nearby wall. Ignore stale hints after falling floors.
    let hint = startArea ? this.index.get(startArea.id) : undefined;
    if (startArea && hint !== undefined) {
      let distance = Math.hypot(
        Math.max(startArea.rect[0] - from.x, 0, from.x - startArea.rect[2]),
        Math.max(startArea.rect[1] - from.z, 0, from.z - startArea.rect[3]),
      );
      if (this.data.polygons && !this.contains(startArea, from.x, from.z)) {
        distance = Infinity;
        for (let i = 0; i < startArea.corners.length; i++) {
          const a = startArea.corners[i],
            b = startArea.corners[(i + 1) % startArea.corners.length],
            dx = b[0] - a[0],
            dz = b[2] - a[2],
            t = T.MathUtils.clamp(
              ((from.x - a[0]) * dx + (from.z - a[2]) * dz) / Math.max(1e-10, dx * dx + dz * dz),
              0,
              1,
            );
          distance = Math.min(distance, Math.hypot(from.x - a[0] - dx * t, from.z - a[2] - dz * t));
        }
      }
      if (distance > 0.4 || Math.abs(from.y - this.height(startArea, from.x, from.z)) > 0.6)
        hint = undefined;
    }
    const start = hint ?? this.nearest(from),
      end = this.nearest(goal);
    const { costs, previous, closed, heapArea, heapScore, linkOffsets, linkTargets } = this,
      areas = this.areas,
      target = areas[end].center;
    costs.fill(Infinity);
    previous.fill(-1);
    closed.fill(0);
    let size = 0;
    const heuristic = (i: number) => {
      const a = areas[i].center;
      return Math.hypot(a[0] - target[0], a[1] - target[1], a[2] - target[2]);
    };
    const push = (i: number, score: number) => {
      let n = size++;
      while (n > 0) {
        const p = (n - 1) >> 1;
        if (heapScore[p] <= score) break;
        heapArea[n] = heapArea[p];
        heapScore[n] = heapScore[p];
        n = p;
      }
      heapArea[n] = i;
      heapScore[n] = score;
    };
    costs[start] = 0;
    push(start, heuristic(start));
    while (size) {
      const i = heapArea[0],
        lastArea = heapArea[--size],
        lastScore = heapScore[size];
      if (size) {
        let n = 0;
        while (n * 2 + 1 < size) {
          let c = n * 2 + 1;
          if (c + 1 < size && heapScore[c + 1] < heapScore[c]) c++;
          if (lastScore <= heapScore[c]) break;
          heapArea[n] = heapArea[c];
          heapScore[n] = heapScore[c];
          n = c;
        }
        heapArea[n] = lastArea;
        heapScore[n] = lastScore;
      }
      if (closed[i]) continue;
      if (i === end) break;
      closed[i] = 1;
      const a = areas[i].center;
      for (let l = linkOffsets[i]; l < linkOffsets[i + 1]; l++) {
        const j = linkTargets[l];
        if (j < 0 || closed[j]) continue;
        const next = areas[j],
          b = next.center;
        if (blocked?.has(next.id) && j !== end) continue;
        const distance = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const ladder = this.ladderEdges.has(`${areas[i].id}:${next.id}`);
        // Native jump links retain separate takeoff and landing edges. Keep
        // shortcuts within the 7.5 m/s, 20 m/s² jump's 1.406 m apex, with a
        // small margin for the fixed-step controller and hull clearance.
        const portal = areas[i].portals?.[next.id];
        const landing = next.portals?.[areas[i].id] ?? portal;
        if (
          !ladder &&
          portal &&
          landing &&
          this.height(next, landing[0], landing[2]) - this.height(areas[i], portal[0], portal[2]) >
            1.35
        )
          continue;
        // Reject ladders/jumps this walking controller cannot traverse.
        const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2]);
        if (!ladder && b[1] - a[1] > 1.35 + horizontal * 0.8) continue;
        let congestion = 0;
        for (const point of avoid) {
          const d = Math.hypot(point.x - b[0], point.z - b[2]);
          if (d < 2.5) congestion += (2.5 - d) * 0.35;
        }
        const cost = costs[i] + distance + congestion;
        if (cost >= costs[j]) continue;
        costs[j] = cost;
        previous[j] = i;
        push(j, cost + heuristic(j));
      }
    }
    if (start !== end && previous[end] < 0) return [];
    const route = [end];
    while (route[route.length - 1] !== start) route.push(previous[route[route.length - 1]]);
    route.reverse();
    const points: T.Vector3[] = [];
    for (let i = 1; i < route.length; i++) {
      const a = this.areas[route[i - 1]],
        b = this.areas[route[i]];
      const transition = this.ladderEdges.get(`${a.id}:${b.id}`);
      if (transition) {
        const { ladder, up } = transition;
        const normal = ladderNormal(ladder);
        const bottom = new T.Vector3().fromArray(ladder.bottom).addScaledVector(normal, 0.42);
        const top = new T.Vector3().fromArray(ladder.top).addScaledVector(normal, 0.42);
        points.push(...(up ? [bottom, top] : [top, bottom]), new T.Vector3().fromArray(b.center));
        continue;
      }
      const x0 = Math.max(a.rect[0], b.rect[0]),
        x1 = Math.min(a.rect[2], b.rect[2]);
      const z0 = Math.max(a.rect[1], b.rect[1]),
        z1 = Math.min(a.rect[3], b.rect[3]);
      if (a.portals?.[b.id]) points.push(new T.Vector3().fromArray(a.portals[b.id]));
      else if (x0 <= x1 + 0.05 && z0 <= z1 + 0.05)
        points.push(
          new T.Vector3((x0 + x1) / 2, this.height(b, (x0 + x1) / 2, (z0 + z1) / 2), (z0 + z1) / 2),
        );
      points.push(new T.Vector3().fromArray(b.center));
    }
    points.push(new T.Vector3().fromArray(this.areas[end].center));
    const rect = this.areas[end].rect;
    if (
      goal.x >= rect[0] &&
      goal.x <= rect[2] &&
      goal.z >= rect[1] &&
      goal.z <= rect[3] &&
      this.contains(this.areas[end], goal.x, goal.z) &&
      Math.abs(goal.y - this.areas[end].center[1]) < 1.2
    )
      points.push(goal.clone());
    return blocked?.size || !smooth ? points : this.smooth(from, points);
  }
}
