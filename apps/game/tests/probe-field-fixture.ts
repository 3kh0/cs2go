import * as T from "three";
import { loadNativeMapProbes } from "../src/native-map-probes";
import { applySourceGpuProbes } from "../src/source-gpu-probes";
import { bindSourceProbeField } from "../src/source-probe-field";
import {
  createSourceProbeSelection,
  updateSourceProbeSelection,
} from "../src/source-probe-selection";

/** Compare the actual Vertigo LPV data across both GPU transports. */
export async function probeFieldFixture(map = "vertigo") {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const probes = await loadNativeMapProbes(
    renderer,
    `/models/maps/${map}-lighting/gpu-probes/`,
    true,
  );
  if (!probes?.uniformsGroup) throw new Error("Probe block unavailable");
  const geometry = new T.PlaneGeometry(2, 2),
    camera = new T.Camera(),
    scene = new T.Scene(),
    target = new T.WebGLRenderTarget(16, 16, { type: T.FloatType });
  const origin = { value: new T.Vector3() },
    normal = { value: new T.Vector3() },
    output = { value: 0 };
  const selection = createSourceProbeSelection(probes.count);
  const materials = ["default", "shared", "selected"].map((mode) => {
    const data = mode !== "default" ? probes : { ...probes, uniformsGroup: undefined };
    const material = new T.ShaderMaterial({
      uniforms: { origin, testNormal: normal, testOutput: output },
      vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
      fragmentShader: `#include <common>
uniform vec3 origin,testNormal;uniform int testOutput;
void main(){SourceGpuProbe p=sourceGpuSample(origin+vec3((gl_FragCoord.x-8.)*.25,0.,(gl_FragCoord.y-8.)*.25),testNormal);gl_FragColor=testOutput==0?vec4(p.irradiance,1.):p.occlusion;}`,
    });
    bindSourceProbeField(material, data);
    material.onBeforeCompile = (shader) =>
      applySourceGpuProbes(shader, data, mode === "selected" ? selection : undefined);
    material.customProgramCacheKey = () => `probe-field:${mode}`;
    return material;
  });
  const mesh = new T.Mesh(geometry, materials[0]);
  scene.add(mesh);
  renderer.setRenderTarget(target);
  let maxError = 0,
    cases = 0,
    nonFinite = 0;
  const read = (material: T.ShaderMaterial) => {
    mesh.material = material;
    renderer.render(scene, camera);
    const pixels = new Float32Array(16 * 16 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 16, 16, pixels);
    return pixels;
  };
  const positions = [
    [-34.75, 293.42, 1.4],
    [-21.85, 300.73, -23.88],
    [-37, 299.6, 20],
    [0, 500, 0],
  ];
  probes.selectionBounds?.forEach((bounds, index) => {
    if (index % 8 !== 0) return;
    const center = bounds.getCenter(new T.Vector3());
    if (center.toArray().every(Number.isFinite)) {
      positions.push(center.toArray());
      positions.push(bounds.min.clone().lerp(center, 0.02).toArray());
    }
  });
  let maxSelected = 0;
  const sampleBounds = new T.Box3(),
    margin = new T.Vector3(6, 6, 6);
  for (const position of positions)
    for (const direction of [
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
    ])
      for (const kind of [0, 1]) {
        origin.value.fromArray(position);
        normal.value.fromArray(direction);
        output.value = kind;
        sampleBounds.setFromCenterAndSize(origin.value, margin);
        updateSourceProbeSelection(selection, probes.selectionBounds!, sampleBounds);
        maxSelected = Math.max(maxSelected, selection.count.value);
        const expected = read(materials[0]),
          actual = read(materials[1]),
          selected = read(materials[2]);
        for (let i = 0; i < expected.length; i++) {
          if (![actual[i], selected[i]].every(Number.isFinite)) nonFinite++;
          maxError = Math.max(
            maxError,
            Math.abs(expected[i] - actual[i]),
            Math.abs(expected[i] - selected[i]),
          );
        }
        cases++;
      }
  const glError = renderer.getContext().getError();
  materials.forEach((material) => material.dispose());
  probes.uniformsGroup.dispose();
  probes.textures.forEach((texture) => texture.dispose());
  geometry.dispose();
  target.dispose();
  renderer.dispose();
  return { cases, maxError, nonFinite, glError, maxSelected, total: probes.count };
}
