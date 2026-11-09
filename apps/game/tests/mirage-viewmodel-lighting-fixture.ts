import * as T from "three";

/** Isolate the real view pass so dark walls do not bias viewmodel measurements. */
export function measureNativeViewmodel() {
  const g = window.__game;
  const renderer = g.renderer;
  const target = new T.WebGLRenderTarget(640, 400);
  const previous = renderer.getRenderTarget();
  const color = renderer.getClearColor(new T.Color());
  const alpha = renderer.getClearAlpha();
  const viewport = renderer.getViewport(new T.Vector4());
  const scissor = renderer.getScissor(new T.Vector4());
  const scissorTest = renderer.getScissorTest();
  const pixels = new Uint8Array(640 * 400 * 4);
  try {
    renderer.setRenderTarget(target);
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(g.view, g.viewCamera);
    renderer.readRenderTargetPixels(target, 0, 0, 640, 400, pixels);
  } finally {
    renderer.setRenderTarget(previous);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    renderer.setClearColor(color, alpha);
    target.dispose();
  }
  const luminance: number[] = [];
  for (let i = 0; i < pixels.length; i += 4)
    if (pixels[i + 3] > 128)
      luminance.push(pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722);
  luminance.sort((a, b) => a - b);
  return {
    visiblePixels: luminance.length,
    meanLuminance: luminance.reduce((a, b) => a + b, 0) / luminance.length,
    p95Luminance: luminance[Math.floor(luminance.length * 0.95)],
    p99Luminance: luminance[Math.floor(luminance.length * 0.99)],
    nativeProbeCount: g.dust?.nativeProbes?.count ?? 0,
    nativeReflectionCount: g.dust?.nativeReflections?.volumes.length ?? 0,
    glError: renderer.getContext().getError(),
  };
}
