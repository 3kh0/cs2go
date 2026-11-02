import { assetFetch, assetUrl } from "./asset-url";
import * as T from "three";
import { fetchGzipped } from "./gltf";
import { bindSourceMapAttributes } from "./source-map-attributes";
import { loadSourceLighting } from "./source-lighting";
import { loadSourceColorCorrection } from "./map-color";
import { applySourceFog } from "./source-fog";
import {
  applySourceFoliage,
  applySourceFoliageTransmission,
  type SourceFoliage,
} from "./source-foliage";

interface SourceMaterialLighting {
  materials: { name: string; ambientOcclusionScale?: number; foliage?: SourceFoliage }[];
}

interface SourceMapLighting {
  irradiance: T.Texture;
  shadows: T.Texture;
  directional?: T.Texture;
  materialLighting: SourceMaterialLighting;
  native: boolean;
  transmissionTextures: Map<string, T.Texture>;
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
  const [irradiance, shadows, directional, materialLighting] = await Promise.all([
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
    loadSourceLighting(),
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
  return { irradiance, shadows, directional, materialLighting, native, transmissionTextures };
}

// Coordinates, lightmap/probe selection and probe fallbacks survive offline simplification.
// Native GPU blocks retain HDR and chart borders; no runtime vertex splitting or ray tracing.
export function applySourceMapLighting(root: T.Object3D, data: SourceMapLighting) {
  const { irradiance, shadows, directional, materialLighting, native, transmissionTextures } = data;
  const patched = new Set<T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    bindSourceMapAttributes(object.geometry);
    // Source multiplies baked visibility by the cached real-time sun shadow.
    object.receiveShadow = true;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (patched.has(material)) continue;
      patched.add(material);
      const nativeMaterial = materialLighting.materials.find(
        (entry) => entry.name === material.name,
      );
      if (material instanceof T.MeshStandardMaterial) {
        if (nativeMaterial?.ambientOcclusionScale !== undefined)
          material.aoMapIntensity = nativeMaterial.ambientOcclusionScale;
        if (nativeMaterial?.foliage?.alphaCoverage)
          material.alphaTest = nativeMaterial.foliage.alphaCoverage.reference;
      }
      const foliage = nativeMaterial?.foliage;
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
          `#include <begin_vertex>\nvSourceUv=vec3(sourceUv, step(0.5 / 65535.0, sourceUv.x + sourceUv.y)); vSourceProbe=sourceProbe;`,
        );
        shader.fragmentShader =
          `uniform sampler2D sourceDirectional; uniform float sourceNative; uniform sampler2D sourceIrradiance; uniform sampler2D sourceShadows; varying vec3 vSourceUv; varying vec4 vSourceProbe;\n` +
          shader.fragmentShader;
        let direct =
          "float sourceCoverage = vSourceUv.z;\n" +
          T.ShaderChunk.lights_fragment_begin.replace(
            "getDirectionalLightInfo( directionalLight, directLight );",
            "getDirectionalLightInfo( directionalLight, directLight );\ndirectLight.color *= mix(vSourceProbe.a, 1.0-texture2D(sourceShadows,vSourceUv.xy).r, sourceCoverage);",
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
          vec3 sourceSurfaceProbe = ${foliage ? "gl_FrontFacing ? vSourceProbe.rgb : vSourceBackProbe.rgb" : "vSourceProbe.rgb"};
          irradiance = mix(sourceSurfaceProbe * sourceSurfaceProbe * 16.0, sourceDiffuse, sourceCoverage) * PI;
          ${
            foliage?.transmission
              ? `vec3 sourceOppositeProbe = gl_FrontFacing ? vSourceBackProbe.rgb : vSourceProbe.rgb;
          sourceTransmittedLight += sourceOppositeProbe * sourceOppositeProbe * 16.0 * sourceTransmissionColor * (1.0 - sourceCoverage);`
              : ""
          }
          iblIrradiance = vec3(0.0);
        `,
        );
      };
      material.customProgramCacheKey = () =>
        priorKey +
        "-native-source-lighting-v6" +
        (cable ? ":cable-radius" : "") +
        (foliage ? ":foliage" : "") +
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
