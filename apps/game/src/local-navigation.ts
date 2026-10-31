import * as T from "three";
import type { MapCollision } from "./map-collision";

const spacing = 0.5,
  reach = 16,
  side = reach * 2 + 1,
  // Midpoints between neighbouring grid nodes lie on a half-spacing lattice.
  halfSide = reach * 4 + 1,
  steps = [-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, -1, 1, 1, -1, 1, 1];
type Node = {
  x: number;
  z: number;
  y: number;
  cost: number;
  score: number;
  order: number;
  parent?: Node;
};
// Lowest score first; equal scores keep insertion order.
const before = (a: Node, b: Node) =>
  a.score < b.score || (a.score === b.score && a.order < b.order);

// A bounded local search refines native NAV routes around angled doors and
// props. Heights remain part of the state so tunnels are not flattened.
export function detour(collision: MapCollision, from: T.Vector3, goal: T.Vector3) {
  const key = (x: number, z: number, y: number) =>
    x + reach + side * (z + reach) + side * side * Math.round(y * 2);
  const distance = (x: number, z: number) =>
    Math.hypot(from.x + x * spacing - goal.x, from.z + z * spacing - goal.z);
  const open: Node[] = [];
  const push = (node: Node) => {
    let n = open.length;
    open.push(node);
    while (n > 0) {
      const p = (n - 1) >> 1;
      if (!before(node, open[p])) break;
      open[n] = open[p];
      n = p;
    }
    open[n] = node;
  };
  const pop = () => {
    const top = open[0],
      last = open.pop()!;
    if (open.length) {
      let n = 0;
      for (;;) {
        let c = n * 2 + 1;
        if (c >= open.length) break;
        if (c + 1 < open.length && before(open[c + 1], open[c])) c++;
        if (!before(open[c], last)) break;
        open[n] = open[c];
        n = c;
      }
      open[n] = last;
    }
    return top;
  };
  // Collision probes are pure, and neighbouring expansions repeat them from
  // the same floor height. Remember the latest result per grid point.
  const floorFrom = new Float64Array(side * side).fill(NaN),
    floorY = new Float64Array(side * side),
    floorBlocked = new Uint8Array(side * side);
  const sweepFeet = new Float64Array(halfSide * halfSide).fill(NaN),
    sweepBlocked = new Uint8Array(halfSide * halfSide);
  const start: Node = { x: 0, z: 0, y: from.y, cost: 0, score: distance(0, 0), order: 0 };
  const costs = new Map([[key(0, 0, start.y), 0]]);
  let end: Node | undefined,
    order = 1;
  push(start);
  for (let iteration = 0; iteration < 200 && open.length; iteration++) {
    const node = pop();
    if (node.cost > costs.get(key(node.x, node.z, node.y))!) continue;
    if (distance(node.x, node.z) < 0.65 && Math.abs(node.y - goal.y) < 1.2) {
      end = node;
      break;
    }
    for (let s = 0; s < steps.length; s += 2) {
      const dx = steps[s],
        dz = steps[s + 1];
      const x = node.x + dx,
        z = node.z + dz;
      if (Math.abs(x) > reach || Math.abs(z) > reach) continue;
      const wx = from.x + x * spacing,
        wz = from.z + z * spacing;
      const point = x + reach + side * (z + reach);
      if (floorFrom[point] !== node.y) {
        const y = collision.floor(wx, wz, node.y + 1.05, node.y - 6);
        floorFrom[point] = node.y;
        floorY[point] = y;
        floorBlocked[point] = !Number.isFinite(y) || collision.blocked(wx, wz, y, 0.35) ? 1 : 0;
      }
      if (floorBlocked[point]) continue;
      const y = floorY[point];
      // Check the swept midpoint as well, preventing diagonal corner cutting.
      const feet = Math.max(y, node.y),
        midpoint = x + node.x + 2 * reach + halfSide * (z + node.z + 2 * reach);
      if (sweepFeet[midpoint] !== feet) {
        const mx = from.x + ((x + node.x) * spacing) / 2,
          mz = from.z + ((z + node.z) * spacing) / 2;
        sweepFeet[midpoint] = feet;
        sweepBlocked[midpoint] = collision.blocked(mx, mz, feet, 0.35) ? 1 : 0;
      }
      if (sweepBlocked[midpoint]) continue;
      const cost = node.cost + Math.hypot(dx, dz) * spacing + Math.max(0, y - node.y) * 1.5;
      const k = key(x, z, y);
      if (cost >= (costs.get(k) ?? Infinity)) continue;
      costs.set(k, cost);
      push({ x, z, y, cost, score: cost + distance(x, z), order: order++, parent: node });
    }
  }
  const route: T.Vector3[] = [];
  while (end?.parent) {
    route.push(new T.Vector3(from.x + end.x * spacing, end.y, from.z + end.z * spacing));
    end = end.parent;
  }
  return route.reverse();
}
