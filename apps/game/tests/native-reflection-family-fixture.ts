import * as T from "three";
import { applySourceReflections, type SourceReflections } from "../src/source-reflections";
/** Independently controlled quality1 normalization/projection equations. The
 * native .01 coverage floor is deliberately visible; legacy behavior is control. */
export function renderNativeReflectionFamilies(
  options: {
    normalSource?: [number, number, number];
    directionPalette?: boolean;
    disableWaterShape?: boolean;
  } = {},
) {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(1, 1);
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const results = [];
  for (const mode of ["normalization", "projection"] as const) {
    const bytes = new Uint8Array(4 * 4 * 6 * 4);
    for (let face = 0; face < 6; face++)
      for (let i = 0; i < 16; i++)
        bytes.set(
          mode === "normalization" && !options.directionPalette
            ? [128, 128, 128, 255]
            : face === 0
              ? [255, 0, 0, 255]
              : face === 4
                ? [0, 0, 255, 255]
                : [0, 255, 0, 255],
          (face * 16 + i) * 4,
        );
    const cube = new T.CompressedArrayTexture(
      [{ width: 4, height: 4, data: bytes }],
      4,
      4,
      6,
      T.RGB_BPTC_UNSIGNED_Format,
    );
    Object.assign(cube, { format: T.RGBAFormat, type: T.UnsignedByteType });
    cube.minFilter = cube.magFilter = T.NearestFilter;
    cube.needsUpdate = true;
    const min = mode === "normalization" ? [-1, -1, -1] : [-10, -10, -1],
      max = mode === "normalization" ? [1, 1, 1] : [10, 10, 1],
      edge = mode === "normalization" ? 0.5 : 1;
    const data: SourceReflections = {
      lightmapVersion: [8, 2],
      cubeSize: 4,
      arraySplit: 1,
      combined: true,
      lastLod: 0,
      textures: [cube],
      volumes: [
        {
          index: 0,
          origin: [0, 0, 0],
          min,
          max,
          fade: [1 / edge, 1 / edge, 1 / edge],
          normalizationSH: [0, 0, 0, mode === "normalization" ? 2 : 0],
        },
      ],
      uniforms: [
        {
          index: 0,
          origin: new T.Vector3(),
          mins: new T.Vector3(...min),
          maxs: new T.Vector3(...max),
          invEdge: new T.Vector3(edge, edge, edge),
          sh: new T.Vector4(0, 0, 0, mode === "normalization" ? 2 : 0),
        },
      ],
    };
    for (const family of [undefined, "complex", "water"] as const)
      for (const roughness of mode === "normalization" ? [0] : [0, 1]) {
        const scene = new T.Scene(),
          camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
        camera.position.z = 1;
        const material = new T.ShaderMaterial({
          vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
          fragmentShader: `
#define RE_IndirectSpecular(a,b,c,d,e,f,g,h,i)
const float RECIPROCAL_PI=.3183098861837907;
struct TestMaterial{float roughness;};
void main(){TestMaterial material;material.roughness=${roughness}.0;vec3 radiance=vec3(0.0),irradiance=vec3(.7853981633974483);
RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
gl_FragColor=vec4(radiance,1.0);}`,
        });
        material.onBeforeCompile = (shader) => {
          applySourceReflections(shader, data, [0], {
            nativeFamily: family,
            worldPosition: mode === "normalization" ? "vec3(0.0)" : "vec3(.2286,0.0,0.0)",
            worldNormal: options.normalSource
              ? `vec3(${options.normalSource[0]},${options.normalSource[2]},${-options.normalSource[1]})`
              : "vec3(0.0,1.0,0.0)",
            worldView: "vec3(0.0,1.0,0.0)",
          });
          if (options.disableWaterShape)
            shader.fragmentShader = shader.fragmentShader.replace(
              "return (worldToViewRow*vec4(normalize(viewNormal),0.0)).xyz;",
              "return normalize(normalSource);",
            );
        };
        scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), material));
        renderer.setRenderTarget(target);
        renderer.render(scene, camera);
        const pixel = new Uint8Array(4);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
        results.push({
          mode,
          family: family ?? "legacy",
          roughness,
          pixel: [...pixel],
          error: renderer.getContext().getError(),
        });
        material.dispose();
      }
    cube.dispose();
  }
  target.dispose();
  renderer.dispose();
  return results;
}
