import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadGzipped } from "../src/gltf";
import { NativeMapBreakableView, type NativeBreakableManifest } from "../src/map-breakable-view";
import { MapCollision } from "@cs2go/simulation/map-collision";
import { MapResources } from "../src/map-resources";

/** Actual native standalone control + packed fragment sidecar, without loading
 * a whole map. Caller supplies source URLs; no staged/private path is embedded. */
export async function renderNativeBreakpieceFixture(input: {
  manifest: string;
  model: string;
  intact: string;
  owner: string;
  worldFromStandaloneScene: number[];
}) {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(128, 128);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const resources = new MapResources();
  const target = resources.target(new T.WebGLRenderTarget(128, 128));
  try {
    const [manifest, pieces, intact] = await Promise.all([
      fetch(input.manifest).then(async (response) => {
        if (!response.ok) throw new Error("Native fragment fixture manifest unavailable");
        return response.json() as Promise<NativeBreakableManifest>;
      }),
      loadGzipped(input.model, 1),
      new GLTFLoader().loadAsync(input.intact),
    ]);
    resources.capture(pieces.scene);
    resources.capture(intact.scene);
    const definition = manifest.breakables.find((part) => part.id === input.owner)!;
    if (!definition?.pieces?.length) throw new Error("Native source piece owner unavailable");
    const scene = new T.Scene();
    scene.background = new T.Color(0x030303);
    scene.add(pieces.scene, new T.HemisphereLight(0xffffff, 0x606060, 2));
    const light = new T.DirectionalLight(0xffffff, 3);
    light.position.set(2, 4, 3);
    scene.add(light);
    for (const part of manifest.breakables)
      for (const name of part.renderNames) {
        const control = part === definition ? intact.scene : new T.Group();
        control.name = name;
        if (part === definition) {
          control.matrix.fromArray(input.worldFromStandaloneScene);
          control.matrixAutoUpdate = false;
        }
        pieces.scene.add(control);
      }
    scene.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(intact.scene);
    for (const piece of definition.pieces)
      for (const name of piece.renderNames)
        bounds.union(new T.Box3().setFromObject(pieces.scene.getObjectByName(name)!));
    const center = bounds.getCenter(new T.Vector3()),
      size = bounds.getSize(new T.Vector3());
    const camera = new T.PerspectiveCamera(45, 1, 0.01, 100);
    const axis = size.x < size.y && size.x < size.z ? 0 : size.y < size.z ? 1 : 2;
    const direction = new T.Vector3().setComponent(axis, 1);
    camera.position.copy(center).addScaledVector(direction, size.length() * 1.5);
    if (axis === 1) camera.up.set(0, 0, -1);
    camera.lookAt(center);
    const view = new NativeMapBreakableView(scene, pieces.scene, manifest, new MapCollision([]));
    resources.capture(scene);
    const read = () => {
      scene.updateMatrixWorld(true);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const data = new Uint8Array(128 * 128 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 128, 128, data);
      return data;
    };
    const changed = (a: Uint8Array, b: Uint8Array) => {
      let count = 0;
      for (let i = 0; i < a.length; i += 4)
        if (
          Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >
          6
        )
          count++;
      return count;
    };
    const before = read();
    const states = manifest.breakables.map((part) => ({
      id: part.id,
      health: part.id === input.owner ? 0 : part.health,
    }));
    view.sync(states, true);
    const broken = read(),
      bodies = view.root.children.length;
    view.update(0.15);
    const moving = read();
    view.update(Math.max(...definition.pieces.map((piece) => piece.fadeTime)) + 1);
    const expired = view.root.children.length;
    view.sync(manifest.breakables.map((part) => ({ id: part.id, health: part.health })));
    const restored = read();
    const gallery = document.createElement("canvas");
    gallery.width = 128 * 3;
    gallery.height = 128;
    const context = gallery.getContext("2d")!;
    for (const [column, pixels] of [before, broken, moving].entries()) {
      const flipped = new Uint8ClampedArray(pixels.length);
      for (let row = 0; row < 128; row++)
        flipped.set(pixels.subarray(row * 128 * 4, (row + 1) * 128 * 4), (127 - row) * 128 * 4);
      context.putImageData(new ImageData(flipped, 128, 128), column * 128, 0);
    }
    document.body.replaceChildren(gallery);
    return {
      bodies,
      expectedBodies: definition.pieces.length,
      changedOnBreak: changed(before, broken),
      changedDuringMotion: changed(broken, moving),
      expired,
      resetPixelDifference: changed(before, restored),
      error: renderer.getContext().getError(),
      calls: renderer.info.render.calls,
      qualification:
        "Actual packed source geometry/material transport; simple fixture lighting and browser rigid-body motion, not native full-map lighting parity",
    };
  } finally {
    resources.dispose();
    renderer.dispose();
  }
}
