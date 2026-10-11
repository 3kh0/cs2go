import * as T from "three";
import type { MapCollision } from "./map-collision";
// A bounded local search refines native NAV routes around angled doors and
// props. Heights remain part of the state so tunnels are not flattened.
export function detour(collision: MapCollision, from: T.Vector3, goal: T.Vector3) {
  const spacing = 0.5;
  type Node = { x: number; z: number; y: number; cost: number; score: number; parent?: Node };
  const key = (n: Node) => `${n.x},${n.z},${Math.round(n.y * 2)}`;
  const distance = (x: number, z: number) =>
    Math.hypot(from.x + x * spacing - goal.x, from.z + z * spacing - goal.z);
  const start: Node = { x: 0, z: 0, y: from.y, cost: 0, score: distance(0, 0) };
  const open = [start],
    costs = new Map([[key(start), 0]]);
  let end: Node | undefined;
  for (let iteration = 0; iteration < 200 && open.length; iteration++) {
    let best = 0;
    for (let i = 1; i < open.length; i++) if (open[i].score < open[best].score) best = i;
    const node = open.splice(best, 1)[0];
    if (node.cost > costs.get(key(node))!) continue;
    if (distance(node.x, node.z) < 0.65 && Math.abs(node.y - goal.y) < 1.2) {
      end = node;
      break;
    }
    for (const [dx, dz] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ]) {
      const x = node.x + dx,
        z = node.z + dz;
      if (Math.abs(x) > 16 || Math.abs(z) > 16) continue;
      const wx = from.x + x * spacing,
        wz = from.z + z * spacing;
      const y = collision.floor(wx, wz, node.y + 1.05, node.y - 6);
      if (!Number.isFinite(y) || collision.blocked(wx, wz, y, 0.35)) continue;
      // Check the swept midpoint as well, preventing diagonal corner cutting.
      const mx = from.x + ((x + node.x) * spacing) / 2,
        mz = from.z + ((z + node.z) * spacing) / 2;
      if (collision.blocked(mx, mz, Math.max(y, node.y), 0.35)) continue;
      const cost = node.cost + Math.hypot(dx, dz) * spacing + Math.max(0, y - node.y) * 1.5;
      const next: Node = { x, z, y, cost, score: cost + distance(x, z), parent: node };
      if (cost >= (costs.get(key(next)) ?? Infinity)) continue;
      costs.set(key(next), cost);
      open.push(next);
    }
  }
  const route: T.Vector3[] = [];
  while (end?.parent) {
    route.push(new T.Vector3(from.x + end.x * spacing, end.y, from.z + end.z * spacing));
    end = end.parent;
  }
  return route.reverse();
}
