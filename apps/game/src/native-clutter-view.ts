import * as T from "three";
import { assetFetch } from "./asset-url";
import { fetchGzipped, loadGzipped } from "./gltf";
import { createNativeClutter, type NativeClutterTemplate } from "./native-clutter";
import type { NativeClutterFields } from "./native-clutter-data";
import { nativeClutterSwayPadding } from "./native-clutter-wind";
import { createAuthoredWind } from "./native-authored-wind";
import { createEnvironmentWorldFrame } from "./native-environment-frame";
import { applyNativeMapFoliage, loadNativeMapFoliage } from "./native-map-foliage";
import { applyNativeMapEnvironment, loadNativeMapEnvironment } from "./native-map-environment";
import {
  validateSourceReflections,
  type SourceReflectionManifest,
  type SourceReflections,
} from "./source-reflections";
import type { MapResources } from "./map-resources";
import type { SourceFoliageSway } from "./source-foliage-wind";
interface ClutterManifest extends NativeClutterFields {
  placements: NativeClutterFields["placements"] & { file: string };
  geometryManifest: string;
  reflectionMetadata: { file: string; volumes: number; maxGpuBytes: number };
  foliageMaterials: string;
  environmentMaterials?: string;
}
interface Model {
  kind: string;
  scope: "main" | "sky";
  file: string;
  resource: string;
  nativeModelSha256: string;
  nativeShaders: string[];
  materials: string[];
  nativeDrawMaterials: string[];
}
function alias<M>(materials: Record<string, M>, model: Model) {
  model.materials.forEach((name, i) => {
    const original = materials[model.nativeDrawMaterials[i]];
    if (!original || materials[name])
      throw new Error("Native clutter draw material namespace mismatch");
    materials[name] = original;
  });
}
export async function loadNativeClutterView(
  renderer: T.WebGLRenderer,
  path: string,
  resources: MapResources,
  reflections: SourceReflections | undefined,
  placement = new T.Matrix4(),
) {
  const response = await assetFetch(path);
  if (!response.ok) throw new Error("Native clutter manifest unavailable");
  const fields = (await response.json()) as ClutterManifest,
    directory = path.slice(0, path.lastIndexOf("/") + 1),
    worldToNative = placement.clone().invert();
  // Candidate selection needs source boxes, not GPU cube support. Preserve
  // the renderer's existing fallback path on non-BPTC hardware.
  let field: Pick<SourceReflections, "volumes"> | undefined = reflections;
  if (!field) {
    const response = await assetFetch(fields.reflectionMetadata.file);
    if (!response.ok) throw new Error("Native clutter reflection metadata unavailable");
    const manifest = (await response.json()) as SourceReflectionManifest;
    validateSourceReflections(manifest, fields.reflectionMetadata);
    field = manifest;
  }
  if (field.volumes.length !== fields.reflectionMetadata.volumes)
    throw new Error("Native clutter reflection scope mismatch");
  const [geometryResponse, bytes, foliageBundle, environmentBundle] = await Promise.all([
    assetFetch(fields.geometryManifest),
    fetchGzipped(directory + fields.placements.file),
    loadNativeMapFoliage(renderer, fields.foliageMaterials).then((bundle) => {
      for (const texture of bundle.textures.values()) resources.texture(texture);
      resources.texture(bundle.noise);
      resources.external(bundle.lookup);
      return bundle;
    }),
    fields.environmentMaterials
      ? loadNativeMapEnvironment(renderer, fields.environmentMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          if (bundle.lookup) resources.external(bundle.lookup);
          return bundle;
        })
      : undefined,
  ]);
  if (!geometryResponse.ok) throw new Error("Native clutter geometry manifest unavailable");
  const models = ((await geometryResponse.json()) as { models: Model[] }).models.filter(
    (m) => m.kind === "clutter-template" && m.scope === fields.scope,
  );
  const wind = createAuthoredWind(foliageBundle.source.controllers ?? [], {
    space: fields.scope,
    speedToStrength: 0.01,
    worldToOwn: worldToNative,
  });
  // Bound every controller, independently of controller selection and pulse timing.
  const maximumStrength =
    Math.max(
      0,
      ...(foliageBundle.source.controllers ?? []).flatMap((record) => {
        const v = (record as { values: Record<string, number> }).values;
        return [(v.minwind + v.maxwind) / 2, (v.mingust + v.maxgust) / 2];
      }),
    ) * 0.01;
  const templates = await Promise.all(
    models.map(async (model) => {
      if (
        model.nativeShaders.length !== 1 ||
        !["csgo_foliage.vfx", "csgo_environment.vfx"].includes(model.nativeShaders[0])
      )
        throw new Error("Unsupported native clutter template family");
      const family = model.nativeShaders[0] as NativeClutterTemplate["family"],
        asset = await loadGzipped(model.file, 1);
      resources.capture(asset.scene);
      let windPadding = 0;
      if (family === "csgo_foliage.vfx") {
        alias(foliageBundle.materials, model);
        for (const name of model.nativeDrawMaterials) {
          const source = foliageBundle.materials[name],
            mode = source.IntParams.F_VERTEX_ANIMATION ?? 0;
          if (![0, 1].includes(mode))
            throw new Error("Native clutter wind mode lacks a displacement envelope");
          if (mode === 1) {
            const p = source.FloatParams,
              parameters: SourceFoliageSway = {
                swayAmount: p.g_flSwayAmount,
                swaySpeed: p.g_flSwaySpeed,
                swayNoiseScale: p.g_flSwayNoiseScale,
                swayFalloff: p.g_flSwayFalloff,
                flutterAmount: p.g_flFlutterAmount,
                flutterSpeed: p.g_flFlutterSpeed,
                flutterNoiseScale: p.g_flFlutterNoiseScale,
                flutterFalloff: p.g_flFlutterFalloff,
              };
            windPadding = Math.max(
              windPadding,
              nativeClutterSwayPadding(parameters, maximumStrength),
            );
          }
        }
      } else {
        if (!environmentBundle)
          throw new Error("Native clutter environment material bank unavailable");
        alias(environmentBundle.materials, model);
      }
      return {
        scope: fields.scope,
        resource: model.resource,
        nativeModelSha256: model.nativeModelSha256,
        root: asset.scene,
        family,
        windPadding,
      };
    }),
  );
  const view = createNativeClutter(fields, bytes, templates, field, resources, placement),
    frame = createEnvironmentWorldFrame(worldToNative);
  // Tile spheres already include every authored instance and the complete
  // local wind envelope. Keep those local-space bounds when the foliage
  // adapter creates its color/depth views; placement is applied by matrixWorld.
  const instanceBounds = new Map<T.InstancedMesh, T.Sphere>();
  view.foliage.traverse((object) => {
    if (object instanceof T.InstancedMesh && object.boundingSphere)
      instanceBounds.set(object, object.boundingSphere.clone());
  });
  const foliage = applyNativeMapFoliage(view.foliage, foliageBundle, {
    sourceWorldFrame: frame,
    windState: wind.state,
    instanceBounds,
  });
  resources.onDispose(() => foliage.dispose());
  if (environmentBundle)
    applyNativeMapEnvironment(view.environment, { ...environmentBundle, sourceWorldFrame: frame });
  resources.capture(view.root);
  return {
    ...view,
    applyShadowPolicy() {
      foliage.applyShadowPolicy();
    },
    update(seconds: number) {
      foliage.update(seconds, wind.update(seconds));
    },
    renderDepth(this: void, camera: T.PerspectiveCamera) {
      const autoClear = renderer.autoClear;
      try {
        renderer.autoClear = false;
        foliage.syncDepth(renderer);
        renderer.render(foliage.depthScene, camera);
      } finally {
        renderer.autoClear = autoClear;
      }
    },
    prepare(camera: T.PerspectiveCamera) {
      renderer.initTexture(foliageBundle.noise);
      foliage.syncDepth(renderer);
      return renderer.compileAsync(foliage.depthScene, camera);
    },
  };
}
