import * as T from "three";
import { NativeMapLocalLights, applyNativeMapLocalLights } from "../src/native-map-local-lights";
import { buildQualifiedVrfLocalBarn } from "../src/native-local-light-bridge";
import { applySourceSurface } from "../src/source-surface";
import { applyNativeMapLighting } from "../src/native-map-lighting";
export function renderMapLocalLights(withCookie = false) {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const camera = new T.OrthographicCamera(-0.02, 0.02, 0.02, -0.02, 0.001, 1);
  camera.position.set(-0.1, 0, 0);
  camera.lookAt(0.0254, 0, 0);
  const base = buildQualifiedVrfLocalBarn(
    {
      classname: "light_barn",
      directlight: 3,
      scales: [1, 1, 1],
      origin: [0, 0, 0],
      angles: [0, 0, 0],
      size_params: [1, 1, 1],
      range: 4,
      precomputedfieldsvalid: 1,
      precomputedobborigin: [0, 0, 0],
      precomputedobbextent: [10, 10, 10],
      precomputedobbangles: [0, 0, 0],
      color: [255, 255, 255],
      brightness_lumens: 1,
    },
    { compiledShadowChannel: 2 },
  ).record;
  let cookies: T.DataArrayTexture | undefined;
  if (withCookie) {
    cookies = new T.DataArrayTexture(new Uint8Array([128, 128, 128, 0]), 1, 1, 1);
    cookies.format = T.RGBAFormat;
    cookies.colorSpace = T.SRGBColorSpace;
    cookies.internalFormat = "SRGB8_ALPHA8";
    cookies.needsUpdate = true;
  }
  const cookieDefinition = withCookie
    ? {
        width: 1,
        height: 1,
        layers: [
          {
            resource: "synthetic-mask",
            file: "unused",
            bytes: 4,
            sha256: "0".repeat(64),
            sourceSha256: "0".repeat(64),
            nativeMip: 0 as const,
            authoredMipCount: 1 as const,
            flags: 8,
          },
        ],
        qualification: "Independent synthetic RGB mask with zero alpha",
      }
    : undefined;
  const native = new NativeMapLocalLights(
    {
      cookies: cookieDefinition,
      version: 1,
      qualification: "Qualified VRF independent fixture",
      lights: [
        {
          id: "independent-unit",
          qualification: "Synthetic independent point",
          record: {
            ...base,
            ...(withCookie
              ? {
                  cookieKind: 1 as const,
                  cookieLayer: 0,
                  cookieResource: "synthetic-mask",
                  cookieTransform: [0, 0, 1, 1],
                }
              : {}),
            color: [2, 4, 6],
            depthFalloff: [1, 0, 0, 0],
            minimumRoughness: 1,
          },
        },
      ],
      rejected: [],
    },
    cookies,
  );
  const geometry = new T.PlaneGeometry(0.03, 0.03);
  geometry.setAttribute("uv1", geometry.getAttribute("uv"));
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(0.0254, 0, 0);
  const rows = [];
  for (const kind of ["atlas", "probe"] as const)
    for (const shadow of [0, 0.5])
      for (const ao of [1, 0.5])
        for (const direct of [true, false]) {
          const m = new T.MeshStandardMaterial({ color: 0xffffff, metalness: 0, roughness: 0.5 });
          m.userData.nativeSourceFamily = "complex";
          m.userData.nativeLocalDirectSpecular = direct;
          if (kind === "probe") m.userData.nativeBakedVisibility = "probe";
          m.onBeforeCompile = (shader) => {
            applySourceSurface(shader, { directSpecular: direct, indirectSpecular: false });
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <lights_physical_fragment>",
              "#include <lights_physical_fragment>\nmaterial.specularColorBlended=vec3(.04);",
            );
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <aomap_fragment>",
              `#include <aomap_fragment>\nreflectedLight.directSpecular*=${ao.toFixed(1)};`,
            );
            if (kind === "probe")
              shader.fragmentShader =
                `struct SourceGpuProbe{vec4 occlusion;};SourceGpuProbe nativePropProbe;\n` +
                shader.fragmentShader.replace(
                  "void main() {",
                  `void main() {nativePropProbe.occlusion=vec4(0.,0.,${shadow.toFixed(1)},0.);`,
                );
          };
          const scene = new T.Scene(),
            mesh = new T.Mesh(geometry, m);
          scene.add(mesh);
          const irrad = new T.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
          irrad.needsUpdate = true;
          const mask = new T.DataTexture(
            new Float32Array([0, 0, shadow, 0]),
            1,
            1,
            T.RGBAFormat,
            T.FloatType,
          );
          mask.needsUpdate = true;
          if (kind === "atlas") applyNativeMapLighting(scene, { irradiance: irrad, shadows: mask });
          applyNativeMapLocalLights(scene, native);
          renderer.setRenderTarget(target);
          native.render(renderer, () => renderer.render(scene, camera));
          const pixel = new Float32Array(4);
          renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
          rows.push({
            kind,
            shadow,
            ao,
            direct,
            pixel: [...pixel],
            error: renderer.getContext().getError(),
          });
          (mesh.material as T.Material).dispose();
          m.dispose();
          irrad.dispose();
          mask.dispose();
        }
  native.dispose();
  geometry.dispose();
  target.dispose();
  renderer.dispose();
  return rows;
}
