import { loadNativeMapParallax, applyNativeMapParallax } from "./native-map-parallax";
import { applyNativeStaticOverlays, type NativeStaticOverlay } from "./native-static-overlay";
import { assetFetch, assetUrl } from "./asset-url";
import type { MapId } from "@cs2go/protocol";
import { MAPS } from "@cs2go/protocol";
import {
  loadNativeMapLighting,
  applyNativeMapLighting,
  type NativeMapLightingPaths,
} from "./native-map-lighting";
import {
  loadNativeMapGrade,
  gradeNativeMapColors,
  type NativeMapPostprocess,
} from "./native-map-color";
import { WorldBall } from "./world-ball";
import { MapResources } from "./map-resources";
import { loadNativeMapEnvironment, applyNativeMapEnvironment } from "./native-map-environment";
import { disposeActorLighting } from "./actor-lighting";
import { applySourceMapLighting, loadSourceMapLighting } from "./source-map-lighting";
import { loadBombDamage } from "./bomb-damage";
import { loadSourceSky, bindSourceSky } from "./source-sky";
import { addSourceDynamicSun, applySourceSunShadows } from "./source-sun";
import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { loadGzipped } from "./gltf";
import { dustCollision } from "@cs2go/simulation/dust-map";
import { Navigation } from "./navigation";
import { loadNativeMapSky } from "./native-map-sky";
import { applySourceSelfIllumination, type SourceSelfIllumination } from "./source-self-illum";
import { loadNativeMapProbes, applyNativeMapProbes } from "./native-map-probes";
import { loadSourceReflections } from "./source-reflections";
import { loadNativeMapLayers, applyNativeMapLayers } from "./native-map-layers";
import { BreakableWorld, bindBreakablePhysics } from "@cs2go/simulation/breakables";
import { NativeMapBreakableView, type NativeBreakableManifest } from "./map-breakable-view";
import type { MapNavigation } from "./navigation";
import type { Wall } from "./physics";
import type { NativePlaces } from "./map-callouts";
import type { RadarOverview } from "./radar-overview";
import { bindDoorPhysics, DoorWorld, type NativeDoorManifest } from "@cs2go/simulation/doors";
import { NativeMapDoorView } from "./map-door-view";
import { loadNativeMapEffects } from "./native-map-effects";
import { applyNativeMapReflections } from "./native-map-reflections";
import { loadNativeMapWater, applyNativeMapWater } from "./native-map-water";
import { loadNativeMapComplex, applyNativeMapComplex } from "./native-map-complex";
export type NativeMapConfig = {
  sun: { pitch: number; yaw: number; color: number; intensity: number };
  fog?: { color: number; near: number; far: number };
  backgroundIntensity?: number;
  environmentIntensity?: number;
  ambient?: { skyColor: number; groundColor: number; intensity: number };
  teamCamera?: { position: number[]; target: number[] };
  radar?: RadarOverview;
  reflections?: { volumes?: number; maxGpuBytes?: number };
  lighting?: NativeMapLightingPaths;
  postprocess?: NativeMapPostprocess;
  skyWorld?: string;
  doors?: string;
  /** Native environment bundle directory or its explicit source.json path. */
  environmentMaterials?: string;
  parallaxMaterials?: string;
  effectsWorld?: string;
  waterMaterials?: string;
  complexMaterials?: string;
};
const dustConfig: NativeMapConfig = {
  sun: { pitch: 50, yaw: 43, color: 0xffdebd, intensity: 2.5 * Math.PI },
  fog: { color: 0xc7d6df, near: 100, far: 240 },
  backgroundIntensity: 2 ** 0.765,
  environmentIntensity: 0.35,
  teamCamera: { position: [-31.5, 4.65, 16], target: [-28.5, 4.1, 7] },
};
export function loadDust2(scene: T.Scene, renderer: T.WebGLRenderer) {
  return loadNativeMap(scene, renderer, "dust2");
}
/** Native world exports already contain their authored positions and metre conversion. */
export async function loadNativeMap(scene: T.Scene, renderer: T.WebGLRenderer, id: MapId) {
  const resources = new MapResources();
  try {
    return await buildNativeMap(scene, renderer, id, resources);
  } catch (error) {
    resources.dispose();
    throw error;
  }
}
async function buildNativeMap(
  scene: T.Scene,
  renderer: T.WebGLRenderer,
  id: MapId,
  resources: MapResources,
) {
  const physicsResources = new MapResources();
  resources.onDispose(() => physicsResources.dispose());
  const ownModel = async (pending: ReturnType<typeof loadGzipped>) => {
    const asset = await pending;
    resources.capture(asset.scene);
    resources.onDispose(() => resources.capture(asset.scene));
    return asset;
  };
  const ownTextures = <Value extends { textures: T.Texture[] }>(value: Value) => {
    for (const texture of value.textures) resources.texture(texture);
    return value;
  };
  const sourceLighting = id === "dust2";
  const config: NativeMapConfig = sourceLighting
    ? {
        ...dustConfig,
        radar: await assetFetch("/models/maps/dust2-overview.json").then(async (response) => {
          if (!response.ok) throw new Error("Dust II native radar metadata unavailable");
          return response.json() as Promise<NonNullable<NativeMapConfig["radar"]>>;
        }),
      }
    : await assetFetch(`/models/maps/${id}-config.json`).then(async (response) => {
        if (!response.ok) throw new Error(`${id} native environment configuration unavailable`);
        return response.json();
      });
  const skyLoad = new HDRLoader().loadAsync(assetUrl(`/models/maps/${id}-sky.hdr`)).then((sky) => {
    resources.texture(sky);
    return sky;
  });
  const [
    asset,
    response,
    physics,
    sky,
    bombDamage,
    lighting,
    skybox,
    cables,
    nativeLighting,
    grade,
    nativeSky,
    nativeMaterials,
    nativeProbes,
    nativeReflections,
    nativeLayers,
    breakableData,
    places,
    doorData,
    environmentMaterials,
    parallaxMaterials,
    nativeEffects,
    waterMaterials,
    complexMaterials,
  ] = await Promise.all([
    ownModel(loadGzipped(`/models/maps/${id}.glb.gz`, 1)),
    assetFetch(`/models/maps/${id}-nav.json`),
    loadGzipped(`/models/maps/${id}-physics.glb.gz`, 1).then((asset) => {
      physicsResources.capture(asset.scene);
      return asset;
    }),
    skyLoad,
    loadBombDamage(id),
    sourceLighting ? loadSourceMapLighting(renderer) : undefined,
    sourceLighting ? loadSourceSky(renderer) : undefined,
    sourceLighting ? ownModel(loadGzipped("/models/maps/dust2-cables.glb.gz", 1)) : undefined,
    config.lighting
      ? loadNativeMapLighting(config.lighting, renderer).then((lighting) => {
          for (const texture of Object.values(lighting)) resources.texture(texture);
          return lighting;
        })
      : undefined,
    config.postprocess
      ? loadNativeMapGrade(config.postprocess).then((grade) => {
          resources.texture(grade.texture);
          return grade;
        })
      : undefined,
    config.skyWorld
      ? loadNativeMapSky(renderer, config.skyWorld, skyLoad, config.sun).then((sky) => {
          resources.onDispose(() => sky.dispose());
          return sky;
        })
      : undefined,
    sourceLighting
      ? undefined
      : assetFetch(`/models/maps/${id}-materials.json`).then(async (r) => {
          if (!r.ok) throw new Error(`${id} native material configuration unavailable`);
          return r.json() as Promise<{
            materials: {
              name: string;
              selfIllumination?: SourceSelfIllumination;
              staticOverlay?: NativeStaticOverlay;
            }[];
          }>;
        }),
    sourceLighting
      ? undefined
      : loadNativeMapProbes(renderer, `/models/maps/${id}-lighting/gpu-probes/`).then((probes) =>
          probes ? ownTextures(probes) : undefined,
        ),
    sourceLighting
      ? undefined
      : loadSourceReflections(renderer, true, {
          directory: `/models/maps/${id}-lighting/reflections/`,
          manifest: "source.json",
          ...config.reflections,
        }).then((reflections) => (reflections ? ownTextures(reflections) : undefined)),
    sourceLighting
      ? undefined
      : loadNativeMapLayers(renderer, id).then((layers) => {
          for (const texture of layers.textures.values()) resources.texture(texture);
          // The shared native BRDF lookup is deliberately not map-owned.
          return layers;
        }),
    !sourceLighting
      ? assetFetch(`/models/maps/${id}-breakables.json`).then(async (r) => {
          if (!r.ok) throw new Error(`${id} native breakable configuration unavailable`);
          return r.json() as Promise<NativeBreakableManifest>;
        })
      : ({ version: 1, mapId: id, breakables: [] } as NativeBreakableManifest),
    assetFetch(`/models/maps/${id}-places.json`).then(async (response) => {
      if (!response.ok) throw new Error(`${id} native callout volumes unavailable`);
      return response.json() as Promise<NativePlaces>;
    }),
    config.doors
      ? assetFetch(config.doors).then(async (response) => {
          if (!response.ok) throw new Error(`${id} native door metadata unavailable`);
          const manifest = (await response.json()) as NativeDoorManifest;
          if (manifest.version !== 1 || manifest.mapId !== id || !Array.isArray(manifest.doors))
            throw new Error(`${id} native door metadata does not match the map`);
          return manifest;
        })
      : ({ version: 1, mapId: id, doors: [] } as NativeDoorManifest),
    config.environmentMaterials
      ? loadNativeMapEnvironment(renderer, config.environmentMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          // Shared native BRDF lookup remains owned by the lighting system.
          return bundle;
        })
      : undefined,
    config.parallaxMaterials
      ? loadNativeMapParallax(renderer, config.parallaxMaterials).then((bundle) => {
          for (const texture of [...bundle.textures.values(), ...bundle.cubes.values()])
            resources.texture(texture);
          return bundle;
        })
      : undefined,

    config.effectsWorld
      ? loadNativeMapEffects(renderer, config.effectsWorld, resources)
      : undefined,
    config.waterMaterials
      ? loadNativeMapWater(renderer, config.waterMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          return bundle;
        })
      : undefined,
    config.complexMaterials
      ? loadNativeMapComplex(renderer, config.complexMaterials).then((bundle) => {
          for (const texture of bundle.textures.values()) resources.texture(texture);
          return bundle;
        })
      : undefined,
  ]);
  // Damage replacements retain exact native geometry in map-owned sidecars.
  // Bind their identities before collision flattening and material adaptation.
  await Promise.all([
    ...(doorData.renderModels ?? []).map(async (path) => {
      const extra = await ownModel(loadGzipped(path, 1));
      asset.scene.add(extra.scene);
    }),
    ...(doorData.physicsModels ?? []).map(async (path) => {
      const extra = await loadGzipped(path, 1);
      physicsResources.capture(extra.scene);
      physics.scene.add(extra.scene);
    }),
  ]);
  if (nativeEffects) asset.scene.add(nativeEffects.root);
  // Native particle ropes are absent from the world export. Their settled tubes are baked offline and share static map lighting; native static_collision=false!
  if (cables) asset.scene.add(cables.scene);
  sky.mapping = T.EquirectangularReflectionMapping;
  if (!response.ok) throw new Error(`${id} navigation could not load`);
  const data = (await response.json()) as MapNavigation;
  if (places.version !== 1 || places.mapId !== id)
    throw new Error(`${id} callout data does not match the map`);
  const navigation = new Navigation({ ...data, mapId: id, locations: places.locations });
  let mapSky: T.Object3D | undefined = skybox;
  if (!sourceLighting) {
    // A map-owned sphere lets the sky use its native VPOST too; Three's built-in
    // background shader would otherwise retain the Dust II CustomToneMapping.
    if (nativeSky) {
      mapSky = nativeSky.background;
      if (grade) gradeNativeMapColors(mapSky);
    } else {
      const skyMaterial = new T.MeshBasicMaterial({
        map: sky,
        side: T.BackSide,
        depthWrite: false,
        fog: false,
      });
      const sphere = new T.Mesh(new T.SphereGeometry(100, 48, 24), skyMaterial);
      sphere.name = `${id} native panorama sky`;
      sphere.rotation.y = Math.PI;
      sphere.frustumCulled = false;
      sphere.renderOrder = -1000;
      sphere.onBeforeRender = (_renderer, _scene, camera) => {
        sphere.position.setFromMatrixPosition(camera.matrixWorld);
        sphere.updateMatrixWorld(true);
      };
      if (grade) gradeNativeMapColors(sphere);
      mapSky = sphere;
    }
  }
  const root = new T.Group();
  root.name = `${MAPS[id]?.name ?? id} - CS2`;
  root.add(asset.scene);
  if (mapSky) root.add(mapSky);
  asset.scene.updateMatrixWorld(true);
  const emissiveMaterials = new Set<T.Material>();
  asset.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const material = (
      Array.isArray(object.material) ? object.material[0] : object.material
    ) as T.MeshStandardMaterial;
    const name = material.name.toLowerCase();
    if (/wrongway|timer/.test(name)) {
      object.visible = false;
      return;
    }
    object.userData.bulletMaterial = /wood|crate|door|basket/.test(name)
      ? "wood"
      : /metal|car|iron|barrel/.test(name)
        ? "metal"
        : "concrete";
    object.castShadow = object.receiveShadow = true;
    // Preserve the native albedo. The shared scenery grade runs once, after lighting.
    for (const tex of [material.map, material.normalMap]) if (tex) tex.anisotropy = 8;
    for (const entry of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(entry instanceof T.MeshStandardMaterial) || emissiveMaterials.has(entry)) continue;
      emissiveMaterials.add(entry);
      const source = nativeMaterials?.materials.find(
        (m) => m.name === entry.name,
      )?.selfIllumination;
      if (source && !parallaxMaterials?.materials[entry.name])
        applySourceSelfIllumination(entry, source);
    }
  });
  if (nativeMaterials) applyNativeStaticOverlays(asset.scene, nativeMaterials.materials);
  if (complexMaterials) applyNativeMapComplex(asset.scene, complexMaterials);
  const nativeWater = waterMaterials
    ? applyNativeMapWater(asset.scene, waterMaterials, (texture) => resources.texture(texture))
    : undefined;
  if (environmentMaterials) applyNativeMapEnvironment(asset.scene, environmentMaterials);
  if (parallaxMaterials) applyNativeMapParallax(asset.scene, parallaxMaterials);
  if (nativeLayers) applyNativeMapLayers(asset.scene, nativeLayers);
  if (lighting) applySourceMapLighting(asset.scene, lighting);
  else {
    // Cache architecture shadows, but refresh moving actors in a separate atlas.
    // This helper contains no Dust II atlas/probe data.
    const materials = new Set<T.Material>();
    asset.scene.traverse((object) => {
      if (object instanceof T.Mesh)
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          materials.add(material);
    });
    for (const material of materials) {
      const compile = material.onBeforeCompile.bind(material);
      const key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer);
        applySourceSunShadows(shader);
      };
      material.customProgramCacheKey = () => `${key}:native-map-moving-shadows`;
      material.needsUpdate = true;
    }
  }
  if (nativeLighting) applyNativeMapLighting(asset.scene, nativeLighting);
  if (nativeProbes) applyNativeMapProbes(asset.scene, nativeProbes);
  if (nativeReflections?.volumes.some((volume) => volume.worldToLocal))
    applyNativeMapReflections(asset.scene, nativeReflections, doorData.doors, [
      ...breakableData.breakables.flatMap((part) => part.renderNames),
      ...(breakableData.enabledRemainders ?? []).flatMap((part) => part.renderNames),
    ]);
  if (grade) gradeNativeMapColors(asset.scene);
  // The imported architecture never moves; skip its per-frame matrix updates.
  asset.scene.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
  bindBreakablePhysics(physics.scene, breakableData.breakables, breakableData.enabledRemainders);
  const doorPhysics = bindDoorPhysics(physics.scene, doorData.doors);
  const { collision, grenadeCollision } = dustCollision(physics.scene);
  navigation.bindCollision(collision);
  const doors = new DoorWorld(collision, doorData.doors, doorPhysics);
  const breakables = new BreakableWorld(collision, breakableData.breakables);
  const breakableView = new NativeMapBreakableView(root, asset.scene, breakableData, collision);
  const ball = new WorldBall(root, collision, id === "dust2" || !!data.worldBallOrigin);
  physicsResources.dispose();
  const proxy = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial());
  proxy.raycast = (raycaster, hits) => {
    const far = Math.min(raycaster.far, 250);
    hits.push(
      ...collision
        .intersections(raycaster.ray, far)
        .filter((hit) => hit.distance >= raycaster.near),
    );
  };
  // Compatibility fill for unregistered transient objects. Native map materials
  // and registered actors replace diffuse fill with their baked atlas/probe data.
  const ambient = config.ambient;
  const bounce = ambient
    ? new T.Color(ambient.groundColor)
    : new T.Color(0x979797).multiplyScalar(1.7);
  root.add(new T.HemisphereLight(ambient?.skyColor ?? 0xd3e2f8, bounce, ambient?.intensity ?? 2.4));
  // CT fixtures 20086/20088 are directlight=1 without baked-shadow indices:
  // their direct light and bounce are already in the native atlases/probes.
  // Source direct diffuse omits Lambert's 1/pi; Three.js includes it.
  const sun = new T.DirectionalLight(config.sun.color, config.sun.intensity);
  sun.target.position.set(0, 0, -30);
  // Source pitch/yaw 50/43 degrees, Z-up inches -> Three.js Y-up meters.
  const pitch = T.MathUtils.degToRad(config.sun.pitch),
    yaw = T.MathUtils.degToRad(config.sun.yaw);
  sun.position.set(
    -Math.cos(pitch) * Math.cos(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(yaw),
  );
  sun.position.multiplyScalar(100).add(sun.target.position);
  sun.castShadow = true;
  // Imported architecture is static; retain its shadow map between frames.
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -90,
    right: 90,
    top: 90,
    bottom: -90,
    near: 1,
    far: 220,
  });
  sun.shadow.bias = -0.0001;
  sun.shadow.normalBias = 0.025;
  root.add(sun, sun.target);
  // Spend the existing 2048 shadow texels on playable terrain rather than a
  // fixed 180m square. Keep depth broad so off-nav roofs still cast shadows.
  // NAV hulls include tunnels and elevation; padding covers walls around them.
  root.updateMatrixWorld(true);
  sun.shadow.updateMatrices(sun);
  const shadowBounds = new T.Box3();
  const shadowPoint = new T.Vector3();
  for (const area of navigation.areas) {
    for (const corner of area.corners) {
      shadowPoint.fromArray(corner).applyMatrix4(sun.shadow.camera.matrixWorldInverse);
      shadowBounds.expandByPoint(shadowPoint);
      shadowPoint.fromArray(corner);
      shadowPoint.y += 5;
      shadowPoint.applyMatrix4(sun.shadow.camera.matrixWorldInverse);
      shadowBounds.expandByPoint(shadowPoint);
    }
  }
  if (!shadowBounds.isEmpty()) {
    Object.assign(sun.shadow.camera, {
      left: shadowBounds.min.x - 8,
      right: shadowBounds.max.x + 8,
      bottom: shadowBounds.min.y - 8,
      top: shadowBounds.max.y + 8,
    });
    sun.shadow.camera.updateProjectionMatrix();
  }
  const dynamicSun = addSourceDynamicSun(root, sun, asset.scene);
  const doorView = new NativeMapDoorView(asset.scene, doorData.doors);
  doorView.sync(doors.states);
  resources.capture(asset.scene);
  resources.capture(proxy);
  resources.capture(sun);
  resources.capture(dynamicSun);
  if (ball.mesh) resources.capture(ball.mesh);
  if (mapSky && !nativeSky) resources.capture(mapSky);
  resources.onDispose(() => {
    breakableView.clearDebris();
    if (ball.mesh) disposeActorLighting(ball.mesh);
    root.removeFromParent();
    root.clear();
  });
  root.visible = false;
  scene.add(root);
  if (mapSky && sourceLighting) bindSourceSky(scene, mapSky, root);
  return {
    id,
    config,
    triggers: data.triggers,
    ladders: data.ladders,
    sourceLighting,
    nativeProbes,
    nativeReflections,
    grade,
    root,
    scenery: asset.scene,
    ball,
    walls: [] as Wall[],
    solids: [proxy],
    collision,
    grenadeCollision,
    navigation,
    sky,
    skybox: mapSky,
    nativeSky,
    nativeEffects,
    nativeWater,
    nativeEnvironment: environmentMaterials,
    breakables,
    doors,
    doorDefinitions: doorData.doors,
    doorPhysics,
    doorView,
    breakableView,
    sun,
    bombDamage,
    dispose: () => resources.dispose(),
  };
}
