import { expect, test, vi } from "vitest";
import * as T from "three";
import { applyNativeStaticOverlays, type NativeStaticOverlay } from "./native-static-overlay";

function overlay(source: NativeStaticOverlay) {
  const original = new T.MeshStandardMaterial({ map: new T.Texture() });
  original.name = "overlay";
  const mesh = new T.Mesh(new T.PlaneGeometry(), original);
  applyNativeStaticOverlays(mesh, [{ name: original.name, staticOverlay: source }]);
  return mesh;
}

function compile(material: T.Material) {
  const shader = {
    uniforms: {},
    vertexShader: "",
    fragmentShader: "#include <map_fragment>\n#include <colorspace_fragment>",
  } as T.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as T.WebGLRenderer);
  return shader;
}

function render(mesh: T.Mesh, frame: number) {
  (mesh.material as T.Material).onBeforeRender(
    { info: { render: { frame } } } as T.WebGLRenderer,
    new T.Scene(),
    new T.PerspectiveCamera(),
    mesh.geometry,
    mesh,
    new T.Group(),
  );
}

test.each([0, 1, 2, 3, 4])("static overlay blend %i does not sample time", (mode) => {
  const mesh = overlay({
    IntParams: { F_BLEND_MODE: mode },
    FloatParams: {},
    VectorParams: {},
  });
  const shader = compile(mesh.material);
  expect(shader.fragmentShader).toContain("vec4 overlaySample=texture2D(map,overlayUv)");
  expect(shader.fragmentShader).not.toContain("nativeOverlayTime");
  expect(shader.uniforms.nativeOverlayTime).toBeUndefined();
  if (mode === 3)
    expect(shader.fragmentShader).toContain("mix(vec3(0.5),gl_FragColor.rgb,gl_FragColor.a)");
  const now = vi.spyOn(performance, "now");
  try {
    render(mesh, 1);
    render(mesh, 2);
    expect(now).not.toHaveBeenCalled();
  } finally {
    now.mockRestore();
  }
});

test.each([0, 1])(
  "animated overlay retains frame wrapping and compile chaining (lit=%i)",
  (lit) => {
    const previous = vi
      .spyOn(T.Material.prototype, "onBeforeCompile")
      .mockImplementation((shader) => {
        shader.fragmentShader += "\n// previous hook";
      });
    const now = vi.spyOn(performance, "now").mockReturnValue(1250);
    try {
      const mesh = overlay({
        IntParams: { F_TEXTURE_ANIMATION: 1, F_LIT: lit, g_nNumAnimationCells: 6 },
        FloatParams: {
          g_flAnimationTimePerFrame: 0.2,
          g_flAnimationTimeOffset: 0.5,
          g_flAnimationFrame: 2,
        },
        VectorParams: { g_vAnimationGrid: [4, 2] },
      });
      const shader = compile(mesh.material);
      expect(previous).toHaveBeenCalledTimes(1);
      expect(shader.fragmentShader).toContain("// previous hook");
      expect(shader.fragmentShader).toContain("mod(floor((nativeOverlayTime+0.5)/0.2)+2.0,6.0)");
      expect(shader.fragmentShader).toContain("vec2(mod(cell,4.0),floor(cell/4.0)))/vec2(4.0,2.0)");
      render(mesh, 1);
      expect(shader.uniforms.nativeOverlayTime.value).toBe(1.25);
      now.mockReturnValue(1750);
      render(mesh, 1);
      expect(shader.uniforms.nativeOverlayTime.value).toBe(1.25);
      render(mesh, 2);
      expect(shader.uniforms.nativeOverlayTime.value).toBe(1.75);
      expect(now).toHaveBeenCalledTimes(2);
      expect(compile(mesh.material).uniforms.nativeOverlayTime).toBe(
        shader.uniforms.nativeOverlayTime,
      );
    } finally {
      previous.mockRestore();
      now.mockRestore();
    }
  },
);
