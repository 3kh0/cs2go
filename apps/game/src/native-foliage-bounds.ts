import * as T from "three";
import { selectNativeComplexMaterial } from "./native-map-complex";
import type { NativeFoliageMaterial } from "./native-map-foliage";
import { nativeClutterSwayPadding } from "./native-clutter-wind";
import { createEnvironmentWorldFrame } from "./native-environment-frame";

function maximumStrength(controllers: readonly unknown[]) {
  let strength = 0;
  for (const record of controllers) {
    const values = (record as { values?: Record<string, number> })?.values;
    if (!values) return undefined;
    for (const [low, high] of [
      ["minwind", "maxwind"],
      ["mingust", "maxgust"],
    ]) {
      const a = values[low],
        b = values[high];
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < a) return undefined;
      strength = Math.max(strength, (a + b) / 2);
    }
  }
  // Matches createAuthoredWind's midpoint controller reconstruction. Bound all
  // controllers so selection, yaw changes and pulse timing cannot enlarge it.
  return strength * 0.01;
}

/** Ordinary sidecars have baked positions, but shader wind moves those positions
 * outside their exported geometry bounds. Admit only bounded modes0/1; mode2,
 * skins, morphs, instances and sheared placements retain the uncullable path. */
export function createNativeFoliageBounds(
  root: T.Object3D,
  materials: Record<string, NativeFoliageMaterial>,
  controllers: readonly unknown[],
  worldToOwn = new T.Matrix4(),
) {
  const ownToWorld = createEnvironmentWorldFrame(worldToOwn).worldToNative.clone().invert(),
    maximum = maximumStrength(controllers),
    bounds = new Map<T.Mesh, T.Sphere>(),
    retained: {
      mesh: T.Mesh;
      geometry: T.BufferGeometry;
      position: T.BufferAttribute | T.InterleavedBufferAttribute;
      version: number;
      world: T.Matrix4;
    }[] = [];
  root.updateWorldMatrix(true, true);
  root.traverse((object) => {
    if (
      !(object instanceof T.Mesh) ||
      object instanceof T.InstancedMesh ||
      object instanceof T.SkinnedMesh ||
      object.morphTargetInfluences
    )
      return;
    const entries = Array.isArray(object.material) ? object.material : [object.material];
    let padding = 0,
      animated = false;
    for (const material of entries) {
      if (!(material instanceof T.MeshStandardMaterial)) return;
      const native = selectNativeComplexMaterial(material, materials) as
        | NativeFoliageMaterial
        | undefined;
      if (!native) return;
      const mode = native.IntParams.F_VERTEX_ANIMATION ?? 0;
      if (mode === 0) continue;
      if (mode !== 1 || maximum === undefined) return;
      animated = true;
      const scalar = (name: string) => {
        const value = native.resolvedMaterialInputs[name] ?? native.FloatParams[name];
        return Array.isArray(value) ? value[0] : value;
      };
      let envelope: number;
      try {
        envelope = nativeClutterSwayPadding(
          {
            swayAmount: scalar("g_flSwayAmount"),
            swaySpeed: scalar("g_flSwaySpeed"),
            swayNoiseScale: scalar("g_flSwayNoiseScale"),
            swayFalloff: scalar("g_flSwayFalloff"),
            flutterAmount: scalar("g_flFlutterAmount"),
            flutterSpeed: scalar("g_flFlutterSpeed"),
            flutterNoiseScale: scalar("g_flFlutterNoiseScale"),
            flutterFalloff: scalar("g_flFlutterFalloff"),
          },
          maximum,
        );
      } catch {
        return;
      }
      padding = Math.max(padding, envelope);
    }
    const world = object.matrixWorld;
    // Three transforms bounding spheres using the largest column scale. That
    // encloses orthogonal placements, including nonuniform/negative scales,
    // but cannot safely enclose an arbitrary shear.
    const columns = [0, 1, 2].map((i) => new T.Vector3().setFromMatrixColumn(world, i));
    if (
      world.elements.some((value) => !Number.isFinite(value)) ||
      Math.abs(world.elements[3]) + Math.abs(world.elements[7]) + Math.abs(world.elements[11]) >
        1e-10 ||
      Math.abs(world.elements[15] - 1) > 1e-10 ||
      Math.abs(world.determinant()) < 1e-12 ||
      columns.some((a, i) =>
        columns.some((b, j) => i !== j && Math.abs(a.dot(b)) > 1e-10 * a.length() * b.length()),
      )
    )
      return;
    const position = object.geometry.getAttribute("position");
    if (!position) return;
    object.geometry.computeBoundingSphere();
    const sphere = object.geometry.boundingSphere?.clone();
    if (
      !sphere ||
      !Number.isFinite(sphere.radius) ||
      sphere.center.toArray().some((v: number) => !Number.isFinite(v))
    )
      return;
    if (animated) {
      // The envelope is per-axis in own-browser metres. Absolute row sums
      // enclose its complete box after own→world→local, then a sphere encloses
      // that local box. No assumed unit mesh/sky transform is required.
      const e = world.clone().invert().multiply(ownToWorld).elements;
      const x = padding * (Math.abs(e[0]) + Math.abs(e[4]) + Math.abs(e[8])),
        y = padding * (Math.abs(e[1]) + Math.abs(e[5]) + Math.abs(e[9])),
        z = padding * (Math.abs(e[2]) + Math.abs(e[6]) + Math.abs(e[10]));
      sphere.radius += Math.hypot(x, y, z) + 1e-5;
    }
    if (!Number.isFinite(sphere.radius)) return;
    bounds.set(object, sphere);
    retained.push({
      mesh: object,
      geometry: object.geometry,
      position,
      version: "version" in position ? position.version : position.data.version,
      world: world.clone(),
    });
  });
  return {
    bounds,
    update() {
      // Frozen scenery normally passes unchanged. A door/replacement changing
      // geometry or an animated placement permanently leaves this optimization;
      // syncDepth mirrors this fallback before rendering its coverage view.
      for (let i = retained.length - 1; i >= 0; i--) {
        const entry = retained[i],
          position = entry.mesh.geometry.getAttribute("position");
        if (
          entry.mesh.geometry !== entry.geometry ||
          position !== entry.position ||
          ("version" in entry.position ? entry.position.version : entry.position.data.version) !==
            entry.version ||
          !entry.mesh.matrixWorld.equals(entry.world)
        ) {
          // Reflection partitioning may replace geometry and attach overflow
          // descendants after material setup. Those inherit the source flag,
          // but have no admitted wind sphere of their own; leave the complete
          // replacement subtree on the original uncullable path.
          entry.mesh.traverse((object) => {
            if (object instanceof T.Mesh) object.frustumCulled = false;
          });
          bounds.delete(entry.mesh);
          retained.splice(i, 1);
        }
      }
    },
  };
}
