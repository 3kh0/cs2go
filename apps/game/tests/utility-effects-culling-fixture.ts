import * as T from "three";
import { UtilityVisual } from "../src/utility-effects";

/** Compare the same GPU shader workload with only CPU culling toggled. */
export function renderUtilityCulling() {
  const size = 128;
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(size, size);
  renderer.setClearColor(0x000000, 1);
  const target = new T.WebGLRenderTarget(size, size);
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 40);
  const parent = new T.Group();
  scene.add(parent);
  const rows = [];
  const screenshot = document.createElement("canvas");
  screenshot.width = size * 3;
  screenshot.height = size * 2;
  document.body.append(screenshot);
  const context = screenshot.getContext("2d")!;
  try {
    for (const transformed of [false, true]) {
      // Match the runtime's unit-scale parent contract, while exercising
      // nonidentity modelView matrices and float32 cancellation at map scale.
      parent.position.set(transformed ? 120 : 0, transformed ? 9 : 0, transformed ? -80 : 0);
      parent.rotation.set(transformed ? 0.3 : 0, transformed ? -1.2 : 0, transformed ? 0.2 : 0);
      camera.position.set(transformed ? 112 : 0, transformed ? 6 : 0, transformed ? -71 : 0);
      camera.rotation.set(transformed ? -0.2 : 0, transformed ? 0.7 : 0, transformed ? 0.15 : 0);
      parent.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const inverseParent = parent.matrixWorld.clone().invert();
      const halfWidth = 5 * Math.tan(Math.PI / 6);
      const cases = [
        { name: "center", center: new T.Vector3(0, 0, -5), visible: true },
        { name: "left-edge", center: new T.Vector3(-halfWidth - 0.04, 0, -5), visible: true },
        { name: "right-edge", center: new T.Vector3(halfWidth + 0.04, 0, -5), visible: true },
        { name: "bottom-edge", center: new T.Vector3(0, -halfWidth - 0.04, -5), visible: true },
        { name: "top-edge", center: new T.Vector3(0, halfWidth - 0.3, -5), visible: true },
        { name: "near-edge", center: new T.Vector3(0, 0, -0.11), visible: true },
        { name: "far-edge", center: new T.Vector3(0, 0, -39.9), visible: true },
        { name: "offscreen", center: new T.Vector3(100, 0, -5), visible: false },
      ];
      for (const [kindIndex, kind] of (["fire", "blast", "flash"] as const).entries()) {
        for (const age of kind === "fire" ? [0, 0.15, 1, 7.99] : [0, 0.075, 0.15, 1]) {
          for (const sample of cases) {
            const center = sample.center
              .clone()
              .applyMatrix4(camera.matrixWorld)
              .applyMatrix4(inverseParent);
            // Include multiple fire cells, not just three billboards at the
            // detonation. Blast/flash constructors use all twelve instances.
            const positions = [center];
            if (kind === "fire") {
              positions.push(center.clone().add(new T.Vector3(-0.22, 0.04, -0.1)));
              positions.push(center.clone().add(new T.Vector3(0.24, 0.08, 0.1)));
            }
            const visual = new UtilityVisual(kind, positions);
            parent.add(visual.mesh);
            visual.update(age, 1);
            const frames = [];
            try {
              for (const cull of [false, true]) {
                visual.mesh.frustumCulled = cull;
                renderer.setRenderTarget(target);
                renderer.info.reset();
                renderer.render(scene, camera);
                const pixels = new Uint8Array(size * size * 4);
                renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
                frames.push({ pixels, calls: renderer.info.render.calls });
              }
              let mismatchedBytes = 0;
              let nonzeroPixels = 0;
              for (let i = 0; i < frames[0].pixels.length; i++) {
                if (frames[0].pixels[i] !== frames[1].pixels[i]) mismatchedBytes++;
                if (
                  i % 4 === 0 &&
                  (frames[0].pixels[i] > 0 ||
                    frames[0].pixels[i + 1] > 0 ||
                    frames[0].pixels[i + 2] > 0)
                )
                  nonzeroPixels++;
              }
              rows.push({
                kind,
                age,
                transformed,
                sample: sample.name,
                visible: sample.visible,
                mismatchedBytes,
                nonzeroPixels,
                controlCalls: frames[0].calls,
                culledCalls: frames[1].calls,
              });
              if (!transformed && age === 0.15 && ["center", "right-edge"].includes(sample.name)) {
                const image = context.createImageData(size, size);
                for (let y = 0; y < size; y++)
                  image.data.set(
                    frames[1].pixels.subarray((size - y - 1) * size * 4, (size - y) * size * 4),
                    y * size * 4,
                  );
                context.putImageData(image, kindIndex * size, sample.name === "center" ? 0 : size);
              }
            } finally {
              parent.remove(visual.mesh);
              visual.dispose();
            }
          }
        }
      }
    }
    return { rows, glError: renderer.getContext().getError() };
  } finally {
    target.dispose();
    renderer.dispose();
  }
}
