import * as T from "three";
export type NavArea = {
  id: number;
  flags: number;
  center: number[];
  rect: number[];
  corners: number[][];
  links: number[];
  cover: number[][];
  place: string;
};
export type MapNavigation = {
  areas: NavArea[];
  spawns: Record<"t" | "ct", number[][]>;
  spawnAngles?: Record<"t" | "ct", number[]>;
  sites: number[][];
  bounds: number[];
};
// The original Source navigation graph preserves stacked tunnels, ramps and
// one-way connections. A* searches this graph rather than a flattened grid.
export class Navigation {
  readonly areas: NavArea[];
  readonly index = new Map<number, number>();
  private readonly connected = new Set<number>();
  private readonly cells = new Map<string, NavArea[]>();
  readonly data: MapNavigation;
  constructor(data: MapNavigation) {
    this.data = data;
    this.areas = data.areas;
    this.areas.forEach((area, i) => this.index.set(area.id, i));
    this.areas.forEach((area) => {
      if (area.links.length) this.connected.add(area.id);
      area.links.forEach((id) => this.connected.add(id));
      for (let z = Math.floor(area.rect[1] / 4); z <= Math.floor(area.rect[3] / 4); z++)
        for (let x = Math.floor(area.rect[0] / 4); x <= Math.floor(area.rect[2] / 4); x++) {
          const key = `${x},${z}`,
            cell = this.cells.get(key) ?? [];
          cell.push(area);
          this.cells.set(key, cell);
        }
    });
  }
  support(x: number, z: number, ceiling: number, bottom: number, from?: NavArea) {
    let best: NavArea | undefined,
      height = -Infinity;
    for (const area of this.cells.get(`${Math.floor(x / 4)},${Math.floor(z / 4)}`) ?? []) {
      if (this.connected.size && !this.connected.has(area.id)) continue;
      if (from && area.id !== from.id && !from.links.includes(area.id)) continue;
      if (
        x < area.rect[0] - 0.025 ||
        x > area.rect[2] + 0.025 ||
        z < area.rect[1] - 0.025 ||
        z > area.rect[3] + 0.025
      )
        continue;
      const y = this.height(area, x, z);
      if (y <= ceiling + 0.01 && y >= bottom && y > height) {
        best = area;
        height = y;
      }
    }
    return best ? { area: best, height } : undefined;
  }
  private height(area: NavArea, x: number, z: number) {
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
  nearest(point: T.Vector3) {
    let best = 0,
      distance = Infinity,
      connectedBest = 0,
      connectedDistance = Infinity;
    this.areas.forEach((area, i) => {
      const [x0, z0, x1, z1] = area.rect;
      const dx = Math.max(x0 - point.x, 0, point.x - x1);
      const dz = Math.max(z0 - point.z, 0, point.z - z1);
      const dy = point.y - this.height(area, point.x, point.z);
      const cost = dx * dx + dz * dz + dy * dy * 3;
      if (this.connected.has(area.id) && cost < connectedDistance) {
        connectedDistance = cost;
        connectedBest = i;
      }
      if (cost < distance) {
        distance = cost;
        best = i;
      }
    });
    // Native NAV files retain orphaned regions overlapping spawn floors. Use
    // an adjacent connected region when it is on the same physical floor.
    return !this.connected.has(this.areas[best].id) && connectedDistance - distance < 2
      ? connectedBest
      : best;
  }
  site(index: number, offsetX = 0, offsetZ = 0) {
    const center = this.data.sites[index];
    const goal = new T.Vector3().fromArray(center);
    goal.x += offsetX;
    goal.z += offsetZ;
    // Bomb trigger centers are above the ground. Prefer the site's ordinary
    // walking areas rather than nearby one-way jump links on top of crates.
    const label = index === 0 ? "BombsiteA" : "BombsiteB";
    let cost = Infinity,
      best: NavArea | undefined;
    for (const area of this.areas) {
      if (area.place !== label || area.flags & 2 || area.center[1] > center[1] - 0.3) continue;
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
  path(from: T.Vector3, goal: T.Vector3, avoid: T.Vector3[] = [], blocked?: ReadonlySet<number>) {
    const start = this.nearest(from),
      end = this.nearest(goal);
    const costs = new Float32Array(this.areas.length).fill(Infinity);
    const previous = new Int32Array(this.areas.length).fill(-1);
    const closed = new Uint8Array(this.areas.length);
    const heap: { i: number; score: number }[] = [];
    const heuristic = (i: number) => {
      const a = this.areas[i].center,
        b = this.areas[end].center;
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    };
    const push = (i: number, score: number) => {
      let n = heap.length;
      heap.push({ i, score });
      while (n > 0) {
        const p = (n - 1) >> 1;
        if (heap[p].score <= score) break;
        heap[n] = heap[p];
        n = p;
      }
      heap[n] = { i, score };
    };
    costs[start] = 0;
    push(start, heuristic(start));
    while (heap.length) {
      const current = heap[0],
        last = heap.pop()!;
      if (heap.length) {
        let n = 0;
        while (n * 2 + 1 < heap.length) {
          let c = n * 2 + 1;
          if (c + 1 < heap.length && heap[c + 1].score < heap[c].score) c++;
          if (last.score <= heap[c].score) break;
          heap[n] = heap[c];
          n = c;
        }
        heap[n] = last;
      }
      const i = current.i;
      if (closed[i]) continue;
      if (i === end) break;
      closed[i] = 1;
      const area = this.areas[i];
      for (const id of area.links) {
        const j = this.index.get(id);
        if (j === undefined || closed[j]) continue;
        const next = this.areas[j];
        if (blocked?.has(next.id) && j !== end) continue;
        const distance = Math.hypot(...next.center.map((v, k) => v - area.center[k]));
        // Reject ladders/jumps this walking controller cannot traverse.
        const horizontal = Math.hypot(
          next.center[0] - area.center[0],
          next.center[2] - area.center[2],
        );
        if (next.center[1] - area.center[1] > 1.35 + horizontal * 0.8) continue;
        let congestion = 0;
        for (const point of avoid) {
          const d = Math.hypot(point.x - next.center[0], point.z - next.center[2]);
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
      const x0 = Math.max(a.rect[0], b.rect[0]),
        x1 = Math.min(a.rect[2], b.rect[2]);
      const z0 = Math.max(a.rect[1], b.rect[1]),
        z1 = Math.min(a.rect[3], b.rect[3]);
      if (x0 <= x1 + 0.05 && z0 <= z1 + 0.05)
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
      Math.abs(goal.y - this.areas[end].center[1]) < 1.2
    )
      points.push(goal.clone());
    return blocked?.size ? points : this.smooth(from, points);
  }
}
