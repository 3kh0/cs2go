import * as T from "three";
import { NativeLightBuffer } from "../src/native-light-buffer";
import {
  packNativeLocalLights,
  nativeLocalLightKernel,
  type NativeBakedLocalLight,
} from "../src/native-local-light-kernel";
const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function record(): NativeBakedLocalLight {
  return {
    projection: I,
    worldToBounds: I,
    positionRadius: [0, 0, 1, 0],
    depthFalloff: [1, 0, 0, 0],
    color: [2, 4, 6],
    rotation: [0, 0, 0, 1],
    angularLine: [1, 0, 0],
    barn: [0.5, 0.5, 0],
    shadowWeights: [0, 0, 0, 0],
    minimumRoughness: 0.2,
    cookieKind: 0,
  };
}
/** Synthetic resolved record values distinguish native branches. Expected
 * vectors are independent hand calculations, not an entity-upload claim. */
export function renderNativeLocalLightKernel() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const material = new T.ShaderMaterial({
    glslVersion: T.GLSL3,
    uniforms: {
      nativeProbePosition: { value: new T.Vector3() },
      shadow: { value: new T.Vector4() },
      mode: { value: 0 },
    },
    vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `precision highp float;precision highp int;${nativeLocalLightKernel}\nlayout(std140) uniform NativeLocalLights {mat4 worldToSource;mat4 sourceToWorld;uvec4 counts;NativeBakedLocalLight records[1];};uniform vec3 nativeProbePosition;uniform vec4 shadow;uniform int mode;out vec4 result;void main(){if(counts.x!=1u){result=vec4(1,0,1,1);return;}NativeLocalLightSample s=nativeBakedLocalLight(records[0],nativeProbePosition,shadow);result=mode==0?vec4(s.color,s.enabled?1.:0.):vec4(s.direction*.5+.5,s.minimumRoughness);}`,
  });
  const scene = new T.Scene(),
    geometry = new T.PlaneGeometry(2, 2);
  scene.add(new T.Mesh(geometry, material));
  const camera = new T.Camera();
  const bounds = I.slice();
  bounds[0] = 2;
  const cases: {
    name: string;
    record: NativeBakedLocalLight;
    position: number[];
    shadow?: number[];
    mode?: number;
    expected: number[];
  }[] = [
    {
      name: "unclamped-hdr-directional",
      record: record(),
      position: [0, 0, 0.5],
      expected: [2, 4, 6, 1],
    },
    {
      name: "baked-blue-channel",
      record: { ...record(), shadowWeights: [0, 0, 1, 0] },
      position: [0, 0, 0.5],
      shadow: [0.2, 0.3, 0.25, 0.4],
      expected: [1.5, 3, 4.5, 1],
    },
    {
      name: "baked-red-channel",
      record: { ...record(), shadowWeights: [1, 0, 0, 0] },
      position: [0, 0, 0.5],
      shadow: [0.2, 0.3, 0.25, 0.4],
      expected: [1.6, 3.2, 4.8, 1],
    },
    {
      name: "inverse-square-range-and-baked-mask",
      record: {
        ...record(),
        positionRadius: [0, 0, 2, 1],
        depthFalloff: [1, -0.25, 2, 2],
        shadowWeights: [0, 0, 1, 0],
      },
      position: [0, 0, 0.5],
      shadow: [0.8, 0.1, 0.5, 0.9],
      expected: [0.3038194444444444, 0.6076388888888888, 0.9114583333333333, 1],
    },
    {
      name: "rectangular-reversed-smoothstep",
      record: record(),
      position: [0.75, 0, 0.5],
      expected: [1, 2, 3, 1],
    },
    {
      name: "rounded-barn-corner",
      record: { ...record(), barn: [0.5, 0.5, 1] },
      position: [0.8, 0.8, 0.5],
      expected: [0, 0, 0, 1],
    },
    {
      name: "projection-x-strict-edge",
      record: record(),
      position: [1, 0, 0.5],
      expected: [0, 0, 0, 0],
    },
    {
      name: "projection-near-strict-edge",
      record: record(),
      position: [0, 0, 0],
      expected: [0, 0, 0, 0],
    },
    {
      name: "projection-far-strict-edge",
      record: record(),
      position: [0, 0, 1],
      expected: [0, 0, 0, 0],
    },
    {
      name: "obb-outside",
      record: { ...record(), worldToBounds: bounds },
      position: [0.6, 0, 0.5],
      expected: [0, 0, 0, 0],
    },
    {
      name: "obb-inclusive-edge",
      record: { ...record(), worldToBounds: bounds },
      position: [0.5, 0, 0.5],
      expected: [2, 4, 6, 1],
    },
    {
      name: "finite-line-angular-control",
      record: { ...record(), positionRadius: [1, 2, 0.5, 1], angularLine: [0, 1, 2] },
      position: [0, 0, 0.5],
      expected: [0.4, 0.8, 1.2, 1],
    },
    {
      name: "zero-line-angular-negative-control",
      record: { ...record(), positionRadius: [1, 2, 0.5, 1], angularLine: [0, 1, 0] },
      position: [0, 0, 0.5],
      expected: [0.1788854382, 0.3577708764, 0.5366563146, 1],
    },
    {
      name: "quaternion-rotated-angular-axis",
      record: {
        ...record(),
        positionRadius: [0, 2, 0.5, 1],
        angularLine: [0, 1, 0],
        rotation: [0, 0, Math.SQRT1_2, Math.SQRT1_2],
      },
      position: [0, 0, 0.5],
      expected: [0.5, 1, 1.5, 1],
    },
    {
      name: "identity-angular-negative-control",
      record: { ...record(), positionRadius: [0, 2, 0.5, 1], angularLine: [0, 1, 0] },
      position: [0, 0, 0.5],
      expected: [0, 0, 0, 1],
    },
    {
      name: "source-radius-distance-floor",
      record: { ...record(), positionRadius: [0, 0, 1, 4] },
      position: [0, 0, 0.5],
      expected: [2, 4, 6, 1],
    },
    {
      name: "independent-near-far-fades",
      record: { ...record(), depthFalloff: [1, 0, 1, 1] },
      position: [0, 0, 0.5],
      expected: [0.5, 1, 1.5, 1],
    },
    {
      name: "direction-and-per-light-roughness",
      record: { ...record(), positionRadius: [1, 2, 0.5, 1] },
      position: [0, 0, 0.5],
      mode: 1,
      expected: [0.72360679775, 0.9472135955, 0.5, 0.2],
    },
  ];
  const rows = [];
  for (const entry of cases) {
    const buffer = new NativeLightBuffer(packNativeLocalLights([entry.record], I, I));
    material.uniforms.nativeProbePosition.value.fromArray(entry.position);
    material.uniforms.shadow.value.fromArray(entry.shadow ?? [0, 0, 0, 0]);
    material.uniforms.mode.value = entry.mode ?? 0;
    const pixel = new Float32Array(4);
    buffer.withBinding(renderer, () => {
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    });
    rows.push({
      name: entry.name,
      actual: [...pixel],
      expected: entry.expected,
      error: renderer.getContext().getError(),
    });
    buffer.dispose();
  }
  material.dispose();
  geometry.dispose();
  target.dispose();
  renderer.dispose();
  return rows;
}
