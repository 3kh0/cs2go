import * as T from "three";
type Surface = {
  triangle: T.Triangle;
  normal: T.Vector3;
  minY: number;
  maxY: number;
  mesh: T.Mesh;
  visit: number;
};
const cellSize = 1.5;
const point = new T.Vector3(),
  contact = new T.Vector3(),
  down = new T.Vector3(0, -1, 0),
  up = new T.Vector3(0, 1, 0);
export class MapCollision {
  private readonly cells = new Map<string, Surface[]>();
  private readonly ray = new T.Ray();
  private query = 0;
  constructor(meshes: T.Mesh[]) {
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      const geometry = mesh.geometry,
        positions = geometry.getAttribute("position"),
        indices = geometry.index;
      const count = indices ? indices.count : positions.count;
      for (let i = 0; i < count; i += 3) {
        const vertices = [0, 1, 2].map((j) =>
          new T.Vector3()
            .fromBufferAttribute(positions, indices ? indices.getX(i + j) : i + j)
            .applyMatrix4(mesh.matrixWorld),
        );
        const triangle = new T.Triangle(...(vertices as [T.Vector3, T.Vector3, T.Vector3]));
        const surface: Surface = {
          triangle,
          normal: triangle.getNormal(new T.Vector3()),
          minY: Math.min(...vertices.map((v) => v.y)),
          maxY: Math.max(...vertices.map((v) => v.y)),
          mesh,
          visit: 0,
        };
        const minX = Math.floor(Math.min(...vertices.map((v) => v.x)) / cellSize),
          maxX = Math.floor(Math.max(...vertices.map((v) => v.x)) / cellSize);
        const minZ = Math.floor(Math.min(...vertices.map((v) => v.z)) / cellSize),
          maxZ = Math.floor(Math.max(...vertices.map((v) => v.z)) / cellSize);
        for (let z = minZ; z <= maxZ; z++)
          for (let x = minX; x <= maxX; x++) {
            const key = `${x},${z}`,
              list = this.cells.get(key) ?? [];
            list.push(surface);
            this.cells.set(key, list);
          }
      }
    }
  }
  floor(x: number, z: number, ceiling: number, bottom = ceiling - 5) {
    this.ray.set(point.set(x, ceiling + 0.01, z), down);
    let height = -Infinity;
    for (const s of this.cells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ??
      []) {
      if (Math.abs(s.normal.y) < 0.6 || s.minY > ceiling || s.maxY < bottom) continue;
      const hit = this.ray.intersectTriangle(
        s.triangle.a,
        s.triangle.b,
        s.triangle.c,
        false,
        contact,
      );
      if (hit && hit.y >= bottom) height = Math.max(height, hit.y);
    }
    return height;
  }
  blocked(x: number, z: number, feet: number, radius = 0.3, height = 1.65) {
    for (
      let cz = Math.floor((z - radius) / cellSize);
      cz <= Math.floor((z + radius) / cellSize);
      cz++
    )
      for (
        let cx = Math.floor((x - radius) / cellSize);
        cx <= Math.floor((x + radius) / cellSize);
        cx++
      )
        for (const s of this.cells.get(`${cx},${cz}`) ?? []) {
          if (s.maxY <= feet + 0.46 || s.minY >= feet + height) continue;
          // A ramp's far vertices can be above the capsule even though its
          // surface under the feet is walkable. Ground projection handles it.
          if (Math.abs(s.normal.y) > 0.6) {
            this.ray.set(point.set(x, feet + 0.46, z), down);
            if (
              this.ray.intersectTriangle(s.triangle.a, s.triangle.b, s.triangle.c, false, contact)
            )
              continue;
          }
          for (const y of [feet + radius + 0.12, feet + height / 2, feet + height - radius]) {
            point.set(x, y, z);
            s.triangle.closestPointToPoint(point, contact);
            if (contact.distanceToSquared(point) < radius * radius) return true;
          }
        }
    return false;
  }
  ceiling(x: number, z: number, bottom: number, top: number) {
    this.ray.set(point.set(x, bottom, z), up);
    let height = Infinity;
    for (const s of this.cells.get(`${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`) ??
      []) {
      if (Math.abs(s.normal.y) < 0.6 || s.maxY < bottom || s.minY > top) continue;
      const hit = this.ray.intersectTriangle(
        s.triangle.a,
        s.triangle.b,
        s.triangle.c,
        false,
        contact,
      );
      if (hit && hit.y <= top) height = Math.min(height, hit.y);
    }
    return height;
  }
  private *rayCells(ray: T.Ray, far: number) {
    let x = Math.floor(ray.origin.x / cellSize),
      z = Math.floor(ray.origin.z / cellSize),
      travelled = 0;
    const sx = Math.sign(ray.direction.x),
      sz = Math.sign(ray.direction.z);
    const dx = sx ? cellSize / Math.abs(ray.direction.x) : Infinity,
      dz = sz ? cellSize / Math.abs(ray.direction.z) : Infinity;
    let tx = sx ? ((x + (sx > 0 ? 1 : 0)) * cellSize - ray.origin.x) / ray.direction.x : Infinity;
    let tz = sz ? ((z + (sz > 0 ? 1 : 0)) * cellSize - ray.origin.z) / ray.direction.z : Infinity;
    // Each triangle is indexed in every cell touched by its bounding box.
    // Exact grid traversal needs no 3x3 neighborhood or per-ray Set allocation.
    while (travelled <= far) {
      const cell = this.cells.get(`${x},${z}`);
      if (cell) yield cell;
      if (tx < tz) {
        x += sx;
        travelled = tx;
        tx += dx;
      } else if (tz < tx) {
        z += sz;
        travelled = tz;
        tz += dz;
      } else {
        x += sx;
        z += sz;
        travelled = tx;
        tx += dx;
        tz += dz;
      }
    }
  }
  intersections(ray: T.Ray, far: number) {
    const hits: T.Intersection[] = [],
      query = ++this.query;
    for (const cell of this.rayCells(ray, far))
      for (const s of cell) {
        if (s.visit === query) continue;
        s.visit = query;
        const hit = ray.intersectTriangle(s.triangle.a, s.triangle.b, s.triangle.c, false, contact);
        if (!hit) continue;
        const distance = hit.distanceTo(ray.origin);
        if (distance > far || distance < 0.002) continue;
        hits.push({
          distance,
          point: hit.clone(),
          object: s.mesh,
          face: { a: 0, b: 1, c: 2, normal: s.normal.clone(), materialIndex: 0 },
        });
      }
    return hits.sort((a, b) => a.distance - b.distance);
  }
  visible(from: T.Vector3, to: T.Vector3) {
    const far = from.distanceTo(to),
      query = ++this.query;
    this.ray.set(from, contact.copy(to).sub(from).normalize());
    for (const cell of this.rayCells(this.ray, far))
      for (const s of cell) {
        if (s.visit === query) continue;
        s.visit = query;
        const hit = this.ray.intersectTriangle(
          s.triangle.a,
          s.triangle.b,
          s.triangle.c,
          false,
          contact,
        );
        if (hit) {
          const distance = hit.distanceTo(from);
          if (distance > 0.002 && distance < far) return false;
        }
      }
    return true;
  }
  thickness(impact: T.Intersection, direction: T.Vector3) {
    const ray = new T.Ray(impact.point.clone().addScaledVector(direction, 0.01), direction);
    const exit = this.intersections(ray, 2.3).find((hit) => hit.face!.normal.dot(direction) > 0.05);
    return exit ? exit.distance + 0.01 : 3;
  }
}
