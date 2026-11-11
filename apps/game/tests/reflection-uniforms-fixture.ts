import * as T from "three";
import { applySourceReflections, type SourceReflections } from "../src/source-reflections";

type Uploads = {
  uniform3f: number;
  uniform4f: number;
  uniform4fv: number;
  uniformMatrix4fv: number;
};
const emptyUploads = (): Uploads => ({
  uniform3f: 0,
  uniform4f: 0,
  uniform4fv: 0,
  uniformMatrix4fv: 0,
});

/** Transport comparison, with synthetic direction/mip palettes rather than map assets. */
export function reflectionUniformsFixture() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(16, 16);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(16, 16, { type: T.FloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const scene = new T.Scene(),
    camera = new T.Camera(),
    geometry = new T.PlaneGeometry(2, 2);
  const mesh = new T.Mesh(geometry);
  scene.add(mesh);
  const gl = renderer.getContext();
  const locations = new Map<WebGLUniformLocation, string>();
  let uploads = emptyUploads();
  const getUniformLocation = gl.getUniformLocation.bind(gl);
  gl.getUniformLocation = (program, name) => {
    const location = getUniformLocation(program, name);
    if (location) locations.set(location, name);
    return location;
  };
  const count = (location: WebGLUniformLocation | null, method: keyof Uploads) => {
    const name = location && locations.get(location);
    if (
      name &&
      (name.startsWith("sourceEnvironments[") || name.startsWith("nativeReflectionWords["))
    )
      uploads[method]++;
  };
  const uniform3f = gl.uniform3f.bind(gl),
    uniform4f = gl.uniform4f.bind(gl),
    uniform4fv = gl.uniform4fv.bind(gl),
    uniformMatrix4fv = gl.uniformMatrix4fv.bind(gl);
  gl.uniform3f = (location, x, y, z) => {
    count(location, "uniform3f");
    uniform3f(location, x, y, z);
  };
  gl.uniform4f = (location, x, y, z, w) => {
    count(location, "uniform4f");
    uniform4f(location, x, y, z, w);
  };
  gl.uniform4fv = (location, data, offset, length) => {
    count(location, "uniform4fv");
    uniform4fv(location, data, offset, length);
  };
  gl.uniformMatrix4fv = (location, transpose, data, offset, length) => {
    count(location, "uniformMatrix4fv");
    uniformMatrix4fv(location, transpose, data, offset, length);
  };
  const mipmaps = [4, 2, 1].map((size, lod) => {
    const bytes = new Uint8Array(size * size * 18 * 4);
    for (let cube = 0; cube < 3; cube++)
      for (let face = 0; face < 6; face++)
        for (let pixel = 0; pixel < size * size; pixel++)
          bytes.set(
            [40 + cube * 55 + lod * 7, 20 + face * 35, 180 - cube * 30 - lod * 20, 255],
            ((cube * 6 + face) * size * size + pixel) * 4,
          );
    return { width: size, height: size, data: bytes };
  });
  const cube = new T.CompressedArrayTexture(mipmaps, 4, 4, 18, T.RGB_BPTC_UNSIGNED_Format);
  Object.assign(cube, { format: T.RGBAFormat, type: T.UnsignedByteType });
  cube.minFilter = T.LinearMipmapLinearFilter;
  cube.magFilter = T.LinearFilter;
  cube.needsUpdate = true;
  const makeData = (affine: boolean, variant: number): SourceReflections => {
    const uniforms = Array.from({ length: 3 }, (_, i) => {
      const origin = new T.Vector3(i * 2 - 2 + variant, i - 1, 0);
      const localToWorld = new T.Matrix4().compose(
        origin,
        new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 0, 1), (i + 1) * 0.27),
        new T.Vector3(0.8 + i * 0.2, 1.3, 0.9),
      );
      return {
        origin,
        index: (i + variant) % 3,
        mins: new T.Vector3(-12, -10, -8),
        maxs: new T.Vector3(12, 10, 8),
        invEdge: new T.Vector3(0.055, 0.065, 0.075),
        sh: new T.Vector4(0.04 * i, 0.03, 0.02, 0.8 + i * 0.3 + variant * 0.2),
        ...(affine ? { localToWorld, worldToLocal: localToWorld.clone().invert() } : {}),
      };
    });
    return {
      lightmapVersion: [8, 2],
      cubeSize: 4,
      arraySplit: 3,
      combined: true,
      lastLod: 2,
      textures: [cube],
      uniforms,
      volumes: uniforms.map((v) => ({
        index: v.index,
        origin: v.origin.toArray(),
        min: v.mins.toArray(),
        max: v.maxs.toArray(),
        fade: [1, 1, 1],
        normalizationSH: v.sh.toArray(),
        ...(affine
          ? { worldToLocal: v.worldToLocal!.toArray(), localToWorld: v.localToWorld!.toArray() }
          : {}),
      })),
    };
  };
  const results = [];
  let maxError = 0,
    nonFinite = 0,
    sharedRestoreError = 0;
  renderer.setRenderTarget(target);
  for (const affine of [false, true])
    for (const family of [undefined, "complex", "glass", "lightmapped", "water"] as const) {
      const datasets = [makeData(affine, 0), makeData(affine, 1)];
      const materials = [false, true].map((packedUniforms) =>
        datasets.map((data, variant) => {
          const roughness = { value: 0 };
          const count = { value: 3 };
          let candidates: { value: Int32Array } | undefined;
          const material = new T.ShaderMaterial({
            uniforms: { testRoughness: roughness },
            vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
            fragmentShader: `
#define RE_IndirectSpecular(a,b,c,d,e,f,g,h,i)
const float RECIPROCAL_PI=.3183098861837907;
uniform float testRoughness;
struct TestMaterial{float roughness;};
void main(){TestMaterial material;material.roughness=testRoughness;vec3 radiance=vec3(0.0),irradiance=vec3(1.7,1.2,.9);
RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
gl_FragColor=vec4(radiance,1.0);}`,
          });
          material.onBeforeCompile = (shader) => {
            applySourceReflections(shader, data, [0, 1, 2], {
              packedUniforms,
              count,
              nativeFamily: family,
              worldPosition: "vec3((gl_FragCoord.x-8.0)*.0254,0.0,(gl_FragCoord.y-8.0)*.0254)",
              worldNormal: "normalize(vec3(.2,1.0,.3))",
              worldView: "normalize(vec3(.3,.8,.4))",
            });
            candidates = shader.uniforms.sourceEnvironmentCandidates;
          };
          material.customProgramCacheKey = () =>
            `reflection-transport:${affine}:${family}:${packedUniforms}`;
          return {
            material,
            roughness,
            count,
            variant,
            get candidates() {
              return candidates!;
            },
          };
        }),
      );
      const firstUploads: Uploads[] = [];
      const read = (
        mode: number,
        variant: number,
        roughness: number,
        reverse: boolean,
        count: number,
      ) => {
        const state = materials[mode][variant];
        state.roughness.value = roughness;
        state.count.value = count;
        state.candidates?.value.set(reverse ? [2, 1, 0] : [0, 1, 2]);
        mesh.material = state.material;
        uploads = emptyUploads();
        renderer.render(scene, camera);
        const pixels = new Float32Array(16 * 16 * 4);
        renderer.readRenderTargetPixels(target, 0, 0, 16, 16, pixels);
        return { pixels, uploads: { ...uploads } };
      };
      for (const mode of [0, 1]) firstUploads.push(read(mode, 0, 0, false, 3).uploads);
      let cases = 0,
        differenceFromOther = 0;
      for (const roughness of [0, 0.35, 1])
        for (const reverse of [false, true])
          for (const count of [1, 3]) {
            for (const variant of [0, 1, 0]) {
              const a = read(0, variant, roughness, reverse, count),
                b = read(1, variant, roughness, reverse, count);
              for (let i = 0; i < a.pixels.length; i++) {
                if (!Number.isFinite(a.pixels[i]) || !Number.isFinite(b.pixels[i])) nonFinite++;
                maxError = Math.max(maxError, Math.abs(a.pixels[i] - b.pixels[i]));
              }
              cases++;
            }
            const restored = read(1, 0, roughness, reverse, count).pixels;
            const alternate = read(1, 1, roughness, reverse, count).pixels;
            const again = read(1, 0, roughness, reverse, count).pixels;
            for (let i = 0; i < restored.length; i++) {
              sharedRestoreError = Math.max(sharedRestoreError, Math.abs(restored[i] - again[i]));
              differenceFromOther = Math.max(
                differenceFromOther,
                Math.abs(restored[i] - alternate[i]),
              );
            }
          }
      results.push({
        affine,
        family: family ?? "legacy",
        cases,
        firstUploads,
        differenceFromOther,
      });
      for (const rows of materials) for (const row of rows) row.material.dispose();
    }
  const glError = gl.getError();
  cube.dispose();
  geometry.dispose();
  target.dispose();
  renderer.dispose();
  return { results, maxError, sharedRestoreError, nonFinite, glError };
}
