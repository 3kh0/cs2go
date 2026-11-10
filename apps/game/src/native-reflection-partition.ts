import * as T from "three";
import type { SourceReflections } from "./source-reflections";

interface Group {
  material: number;
  candidates: number[];
  indices: number[];
}
interface Vertex {
  index: number;
  world: T.Vector3;
  values?: Record<string, number[]>;
}

/** Partition draws by conservative triangle coverage. Index-only partitions keep
 * the original attribute buffers; large triangles are bisected with exact
 * linear interpolation of every attribute, including atlas UVs and controls. */
export function partitionNativeReflections(mesh: T.Mesh, data: SourceReflections, capacity = 8) {
  const geometry = mesh.geometry;
  const position = geometry.getAttribute("position");
  const boxes = data.volumes.map((volume) => {
    const lo = volume.worldAABB?.[0] ?? volume.origin.map((v, i) => v + volume.min[i]);
    const hi = volume.worldAABB?.[1] ?? volume.origin.map((v, i) => v + volume.max[i]);
    return new T.Box3(
      new T.Vector3(lo[0] * 0.0254, lo[2] * 0.0254, -hi[1] * 0.0254),
      new T.Vector3(hi[0] * 0.0254, hi[2] * 0.0254, -lo[1] * 0.0254),
    );
  });
  const groups: Group[] = [];
  const clippedGroups: Group[] = [];
  const clipped: Record<string, number[]> = Object.fromEntries(
    Object.keys(geometry.attributes).map((name) => [name, []]),
  );
  let extraVertices = 0;
  const triangle = new T.Triangle();
  const box = new T.Box3();
  const candidates = (a: Vertex, b: Vertex, c: Vertex, possible: number[]) => {
    triangle.set(a.world, b.world, c.world);
    box.setFromPoints([a.world, b.world, c.world]);
    return possible.filter(
      (index) => boxes[index].intersectsBox(box) && boxes[index].intersectsTriangle(triangle),
    );
  };
  const groupFor = (list: Group[], material: number, coverage: number[]) => {
    // A superset is safe: fragment-native edge/priority weights still select
    // the exact local volume. Merge only when the complete union fits.
    const source = Array.isArray(mesh.material) ? mesh.material[material] : mesh.material;
    // Alpha blending observes triangle order. Only extend the last draw for
    // transparent materials; opaque draws may merge nonadjacent triangles.
    const eligible = source.transparent ? list.slice(-1) : list;
    let group = eligible.find(
      (item) => item.material === material && coverage.every((id) => item.candidates.includes(id)),
    );
    if (group) return group;
    group = eligible.find(
      (item) =>
        item.material === material && new Set([...item.candidates, ...coverage]).size <= capacity,
    );
    if (group)
      group.candidates = [...new Set([...group.candidates, ...coverage])].sort((a, b) => a - b);
    else {
      group = { material, candidates: coverage, indices: [] };
      list.push(group);
    }
    return group;
  };
  const values = (vertex: Vertex) =>
    (vertex.values ??= Object.fromEntries(
      Object.entries(geometry.attributes).map(([name, attribute]) => [
        name,
        Array.from({ length: attribute.itemSize }, (_, component) =>
          attribute.getComponent(vertex.index, component),
        ),
      ]),
    ));
  const midpoint = (a: Vertex, b: Vertex): Vertex => {
    const av = values(a),
      bv = values(b);
    return {
      index: -1,
      world: a.world.clone().add(b.world).multiplyScalar(0.5),
      values: Object.fromEntries(
        Object.keys(av).map((name) => [
          name,
          av[name].map((value, i) => (value + bv[name][i]) * 0.5),
        ]),
      ),
    };
  };
  const emit = (
    a: Vertex,
    b: Vertex,
    c: Vertex,
    material: number,
    possible: number[],
    depth: number,
  ) => {
    const coverage = candidates(a, b, c, possible);
    if (coverage.length > capacity) {
      const source = Array.isArray(mesh.material) ? mesh.material[material] : mesh.material;
      if (source.transparent)
        throw new Error(
          `Native transparent reflection triangle exceeds ${capacity} volumes: ${mesh.name}`,
        );
      if (depth >= 24)
        throw new Error(`Native reflection overlap exceeds ${capacity} volumes: ${mesh.name}`);
      const ab = a.world.distanceToSquared(b.world),
        bc = b.world.distanceToSquared(c.world),
        ca = c.world.distanceToSquared(a.world);
      if (ab >= bc && ab >= ca) {
        const mid = midpoint(a, b);
        emit(a, mid, c, material, coverage, depth + 1);
        emit(mid, b, c, material, coverage, depth + 1);
      } else if (bc >= ca) {
        const mid = midpoint(b, c);
        emit(a, b, mid, material, coverage, depth + 1);
        emit(a, mid, c, material, coverage, depth + 1);
      } else {
        const mid = midpoint(c, a);
        emit(a, b, mid, material, coverage, depth + 1);
        emit(mid, b, c, material, coverage, depth + 1);
      }
      return;
    }
    if (!depth) groupFor(groups, material, coverage).indices.push(a.index, b.index, c.index);
    else {
      const group = groupFor(clippedGroups, material, coverage);
      for (const vertex of [a, b, c]) {
        const attributes = values(vertex);
        for (const name of Object.keys(clipped)) clipped[name].push(...attributes[name]);
        group.indices.push(extraVertices++);
      }
    }
  };
  const index = geometry.index;
  const sourceGroups = geometry.groups.length
    ? geometry.groups
    : [{ start: 0, count: index?.count ?? position.count, materialIndex: 0 }];
  const all = boxes.map((_, index) => index);
  const meshBounds = new T.Box3().setFromObject(mesh);
  const possible = all.filter((index) => boxes[index].intersectsBox(meshBounds));
  for (const group of sourceGroups) {
    for (let offset = group.start; offset < group.start + group.count; offset += 3) {
      const vertices = [0, 1, 2].map((i) => {
        const vertex = index ? index.getX(offset + i) : offset + i;
        return {
          index: vertex,
          world: new T.Vector3()
            .fromBufferAttribute(position, vertex)
            .applyMatrix4(mesh.matrixWorld),
        };
      });
      emit(vertices[0], vertices[1], vertices[2], group.materialIndex ?? 0, possible, 0);
    }
  }
  const build = (target: T.BufferGeometry, list: Group[]) => {
    target.clearGroups();
    const indices: number[] = [];
    for (const [i, group] of list.entries()) {
      target.addGroup(indices.length, group.indices.length, i);
      for (const index of group.indices) indices.push(index);
    }
    target.setIndex(indices);
    target.computeBoundingBox();
    target.computeBoundingSphere();
    return { geometry: target, groups: list };
  };
  const retained = new T.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes))
    retained.setAttribute(name, attribute);
  const original = build(retained, groups);
  let overflow: ReturnType<typeof build> | undefined;
  if (extraVertices) {
    const target = new T.BufferGeometry();
    for (const [name, array] of Object.entries(clipped))
      target.setAttribute(
        name,
        new T.Float32BufferAttribute(array, geometry.getAttribute(name).itemSize),
      );
    overflow = build(target, clippedGroups);
  }
  return { original, overflow, extraVertices };
}
