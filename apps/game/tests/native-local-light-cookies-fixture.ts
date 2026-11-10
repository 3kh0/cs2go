import * as T from "three";
import { nativeLocalLightKernel } from "../src/native-local-light-kernel";
import { nativeLocalCookieSampling } from "../src/native-local-light-cookies";
import { renderMapLocalLights } from "./native-map-local-lights-fixture";
export function renderNativeCookieControls() {
  const width = 4,
    height = 4,
    depth = 3,
    data = new Uint8Array(width * height * depth * 4);
  for (let l = 0; l < depth; l++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        data.set(
          l === 2
            ? [128, 128, 128, 0]
            : [32 + x * 50 + l * 17, 24 + y * 53 + l * 19, 48 + (x + y) * 20 + l * 23, 0],
          ((l * height + y) * width + x) * 4,
        );
  const texture = new T.DataArrayTexture(data, width, height, depth);
  texture.type = T.UnsignedByteType;
  texture.format = T.RGBAFormat;
  texture.colorSpace = T.SRGBColorSpace;
  texture.internalFormat = "SRGB8_ALPHA8";
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  const renderer = new T.WebGLRenderer();
  renderer.setSize(1, 1);
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  const material = new T.ShaderMaterial({
      uniforms: { nativeLocalCookies: { value: texture }, query: { value: new T.Vector3() } },
      vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader:
        nativeLocalCookieSampling +
        "\nuniform vec3 query;void main(){gl_FragColor=vec4(nativeLocalCookieSample(query),1.);}",
    }),
    geometry = new T.PlaneGeometry(2, 2),
    scene = new T.Scene(),
    camera = new T.Camera();
  scene.add(new T.Mesh(geometry, material));
  const rows = [];
  for (const layer of [0, 1])
    for (const uv of [
      [0, 0],
      [0.125, 0.125],
      [0.5, 0.5],
      [1, 1],
      [-0.125, 0.5],
      [1.125, 0.5],
      [0.02, 0.9],
    ]) {
      material.uniforms.query.value.set(uv[0], uv[1], layer);
      renderer.setRenderTarget(target);
      renderer.render(scene, camera);
      const pixel = new Float32Array(4);
      renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
      rows.push({ uv, layer, pixel: [...pixel], error: renderer.getContext().getError() });
    }
  const decodedTexels: number[][] = [];
  const reference = new T.ShaderMaterial({
    uniforms: { nativeLocalCookies: { value: texture }, query: { value: new T.Vector3() } },
    vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader:
      "uniform highp sampler2DArray nativeLocalCookies;uniform vec3 query;void main(){gl_FragColor=textureLod(nativeLocalCookies,query,0.);}",
  });
  (scene.children[0] as T.Mesh).material = reference;
  for (let l = 0; l < depth; l++)
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        reference.uniforms.query.value.set((x + 0.5) / width, (y + 0.5) / height, l);
        renderer.render(scene, camera);
        const pixel = new Float32Array(4);
        renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
        decodedTexels.push([...pixel]);
      }
  reference.dispose();
  const qMaterial = new T.ShaderMaterial({
    uniforms: {
      query: { value: new T.Vector3() },
      fixtureLight: {
        value: {
          projection: new T.Matrix4(),
          worldToBounds: new T.Matrix4(),
          positionRadius: new T.Vector4(0, 0, 1, 0),
          depthFalloff: new T.Vector4(1, 0, 0, 0),
          color: new T.Vector4(1, 1, 1, 2),
          rotation: new T.Vector4(0, 0, 0, 1),
          angularLine: new T.Vector4(1, 0, 0, 0),
          barn: new T.Vector4(0, 0, 1, 1),
          shadowWeights: new T.Vector4(),
          roughness: new T.Vector4(0.2, 0, 0, 0),
        },
      },
    },
    vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader:
      nativeLocalLightKernel +
      "\nuniform NativeBakedLocalLight fixtureLight;uniform vec3 query;void main(){NativeLocalLightSample p=nativeBakedLocalLight(fixtureLight,query,vec4(0.));gl_FragColor=p.enabled?vec4(p.cookieUVW,1.):vec4(-2.);}",
  });
  (scene.children[0] as T.Mesh).material = qMaterial;
  const coordinates = [];
  for (const q of [
    [-0.75, 0.75, 0.5],
    [0.75, -0.75, 0.5],
    [0, 0, 0.5],
    [-1, 0, 0.5],
    [1, 0, 0.5],
    [0, 0, 0],
    [0, 0, 1],
    [0, 1.1, 0.5],
  ]) {
    qMaterial.uniforms.query.value.fromArray(q);
    renderer.render(scene, camera);
    const pixel = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    coordinates.push({ q, pixel: [...pixel], error: renderer.getContext().getError() });
  }
  qMaterial.dispose();
  geometry.dispose();
  material.dispose();
  texture.dispose();
  target.dispose();
  renderer.dispose();
  return {
    width,
    height,
    depth,
    data: [...data],
    rows,
    coordinates,
    decodedTexels,
    integration: renderMapLocalLights(true),
  };
}
