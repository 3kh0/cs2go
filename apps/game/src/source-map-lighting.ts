import { assetFetch, assetUrl } from "./asset-url";
import * as T from "three";
import { fetchGzipped } from "./gltf";
import { bindSourceMapAttributes } from "./source-map-attributes";
import { applySourceSunShadows } from "./source-sun";
import { loadSourceLighting } from "./source-lighting";
import {
  loadSourceGpuProbes,
  applySourceGpuProbes,
  type SourceGpuProbes,
} from "./source-gpu-probes";
import { loadSourceColorCorrection } from "./map-color";
import { applySourceFog } from "./source-fog";
import { loadSourceLayers, loadSourceMaterialBundle, applySourceLayers } from "./source-layers";
import { registerSurfaceTextures } from "./presentation-settings";
import { applySourceBarns, loadSourceBarns } from "./source-barn";
import { applySourceSelfIllumination, type SourceSelfIllumination } from "./source-self-illum";
import { applySourceSurface, loadSourceSurfaceLookup, type SourceSurface } from "./source-surface";
import {
  loadSourceReflections,
  applySourceReflections,
  sourceReflectionCandidates,
  type SourceReflections,
} from "./source-reflections";
import {
  applySourceFoliage,
  applySourceFoliageTransmission,
  type SourceFoliage,
} from "./source-foliage";

import { applySourceEnvironment, type SourceEnvironment } from "./source-environment";
import {
  applySourceGenericTextures,
  sourceTextureWithUV,
  type SourceGenericTextures,
} from "./source-generic-textures";

interface SourceMaterialLighting {
  materials: {
    name: string;
    foliage?: SourceFoliage;
    selfIllumination?: SourceSelfIllumination;
    surface?: SourceSurface;
    localReflections?: boolean;
    environment?: SourceEnvironment;
    nativeAOTexture?: string;
    constantAO?: 1;
  }[];
}

interface SourceMapLighting {
  irradiance: T.Texture;
  shadows: T.Texture;
  directional?: T.Texture;
  materialLighting: SourceMaterialLighting;
  native: boolean;
  transmissionTextures: Map<string, T.Texture>;
  layers?: Awaited<ReturnType<typeof loadSourceLayers>>;
  environmentTextures?: Map<string, T.Texture>;
  occlusionTextures?: Map<string, T.Texture>;
  generic?: { materials: Record<string, SourceGenericTextures>; textures: Map<string, T.Texture> };
  barns?: T.Box3[];
  surfaceLookup?: T.DataTexture;
  reflections?: SourceReflections;
  gpuProbes?: SourceGpuProbes;
}

async function loadNativeAtlas(name: string, format: T.CompressedPixelFormat, bytes: number) {
  const data = await fetchGzipped(`/models/maps/lighting/native/${name}-4096.bin.gz`);
  if (data.byteLength !== bytes) throw new Error(`Invalid native Dust II atlas: ${name}`);
  const texture = new T.CompressedTexture(
    [{ data: new Uint8Array(data), width: 4096, height: 4096 }],
    4096,
    4096,
    format,
  );
  texture.colorSpace = T.NoColorSpace;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export async function loadSourceMapLighting(renderer: T.WebGLRenderer) {
  const native =
    renderer.capabilities.maxTextureSize >= 4096 &&
    renderer.extensions.has("EXT_texture_compression_bptc") &&
    renderer.extensions.has("WEBGL_compressed_texture_s3tc");
  const [
    irradiance,
    shadows,
    directional,
    materialLighting,
    layers,
    barns,
    surfaceLookup,
    reflections,
    environmentBundle,
    occlusionBundle,
    generic,
    gpuProbes,
  ] = await Promise.all([
    native
      ? loadNativeAtlas("irradiance", T.RGB_BPTC_UNSIGNED_Format, 16777216)
      : new T.TextureLoader().loadAsync(assetUrl("/models/maps/lighting/irradiance.webp")),
    native
      ? loadNativeAtlas("direct_light_shadows", T.RGBA_BPTC_Format, 16777216)
      : new T.TextureLoader().loadAsync(assetUrl("/models/maps/lighting/shadows.webp")),
    native ? loadNativeAtlas("directional_irradiance", T.RGB_S3TC_DXT1_Format, 8388608) : undefined,
    assetFetch("/models/maps/material-lighting.json").then(async (r) => {
      if (!r.ok) throw new Error("Native map material lighting unavailable");
      return (await r.json()) as SourceMaterialLighting;
    }),
    loadSourceLayers(renderer),
    loadSourceBarns(),
    loadSourceSurfaceLookup(),
    loadSourceReflections(renderer, true),
    loadSourceMaterialBundle(renderer, "/models/maps/lighting/environment/"),
    loadSourceMaterialBundle(renderer, "/models/maps/lighting/occlusion/"),
    loadSourceMaterialBundle<SourceGenericTextures>(renderer, "/models/maps/lighting/generic/"),
    loadSourceGpuProbes(renderer),
    loadSourceGpuProbes(renderer).then((probes) => loadSourceLighting(!!probes)),
    loadSourceColorCorrection(),
  ]);
  for (const texture of [irradiance, shadows]) {
    texture.colorSpace = T.NoColorSpace;
    texture.flipY = false;
    texture.minFilter = native ? T.LinearFilter : T.LinearMipmapLinearFilter;
    texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
  }
  const transmissionTextures = new Map<string, T.Texture>();
  const transmissionPaths = new Set(
    materialLighting.materials.flatMap((entry) => entry.foliage?.transmission?.texture ?? []),
  );
  await Promise.all(
    [...transmissionPaths].map(async (path) => {
      const texture = await new T.TextureLoader().loadAsync(assetUrl(path));
      texture.flipY = false;
      texture.colorSpace = T.SRGBColorSpace;
      transmissionTextures.set(path, texture);
    }),
  );
  return {
    irradiance,
    shadows,
    directional,
    materialLighting,
    native,
    transmissionTextures,
    layers,
    barns,
    surfaceLookup,
    reflections,
    environmentTextures: environmentBundle.textures,
    occlusionTextures: occlusionBundle.textures,
    generic,
    gpuProbes,
  };
}

// Coordinates, lightmap/probe selection and probe fallbacks survive offline simplification.
// Native GPU blocks retain HDR and chart borders; no runtime vertex splitting or ray tracing.
export function applySourceMapLighting(root: T.Object3D, data: SourceMapLighting) {
  const {
    irradiance,
    shadows,
    directional,
    materialLighting,
    native,
    transmissionTextures,
    layers,
    barns,
    surfaceLookup,
    reflections,
    environmentTextures,
    occlusionTextures,
    generic,
    gpuProbes: availableGpuProbes,
  } = data;
  const barnMasks = new Map<T.Material, number>();
  const reflectionCandidates = new Map<T.Material, Set<number>>();
  if (barns || reflections) {
    root.updateMatrixWorld(true);
    const bounds = new T.Box3();
    root.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      bounds.copy(object.geometry.boundingBox!).applyMatrix4(object.matrixWorld);
      let mask = 0;
      barns?.forEach((barn, index) => {
        if (bounds.intersectsBox(barn)) mask |= 1 << index;
      });
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        barnMasks.set(material, (barnMasks.get(material) ?? 0) | mask);
        if (reflections) {
          let candidates = reflectionCandidates.get(material);
          if (!candidates) reflectionCandidates.set(material, (candidates = new Set()));
          for (const index of sourceReflectionCandidates(bounds, reflections))
            candidates.add(index);
        }
      }
    });
  }
  const materialPaths = new Map<T.Material, { probe: boolean; lightmap: boolean }>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    if (!object.geometry.hasAttribute("sourceUv")) bindSourceMapAttributes(object.geometry);
    const uv = object.geometry.getAttribute("sourceUv");
    let probe = false,
      lightmap = false;
    for (let i = 0; i < uv.count && !(probe && lightmap); i++) {
      if (uv.getX(i) < 0.5 / 65535) probe = true;
      else lightmap = true;
    }
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      const previous = materialPaths.get(material);
      materialPaths.set(material, {
        probe: probe || !!previous?.probe,
        lightmap: lightmap || !!previous?.lightmap,
      });
    }
  });
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    // Source multiplies baked visibility by the cached real-time sun shadow.
    object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (patched.has(material)) continue;
      patched.add(material);
      const lightingPath = materialPaths.get(material)!;
      const gpuProbes = lightingPath.probe ? availableGpuProbes : undefined;
      const nativeMaterial = materialLighting.materials.find(
        (entry) => entry.name === material.name,
      );
      if (material instanceof T.MeshStandardMaterial) {
        if (nativeMaterial?.surface?.metalness !== undefined)
          material.metalness = nativeMaterial.surface.metalness;
        if (nativeMaterial?.surface?.metalness !== undefined || material.metalness === 0)
          material.metalnessMap = null;
        if (nativeMaterial?.constantAO === 1) material.aoMap = null;
        if (nativeMaterial?.selfIllumination)
          applySourceSelfIllumination(material, nativeMaterial.selfIllumination);
        if (nativeMaterial?.foliage?.alphaCoverage)
          material.alphaTest = nativeMaterial.foliage.alphaCoverage.reference;
      }
      const foliage = nativeMaterial?.foliage;
      let nativeAOTexture: T.Texture | undefined;
      if (nativeMaterial?.nativeAOTexture && material instanceof T.MeshStandardMaterial) {
        const original = material.aoMap;
        const texture = occlusionTextures?.get(nativeMaterial.nativeAOTexture);
        if (!texture || !original) throw new Error("Native material AO texture/UV mapping missing");
        nativeAOTexture = texture.clone();
        nativeAOTexture.offset.copy(original.offset);
        nativeAOTexture.repeat.copy(original.repeat);
        nativeAOTexture.center.copy(original.center);
        nativeAOTexture.rotation = original.rotation;
        nativeAOTexture.channel = original.channel;
        material.aoMap = nativeAOTexture;
      }
      const genericMaterial = generic?.materials[material.name];
      if (genericMaterial && material instanceof T.MeshStandardMaterial) {
        const color = generic!.textures.get(genericMaterial.color);
        const normal = generic!.textures.get(genericMaterial.normal);
        if (!color || !normal || !material.map || !material.normalMap)
          throw new Error("Native generic texture/UV mapping missing");
        material.map = sourceTextureWithUV(color, material.map);
        material.normalMap = sourceTextureWithUV(normal, material.normalMap);
        material.roughnessMap = null;
      }
      const surface = nativeMaterial?.surface;
      const environment = nativeMaterial?.environment;
      if (environment && material instanceof T.MeshStandardMaterial) {
        if (!environmentTextures) throw new Error("Native environment textures missing");
        for (const key of ["color", "normal", "height"])
          if (!environmentTextures.has(key))
            throw new Error(`Native environment texture missing: ${key}`);
        material.map = environmentTextures.get("color")!;
        material.normalMap = environmentTextures.get("normal")!;
        material.roughnessMap = material.metalnessMap = material.aoMap = null;
      }
      const environmentCandidates =
        (surface?.indirectSpecular || nativeMaterial?.localReflections) && reflections
          ? [...(reflectionCandidates.get(material) ?? [])].sort((a, b) => a - b)
          : undefined;
      const barnMask = barnMasks.get(material) ?? 0;
      const layered = layers?.materials[material.name];
      const surfaceTextures: T.Texture[] = environment ? [...environmentTextures!.values()] : [];
      if (nativeAOTexture) surfaceTextures.push(nativeAOTexture);
      if (layered && layers)
        for (const key of [
          layered.normal1,
          layered.normal2,
          layered.color2,
          layered.mask,
          ...(layered.detail ? [layered.detail.texture] : []),
        ]) {
          const texture = layers.textures.get(key);
          if (texture) surfaceTextures.push(texture);
        }
      const transmissionPath = foliage?.transmission?.texture;
      const transmissionTexture = transmissionPath
        ? transmissionTextures.get(transmissionPath)
        : undefined;
      if (transmissionTexture) surfaceTextures.push(transmissionTexture);
      if (surfaceTextures.length) registerSurfaceTextures(material, surfaceTextures);
      if (layered && material instanceof T.MeshStandardMaterial) {
        if (!object.geometry.hasAttribute("sourceBlend") || !material.map)
          throw new Error("Native layered surface data missing; regenerate the map");
        // Keep the primary UV packing transform for the derivative tangent frame.
        // Native packed normal/roughness samples replace the GLTF approximations.
        material.normalMap = material.map;
        material.roughnessMap = material.metalnessMap = material.aoMap = null;
        material.metalness = layered.metalness;
      }
      if (foliage && !object.geometry.hasAttribute("sourceBackProbe"))
        throw new Error("Native foliage back-probe attributes missing; regenerate the map");
      const cable = material.name === "csgo_placeholder_cable";
      const cableViewport = { value: 1 };
      if (cable)
        material.onBeforeRender = (renderer: T.WebGLRenderer) => {
          cableViewport.value = renderer.getRenderTarget()?.height ?? renderer.domElement.height;
        };
      const prior = material.onBeforeCompile.bind(material);
      const priorKey = material.customProgramCacheKey();
      material.onBeforeCompile = (
        shader: T.WebGLProgramParametersWithUniforms,
        renderer: T.WebGLRenderer,
      ) => {
        prior(shader, renderer);
        if (layered && layers) applySourceLayers(shader, layered, layers.textures);
        // Layered materials construct AO from their own layer inputs first.
        if (surface) applySourceSurface(shader, surface, surfaceLookup);
        if (genericMaterial) applySourceGenericTextures(shader, genericMaterial);
        if (environment)
          applySourceEnvironment(shader, environment, environmentTextures!.get("height")!);
        if (foliage) applySourceFoliage(shader, foliage);
        if (foliage) {
          shader.vertexShader =
            "attribute vec4 sourceBackProbe; varying vec4 vSourceBackProbe;\n" +
            shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            "#include <begin_vertex>\nvSourceBackProbe = sourceBackProbe;",
          );
          shader.fragmentShader = "varying vec4 vSourceBackProbe;\n" + shader.fragmentShader;
          const path = foliage.transmission?.texture;
          applySourceFoliageTransmission(
            shader,
            foliage,
            path ? transmissionTextures.get(path) : undefined,
          );
        }
        if (cable) {
          shader.uniforms.sourceCableViewport = cableViewport;
          shader.vertexShader = "uniform float sourceCableViewport;\n" + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace(
            "#include <color_vertex>",
            `#include <color_vertex>
            #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
              vColor.rgb = vec3(1.0);
            #endif`,
          );
          // F_CLAMP_MIN_RADIUS is enabled in the native material. A 0.75-pixel
          // radial floor keeps its four-sided tube continuous without MSAA;
          // the exact engine floor is not exposed by the compiled material.
          shader.vertexShader = shader.vertexShader.replace(
            "#include <project_vertex>",
            `#include <project_vertex>
            float sourceCableRadius = color.r * 0.0254;
            vec3 sourceCableNormal = normalize(transformedNormal);
            vec3 sourceCableCenter = mvPosition.xyz - sourceCableNormal * sourceCableRadius;
            float sourceCableMinRadius = 1.5 * abs(sourceCableCenter.z) / (max(sourceCableViewport, 1.0) * projectionMatrix[1][1]);
            mvPosition.xyz = sourceCableCenter + sourceCableNormal * max(sourceCableRadius, sourceCableMinRadius);
            gl_Position = projectionMatrix * mvPosition;`,
          );
        }
        applySourceFog(shader);
        shader.uniforms.sourceIrradiance = { value: irradiance };
        shader.uniforms.sourceShadows = { value: shadows };
        shader.uniforms.sourceNative = { value: native ? 1 : 0 };
        shader.uniforms.sourceDirectional = { value: directional ?? irradiance };
        shader.vertexShader =
          `attribute vec2 sourceUv; attribute vec4 sourceProbe; varying vec3 vSourceUv; varying vec4 vSourceProbe;\n` +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>
          float sourceLightmapped = step(0.5 / 65535.0, sourceUv.x);
          float sourceLocalMask = floor(sourceUv.y*65535.0+0.5);
          vec2 sourceLocalShadows = vec2(mod(sourceLocalMask, 256.0), floor(sourceLocalMask/256.0))/255.0;
          vSourceUv=vec3(mix(sourceLocalShadows, sourceUv, sourceLightmapped), sourceLightmapped); vSourceProbe=sourceProbe;`,
        );
        shader.fragmentShader =
          `uniform sampler2D sourceDirectional; uniform float sourceNative; uniform sampler2D sourceIrradiance; uniform sampler2D sourceShadows; varying vec3 vSourceUv; varying vec4 vSourceProbe;\n` +
          shader.fragmentShader;
        let direct =
          `float sourceCoverage = ${lightingPath.probe && lightingPath.lightmap ? "vSourceUv.z" : lightingPath.probe ? "0.0" : "1.0"};\nvec4 sourceBakedShadows = ${lightingPath.lightmap ? "texture2D(sourceShadows, vSourceUv.xy)" : "vec4(0.0)"};\n` +
          (gpuProbes
            ? `SourceGpuProbe sourceFragmentProbe;
sourceFragmentProbe.irradiance=vec3(0.0);sourceFragmentProbe.occlusion=vec4(0.0);
if(sourceCoverage<0.5) sourceFragmentProbe=sourceGpuSample(cameraPosition+transpose(mat3(viewMatrix))*(-vViewPosition), inverseTransformDirection(normal,viewMatrix));
`
            : "") +
          T.ShaderChunk.lights_fragment_begin.replace(
            "getDirectionalLightInfo( directionalLight, directLight );",
            `getDirectionalLightInfo( directionalLight, directLight );\ndirectLight.color *= mix(${gpuProbes ? "1.0-sourceFragmentProbe.occlusion.r" : "vSourceProbe.a"}, 1.0-sourceBakedShadows.r, sourceCoverage);`,
          );
        if (foliage?.transmission)
          direct = direct.replaceAll(
            "RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );",
            `RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
            sourceTransmittedLight += max(-dot(nonPerturbedNormal, directLight.direction), 0.0) * directLight.color * sourceTransmissionColor * RECIPROCAL_PI;`,
          );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_begin>",
          direct,
        );
        applySourceBarns(shader, {
          mask: barnMask,
          shadows: gpuProbes
            ? "mix(sourceFragmentProbe.occlusion.gb, sourceBakedShadows.gb, sourceCoverage)"
            : "mix(vSourceUv.xy, sourceBakedShadows.gb, sourceCoverage)",
          transmission: foliage?.transmission ? "sourceTransmissionColor" : undefined,
        });
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_maps>",
          `#include <lights_fragment_maps>
          vec4 sourceLight = texture2D(sourceIrradiance, vSourceUv.xy);
          vec3 sourceDiffuse = sourceLight.rgb * sourceLight.rgb * 16.0;
          if (sourceNative > 0.5) {
            ${
              foliage?.nonDirectional
                ? "sourceDiffuse = sourceLight.rgb;"
                : `
            vec3 sourceDirection = texture2D(sourceDirectional, vSourceUv.xy).rgb;
            vec2 directionXY = sourceDirection.xy * 2.0 - 1.0;
            const float maxXY = 0.996190805;
            directionXY *= maxXY / max(maxXY, length(directionXY));
            float directionZ = sqrt(max(1.0 - dot(directionXY, directionXY), 0.0));
            float curvature = length(fwidth(nonPerturbedNormal)) * 0.0254 / max(length(fwidth(vViewPosition)), 1e-6);
            float flatness = (1.0 - smoothstep(0.01, 0.1, curvature)) * 0.8;
            float zScale = mix(1.0, mix(0.1, 2.0, clamp((1.0-directionZ)*1.5, 0.0, 1.0)), flatness);
            vec3 lightTs = normalize(vec3(directionXY, directionZ * zScale));
            vec3 normalTs = vec3(0.0, 0.0, 1.0);
            #ifdef USE_NORMALMAP_TANGENTSPACE
              normalTs = normalize(mapN);
            #endif
            vec3 nonDirectional = sourceLight.rgb * sourceDirection.z;
            sourceDiffuse = nonDirectional + max(dot(lightTs, normalTs), 0.0) * (sourceLight.rgb - nonDirectional) / lightTs.z;
            `
            }
          }
          vec3 sourceSurfaceProbe = ${foliage && !foliage.dontFlipBackfaceNormals ? "gl_FrontFacing ? vSourceProbe.rgb : vSourceBackProbe.rgb" : "vSourceProbe.rgb"};
          irradiance = mix(${gpuProbes ? "sourceFragmentProbe.irradiance" : "sourceSurfaceProbe * sourceSurfaceProbe * 16.0"}, sourceDiffuse, sourceCoverage) * PI;
          ${
            foliage?.transmission
              ? `vec3 sourceOppositeProbe = ${foliage.dontFlipBackfaceNormals ? "vSourceBackProbe.rgb" : "gl_FrontFacing ? vSourceBackProbe.rgb : vSourceProbe.rgb"};
          ${gpuProbes ? "if(sourceCoverage<0.5) sourceTransmittedLight += sourceGpuSample(cameraPosition+transpose(mat3(viewMatrix))*(-vViewPosition), -inverseTransformDirection(normal,viewMatrix)).irradiance * sourceTransmissionColor;" : "sourceTransmittedLight += sourceOppositeProbe * sourceOppositeProbe * 16.0 * sourceTransmissionColor * (1.0 - sourceCoverage);"}`
              : ""
          }
          iblIrradiance = vec3(0.0);
        `,
        );
        if (!lightingPath.lightmap) {
          const start = shader.fragmentShader.indexOf(
            "vec4 sourceLight = texture2D(sourceIrradiance,",
          );
          const end = shader.fragmentShader.indexOf("vec3 sourceSurfaceProbe =", start);
          if (start < 0 || end < 0) throw new Error("Native probe shader lighting block missing");
          shader.fragmentShader =
            shader.fragmentShader.slice(0, start) +
            "vec3 sourceDiffuse=vec3(0.0);\n" +
            shader.fragmentShader.slice(end);
        }
        if (reflections && environmentCandidates)
          applySourceReflections(shader, reflections, environmentCandidates);
        if (gpuProbes) applySourceGpuProbes(shader, gpuProbes);
        applySourceSunShadows(shader);
      };
      material.customProgramCacheKey = () =>
        priorKey +
        "-native-source-lighting-v12" +
        (gpuProbes ? ":fragment-probes" : "") +
        `:barns-${barnMask}` +
        (surface
          ? `:surface-${surface.directSpecular}-${surface.indirectSpecular}-${!!surface.nativeAO}`
          : "") +
        (environmentCandidates ? ":native-environments" : "") +
        (environment ? ":environment-inputs" : "") +
        (genericMaterial ? ":generic-packed-inputs" : "") +
        (layered
          ? `:layers-${layered.fancy}-${!!layered.detail}-${layered.specularIndirect}`
          : "") +
        (cable ? ":cable-radius" : "") +
        (foliage
          ? `:foliage-${!!foliage.dontFlipBackfaceNormals}-${!!foliage.heightGradient}`
          : "") +
        (foliage?.transmission
          ? foliage.transmission.useAlbedo
            ? ":transmission-albedo"
            : ":transmission-texture"
          : "");
      material.needsUpdate = true;
    }
  });
  return { irradiance, shadows, directional };
}
