import * as T from "three";
import { loadModel } from "./gltf";
import { armoryReflections } from "./reflections";

/** One persistent world C4, reused for dropped and planted states. */
export class BombModel extends T.Group {
  private body?: T.MeshStandardMaterial;
  private display?: T.Texture;

  async load(renderer: T.WebGLRenderer) {
    const { scene } = await loadModel("/models/c4.glb");
    scene.name = "CS2 C4";
    // Source2Viewer already exports meters and places the keypad facing up.
    scene.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(scene);
    const center = bounds.getCenter(new T.Vector3());
    // Both placement paths use feet height; keep the device resting on its base.
    scene.position.set(-center.x, -bounds.min.y, -center.z);
    scene.traverse((node) => {
      if (!(node instanceof T.Mesh)) return;
      node.castShadow = true;
      node.receiveShadow = true;
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
        if (!(material instanceof T.MeshStandardMaterial)) continue;
        material.envMap = armoryReflections(renderer);
        material.envMapIntensity = 1.6;
        material.aoMapIntensity = 0.65;
        if (material.name === "weapon_c4") {
          this.body = material;
          material.emissive.set(0xff1808);
          material.emissiveIntensity = 0;
        }
        if (material.name === "weapon_c4_digits") this.display = material.map ?? undefined;
      }
    });
    this.add(scene);
  }

  update(planted: boolean, timer: number, ticking: boolean, pulse = false) {
    // Native LCD atlas: blank at row 0, the armed 7355608 code at row 8.
    if (this.display) this.display.offset.y = planted ? 0.5 : 0;
    // Use simulation time, so pausing freezes the pulse with the bomb countdown.
    if (this.body) this.body.emissiveIntensity = planted && ticking && timer > 0 && pulse ? 6 : 0;
  }
}
