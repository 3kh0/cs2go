import * as T from "three";
import type { MapResources } from "./map-resources";

interface CoveragePass {
  depthScene: T.Scene;
  syncDepth(renderer?: T.WebGLRenderer): void;
  update(seconds: number): void;
  dispose(): void;
  applyShadowPolicy(): void;
}
export interface NativeCoverage {
  renderDepth(this: void, camera: T.PerspectiveCamera): void;
  prepare(camera: T.PerspectiveCamera): Promise<unknown>;
  update(seconds: number): void;
}

/** The same coverage contract precedes world color, smoke depth and own-sky
 * color. Each family retains its own authored coverage and vertex equations. */
export function ownNativeCoverage(
  renderer: T.WebGLRenderer,
  resources: MapResources,
  passes: readonly CoveragePass[],
): NativeCoverage {
  for (const pass of passes) resources.onDispose(() => pass.dispose());
  return {
    renderDepth(camera) {
      const autoClear = renderer.autoClear;
      try {
        renderer.autoClear = false;
        for (const pass of passes) {
          if (!pass.depthScene.children.length) {
            pass.applyShadowPolicy();
            continue;
          }
          pass.syncDepth(renderer);
          renderer.render(pass.depthScene, camera);
        }
      } finally {
        renderer.autoClear = autoClear;
      }
    },
    prepare(camera) {
      return Promise.all(
        passes.map((pass) => {
          if (!pass.depthScene.children.length) {
            pass.applyShadowPolicy();
            return Promise.resolve();
          }
          pass.syncDepth(renderer);
          return renderer.compileAsync(pass.depthScene, camera);
        }),
      );
    },
    update(seconds) {
      for (const pass of passes) pass.update(seconds);
    },
  };
}

export function combineNativeCoverage(
  candidates: readonly (NativeCoverage | undefined)[],
): NativeCoverage | undefined {
  const passes = candidates.filter((pass): pass is NativeCoverage => !!pass);
  if (!passes.length) return undefined;
  return {
    renderDepth(camera) {
      for (const pass of passes) pass.renderDepth(camera);
    },
    prepare(camera) {
      return Promise.all(passes.map((pass) => pass.prepare(camera)));
    },
    update(seconds) {
      for (const pass of passes) pass.update(seconds);
    },
  };
}
