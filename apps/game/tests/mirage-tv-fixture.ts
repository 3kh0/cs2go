import * as T from "three";
import { loadNativeMap } from "../src/dust2";
import { activateNativeMapGrade } from "../src/native-map-color";
import { enableTextureTranscoding } from "../src/gltf";

export async function renderMirageTelevisions() {
  const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1200, 900);
  renderer.toneMapping = T.CustomToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  enableTextureTranscoding(renderer);
  document.body.replaceChildren(renderer.domElement);
  const scene = new T.Scene();
  const world = await loadNativeMap(scene, renderer, "mirage");
  world.root.visible = true;
  activateNativeMapGrade(world.grade);
  scene.environment = world.sky;
  scene.environmentIntensity = world.config.environmentIntensity ?? 0.35;
  scene.environmentRotation.y = Math.PI;
  const camera = new T.PerspectiveCamera(55, 1200 / 900, 0.05, 254);
  const target = new T.Vector3(-44.297592, -0.94, 17.678402);
  const captures = [];
  for (const [name, offset] of [
    ["front", [1.25, -0.12, -1.55]],
    ["side", [1.65, -0.12, 0.4]],
  ] as const) {
    camera.position.copy(target).add(new T.Vector3(...offset));
    camera.lookAt(target);
    renderer.render(scene, camera);
    captures.push({ name, image: renderer.domElement.toDataURL() });
  }
  const televisionMaterials: Record<string, number> = {};
  const emission: Record<string, number> = {};
  world.scenery.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      if (material.name.startsWith("tv")) {
        televisionMaterials[material.name] = (televisionMaterials[material.name] ?? 0) + 1;
        if (material instanceof T.MeshStandardMaterial)
          emission[material.name] =
            (material.emissive.r + material.emissive.g + material.emissive.b) *
            material.emissiveIntensity;
      }
  });
  return { captures, televisionMaterials, emission, glError: renderer.getContext().getError() };
}
