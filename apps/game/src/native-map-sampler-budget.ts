/** External texture slots required by the resolved map lighting graph.
 * Atlas and LPV receivers are alternatives, never additive. The explicit
 * shadow/grade reservations also cover later settings/pass changes. */
export interface NativeMapSamplerResources {
  lighting?: { directional?: unknown };
  probes?: { textures: readonly unknown[] };
  reflections?: { combined?: boolean; textures: readonly unknown[] };
  fog?: { cube?: unknown };
  stockEnvironmentFallback: boolean;
  grade: "active" | "reserved" | "none";
  sourceSunShadows: 0 | 2;
}
export function nativeMapSamplerReservation(resources: NativeMapSamplerResources) {
  const atlas = resources.lighting ? (resources.lighting.directional ? 3 : 2) : 0;
  if (resources.probes && resources.probes.textures.length < 2)
    throw new Error("Native probe sampler layout is incomplete");
  const probes = resources.probes ? 2 : 0; // sourceGpuAtlas0/1 shader ABI
  const lighting = Math.max(atlas, probes);
  const reflection = resources.reflections;
  if (
    reflection &&
    (!reflection.textures.length || (!reflection.combined && reflection.textures.length > 2))
  )
    throw new Error("Unsupported native reflection sampler layout");
  const reflections = reflection
    ? reflection.combined
      ? 1
      : 2
    : resources.stockEnvironmentFallback
      ? 1
      : 0;
  const fog = resources.fog?.cube ? 1 : 0;
  const grade = resources.grade === "none" ? 0 : 1;
  return {
    qualification: "resolved-resource sampler upper bound; not an active-uniform measurement",
    lighting,
    atlas,
    probes,
    reflections,
    reflectionMode: reflection
      ? "native"
      : resources.stockEnvironmentFallback
        ? "stock-environment"
        : "none",
    fog,
    grade,
    gradeReservation: resources.grade === "reserved",
    sourceSunShadows: resources.sourceSunShadows,
    samplers: lighting + reflections + fog + grade + resources.sourceSunShadows,
  };
}
