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
  geometry.setAttribute(
    "uv",
    new T.Float32BufferAttribute([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 2),
  );
  const sample = (bytes: number[], strength: number, mode: "normal" | "roughness") => {
    const texture = new T.DataTexture(new Uint8Array(bytes), bytes.length / 4, 1);
    texture.minFilter = texture.magFilter = T.LinearFilter;
    texture.needsUpdate = true;
    const material = new T.MeshStandardMaterial({ normalMap: texture });
    material.onBeforeCompile = (shader) => {
      applySourceGenericTextures(shader, { color: "", normal: "", normalStrength: strength });
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `outgoingLight = ${mode === "normal" ? "normal * 0.5 + 0.5" : "vec3(roughnessFactor)"};\n#include <opaque_fragment>`,
      );
    };
    material.customProgramCacheKey = () => `generic-${mode}-${strength}`;
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
  };
  geometry.dispose();
  renderer.dispose();
  return result;
}
