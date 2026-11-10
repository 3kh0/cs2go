import * as T from "three";
import { assetFetch } from "./asset-url";
import { loadNativeCube, type NativeCube } from "./native-cube";
import { sourceCubeSampling } from "./source-reflections";
import { isNativeMod2x } from "./native-static-overlay";

export interface NativeGradientFog {
  distance: [number, number, number];
  height?: [number, number, number];
  color: [number, number, number];
  strength: number;
  opacity: number;
}
export interface NativeCubemapFog {
  distance: [number, number, number];
  height?: [number, number, number];
  opacity: number;
  lodBias: number;
  exposure: number;
  angles: [number, number, number];
  texture: NativeCube;
}
export interface NativeFogDefinition {
  gradient?: NativeGradientFog;
  cube?: NativeCubemapFog;
  disabledMaterials?: string[];
}
export function nativeFogParameters(definition: NativeFogDefinition) {
  const gradient = definition.gradient,
    cube = definition.cube;
  const distance = (range: number[]) => {
    const [start, end, exponent] = range;
    if (![start, end, exponent].every(Number.isFinite) || end <= start || exponent <= 0)
      throw new Error("Invalid native fog distance range");
    return [-start / (end - start), 1 / (end - start), exponent];
  };
  const height = (range?: number[]) => {
    if (!range) return [1, 0, 1];
    const [start, end, exponent] = range;
    if (![start, end, exponent].every(Number.isFinite) || exponent <= 0)
      throw new Error("Invalid native fog height range");
    if (start === end) return [1, 0, 1];
    return [end / (end - start), -1 / (end - start), exponent];
  };
  const opacity = (value: number) => {
    if (!Number.isFinite(value) || value < 0 || value > 1)
      throw new Error("Invalid native fog opacity");
    return value;
  };
  const gd = gradient ? distance(gradient.distance) : [0, 0, 1];
  const gh = height(gradient?.height);
  const cd = cube ? distance(cube.distance) : [0, 0, 1];
  const ch = height(cube?.height);
  const culling = (range?: number[]) => {
    if (!range || range[0] === range[1]) return new T.Vector2(1, 0);
    const sign = Math.sign(range[1] - range[0]);
    return new T.Vector2(range[1] * sign, sign);
  };
  if (
    gradient &&
    (!gradient.color.every((v) => Number.isFinite(v) && v >= 0) ||
      !Number.isFinite(gradient.strength) ||
      gradient.strength < 0)
  )
    throw new Error("Invalid native gradient fog color");
  if (
    cube &&
    (!cube.angles.every(Number.isFinite) ||
      !Number.isFinite(cube.exposure) ||
      cube.exposure < 0 ||
      !Number.isFinite(cube.lodBias))
  )
    throw new Error("Invalid native cubemap fog environment");
  const rotation = new T.Matrix4();
  if (cube) {
    const [pitch, yaw, roll] = cube.angles.map(T.MathUtils.degToRad);
    rotation
      .makeRotationZ(yaw)
      .multiply(new T.Matrix4().makeRotationY(pitch))
      .multiply(new T.Matrix4().makeRotationX(roll))
      .invert();
  }
  return {
    gradientBiasScale: new T.Vector4(gd[0], gh[0], gd[1], gh[1]),
    gradientExponents: new T.Vector2(gd[2], gh[2]),
    gradientColorOpacity: new T.Vector4(
      ...((gradient?.color.map((v) => v * gradient.strength) ?? [0, 0, 0]) as [
        number,
        number,
        number,
      ]),
      gradient ? opacity(gradient.opacity) : 0,
    ),
    cubeDistance: new T.Vector4(cd[0], cd[1], cube?.lodBias ?? 0, cd[2]),
    cubeHeight: new T.Vector4(
      ch[0],
      ch[1],
      ch[2],
      cube ? Math.max(0, Math.log2(cube.texture.mips[0].width) - 3) : 0,
    ),
    cubeExposureOpacity: new T.Vector2(cube?.exposure ?? 0, cube ? opacity(cube.opacity) : 0),
    cubeRotation: new T.Matrix3().setFromMatrix4(rotation),
    gradientCull: new T.Vector3(
      (gradient?.distance[0] ?? 0) ** 2,
      culling(gradient?.height).x,
      culling(gradient?.height).y,
    ),
    cubeCull: new T.Vector3(
      (cube?.distance[0] ?? 0) ** 2,
      culling(cube?.height).x,
      culling(cube?.height).y,
    ),
  };
}

export interface NativeMapFog {
  definition: NativeFogDefinition;
  parameters: ReturnType<typeof nativeFogParameters>;
  cube?: T.Texture;
}

export async function loadNativeMapFog(
  renderer: T.WebGLRenderer,
  path: string,
): Promise<NativeMapFog> {
  const response = await assetFetch(path);
  if (!response.ok) throw new Error("Native map fog definition unavailable");
  const definition = (await response.json()) as NativeFogDefinition;
  const parameters = nativeFogParameters(definition);
  const directory = path.slice(0, path.lastIndexOf("/") + 1);
  const cube = definition.cube
    ? await loadNativeCube(renderer, directory, definition.cube.texture)
    : undefined;
  return { definition, parameters, cube };
}

// The distance/height product and gradient-before-cube ordering follow the
// retained native Nuke PS fog helpers. Entity-to-view constant packing and
// runtime activation remain an adaptation, recorded in each source manifest.
export function applyNativeFogShader(
  shader: T.WebGLProgramParametersWithUniforms,
  fog: NativeMapFog,
  blend: "ordinary" | "additive" | "mod2x" = "ordinary",
  worldToSource = new T.Matrix4().set(
    1 / 0.0254,
    0,
    0,
    0,
    0,
    0,
    -1 / 0.0254,
    0,
    0,
    1 / 0.0254,
    0,
    0,
    0,
    0,
    0,
    1,
  ),
) {
  if (shader.uniforms.nativeFogGradient) return;
  const p = fog.parameters;
  Object.assign(shader.uniforms, {
    nativeFogGradient: { value: p.gradientBiasScale },
    nativeFogGradientExponents: { value: p.gradientExponents },
    nativeFogGradientColor: { value: p.gradientColorOpacity },
    nativeFogCubeDistance: { value: p.cubeDistance },
    nativeFogCubeHeight: { value: p.cubeHeight },
    nativeFogCubeExposure: { value: p.cubeExposureOpacity },
    nativeFogCubeRotation: { value: p.cubeRotation },
    nativeFogWorldToSource: { value: worldToSource },
    nativeFogGradientCull: { value: p.gradientCull },
    nativeFogCubeCull: { value: p.cubeCull },
  });
  const cubeFunctions = fog.cube
    ? sourceCubeSampling
        .replaceAll("SOURCE_REFLECTION_CUBE_SIZE", "NATIVE_FOG_CUBE_SIZE")
        .replaceAll("SOURCE_REFLECTION_ARRAY_SPLIT", "NATIVE_FOG_ARRAY_SPLIT")
        .replaceAll("SOURCE_REFLECTION_SINGLE_ARRAY", "NATIVE_FOG_SINGLE_ARRAY")
        .replaceAll("sourceReflectionCubes", "nativeFogCubes")
        .replaceAll("sourceCube", "nativeFogCube")
    : "";
  if (fog.cube) shader.uniforms.nativeFogCubes0 = { value: fog.cube };
  shader.vertexShader = "varying vec3 vNativeFogWorld;\n" + shader.vertexShader;
  const position = "vNativeFogWorld=cameraPosition+transpose(mat3(viewMatrix))*mvPosition.xyz;";
  if (shader.vertexShader.includes("#include <project_vertex>")) {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\n" + position,
    );
  } else if (
    /gl_Position\s*=\s*projectionMatrix\s*\*\s*(mvPosition|mv)\s*;/.test(shader.vertexShader)
  ) {
    // Native water has already expanded project_vertex to apply its authored
    // plane displacement. Read that final view-space point, not the original
    // undisplaced mesh position or a second reconstruction of the vertex.
    shader.vertexShader = shader.vertexShader.replace(
      /gl_Position\s*=\s*projectionMatrix\s*\*\s*(mvPosition|mv)\s*;/g,
      "$&\nvNativeFogWorld=cameraPosition+transpose(mat3(viewMatrix))*$1.xyz;",
    );
  } else throw new Error("Native fog vertex world position unavailable");
  const cubeSize = fog.definition.cube?.texture.mips[0].width ?? 1;
  shader.fragmentShader =
    `
#define NATIVE_FOG_CUBE_SIZE ${cubeSize}
#define NATIVE_FOG_SINGLE_ARRAY
${cubeFunctions}
varying vec3 vNativeFogWorld;
uniform mat4 nativeFogWorldToSource;
uniform vec4 nativeFogGradient, nativeFogGradientColor;
uniform vec2 nativeFogGradientExponents;
uniform vec4 nativeFogCubeDistance, nativeFogCubeHeight;
uniform vec2 nativeFogCubeExposure;
uniform mat3 nativeFogCubeRotation;
uniform vec3 nativeFogGradientCull, nativeFogCubeCull;
void nativeFogApply(inout vec3 color) {
  vec3 position=(nativeFogWorldToSource*vec4(vNativeFogWorld,1.0)).xyz;
  vec3 relative=(nativeFogWorldToSource*vec4(vNativeFogWorld-cameraPosition,0.0)).xyz;
  float distance=length(relative);
  float distanceSquared=dot(relative,relative);
  vec2 g=pow(clamp(vec2(distance,position.z)*nativeFogGradient.zw+nativeFogGradient.xy,vec2(0.0),vec2(1.0)),nativeFogGradientExponents);
  float gradient=distanceSquared>nativeFogGradientCull.x && position.z*nativeFogGradientCull.z<nativeFogGradientCull.y ? g.x*g.y*nativeFogGradientColor.a : 0.0;
  ${blend === "ordinary" ? "color=mix(color,nativeFogGradientColor.rgb,gradient);" : blend === "mod2x" ? "color=mix(vec3(.5),color,1.0-gradient);" : "color*=1.0-gradient;"}
  ${
    fog.cube
      ? `
  if(distanceSquared>nativeFogCubeCull.x && position.z*nativeFogCubeCull.z<nativeFogCubeCull.y) {
  float d=pow(max(distance*nativeFogCubeDistance.y+nativeFogCubeDistance.x,0.0),nativeFogCubeDistance.w);
  float h=pow(max(position.z*nativeFogCubeHeight.y+nativeFogCubeHeight.x,0.0),nativeFogCubeHeight.z);
  float blend=clamp(d,0.0,1.0)*clamp(h,0.0,1.0);
  float opacity=blend*nativeFogCubeExposure.y;
  ${
    blend === "ordinary"
      ? `float lod=clamp(1.0-blend*nativeFogCubeDistance.z,0.0,1.0)*nativeFogCubeHeight.w;
  vec3 cubeColor=nativeFogCubeSample(nativeFogCubeRotation*normalize(relative),0,lod)*nativeFogCubeExposure.x;
  color=mix(color,cubeColor,opacity);`
      : blend === "mod2x"
        ? "color=mix(vec3(.5),color,1.0-opacity);"
        : "color*=1.0-opacity;"
  }
  }
  `
      : ""
  }
}
` + shader.fragmentShader;
  if (shader.fragmentShader.includes("#include <tonemapping_fragment>"))
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <tonemapping_fragment>",
      "nativeFogApply(gl_FragColor.rgb);\n#include <tonemapping_fragment>",
    );
  else
    // The separate sky FX pass writes linear HDR and has no tone-mapping chunk.
    shader.fragmentShader = shader.fragmentShader.replace(
      /\}\s*$/,
      "nativeFogApply(gl_FragColor.rgb);\n}",
    );
}

export function applyNativeMapFog(root: T.Object3D, fog: NativeMapFog, worldToSource?: T.Matrix4) {
  const patched = new Set<T.Material>();
  const disabled = new Set(fog.definition.disabledMaterials);
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (
        patched.has(material) ||
        material.userData.nativeSourceFamily === "glass" ||
        material.userData.nativeFogRequested === false ||
        (!material.fog && material.userData.nativeFogRequested !== true) ||
        disabled.has(material.name)
      )
        continue;
      patched.add(material);
      const compile = material.onBeforeCompile.bind(material),
        key = material.customProgramCacheKey();
      const blend = isNativeMod2x(material)
        ? "mod2x"
        : material.blending === T.AdditiveBlending
          ? "additive"
          : "ordinary";
      material.onBeforeCompile = (
        shader: T.WebGLProgramParametersWithUniforms,
        renderer: T.WebGLRenderer,
      ) => {
        compile(shader, renderer);
        applyNativeFogShader(shader, fog, blend, worldToSource);
      };
      material.customProgramCacheKey = () =>
        `${key}:native-fog:${blend}:${fog.definition.cube?.texture.mips[0].width ?? 0}`;
      material.needsUpdate = true;
    }
  });
}
