import * as T from "three";
import { applySourceColorCorrection } from "../src/map-color";
import {
  activateNativeMapGrade,
  applyNativeMapGrade,
  loadNativeMapGrade,
  withoutNativeMapGrade,
} from "../src/native-map-color";

export async function renderNativeMapColorFixture() {
  const config = await fetch("/models/maps/mirage-config.json").then((response) => response.json());
  const grade = await loadNativeMapGrade(config.postprocess);
  const renderer = new T.WebGLRenderer();
  renderer.setSize(64, 64);
  renderer.toneMapping = T.CustomToneMapping;
  const scene = new T.Scene();
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;
  const geometry = new T.PlaneGeometry(2, 2);
  const reference = new T.MeshBasicMaterial();
  const native = reference.clone(),
    actor = reference.clone();
  native.onBeforeCompile = (shader) => applyNativeMapGrade(shader);
  actor.onBeforeCompile = (shader) => applySourceColorCorrection(shader, "1.0", true);
  native.customProgramCacheKey = () => "native-map-color-fixture";
  actor.customProgramCacheKey = () => "native-map-color-shared-sampler-fixture";
  const mesh = new T.Mesh(geometry, native);
  scene.add(mesh);
  const pixel = (material: T.MeshBasicMaterial, rgb: number[]) => {
    mesh.material = material;
    material.color.setRGB(rgb[0], rgb[1], rgb[2]);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      bytes = new Uint8Array(4);
    gl.readPixels(32, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return Array.from(bytes).slice(0, 3);
  };
  const expected = (rgb: number[]) => {
    const p = grade.parameters;
    const A = p.m_flShoulderStrength,
      B = p.m_flLinearStrength,
      C = p.m_flLinearAngle,
      D = p.m_flToeStrength,
      E = p.m_flToeNum,
      F = p.m_flToeDenom;
    // Independently evaluate the original native rational curve in double precision.
    const filmic = (x: number) => (x * (A * x + C * B) + D * E) / (x * (A * x + B) + D * F) - E / F;
    // Native CPU renderer scales its LINEAR authored white and scene by 2.8.
    const white = p.m_flWhitePoint * 2.8;
    const display = rgb.map((channel) => {
      const linear =
        filmic(Math.min(white, channel * grade.exposure * 2 ** p.m_flExposureBias * 2.8)) /
        filmic(white);
      return linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
    });
    const data = grade.texture.image.data as Uint8Array;
    const coord = display.map((value) => Math.max(0, Math.min(31, value * 31)));
    const index = coord.map(Math.floor),
      fraction = coord.map((value, i) => value - index[i]);
    return [0, 1, 2].map((channel) => {
      let value = 0;
      for (let z = 0; z < 2; z++)
        for (let y = 0; y < 2; y++)
          for (let x = 0; x < 2; x++) {
            const weight =
              (x ? fraction[0] : 1 - fraction[0]) *
              (y ? fraction[1] : 1 - fraction[1]) *
              (z ? fraction[2] : 1 - fraction[2]);
            const at =
              ((Math.min(31, index[2] + z) * 32 + Math.min(31, index[1] + y)) * 32 +
                Math.min(31, index[0] + x)) *
              4;
            value += data[at + channel] * weight;
          }
      return Math.round(value);
    });
  };
  activateNativeMapGrade(grade);
  const samples = [
    [0.02, 0.1, 0.3],
    [0.12, 0.05, 0.22],
    [0.4, 0.24, 0.08],
  ].map((rgb) => ({
    rgb,
    expected: expected(rgb),
    native: pixel(native, rgb),
    actor: pixel(actor, rgb),
  }));
  const control = [0.12, 0.05, 0.22];
  const plain = withoutNativeMapGrade(() => pixel(reference, control));
  const isolated = withoutNativeMapGrade(() => pixel(actor, control));
  const restored = pixel(actor, control);
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const samplerCounts = (renderer.info.programs ?? []).map((program) => {
    const rawProgram = program.program as WebGLProgram;
    const count = gl.getProgramParameter(rawProgram, gl.ACTIVE_UNIFORMS) as number;
    let samplers = 0;
    for (let i = 0; i < count; i++)
      if (gl.getActiveUniform(rawProgram, i)?.type === gl.SAMPLER_3D) samplers++;
    return samplers;
  });
  activateNativeMapGrade();
  grade.texture.dispose();
  geometry.dispose();
  native.dispose();
  actor.dispose();
  reference.dispose();
  renderer.dispose();
  return { samples, plain, isolated, restored, samplerCounts };
}
