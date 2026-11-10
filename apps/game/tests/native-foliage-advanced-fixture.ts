import * as T from "three";
import { createSourceFoliageAdvancedWind } from "../src/source-foliage-advanced-wind";
/** Independent literal-native controls: two production-format RGBA8 volumes,
 * explicit synthetic uniforms, float output avoids scene/tone-map ambiguity. */
export function renderNativeFoliageAdvanced() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(3, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(3, 1, { type: T.FloatType });
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 2;
  const geometry = new T.PlaneGeometry(2, 2);
  const results = [];
  for (const kind of ["negative-unclamped", "independent-fields", "time-zero"]) {
    const data = new Uint8Array(32);
    for (let z = 0; z < 2; z++)
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < 2; x++)
          data.set(
            kind === "negative-unclamped" ? [0, 0, 0, 255] : [x * 255, y * 255, 0, 255],
            ((z * 2 + y) * 2 + x) * 4,
          );
    const noise = new T.Data3DTexture(data, 2, 2, 2);
    noise.colorSpace = T.NoColorSpace;
    noise.format = T.RGBAFormat;
    noise.minFilter = noise.magFilter = T.LinearFilter;
    noise.wrapS = noise.wrapT = noise.wrapR = T.RepeatWrapping;
    noise.needsUpdate = true;
    const negative = kind === "negative-unclamped";
    const wind = createSourceFoliageAdvancedWind(
      [
        // Binary-exact eighth-texel weights avoid backend-dependent UNORM
        // filter precision without weakening the native arithmetic assertions.
        { strength: 2, falloff: 1, scale: [125, 125, 125], speed: [0.5, 0, 0] },
        { strength: 3, falloff: 1, scale: [125, 125, 125], speed: [0, 0.5, 0] },
      ],
      negative,
      { direction: [1, 0, 0], strength: 1, timeSeconds: kind === "time-zero" ? 0 : 1 },
      noise,
    );
    const material = new T.ShaderMaterial({
      uniforms: {
        ...wind.uniforms,
        point: { value: new T.Vector3(...(negative ? [10, 20, 30] : [2.5, 2.5, 2.5])) },
      },
      vertexShader: "void main(){gl_Position=vec4(position.xy,0,1);}",
      fragmentShader: `${wind.glsl}\nuniform vec3 point;void main(){vec3 p,n,t;sourceFoliageSwayFrame(point,vec3(0,0,1),vec3(1,0,0),vec4(.5,.7,.25,.3),p,n,t);gl_FragColor=vec4(gl_FragCoord.x<1.?p:gl_FragCoord.x<2.?t:n,1);}`,
    });
    const mesh = new T.Mesh(geometry, material);
    scene.add(mesh);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const values = new Float32Array(12);
    renderer.readRenderTargetPixels(target, 0, 0, 3, 1, values);
    results.push({
      kind,
      position: Array.from(values.slice(0, 3)),
      tangent: Array.from(values.slice(4, 7)),
      normal: Array.from(values.slice(8, 11)),
      glError: renderer.getContext().getError(),
    });
    scene.remove(mesh);
    material.dispose();
    noise.dispose();
  }
  geometry.dispose();
  target.dispose();
  renderer.dispose();
  return results;
}
