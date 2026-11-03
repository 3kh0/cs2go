import * as T from "three";
import { applySourceGenericTextures } from "../src/source-generic-textures";

export function renderSourceGenericTextures() {
  const renderer = new T.WebGLRenderer();
  renderer.setSize(32, 32);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 5;
  const scene = new T.Scene();
  const geometry = new T.PlaneGeometry(2, 2);
  geometry.setAttribute(
    "tangent",
    new T.Float32BufferAttribute([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1], 4),
  );
  const tangent = geometry.getAttribute("tangent");
  const sample = (
    bytes: number[],
    strength: number,
    mode: "normal" | "roughness",
    derivative = false,
    converted = false,
  ) => {
    if (derivative) geometry.deleteAttribute("tangent");
    else geometry.setAttribute("tangent", tangent);
    const texture = new T.DataTexture(new Uint8Array(bytes), bytes.length / 4, 1);
    texture.minFilter = texture.magFilter = T.LinearFilter;
    // Sample the exact midpoint while retaining UV derivatives for the TBN.
    texture.offset.set(-1 / 64, -1 / 64);
    texture.needsUpdate = true;
    const material = new T.MeshStandardMaterial({ normalMap: texture });
    // GLTFLoader uses -Y for meshes without stored tangents. Native packed
    // shaders own their decode and must not apply that converted-map scale twice.
    material.normalScale.y = -1;
    material.onBeforeCompile = (shader) => {
      if (!converted)
        applySourceGenericTextures(shader, { color: "", normal: "", normalStrength: strength });
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `outgoingLight = ${mode === "normal" ? "normal * 0.5 + 0.5" : "vec3(roughnessFactor)"};\n#include <opaque_fragment>`,
      );
    };
    material.customProgramCacheKey = () => `generic-${mode}-${strength}-${derivative}-${converted}`;
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      pixel = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    scene.remove(mesh);
    material.dispose();
    texture.dispose();
    return [...pixel].slice(0, 3);
  };
  const filtered = [220, 180, 51, 0, 80, 120, 204, 255];
  const result = {
    neutral: sample([128, 128, 255, 17], 1, "normal"),
    oblique: sample([180, 100, 204, 255], 1, "normal"),
    filtered: sample(filtered, 1, "normal"),
    filteredRoughness: sample(filtered, 1, "roughness"),
    flattened: sample([180, 100, 204, 255], 0, "normal"),
    roughness: sample([180, 100, 51, 0], 1, "roughness"),
    nativeExplicit: sample([160, 96, 128, 255], 1, "normal"),
    nativeDerivative: sample([160, 96, 128, 255], 1, "normal", true),
    convertedDerivative: sample([127, 168, 248, 255], 1, "normal", true, true),
    convertedExplicit: sample([127, 168, 248, 255], 1, "normal", false, true),
  };
  geometry.dispose();
  renderer.dispose();
  return result;
}
