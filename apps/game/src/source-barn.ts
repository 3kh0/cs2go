import * as T from "three";
import { assetFetch } from "./asset-url";

interface Barn {
  id: string;
  bakedShadowIndex: number;
  frustum: number[];
  obb: number[];
  position: number[];
  color: number[];
  skirt: number[];
  edge: number[];
  minRoughness: number;
  bounds: number[][];
}
const ready = { value: 0 };
const lights = {
  value: Array.from({ length: 2 }, () => ({
    frustum: new T.Matrix4(),
    obb: new T.Matrix4(),
    position: new T.Vector4(0, 0, 0, 1),
    color: new T.Vector3(),
    skirt: new T.Vector2(),
    edge: new T.Vector3(),
    minRoughness: 0.04,
    boundsMin: new T.Vector3(),
    boundsMax: new T.Vector3(),
  })),
};
let pending: Promise<T.Box3[]> | undefined;
export function loadSourceBarns() {
  pending ??= assetFetch("/models/maps/lighting/barn-source.json").then(async (response) => {
    if (!response.ok) throw new Error("Native barn-light metadata unavailable");
    const data = (await response.json()) as { lights: Barn[] };
    if (
      data.lights.length !== 2 ||
      data.lights.some((light, i) => light.bakedShadowIndex !== i + 1)
    )
      throw new Error("Unexpected native stationary barn lights");
    const bounds = data.lights.map((light, i) => {
      const uniform = lights.value[i];
      uniform.frustum.fromArray(light.frustum);
      uniform.obb.fromArray(light.obb);
      uniform.position.fromArray(light.position);
      uniform.color.fromArray(light.color);
      uniform.skirt.fromArray(light.skirt);
      uniform.edge.fromArray(light.edge);
      uniform.minRoughness = light.minRoughness;
      uniform.boundsMin.fromArray(light.bounds[0]);
      uniform.boundsMax.fromArray(light.bounds[1]);
      return new T.Box3(uniform.boundsMin.clone(), uniform.boundsMax.clone());
    });
    ready.value = 1;
    return bounds;
  });
  return pending;
}

// Adapted from VRF 5564866 SceneLight.cs / lighting_barn.slang (MIT).
// Copyright (c) 2015 ValveResourceFormat Contributors; full notice:
// packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt.
// Only the two stationary tunnel barns need runtime direct lighting. Their
// static occlusion is already baked; CT fixtures are fully baked and excluded.
export function applySourceBarns(
  shader: T.WebGLProgramParametersWithUniforms,
  options: {
    mask?: number;
    shadows: string;
    enabled?: string;
    worldPosition?: string;
    worldToLighting?: string;
    transmission?: string;
  },
) {
  const mask = options.mask ?? 3;
  if (!mask) return;
  shader.uniforms.sourceBarnReady = ready;
  shader.uniforms.sourceBarnLights = lights;
  shader.fragmentShader =
    `
    struct SourceBarn {
      mat4 frustum; mat4 obb; vec4 position; vec3 color; vec2 skirt; vec3 edge;
      float minRoughness; vec3 boundsMin; vec3 boundsMax;
    };
    uniform SourceBarn sourceBarnLights[2];
    uniform float sourceBarnReady;
    float sourceBarnSmooth(float a, float b, float x) {
      float t = clamp((x-a)/(b-a), 0.0, 1.0);
      return t*t*(3.0-2.0*t);
    }
    float sourceBarnEdge(vec2 ndc, vec3 edge) {
      vec2 p = abs(ndc);
      if (edge.z == 0.0) {
        float x = edge.x < 1.0 ? sourceBarnSmooth(1.0, edge.x, p.x) : 1.0;
        float y = edge.y < 1.0 ? sourceBarnSmooth(1.0, edge.y, p.y) : 1.0;
        return x*y;
      }
      float power = 2.0/edge.z;
      float inversePower = -0.5*edge.z;
      float inner = edge.x*edge.y*pow(max(pow(edge.y*p.x, power)+pow(edge.x*p.y, power), 1.175e-38), inversePower);
      float outer = pow(max(pow(p.x, power)+pow(p.y, power), 1.175e-38), inversePower);
      return inner < outer ? sourceBarnSmooth(outer, inner, 1.0) : float(outer > 1.0);
    }
    ` + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_end>",
    `
    if (sourceBarnReady > 0.5 && ${options.enabled ?? "1.0"} > 0.5) {
      vec3 sourceBarnWorldRelative = transpose(mat3(viewMatrix)) * (-vViewPosition);
      vec3 sourceBarnWorldPosition = ${options.worldPosition ?? "cameraPosition + sourceBarnWorldRelative"};
      vec2 sourceBarnOcclusion = ${options.shadows};
      for (int sourceBarnIndex = 0; sourceBarnIndex < 2; sourceBarnIndex++) {
        if ((${mask} & (1 << sourceBarnIndex)) == 0) continue;
        SourceBarn barn = sourceBarnLights[sourceBarnIndex];
        if (any(lessThan(sourceBarnWorldPosition, barn.boundsMin)) || any(greaterThan(sourceBarnWorldPosition, barn.boundsMax))) continue;
        float visibility = clamp(1.0-sourceBarnOcclusion[sourceBarnIndex], 0.0, 1.0);
        if (visibility <= 0.0) continue;
        if (any(greaterThan(abs((barn.obb*vec4(sourceBarnWorldPosition, 1.0)).xyz), vec3(1.0)))) continue;
        vec4 clip = barn.frustum*vec4(sourceBarnWorldPosition, 1.0);
        if (clip.w <= 0.0) continue;
        vec3 ndc = clip.xyz/clip.w;
        if (ndc.z <= 0.0 || any(greaterThanEqual(ndc, vec3(1.0))) || any(lessThanEqual(ndc.xy, vec2(-1.0)))) continue;
        float skirt = barn.skirt.x > 0.0 ? sourceBarnSmooth(0.0, 1.0, ndc.z*barn.skirt.x) : 1.0;
        if (barn.skirt.y > 0.0) skirt *= sourceBarnSmooth(0.0, 1.0, (1.0-ndc.z)*barn.skirt.y);
        vec3 delta = barn.position.xyz-sourceBarnWorldPosition;
        float distanceSquared = max(dot(delta, delta), 1e-8);
        float attenuation = barn.position.w/max(distanceSquared, barn.position.w);
        attenuation *= skirt*sourceBarnEdge(ndc.xy, barn.edge)*visibility;
        if (attenuation <= 0.0) continue;
        vec3 worldDirection = delta*inversesqrt(distanceSquared);
        directLight.direction = mat3(viewMatrix)*(${options.worldToLighting ?? "mat3(1.0)"}*worldDirection);
        directLight.color = barn.color*(PI*attenuation);
        directLight.visible = true;
        float originalRoughness = material.roughness;
        material.roughness = max(material.roughness, barn.minRoughness);
        RE_Direct(directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight);
        material.roughness = originalRoughness;
        ${options.transmission ? `sourceTransmittedLight += max(-dot(nonPerturbedNormal, directLight.direction), 0.0)*directLight.color*${options.transmission}*RECIPROCAL_PI;` : ""}
      }
    }
    #include <lights_fragment_end>`,
  );
}
