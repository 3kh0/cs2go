import * as T from "three";
import {
  loadNativeLocalCookies,
  nativeLocalCookieSampling,
  type NativeLocalCookieAtlas,
} from "./native-local-light-cookies";
import { assetFetch } from "./asset-url";
import { NativeLightBuffer } from "./native-light-buffer";
import {
  packNativeLocalLights,
  nativeLocalLightKernel,
  type NativeBakedLocalLight,
} from "./native-local-light-kernel";

export interface NativeMapLocalLightDefinition {
  version: 1;
  qualification: string;
  lights: { id: string; record: NativeBakedLocalLight; qualification: unknown }[];
  rejected: unknown[];
  cookies?: NativeLocalCookieAtlas;
}

/** Candidate-only qualified host bridge. The SRV record shape is lowered into
 * a map-owned UBO; native private host packing/live-shadow parity is not claimed. */
export class NativeMapLocalLights {
  readonly buffer: NativeLightBuffer;
  readonly definition: NativeMapLocalLightDefinition;
  readonly cookies?: T.DataArrayTexture;
  private disposed = false;
  private readonly checked = new WeakSet<T.WebGLRenderer>();
  constructor(definition: NativeMapLocalLightDefinition, cookies?: T.DataArrayTexture) {
    this.cookies = cookies;
    this.definition = definition;
    if (
      definition.version !== 1 ||
      !definition.qualification ||
      !definition.lights.length ||
      definition.lights.some((light) => !light.id || !light.qualification)
    )
      throw new Error("Invalid qualified native local-light metadata");
    for (const light of definition.lights)
      if (
        light.record.cookieKind === 1 &&
        (!cookies ||
          !definition.cookies ||
          light.record.cookieLayer! >= definition.cookies.layers.length ||
          definition.cookies.layers[light.record.cookieLayer!]?.resource !==
            light.record.cookieResource ||
          cookies.image.depth !== definition.cookies.layers.length ||
          cookies.image.width !== definition.cookies.width ||
          cookies.image.height !== definition.cookies.height)
      )
        throw new Error("Native planar cookie binding unavailable");
    // Browser metres = .0254*(SourceX,SourceZ,-SourceY).
    const sourceToWorld = new T.Matrix4().set(
      0.0254,
      0,
      0,
      0,
      0,
      0,
      0.0254,
      0,
      0,
      -0.0254,
      0,
      0,
      0,
      0,
      0,
      1,
    );
    this.buffer = new NativeLightBuffer(
      packNativeLocalLights(
        definition.lights.map((light) => light.record),
        sourceToWorld.clone().invert().toArray(),
        sourceToWorld.toArray(),
      ),
    );
  }
  render<Value>(renderer: T.WebGLRenderer, draw: () => Value) {
    if (this.cookies && !this.checked.has(renderer)) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl.isContextLost()) return this.buffer.withBinding(renderer, draw);
      if (
        this.cookies.image.width > renderer.capabilities.maxTextureSize ||
        this.cookies.image.height > renderer.capabilities.maxTextureSize ||
        this.cookies.image.depth > gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS)
      )
        throw new Error("Native cookie array exceeds GPU capacity");
      this.checked.add(renderer);
    }
    return this.buffer.withBinding(renderer, draw);
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.buffer.dispose();
    this.cookies?.dispose();
  }
}
export async function loadNativeMapLocalLights(path: string) {
  const response = await assetFetch(path);
  if (!response.ok) throw new Error("Qualified native local lights unavailable");
  const definition = (await response.json()) as NativeMapLocalLightDefinition;
  const directory = path.slice(0, path.lastIndexOf("/") + 1);
  const cookies = definition.cookies
    ? await loadNativeLocalCookies(directory, definition.cookies)
    : undefined;
  try {
    return new NativeMapLocalLights(definition, cookies);
  } catch (error) {
    cookies?.dispose();
    throw error;
  }
}

const contribution = /* glsl */ `
{
 vec3 localWorld=cameraPosition+transpose(mat3(viewMatrix))*(-vViewPosition);
 vec3 localSource=(nativeLocalWorldToSource*vec4(localWorld,1.)).xyz;
 vec4 localMask=NATIVE_LOCAL_LIGHT_MASK;
 for(uint localIndex=0u;localIndex<nativeLocalCount.x;localIndex++){
  NativeLocalLightSample localSample=nativeBakedLocalLight(nativeLocalRecords[localIndex],localSource,localMask);
  if(!localSample.enabled)continue;
  NATIVE_LOCAL_COOKIE_CONTRIBUTION
  if(all(equal(localSample.color,vec3(0.))))continue;
  vec3 localL=normalize(mat3(viewMatrix)*mat3(nativeLocalSourceToWorld)*localSample.direction);
  float localNoL=max(0.,dot(geometryNormal,localL));
  float localR=max(material.roughness,localSample.minimumRoughness);
  vec3 localH=normalize(localL+geometryViewDir);
  float localNoH=dot(localH,geometryNormal);
  float localR2=localR*localR;
  float localD=localR2/(localNoH*localNoH*(localR2*localR2-1.)+1.);
  float localK=(localR+1.)*(localR+1.)*.125;
  float localV=4.*(localNoL*(1.-localK)+localK)*(max(0.,dot(geometryNormal,geometryViewDir))*(1.-localK)+localK);
  vec3 localF=material.specularColorBlended+(vec3(1.)-material.specularColorBlended)*pow(max(.000001,1.-max(0.,dot(localL,localH))),5.);
  reflectedLight.directDiffuse+=localNoL*localSample.color*material.diffuseContribution;
  if(NATIVE_LOCAL_SPECULAR_ENABLED)reflectedLight.directSpecular+=localF*(localD*localD/localV)*localNoL*localSample.color;
 }
}
`;

/** Called AFTER native material/lighting/probe adapters. The wrapper inserts its
 * contribution before invoking those callbacks so their original AO and native
 * indirect-light ordering also covers this contribution. Material objects are
 * retained: no clone defines/depth hooks/owned resources are discarded. */
export function applyNativeMapLocalLights(root: T.Object3D, lights: NativeMapLocalLights) {
  const patched = new Set<T.Material>(),
    held = new Set<string>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof T.MeshStandardMaterial) || patched.has(material)) continue;
      const family = material.userData.nativeSourceFamily;
      const visibility = material.userData.nativeBakedVisibility;
      const specular = material.userData.nativeLocalDirectSpecular !== false;
      if (
        !["complex", "legacy", "environment", "lightmapped"].includes(family) ||
        !["atlas", "probe"].includes(visibility) ||
        material.userData.nativeLocalLightResponse === "wetness" ||
        Object.hasOwn(material.userData, "nativeComplexDoNotCastShadows")
      ) {
        held.add(material.name);
        continue;
      }
      patched.add(material);
      const prior = material.onBeforeCompile.bind(material),
        key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        if (!shader.fragmentShader.includes("#include <lights_fragment_end>"))
          throw new Error(`Qualified local-light insertion unavailable: ${material.name}`);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <lights_fragment_end>",
          contribution.replace("NATIVE_LOCAL_SPECULAR_ENABLED", String(specular)) +
            "\n#include <lights_fragment_end>",
        );
        prior(shader, renderer);
        const mask = shader.fragmentShader.includes("uniform sampler2D nativeMapShadows")
          ? "texture2D(nativeMapShadows,vNativeMapLightUv)"
          : shader.fragmentShader.includes("SourceGpuProbe nativePropProbe")
            ? "nativePropProbe.occlusion"
            : undefined;
        if (!mask)
          throw new Error(`Qualified local-light baked visibility unavailable: ${material.name}`);
        if (
          !shader.fragmentShader.includes("specularColorBlended") ||
          !shader.fragmentShader.includes("diffuseContribution")
        )
          throw new Error(
            `Qualified local-light native material response unavailable: ${material.name}`,
          );
        shader.fragmentShader = shader.fragmentShader.replace("NATIVE_LOCAL_LIGHT_MASK", mask);
        if (lights.cookies) shader.uniforms.nativeLocalCookies = { value: lights.cookies };
        shader.fragmentShader = shader.fragmentShader.replace(
          "NATIVE_LOCAL_COOKIE_CONTRIBUTION",
          lights.cookies
            ? "if(localSample.cookieUVW.z>=0.)localSample.color*=nativeLocalCookieSample(localSample.cookieUVW);"
            : "",
        );
        shader.fragmentShader =
          (lights.cookies ? nativeLocalCookieSampling : "") +
          nativeLocalLightKernel +
          `\nlayout(std140) uniform NativeMapLocalLightBlock {
 mat4 nativeLocalWorldToSource;mat4 nativeLocalSourceToWorld;uvec4 nativeLocalCount;
 NativeBakedLocalLight nativeLocalRecords[${lights.definition.lights.length}];
};\n` +
          shader.fragmentShader;
      };
      material.customProgramCacheKey = () =>
        `${key}:qualified-local-lights:${lights.definition.lights.length}:${specular}:cookies${!!lights.cookies}`;
      material.needsUpdate = true;
    }
  });
  return { materials: patched.size, held: [...held] };
}
