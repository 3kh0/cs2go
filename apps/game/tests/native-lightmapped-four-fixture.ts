import * as T from "three";
import {
  applyNativeMapLightmapped,
  type NativeLightmappedMaterial,
} from "../src/native-map-lightmapped";
import { loadSourceSurfaceLookup } from "../src/source-surface";
const base = "/@fs/Users/sh/Documents/GitHub/cs2go/";
function texture(values: number[], width = 1) {
  const t = new T.DataTexture(new Float32Array(values), width, 1, T.RGBAFormat, T.FloatType);
  t.minFilter = t.magFilter = T.NearestFilter;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}
export async function fourLightmappedProof() {
  const plan = await (
    await fetch(base + "artifacts/new-maps/metadata/lmg-followon-resolved-data-plan.json")
  ).json();
  const renderer = new T.WebGLRenderer({ antialias: false, premultipliedAlpha: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const lookup = await loadSourceSurfaceLookup(),
    rows = [];
  for (const kind of ["plain-opaque", "detail1-opaque", "specular-opaque", "nonspec-overlay"])
    for (const mode of ["color", "channels", "normal", "specular", "f0"]) {
      if (mode === "f0" && kind !== "specular-opaque") continue;
      const actual = plan.materials.find((r: { featureClass: string }) => r.featureClass === kind),
        source: NativeLightmappedMaterial = {
          shader: "csgo_lightmappedgeneric.vfx",
          selectedContract: "lmg-four-build26445667",
          programKind: actual.featureClass,
          nativeSourceSha256: actual.nativeResourceSha256,
          nativeResource: actual.nativeResource,
          exportedName: "diagnostic",
          exportedVariants: [
            {
              packedMaterialIndex: 0,
              baseColorFactor: [1, 1, 1, 0.5],
              nativeCombinedVSFactor: [0.2, 0.4, 0.6, 0.5],
            },
          ],
          tintTransportQualification: "Synthetic final VS factor, not private host upload",
          IntParams: actual.nativeMaterial.IntParams,
          FloatParams: actual.nativeMaterial.FloatParams,
          VectorParams: actual.nativeMaterial.VectorParams,
          resolvedMaterialInputs: structuredClone(actual.resolvedMaterialInputs),
          textures: {
            g_tColor: "color",
            g_tLayer1NormalRoughness: "normal",
            g_tLayer1AmbientOcclusion: "ao",
            g_tLayer1Detail: "detail",
          },
        };
      source.resolvedMaterialInputs.g_vLayer1Tint = [0.9, 0.8, 0.7, 0];
      if (kind === "detail1-opaque") {
        source.resolvedMaterialInputs.g_vLayer1DetailScale = [0.125, 0.125, 0, 0];
        source.resolvedMaterialInputs.g_vLayer1DetailTintAndBlend = [1, 1, 1, 0.8];
      }
      const geometry = new T.PlaneGeometry(2, 2);
      geometry.computeTangents();
      const uv = geometry.getAttribute("uv");
      for (let i = 0; i < uv.count; i++) uv.setXY(i, 6, 0.5);
      const material = new T.MeshStandardMaterial();
      material.name = "diagnostic";
      material.opacity = 0.5;
      material.userData.nativeGltfMaterialIndex = 0;
      const mesh = new T.Mesh(geometry, material),
        scene = new T.Scene();
      scene.add(mesh);
      const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.z = 3;
      const light = new T.DirectionalLight(0xffffff, Math.PI);
      light.position.z = 3;
      scene.add(light);
      const textures = new Map([
        ["color", texture([0.3, 0.6, 0.2, 0.8])],
        ["normal", texture([0.8, 0.2, 0.25, 0.9])],
        ["ao", texture([0.25, 0.7, 0.9, 0.1])],
        ["detail", texture([0.6, 0.1, 0.2, 0.7, 0.2, 0.7, 0.4, 0.1], 2)],
      ]);
      applyNativeMapLightmapped(scene, { materials: { source }, textures, lookup });
      material.blending = T.NoBlending;
      const before = material.onBeforeCompile.bind(material),
        key = material.customProgramCacheKey();
      material.customProgramCacheKey = () => key + ":diagnostic:" + mode;
      material.onBeforeCompile = (shader, r) => {
        before(shader, r);
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          mode === "color"
            ? "gl_FragColor=vec4(diffuseColor.rgb,diffuseColor.a);"
            : mode === "channels"
              ? "gl_FragColor=vec4(metalnessFactor,ambientOcclusion,roughnessFactor,diffuseColor.a);"
              : mode === "normal"
                ? "gl_FragColor=vec4(normal*.5+.5,diffuseColor.a);"
                : mode === "f0"
                  ? "gl_FragColor=vec4(material.specularColor,diffuseColor.a);"
                  : "gl_FragColor=vec4(reflectedLight.directSpecular,1.);",
        );
      };
      renderer.setRenderTarget(target);
      renderer.setClearColor(0, 0);
      renderer.clear();
      renderer.render(scene, camera);
      const raw = new Uint16Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, raw);
      rows.push({
        kind,
        mode,
        pixel: [...raw].map((v) => T.DataUtils.fromHalfFloat(v)),
        metalness: (source.resolvedMaterialInputs.g_flMetalness as number[])[0],
        error: renderer.getContext().getError(),
        depthWrite: material.depthWrite,
        transparent: material.transparent,
        polygonOffset: material.polygonOffset,
      });
      material.dispose();
      geometry.dispose();
      for (const t of new Set(textures.values())) t.dispose();
    }
  target.dispose();
  renderer.dispose();
  return rows;
}
