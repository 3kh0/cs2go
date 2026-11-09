import * as T from "three";
import { fetchGzipped } from "./gltf";

export type NativeFilmicParameters = {
  m_flShoulderStrength: number;
  m_flLinearStrength: number;
  m_flLinearAngle: number;
  m_flToeStrength: number;
  m_flToeNum: number;
  m_flToeDenom: number;
  m_flWhitePoint: number;
  m_flExposureBias: number;
};
export type NativeMapPostprocess = {
  lut: string;
  tonemap: NativeFilmicParameters;
  /** Fixed authored exposure; automatic eye adaptation remains a browser approximation. */
  exposure?: number;
};
export type NativeMapGrade = {
  texture: T.Data3DTexture;
  parameters: NativeFilmicParameters;
  exposure: number;
};
const enabled = { value: 0 };
const lut = { value: null as T.Data3DTexture | null };
const abcd = { value: new T.Vector4() };
const efWhiteBias = { value: new T.Vector4() };
const exposure = { value: 1 };

export async function loadNativeMapGrade(config: NativeMapPostprocess): Promise<NativeMapGrade> {
  const parameters = config.tonemap;
  if (
    !parameters ||
    Object.values(parameters).some((value) => !Number.isFinite(value)) ||
    !parameters.m_flToeDenom ||
    !(config.exposure === undefined || config.exposure > 0)
  )
    throw new Error("Invalid native map tone mapping parameters");
  const bytes = new Uint8Array(await fetchGzipped(config.lut));
  const pixels = 32 ** 3;
  if (bytes.length !== pixels * 3 && bytes.length !== pixels * 4)
    throw new Error("Native map color correction must be a 32-cube RGB/RGBA byte volume");
  let rgba = bytes;
  if (bytes.length === pixels * 3) {
    rgba = new Uint8Array(pixels * 4);
    for (let i = 0; i < pixels; i++) {
      rgba[i * 4] = bytes[i * 3];
      rgba[i * 4 + 1] = bytes[i * 3 + 1];
      rgba[i * 4 + 2] = bytes[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    }
  }
  const texture = new T.Data3DTexture(rgba, 32, 32, 32);
  texture.colorSpace = T.NoColorSpace;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return { texture, parameters, exposure: config.exposure ?? 1 };
}

export function activateNativeMapGrade(grade?: NativeMapGrade) {
  enabled.value = grade ? 1 : 0;
  lut.value = grade?.texture ?? null;
  if (!grade) return;
  const p = grade.parameters;
  abcd.value.set(
    p.m_flShoulderStrength,
    p.m_flLinearStrength,
    p.m_flLinearAngle,
    p.m_flToeStrength,
  );
  efWhiteBias.value.set(p.m_flToeNum, p.m_flToeDenom, p.m_flWhitePoint, p.m_flExposureBias);
  exposure.value = grade.exposure;
}

export function showNativeMapGrade(visible: boolean) {
  enabled.value = visible && lut.value ? 1 : 0;
}

/** Homepage/inspection draws retain their own authored exposure and color correction. */
export function withoutNativeMapGrade<T>(draw: () => T): T {
  const previous = enabled.value;
  enabled.value = 0;
  try {
    return draw();
  } finally {
    enabled.value = previous;
  }
}

export function applyNativeMapGrade(
  shader: T.WebGLProgramParametersWithUniforms,
  existingLut?: { value: T.Data3DTexture | null },
) {
  if (shader.uniforms.nativeMapGradeEnabled) return;
  Object.assign(shader.uniforms, {
    nativeMapGradeEnabled: enabled,
    nativeMapGradeABCD: abcd,
    nativeMapGradeEFWhiteBias: efWhiteBias,
    nativeMapGradeExposure: exposure,
  });
  const sampler = existingLut ? "sourceColorCorrection" : "nativeMapGradeLut";
  if (existingLut) {
    // Actors already have a Dust II LUT sampler. Select the current map texture
    // at upload time instead of exceeding the minimum 16 fragment texture units.
    shader.uniforms.sourceColorCorrection = {
      get value() {
        return enabled.value > 0.5 ? lut.value : existingLut.value;
      },
    };
  } else shader.uniforms.nativeMapGradeLut = lut;
  shader.fragmentShader = `uniform float nativeMapGradeEnabled, nativeMapGradeExposure;
    ${existingLut ? "" : "uniform highp sampler3D nativeMapGradeLut;"}
    uniform vec4 nativeMapGradeABCD, nativeMapGradeEFWhiteBias;
    vec3 nativeMapFilmic(vec3 x) {
      float A=nativeMapGradeABCD.x, B=nativeMapGradeABCD.y, C=nativeMapGradeABCD.z, D=nativeMapGradeABCD.w;
      float E=nativeMapGradeEFWhiteBias.x, F=nativeMapGradeEFWhiteBias.y;
      // Algebraically cancel E/F before evaluation; near-equal native coefficients
      // otherwise lose precision when normalizing the shoulder at the white point.
      return (A*(F-E)*x+B*(C*F-E))*x/(F*(A*x*x+B*x+D*F));
    }
    ${shader.fragmentShader}`;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <tonemapping_fragment>",
    `
    vec3 nativeMapUngraded = gl_FragColor.rgb;
    #include <tonemapping_fragment>
    #ifdef TONE_MAPPING
      if (nativeMapGradeEnabled > 0.5) {
        float nativeMapWhite = nativeMapGradeEFWhiteBias.z * 2.8;
        vec3 nativeMapExposed = min(max(nativeMapUngraded, vec3(0.0)) * toneMappingExposure * nativeMapGradeExposure * exp2(nativeMapGradeEFWhiteBias.w) * 2.8, vec3(nativeMapWhite));
        gl_FragColor.rgb = nativeMapFilmic(nativeMapExposed) / nativeMapFilmic(vec3(nativeMapWhite));
      }
    #endif
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <colorspace_fragment>",
    `
    #include <colorspace_fragment>
    if (nativeMapGradeEnabled > 0.5) {
      vec3 nativeMapLutUv = clamp(gl_FragColor.rgb, 0.0, 1.0)*(31.0/32.0)+(0.5/32.0);
      gl_FragColor.rgb = texture(${sampler}, nativeMapLutUv).rgb;
    }
  `,
  );
}

export function gradeNativeMapColors(root: T.Object3D) {
  const materials = new Set<T.Material>();
  root.traverse((object) => {
    if (object instanceof T.Mesh)
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
  });
  for (const material of materials) {
    const compile = material.onBeforeCompile.bind(material),
      key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      compile(shader, renderer);
      applyNativeMapGrade(shader);
    };
    material.customProgramCacheKey = () => `${key}:native-map-vpost-v1`;
    material.needsUpdate = true;
  }
}
