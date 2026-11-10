import * as T from "three";
import { bindNativeMapEffects } from "../src/native-map-effects";
import { MapResources } from "../src/map-resources";
import { SmokeComposite } from "../src/smoke-renderer";
import type { NativeSkyEffectParameters } from "../src/native-sky-clouds";

/** Synthetic linear reference: real main-FX binder and SmokeComposite depth
 * consumer, without smoke or any imported map assets masking a depth failure. */
export function renderNativeMapEffectsFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(96, 64);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const results = [];
  for (const mode of ["full", "letterbox", "half-depth", "fog"] as const) {
    const viewport = mode === "full" ? new T.Vector4(0, 0, 96, 64) : new T.Vector4(24, 0, 48, 64);
    renderer.setViewport(viewport);
    const camera = new T.PerspectiveCamera(50, viewport.z / viewport.w, 0.1, 300);
    camera.position.z = 3;
    camera.updateMatrixWorld();
    const background = [0.1, 0.2, 0.3],
      color = [0.8, 0.4, 0.2],
      fogColor = [0.2, 0.4, 0.7],
      gap = 0.0127;
    const scene = new T.Scene();
    scene.background = new T.Color(0, 0, 0);
    if (mode === "fog")
      scene.fog = new T.Fog(new T.Color(...(fogColor as [number, number, number])), 0, 6);
    const wall = new T.Mesh(
      new T.PlaneGeometry(10, 10),
      new T.MeshBasicMaterial({ color: new T.Color(...(background as [number, number, number])) }),
    );
    wall.position.z = -gap;
    scene.add(wall);
    const measured = [];
    for (const feather of [false, true]) {
      const resources = new MapResources(),
        group = new T.Group();
      scene.add(group);
      const source = new T.MeshStandardMaterial();
      source.name = "native-steam-reference";
      const mesh = new T.Mesh(new T.PlaneGeometry(10, 10), source);
      group.add(mesh);
      const texture = (rgba: number[]) => {
        const texture = new T.DataTexture(
          new Uint8Array(rgba.map((v) => Math.round(v * 255))),
          1,
          1,
        );
        texture.needsUpdate = true;
        return texture;
      };
      const textures = new Map([
        ["color", texture([...color, 0.8])],
        ["mask", texture([1, 1, 1, 1])],
      ]);
      const native: NativeSkyEffectParameters = {
        IntParams: { F_DEPTH_FEATHER: feather ? 1 : 0, g_bFogEnabled: mode === "fog" ? 1 : 0 },
        FloatParams: { g_flFeatherDistance: 1, g_flFeatherFalloff: 1, g_flFresnelExponent: 0.001 },
        VectorParams: {},
        TextureParams: { g_tColor: "color", g_tMask1: "mask", g_tMask2: "mask", g_tMask3: "mask" },
      };
      const effect = bindNativeMapEffects(
        renderer,
        group,
        { [source.name]: native },
        textures,
        resources,
      );
      scene.updateMatrixWorld(true);
      effect.update(0);
      const composite = new SmokeComposite();
      const consumer = effect.needsDepth(camera) ? effect : undefined;
      composite.render(renderer, scene, camera, [], mode === "half-depth", consumer);
      const gl = renderer.getContext() as WebGL2RenderingContext,
        pixel = new Uint8Array(4),
        outside = new Uint8Array(4);
      gl.readPixels(48, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      gl.readPixels(4, 32, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, outside);
      measured.push({
        pixel: Array.from(pixel).slice(0, 3),
        outside: Array.from(outside).slice(0, 3),
        depthCreated: !!composite.target,
        depthSize: composite.target ? [composite.target.width, composite.target.height] : null,
        error: gl.getError(),
      });
      scene.remove(group);
      resources.dispose();
      composite.target?.dispose();
    }
    const smooth = (x: number) => x * x * (3 - 2 * x);
    const wallFog = mode === "fog" ? smooth((3 + gap) / 6) : 0,
      fxFog = mode === "fog" ? smooth(3 / 6) : 0;
    const expected = (feather: boolean) => {
      const alpha = 0.8 * (feather ? 0.5 : 1);
      return background.map((b, i) => {
        const bg = b * (1 - wallFog) + fogColor[i] * wallFog;
        const fg = color[i] * (1 - fxFog) + fogColor[i] * fxFog;
        return Math.round((bg * (1 - alpha) + fg * alpha) * 255);
      });
    };
    results.push({
      mode,
      control: measured[0],
      feather: measured[1],
      expectedControl: expected(false),
      expectedFeather: expected(true),
    });
    wall.geometry.dispose();
    (wall.material as T.Material).dispose();
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return results;
}
