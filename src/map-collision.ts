import * as T from "three";

const baseCellSize = 1.5,
  // A dense grid is only practical for map-scale bounds; very distant stray
  // geometry coarsens the grid instead of allocating millions of cells.
  maxCells = 1 << 22,
  stampLimit = 0x7fffffff,
  // Ray Y-range culling tolerance. Hits must lie within both the triangle's
  // vertical extent and the segment of the ray crossing the current cell.
  yMargin = 1e-3;
const triangle = new T.Triangle(),
  sample = new T.Vector3(),
  closest = new T.Vector3(),
  correction = new T.Vector3();

// Woop/Benthin/Wald watertight ray-triangle test, mirroring three's
// Ray.intersectTriangle without backface culling. Returns the ray parameter,
// or -1 for a miss, without allocating vectors.
function intersect(
  v: Float32Array,
  o: number,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
) {
  const aox = v[o] - ox,
    aoy = v[o + 1] - oy,
    aoz = v[o + 2] - oz;
  const box = v[o + 3] - ox,
    boy = v[o + 4] - oy,
    boz = v[o + 5] - oz;
  const cox = v[o + 6] - ox,
    coy = v[o + 7] - oy,
    coz = v[o + 8] - oz;
  const adx = Math.abs(dx),
    ady = Math.abs(dy),
    adz = Math.abs(dz);
  let dkx, dky, dkz, akx, aky, akz, bkx, bky, bkz, ckx, cky, ckz;
  if (adx >= ady && adx >= adz) {
    dkz = dx;
    akz = aox;
    bkz = box;
    ckz = cox;
    if (dx >= 0) {
      dkx = dy;
      dky = dz;
      akx = aoy;
      aky = aoz;
      bkx = boy;
      bky = boz;
      ckx = coy;
      cky = coz;
    } else {
      dkx = dz;
      dky = dy;
      akx = aoz;
      aky = aoy;
      bkx = boz;
      bky = boy;
      ckx = coz;
      cky = coy;
    }
  } else if (ady >= adz) {
    dkz = dy;
    akz = aoy;
    bkz = boy;
    ckz = coy;
    if (dy >= 0) {
      dkx = dz;
      dky = dx;
      akx = aoz;
      aky = aox;
      bkx = boz;
      bky = box;
      ckx = coz;
      cky = cox;
    } else {
      dkx = dx;
      dky = dz;
      akx = aox;
      aky = aoz;
      bkx = box;
      bky = boz;
      ckx = cox;
      cky = coz;
    }
  } else {
    dkz = dz;
    akz = aoz;
    bkz = boz;
    ckz = coz;
    if (dz >= 0) {
      dkx = dx;
      dky = dy;
      akx = aox;
      aky = aoy;
      bkx = box;
      bky = boy;
      ckx = cox;
      cky = coy;
    } else {
      dkx = dy;
      dky = dx;
      akx = aoy;
      aky = aox;
      bkx = boy;
      bky = box;
      ckx = coy;
      cky = cox;
    }
  }
  if (dkz === 0) return -1;
  const sx = dkx / dkz,
    sy = dky / dkz,
    sz = 1 / dkz;
  const ax = akx - sx * akz,
    ay = aky - sy * akz;
  const bx = bkx - sx * bkz,
    by = bky - sy * bkz;
  const cx = ckx - sx * ckz,
    cy = cky - sy * ckz;
  const u = cx * by - cy * bx,
    w0 = ax * cy - ay * cx,
    w1 = bx * ay - by * ax;
  if ((u < 0 || w0 < 0 || w1 < 0) && (u > 0 || w0 > 0 || w1 > 0)) return -1;
  const det = u + w0 + w1;
  if (det === 0) return -1;
  const scaled = sz * (u * akz + w0 * bkz + w1 * ckz);
  if (det > 0 ? scaled < 0 : scaled > 0) return -1;
  return scaled / det;
}

// Whether (x, z) lies farther than margin outside the triangle's XZ bounds.
function outside(v: Float32Array, o: number, x: number, z: number, margin: number) {
  return (
    x < Math.min(v[o], v[o + 3], v[o + 6]) - margin ||
    x > Math.max(v[o], v[o + 3], v[o + 6]) + margin ||
    z < Math.min(v[o + 2], v[o + 5], v[o + 8]) - margin ||
    z > Math.max(v[o + 2], v[o + 5], v[o + 8]) + margin
  );
}

const Collect = 0,
  Blocked = 1,
  Exit = 2;
type Cast = typeof Collect | typeof Blocked | typeof Exit;

// Static map triangles are stored in flat typed arrays and indexed by a dense
// XZ grid in CSR form. A triangle is listed in every cell its bounding box
// touches, so point queries read one cell and rays walk cells exactly.
export class MapCollision {
  private readonly meshes: T.Mesh[];
  private readonly raycastMeshCount: number;
  private readonly vertices: Float32Array;
  private readonly normals: Float32Array;
  private readonly minY: Float32Array;
  private readonly maxY: Float32Array;
  private readonly owner: Uint16Array | Uint32Array;
  private readonly visit: Int32Array;
  private readonly offsets: Int32Array;
  private readonly entries: Int32Array;
  private readonly groundOffsets: Int32Array;
  private readonly ground: Int32Array;
  private readonly cellSize: number;
  private readonly x0: number;
  private readonly z0: number;
  private readonly width: number;
  private readonly depth: number;
  private query = 0;
  constructor(meshes: T.Mesh[], movementMeshes: T.Mesh[] = []) {
    this.raycastMeshCount = meshes.length;
    meshes = meshes.concat(movementMeshes);
    this.meshes = meshes.slice();
    let total = 0;
    for (const mesh of meshes) {
      const geometry = mesh.geometry;
      total += Math.floor(
        (geometry.index ? geometry.index.count : geometry.getAttribute("position").count) / 3,
      );
    }
    const v = (this.vertices = new Float32Array(total * 9));
    const normals = (this.normals = new Float32Array(total * 3));
    const minY = (this.minY = new Float32Array(total)),
      maxY = (this.maxY = new Float32Array(total));
    const owner = (this.owner =
      meshes.length < 0xffff ? new Uint16Array(total) : new Uint32Array(total));
    this.visit = new Int32Array(total);
    let minX = Infinity,
      maxX = -Infinity,
      minZ = Infinity,
      maxZ = -Infinity,
      n = 0;
    for (let m = 0; m < meshes.length; m++) {
      const mesh = meshes[m];
      mesh.updateWorldMatrix(true, false);
      const geometry = mesh.geometry,
        positions = geometry.getAttribute("position"),
        indices = geometry.index,
        e = mesh.matrixWorld.elements;
      // getX/Y/Z denormalize quantized attributes; transform each vertex once.
      const world = new Float32Array(positions.count * 3);
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          y = positions.getY(i),
          z = positions.getZ(i);
        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
        world[i * 3] = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
        world[i * 3 + 1] = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
        world[i * 3 + 2] = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
      }
      const count = Math.floor((indices ? indices.count : positions.count) / 3) * 3;
      for (let i = 0; i < count; i += 3, n++) {
        const o = n * 9;
        for (let j = 0; j < 3; j++) {
          const s = (indices ? indices.getX(i + j) : i + j) * 3;
          v[o + j * 3] = world[s];
          v[o + j * 3 + 1] = world[s + 1];
          v[o + j * 3 + 2] = world[s + 2];
        }
        // Normal of (c - b) x (a - b), as T.Triangle.getNormal.
        const ex = v[o + 6] - v[o + 3],
          ey = v[o + 7] - v[o + 4],
          ez = v[o + 8] - v[o + 5];
        const fx = v[o] - v[o + 3],
          fy = v[o + 1] - v[o + 4],
          fz = v[o + 2] - v[o + 5];
        const nx = ey * fz - ez * fy,
          ny = ez * fx - ex * fz,
          nz = ex * fy - ey * fx;
        const length = nx * nx + ny * ny + nz * nz,
          scale = length > 0 ? 1 / Math.sqrt(length) : 0;
        normals[n * 3] = nx * scale;
        normals[n * 3 + 1] = ny * scale;
        normals[n * 3 + 2] = nz * scale;
        minY[n] = Math.min(v[o + 1], v[o + 4], v[o + 7]);
        maxY[n] = Math.max(v[o + 1], v[o + 4], v[o + 7]);
        owner[n] = m;
        minX = Math.min(minX, v[o], v[o + 3], v[o + 6]);
        maxX = Math.max(maxX, v[o], v[o + 3], v[o + 6]);
        minZ = Math.min(minZ, v[o + 2], v[o + 5], v[o + 8]);
        maxZ = Math.max(maxZ, v[o + 2], v[o + 5], v[o + 8]);
      }
    }
    let cellSize = baseCellSize,
      x0 = 0,
      z0 = 0,
      width = 0,
      depth = 0;
    if (n > 0 && Number.isFinite(minX + maxX + minZ + maxZ)) {
      for (;;) {
        x0 = Math.floor(minX / cellSize);
        z0 = Math.floor(minZ / cellSize);
        width = Math.floor(maxX / cellSize) - x0 + 1;
        depth = Math.floor(maxZ / cellSize) - z0 + 1;
        if (width * depth <= maxCells) break;
        cellSize *= 2;
      }
    }
    this.cellSize = cellSize;
    this.x0 = x0;
    this.z0 = z0;
    this.width = width;
    this.depth = depth;
    [this.offsets, this.entries] = this.index(n, () => true);
    // Floor and ceiling probes only consider walkable surfaces.
    [this.groundOffsets, this.ground] = this.index(n, (k) => Math.abs(normals[k * 3 + 1]) >= 0.6);
  }
  // CSR cell lists, built in two passes: count entries per cell, then fill.
  private index(count: number, include: (k: number) => boolean): [Int32Array, Int32Array] {
    const { vertices: v, cellSize, x0, z0, width } = this,
      cells = width * this.depth,
      offsets = new Int32Array(cells + 1);
    let entries: Int32Array | undefined,
      cursor = offsets;
    for (;;) {
      for (let k = 0; k < count; k++) {
        if (!include(k)) continue;
        const o = k * 9;
        const cx0 = Math.floor(Math.min(v[o], v[o + 3], v[o + 6]) / cellSize) - x0,
          cx1 = Math.floor(Math.max(v[o], v[o + 3], v[o + 6]) / cellSize) - x0;
        const cz0 = Math.floor(Math.min(v[o + 2], v[o + 5], v[o + 8]) / cellSize) - z0,
          cz1 = Math.floor(Math.max(v[o + 2], v[o + 5], v[o + 8]) / cellSize) - z0;
        for (let z = cz0; z <= cz1; z++)
          for (let x = cx0; x <= cx1; x++) {
            const cell = z * width + x;
            if (entries) entries[cursor[cell]++] = k;
            else offsets[cell + 1]++;
          }
      }
      if (entries) return [offsets, entries];
      for (let c = 0; c < cells; c++) offsets[c + 1] += offsets[c];
      entries = new Int32Array(offsets[cells]);
      cursor = offsets.slice(0, cells);
    }
  }
  private cell(cx: number, cz: number) {
    const x = cx - this.x0,
      z = cz - this.z0;
    return x >= 0 && z >= 0 && x < this.width && z < this.depth ? z * this.width + x : -1;
  }
  private stamp() {
    if (++this.query >= stampLimit) {
      this.visit.fill(0);
      this.query = 1;
    }
    return this.query;
  }
  floor(x: number, z: number, ceiling: number, bottom = ceiling - 5) {
    const cell = this.cell(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize));
    let height = -Infinity;
    if (cell < 0) return height;
    const { ground, groundOffsets, minY, maxY, vertices } = this,
      origin = ceiling + 0.01;
    for (let e = groundOffsets[cell], end = groundOffsets[cell + 1]; e < end; e++) {
      const k = ground[e];
      if (this.owner[k] >= this.raycastMeshCount && this.normals[k * 3 + 1] < 0.6) continue;
      if (minY[k] > ceiling || maxY[k] < bottom) continue;
      if (outside(vertices, k * 9, x, z, 0)) continue;
      const t = intersect(vertices, k * 9, x, origin, z, 0, -1, 0);
      if (t < 0) continue;
      const y = origin - t;
      if (y >= bottom && y > height) height = y;
    }
    return height;
  }
  blocked(x: number, z: number, feet: number, radius = 0.3, height = 1.65) {
    return this.overlap(x, z, feet, radius, height);
  }
  // Falling beside a ledge (or rising beside a sloped wall) can intersect its
  // side even when the preceding horizontal move was clear. Slide out of that
  // contact before testing horizontal input, otherwise every direction fails.
  resolveHorizontal(position: T.Vector3, radius = 0.3, height = 1.65) {
    const { x, z } = position;
    for (let i = 0; i < 8; i++) {
      correction.set(0, 0, 0);
      if (!this.overlap(position.x, position.z, position.y, radius, height, correction))
        return true;
      if (correction.lengthSq() === 0) break;
      position.x += correction.x;
      position.z += correction.z;
      // Bound correction to a local contact instead of searching for a
      // distant escape from conflicting surfaces.
      if (Math.hypot(position.x - x, position.z - z) > radius) break;
    }
    position.x = x;
    position.z = z;
    return false;
  }
  private overlap(
    x: number,
    z: number,
    feet: number,
    radius: number,
    height: number,
    offset?: T.Vector3,
  ) {
    const { entries, normals, minY, maxY, vertices, visit, offsets, cellSize } = this,
      query = this.stamp(),
      step = feet + 0.46,
      top = feet + height,
      limit = radius * radius;
    const low = feet + radius + 0.12,
      middle = feet + height / 2,
      high = feet + height - radius;
    let hit = false;
    for (
      let cz = Math.floor((z - radius) / cellSize);
      cz <= Math.floor((z + radius) / cellSize);
      cz++
    )
      for (
        let cx = Math.floor((x - radius) / cellSize);
        cx <= Math.floor((x + radius) / cellSize);
        cx++
      ) {
        const cell = this.cell(cx, cz);
        if (cell < 0) continue;
        for (let e = offsets[cell], end = offsets[cell + 1]; e < end; e++) {
          const k = entries[e];
          if (visit[k] === query) continue;
          visit[k] = query;
          if (maxY[k] <= step || minY[k] >= top) continue;
          const o = k * 9;
          // Horizontal distance to the bounds already exceeds the capsule radius.
          if (outside(vertices, o, x, z, radius)) continue;
          // A ramp's far vertices can be above the capsule even though its
          // surface under the feet is walkable. Ground projection handles it.
          if (
            Math.abs(normals[k * 3 + 1]) > 0.6 &&
            intersect(vertices, o, x, step, z, 0, -1, 0) >= 0
          )
            continue;
          triangle.a.fromArray(vertices, o);
          triangle.b.fromArray(vertices, o + 3);
          triangle.c.fromArray(vertices, o + 6);
          // When resolving, visit every sample and retain the deepest contact.
          for (let s = 0; s < 3; s++) {
            if (!this.touches(x, s === 0 ? low : s === 1 ? middle : high, z, radius, limit, k))
              continue;
            if (!offset) return true;
            hit = true;
            const dx = x - closest.x,
              dz = z - closest.z,
              dy = sample.y - closest.y,
              horizontal = Math.hypot(dx, dz);
            if (horizontal < 1e-6) continue;
            const depth = Math.sqrt(Math.max(0, limit - dy * dy)) - horizontal + 1e-4;
            if (depth * depth > offset.lengthSq())
              offset.set((dx / horizontal) * depth, 0, (dz / horizontal) * depth);
          }
        }
      }
    return hit;
  }
  // Sphere test against the triangle loaded into the scratch triangle.
  private touches(x: number, y: number, z: number, radius: number, limit: number, k: number) {
    if (y - radius >= this.maxY[k] || y + radius <= this.minY[k]) return false;
    triangle.closestPointToPoint(sample.set(x, y, z), closest);
    return closest.distanceToSquared(sample) < limit;
  }
  ceiling(x: number, z: number, bottom: number, top: number) {
    const cell = this.cell(Math.floor(x / this.cellSize), Math.floor(z / this.cellSize));
    let height = Infinity;
    if (cell < 0) return height;
    const { ground, groundOffsets, minY, maxY, vertices } = this;
    for (let e = groundOffsets[cell], end = groundOffsets[cell + 1]; e < end; e++) {
      const k = ground[e];
      if (this.owner[k] >= this.raycastMeshCount && this.normals[k * 3 + 1] > -0.6) continue;
      if (maxY[k] < bottom || minY[k] > top) continue;
      if (outside(vertices, k * 9, x, z, 0)) continue;
      const t = intersect(vertices, k * 9, x, bottom, z, 0, 1, 0);
      if (t < 0) continue;
      const y = bottom + t;
      if (y <= top && y < height) height = y;
    }
    return height;
  }
  // Exact XZ grid traversal shared by every ray query. Collect appends hits,
  // Blocked returns 0 at the first obstruction, and Exit returns the nearest
  // back-facing surface. Other results are Infinity.
  private cast(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    far: number,
    mode: Cast,
    hits?: T.Intersection[],
  ) {
    const { entries, normals, minY, maxY, vertices, visit, offsets, cellSize, meshes, owner } =
        this,
      query = this.stamp(),
      length = Math.sqrt(dx * dx + dy * dy + dz * dz),
      limit = length > 0 ? far / length : far;
    let x = Math.floor(ox / cellSize),
      z = Math.floor(oz / cellSize),
      travelled = 0,
      best = Infinity;
    const sx = Math.sign(dx),
      sz = Math.sign(dz);
    const stepX = sx ? cellSize / Math.abs(dx) : Infinity,
      stepZ = sz ? cellSize / Math.abs(dz) : Infinity;
    let tx = sx ? ((x + (sx > 0 ? 1 : 0)) * cellSize - ox) / dx : Infinity;
    let tz = sz ? ((z + (sz > 0 ? 1 : 0)) * cellSize - oz) / dz : Infinity;
    while (travelled <= far) {
      const cell = this.cell(x, z),
        exit = Math.min(tx, tz);
      if (cell >= 0) {
        const a = oy + dy * travelled,
          b = oy + dy * Math.min(exit, limit);
        const low = Math.min(a, b) - yMargin,
          high = Math.max(a, b) + yMargin;
        for (let e = offsets[cell], end = offsets[cell + 1]; e < end; e++) {
          const k = entries[e];
          // Source player clips affect movement, not bullets or visibility.
          if (owner[k] >= this.raycastMeshCount) continue;
          // A hit lies in the cell crossed at that distance, so a triangle
          // outside this segment's height range is retested in later cells.
          if (visit[k] === query || maxY[k] < low || minY[k] > high) continue;
          visit[k] = query;
          const t = intersect(vertices, k * 9, ox, oy, oz, dx, dy, dz);
          if (t < 0) continue;
          const px = ox + dx * t,
            py = oy + dy * t,
            pz = oz + dz * t;
          const distance = Math.sqrt(
            (px - ox) * (px - ox) + (py - oy) * (py - oy) + (pz - oz) * (pz - oz),
          );
          if (mode === Blocked) {
            if (distance > 0.002 && distance < far) return 0;
            continue;
          }
          if (distance > far || distance < 0.002) continue;
          const n = k * 3;
          if (mode === Collect)
            hits!.push({
              distance,
              point: new T.Vector3(px, py, pz),
              object: meshes[owner[k]],
              face: {
                a: 0,
                b: 1,
                c: 2,
                normal: new T.Vector3(normals[n], normals[n + 1], normals[n + 2]),
                materialIndex: 0,
              },
            });
          else if (
            distance < best &&
            normals[n] * dx + normals[n + 1] * dy + normals[n + 2] * dz > 0.05
          )
            best = distance;
        }
        // Unvisited triangles can only be hit beyond this cell.
        if (mode === Exit && best <= exit * length) return best;
      }
      if (tx < tz) {
        x += sx;
        travelled = tx;
        tx += stepX;
      } else if (tz < tx) {
        z += sz;
        travelled = tz;
        tz += stepZ;
      } else {
        x += sx;
        z += sz;
        travelled = tx;
        tx += stepX;
        tz += stepZ;
      }
    }
    return best;
  }
  intersections(ray: T.Ray, far: number) {
    const hits: T.Intersection[] = [],
      { origin, direction } = ray;
    this.cast(
      origin.x,
      origin.y,
      origin.z,
      direction.x,
      direction.y,
      direction.z,
      far,
      Collect,
      hits,
    );
    return hits.sort((a, b) => a.distance - b.distance);
  }
  visible(from: T.Vector3, to: T.Vector3) {
    const dx = to.x - from.x,
      dy = to.y - from.y,
      dz = to.z - from.z;
    const far = Math.sqrt(dx * dx + dy * dy + dz * dz),
      scale = 1 / (far || 1);
    return this.cast(from.x, from.y, from.z, dx * scale, dy * scale, dz * scale, far, Blocked) > 0;
  }
  thickness(impact: T.Intersection, direction: T.Vector3) {
    const { point } = impact;
    const exit = this.cast(
      point.x + direction.x * 0.01,
      point.y + direction.y * 0.01,
      point.z + direction.z * 0.01,
      direction.x,
      direction.y,
      direction.z,
      2.3,
      Exit,
    );
    return exit < Infinity ? exit + 0.01 : 3;
  }
}
