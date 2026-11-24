// Development-only map visibility baker. scripts/bake-visibility.mjs imports
// this module from the Vite dev server; production code never references it.
import * as T from "three";
import type { Game } from "./game";
import type { NavArea, Navigation } from "./navigation";
import {
  encodeVisibilityBits,
  mapDynamicObjects,
  MapVisibility,
  VISIBILITY_HEIGHTS,
  visibilityUnits,
  type MapVisibilityData,
  type VisibilityUnit,
} from "./map-visibility";

const FACES = [
  [1, 0, 0, 0, 1, 0],
  [-1, 0, 0, 0, 1, 0],
  [0, 1, 0, 0, 0, -1],
  [0, -1, 0, 0, 0, 1],
  [0, 0, 1, 0, 1, 0],
  [0, 0, -1, 0, 1, 0],
] as const;

/** Renders unit IDs into an RGB8 target with every other drawable hidden. */
class IdPass {
  readonly units: VisibilityUnit[];
  private readonly materials = new Map<T.Mesh, T.Material | T.Material[]>();
  private readonly ids: T.MeshBasicMaterial[] = [];
  private readonly skip = new T.MeshBasicMaterial({ visible: false });
  private restore?: () => void;
  private readonly game: Game;
  constructor(game: Game) {
    this.game = game;
    this.units = visibilityUnits(game.world.scenery, mapDynamicObjects(game.world));
    const slots = new Map<T.Mesh, Map<number, T.Material>>();
    this.units.forEach((unit, index) => {
      const id = index + 1;
      const original = Array.isArray(unit.mesh.material)
        ? unit.mesh.material[unit.slot]
        : unit.mesh.material;
      // Match the runtime face culling: a one-sided wall must not occlude from behind.
      const material = new T.MeshBasicMaterial({ side: original.side, toneMapped: false });
      material.color.setRGB(
        (id & 255) / 255,
        ((id >> 8) & 255) / 255,
        ((id >> 16) & 255) / 255,
        T.LinearSRGBColorSpace,
      );
      this.ids.push(material);
      const mesh = slots.get(unit.mesh) ?? new Map();
      // Exempt draws neither occlude nor need proof of visibility.
      mesh.set(unit.slot, unit.exempt ? this.skip : material);
      slots.set(unit.mesh, mesh);
    });
    for (const [mesh, byslot] of slots)
      this.materials.set(
        mesh,
        Array.isArray(mesh.material)
          ? mesh.material.map((_, slot) => byslot.get(slot) ?? this.skip)
          : byslot.get(0)!,
      );
  }
  begin() {
    const { scene, renderer } = this.game;
    const saved: [T.Object3D, boolean, T.Material | T.Material[] | undefined][] = [];
    scene.traverse((object) => {
      const material = this.materials.get(object as T.Mesh);
      if (material) {
        saved.push([object, object.visible, (object as T.Mesh).material]);
        (object as T.Mesh).material = material;
      } else if (
        object instanceof T.Mesh ||
        object instanceof T.Line ||
        object instanceof T.Points ||
        object instanceof T.Sprite
      ) {
        saved.push([object, object.visible, undefined]);
        object.visible = false;
      }
    });
    // The map root is hidden outside a match; ancestors of units must render.
    const ancestors: T.Object3D[] = [];
    for (let parent = this.game.world.scenery as T.Object3D | null; parent; parent = parent.parent)
      if (!parent.visible) {
        ancestors.push(parent);
        parent.visible = true;
      }
    const state = {
      background: scene.background,
      fog: scene.fog,
      toneMapping: renderer.toneMapping,
      autoClear: renderer.autoClear,
      shadows: renderer.shadowMap.autoUpdate,
      target: renderer.getRenderTarget(),
    };
    scene.background = null;
    scene.fog = null;
    renderer.toneMapping = T.NoToneMapping;
    renderer.autoClear = false;
    renderer.shadowMap.autoUpdate = false;
    this.restore = () => {
      for (const [object, visible, material] of saved) {
        object.visible = visible;
        if (material) (object as T.Mesh).material = material;
      }
      for (const parent of ancestors) parent.visible = false;
      scene.background = state.background;
      scene.fog = state.fog;
      renderer.toneMapping = state.toneMapping;
      renderer.autoClear = state.autoClear;
      renderer.shadowMap.autoUpdate = state.shadows;
      renderer.setRenderTarget(state.target);
    };
  }
  end() {
    this.restore?.();
    this.restore = undefined;
  }
  dispose() {
    this.end();
    for (const material of this.ids) material.dispose();
    this.skip.dispose();
  }
}

/** Scatters every ID pixel of the cube target into a small per-unit texture
 * on the GPU, so each sample reads back kilobytes instead of the full cube. */
class SeenReducer {
  private readonly seen: T.WebGLRenderTarget;
  private readonly scene = new T.Scene();
  private readonly camera = new T.OrthographicCamera();
  private readonly material: T.RawShaderMaterial;
  private readonly pixels: Uint8Array;
  private readonly flags: Uint8Array;
  constructor(source: T.WebGLRenderTarget, count: number) {
    const width = 256,
      height = Math.ceil((count + 1) / width);
    this.seen = new T.WebGLRenderTarget(width, height, { depthBuffer: false });
    this.pixels = new Uint8Array(width * height * 4);
    this.flags = new Uint8Array(width * height);
    const points = source.width * source.height;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.BufferAttribute(new Uint8Array(points), 1));
    // The attribute only sets the draw count; skip Three's NaN sphere fit.
    geometry.boundingSphere = new T.Sphere(new T.Vector3(), 1);
    this.material = new T.RawShaderMaterial({
      glslVersion: T.GLSL3,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        ids: { value: source.texture },
        sourceWidth: { value: source.width },
        seenSize: { value: new T.Vector2(width, height) },
      },
      vertexShader: `precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D ids;
uniform int sourceWidth;
uniform vec2 seenSize;
in float position;
void main() {
  vec4 c = texelFetch(ids, ivec2(gl_VertexID % sourceWidth, gl_VertexID / sourceWidth), 0);
  int id = int(c.r * 255.0 + 0.5) | (int(c.g * 255.0 + 0.5) << 8) | (int(c.b * 255.0 + 0.5) << 16);
  int columns = int(seenSize.x);
  vec2 cell = vec2(float(id % columns), float(id / columns)) + 0.5;
  gl_Position = id == 0 ? vec4(2.0, 2.0, 2.0, 1.0) : vec4(cell / seenSize * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0 + position * 0.0;
}`,
      fragmentShader: `precision highp float;
out highp vec4 color;
void main() { color = vec4(1.0); }`,
    });
    const cloud = new T.Points(geometry, this.material);
    cloud.frustumCulled = false;
    this.scene.add(cloud);
  }
  clear(renderer: T.WebGLRenderer) {
    renderer.setRenderTarget(this.seen);
    renderer.setClearColor(0, 0);
    renderer.clear();
  }
  accumulate(renderer: T.WebGLRenderer) {
    renderer.setRenderTarget(this.seen);
    renderer.render(this.scene, this.camera);
  }
  read(renderer: T.WebGLRenderer) {
    renderer.readRenderTargetPixels(
      this.seen,
      0,
      0,
      this.seen.width,
      this.seen.height,
      this.pixels,
    );
    for (let i = 0; i < this.flags.length; i++) this.flags[i] = this.pixels[i * 4] ? 1 : 0;
    return this.flags;
  }
  dispose() {
    this.seen.dispose();
    this.material.dispose();
    for (const child of this.scene.children) (child as T.Points).geometry.dispose();
  }
}

function insideArea(area: NavArea, x: number, z: number) {
  const corners = area.corners;
  let odd = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, , zi] = corners[i],
      [xj, , zj] = corners[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) odd = !odd;
  }
  return odd;
}

/** Corners and edge points, an interior grid and the centre, each with its
 * floor height. NAV corners are hull-centre positions, clear of walls, and
 * shared with neighbouring areas, so their samples are reused. */
export function areaSamples(navigation: Navigation, area: NavArea, spacing: number) {
  const points: [number, number, number][] = [];
  const [cx, , cz] = area.center;
  const corners = area.corners;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i],
      b = corners[(i + 1) % corners.length];
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / spacing));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
    }
  }
  const [x0, z0, x1, z1] = area.rect;
  for (let x = x0 + spacing / 2; x < x1; x += spacing)
    for (let z = z0 + spacing / 2; z < z1; z += spacing)
      if (insideArea(area, x, z)) points.push([x, navigation.height(area, x, z), z]);
  points.push([cx, navigation.height(area, cx, cz), cz]);
  return points;
}

/** Adds each linked area's set (in either link direction). A player near an
 * edge sees almost what the neighbour's samples see; this closes most gaps
 * between sample points for about ten percent more draws. */
function dilate(areas: NavArea[], sets: Uint8Array, stride: number) {
  const rows = new Map(areas.map((area, row) => [area.id, row]));
  const neighbours = areas.map(() => new Set<number>());
  areas.forEach((area, row) => {
    for (const id of area.links) {
      const other = rows.get(id);
      if (other === undefined || other === row) continue;
      neighbours[row].add(other);
      neighbours[other].add(row);
    }
  });
  const out = new Uint8Array(sets);
  neighbours.forEach((linked, row) => {
    for (const other of linked)
      for (let i = 0; i < stride; i++) out[row * stride + i] |= sets[other * stride + i];
  });
  return out;
}

type BakeOptions = {
  size?: number;
  spacing?: number;
  heights?: number[];
  /** Limit the bake to these NAV area ids (validation experiments). */
  areas?: number[];
  progress?: (done: number, total: number) => void;
};

/** Cube-renders unit IDs from sample points across every NAV area and keeps,
 * per area, each unit that covered at least one pixel from any sample. */
export async function bakeMapVisibility(
  game: Game,
  options: BakeOptions = {},
): Promise<Omit<MapVisibilityData, "sources">> {
  const { size = 1024, spacing = 2.5, heights = VISIBILITY_HEIGHTS } = options;
  const { renderer, world } = game;
  const navigation = world.navigation;
  const pass = new IdPass(game);
  const count = pass.units.length,
    stride = Math.ceil(count / 8);
  const target = new T.WebGLRenderTarget(size * 6, size, { depthBuffer: true });
  const camera = new T.PerspectiveCamera(90, 1, 0.02, 2000);
  const reducer = new SeenReducer(target, count);
  const cache = new Map<string, Uint8Array>();
  const sample = (x: number, floor: number, z: number) => {
    const key = `${Math.round(x * 20)},${Math.round(floor * 20)},${Math.round(z * 20)}`;
    let bits = cache.get(key);
    if (bits) return bits;
    reducer.clear(renderer);
    for (const height of heights) {
      renderer.setClearColor(0, 0);
      for (let f = 0; f < 6; f++) {
        const [dx, dy, dz, ux, uy, uz] = FACES[f];
        camera.position.set(x, floor + height, z);
        camera.up.set(ux, uy, uz);
        camera.lookAt(x + dx, floor + height + dy, z + dz);
        camera.updateMatrixWorld();
        target.viewport.set(f * size, 0, size, size);
        target.scissor.set(f * size, 0, size, size);
        target.scissorTest = true;
        renderer.setRenderTarget(target);
        // The scissor confines the clear, so clear each face's colour and depth.
        renderer.clear();
        renderer.render(game.scene, camera);
      }
      reducer.accumulate(renderer);
    }
    const seen = reducer.read(renderer);
    bits = new Uint8Array(stride);
    for (let i = 0; i < count; i++) if (seen[i + 1]) bits[i >> 3] |= 1 << (i & 7);
    cache.set(key, bits);
    return bits;
  };
  const areas = options.areas
    ? navigation.areas.filter((area) => options.areas!.includes(area.id))
    : navigation.areas;
  const sets = new Uint8Array(stride * areas.length);
  let last = performance.now();
  pass.begin();
  try {
    for (let row = 0; row < areas.length; row++) {
      const out = sets.subarray(row * stride, (row + 1) * stride);
      for (const [x, floor, z] of areaSamples(navigation, areas[row], spacing)) {
        const bits = sample(x, floor, z);
        for (let i = 0; i < stride; i++) out[i] |= bits[i];
      }
      if (performance.now() - last > 250) {
        options.progress?.(row + 1, areas.length);
        // Yield so the page stays responsive to the driver between areas.
        pass.end();
        await new Promise((resolve) => setTimeout(resolve));
        pass.begin();
        last = performance.now();
      }
    }
  } finally {
    pass.dispose();
    target.dispose();
    reducer.dispose();
  }
  return {
    version: 1,
    map: world.id,
    heights,
    units: pass.units.map((unit) => unit.key),
    areas: areas.map((area) => area.id),
    sets: encodeVisibilityBits(dilate(areas, sets, stride)),
  };
}

/** Renders random in-area player views at game resolution and counts pixels
 * whose draw the runtime would have culled. Zero means no visible holes. */
export async function validateMapVisibility(
  game: Game,
  visibility: MapVisibility,
  {
    views = 300,
    width = 1280,
    height = 720,
    seed = 1,
    areas: only,
  }: { views?: number; width?: number; height?: number; seed?: number; areas?: number[] } = {},
) {
  const { renderer, world } = game;
  const navigation = world.navigation;
  const pass = new IdPass(game);
  let state = seed >>> 0 || 1;
  const random = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
  const target = new T.WebGLRenderTarget(width, height, { depthBuffer: true });
  const pixels = new Uint8Array(width * height * 4);
  const camera = new T.PerspectiveCamera(game.camera.fov, width / height, 0.05, game.camera.far);
  camera.rotation.order = "YXZ";
  const results: {
    position: number[];
    area: number;
    found: number;
    yaw: number;
    pitch: number;
    missing: number;
    units: string[];
  }[] = [];
  let unculled = 0,
    culled = 0,
    offNav = 0;
  const areas = navigation.areas.filter(
    (area) => area.rect[2] > area.rect[0] && (!only || only.includes(area.id)),
  );
  pass.begin();
  try {
    for (let v = 0; v < views; v++) {
      const area = areas[Math.floor(random() * areas.length)];
      const [x0, z0, x1, z1] = area.rect;
      // Players stand inside the area polygon, not anywhere in its bounding rect.
      let x = area.center[0],
        z = area.center[2];
      for (let attempt = 0; attempt < 32; attempt++) {
        const px = x0 + random() * (x1 - x0),
          pz = z0 + random() * (z1 - z0);
        if (!insideArea(area, px, pz)) continue;
        x = px;
        z = pz;
        break;
      }
      const eye = VISIBILITY_HEIGHTS[0] + random() * (VISIBILITY_HEIGHTS.at(-1)! - 1.17);
      camera.position.set(x, navigation.height(area, x, z) + eye, z);
      const yaw = random() * Math.PI * 2,
        pitch = (random() - 0.5) * 1.2;
      camera.rotation.set(pitch, yaw, 0);
      camera.updateMatrixWorld();
      const current = visibility.area(camera.position);
      if (!current) {
        offNav++;
        continue;
      }
      renderer.setRenderTarget(target);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(game.scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, pixels);
      const counts = new Map<number, number>();
      for (let p = 0; p < pixels.length; p += 4) {
        const id = pixels[p] | (pixels[p + 1] << 8) | (pixels[p + 2] << 16);
        if (id) counts.set(id - 1, (counts.get(id - 1) ?? 0) + 1);
      }
      let missing = 0;
      const lost: string[] = [];
      for (const [index, pixelsSeen] of counts) {
        const key = pass.units[index]?.key;
        if (!key) continue;
        const visible = visibility.visible(current, key);
        if (visible === false) {
          missing += pixelsSeen;
          lost.push(`${key}:${pixelsSeen}`);
        }
      }
      unculled += pass.units.length;
      culled += pass.units.filter((unit) => visibility.visible(current, unit.key) === false).length;
      if (missing)
        results.push({
          position: camera.position.toArray(),
          area: area.id,
          found: current.id,
          yaw,
          pitch,
          missing,
          units: lost.slice(0, 6),
        });
      if (v % 20 === 19) {
        pass.end();
        await new Promise((resolve) => setTimeout(resolve));
        pass.begin();
      }
    }
  } finally {
    pass.dispose();
    target.dispose();
  }
  return {
    views,
    offNav,
    failing: results.length,
    culledShare: culled / Math.max(1, unculled),
    worst: results.sort((a, b) => b.missing - a.missing).slice(0, 12),
  };
}

export { MapVisibility };
