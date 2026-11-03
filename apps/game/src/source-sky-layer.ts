import * as T from "three";
import { fetchGzipped } from "./gltf";
import { loadSourceMaterialBundle } from "./source-layers";

/** Linear HDR composition for the native sky world, before the existing tone/LUT. */
export async function sourceSkyLayer(renderer: T.WebGLRenderer, cube: T.CompressedCubeTexture) {
  const [bundle, bytes] = await Promise.all([
    loadSourceMaterialBundle(renderer, "/models/maps/lighting/sky/"),
    fetchGzipped("/models/maps/lighting/sky/clouds.json.gz"),
  ]);
  const data = JSON.parse(new TextDecoder().decode(bytes)) as {
    positions: number[];
    uvs: number[];
    colors: number[];
    indices: number[];
  };
  const scene = new T.Scene();
  const skyCamera = new T.PerspectiveCamera();
  const background = new T.ShaderMaterial({
    uniforms: { sky: { value: cube } },
    vertexShader: `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*mat4(mat3(viewMatrix))*vec4(position,1.0);gl_Position.z=gl_Position.w;}`,
    fragmentShader: `uniform samplerCube sky;varying vec3 direction;void main(){vec3 d=normalize(direction);gl_FragColor=vec4(textureCube(sky,vec3(d.x,-d.z,d.y)).rgb*exp2(0.765),1.0);}`,
    side: T.BackSide,
    depthWrite: false,
    toneMapped: false,
  });
  const base = new T.Mesh(new T.BoxGeometry(1, 1, 1), background);
  base.frustumCulled = false;
  base.renderOrder = -1000;
  scene.add(base);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(data.uvs, 2));
  geometry.setAttribute("color", new T.Float32BufferAttribute(data.colors, 3));
  geometry.setIndex(data.indices);
  const time = { value: 0 };
  const clouds = new T.ShaderMaterial({
    uniforms: {
      cloud1: { value: bundle.textures.get("cloud1") },
      cloud2: { value: bundle.textures.get("cloud2") },
      time,
    },
    vertexShader: `varying vec2 cloudUv;varying vec3 cloudTint;void main(){cloudUv=uv;cloudTint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D cloud1;uniform sampler2D cloud2;uniform float time;varying vec2 cloudUv;varying vec3 cloudTint;void main(){vec4 c=texture2D(cloud1,cloudUv*3.5+vec2(0.0,fract(time*0.0020000000949949026)))*texture2D(cloud2,cloudUv);gl_FragColor=vec4(c.rgb*cloudTint,c.a);}`,
    vertexColors: true,
    transparent: true,
    blending: T.CustomBlending,
    blendSrc: T.SrcAlphaFactor,
    blendDst: T.OneFactor,
    blendEquation: T.AddEquation,
    depthWrite: false,
    toneMapped: false,
  });
  scene.add(new T.Mesh(geometry, clouds));
  const target = new T.WebGLRenderTarget(1, 1, {
    type: renderer.extensions.has("EXT_color_buffer_float") ? T.HalfFloatType : T.UnsignedByteType,
    depthBuffer: true,
  });
  target.texture.colorSpace = T.LinearSRGBColorSpace;
  target.texture.generateMipmaps = false;
  target.texture.minFilter = target.texture.magFilter = T.LinearFilter;
  const viewport = new T.Vector4(),
    logicalViewport = new T.Vector4();
  const position = new T.Vector3(),
    rotation = new T.Quaternion(),
    scale = new T.Vector3();
  const lastWorld = new T.Matrix4(),
    lastProjection = new T.Matrix4();
  let lastBucket = -1,
    lastWidth = 0,
    lastHeight = 0;
  function update(camera: T.Camera) {
    renderer.getCurrentViewport(viewport);
    const ratio = Math.min(1, Math.sqrt(2097152 / (viewport.z * viewport.w)));
    const width = Math.max(1, Math.round(viewport.z * ratio)),
      height = Math.max(1, Math.round(viewport.w * ratio));
    const now = performance.now() / 1000,
      bucket = Math.floor(now * 30);
    const projection = camera.projectionMatrix.elements;
    const oldProjection = lastProjection.elements;
    const sameProjection = projection.every(
      (v, i) => i === 10 || i === 14 || v === oldProjection[i],
    );
    if (
      bucket === lastBucket &&
      width === lastWidth &&
      height === lastHeight &&
      lastWorld.equals(camera.matrixWorld) &&
      sameProjection
    )
      return;
    if (width !== lastWidth || height !== lastHeight) target.setSize(width, height);
    lastWorld.copy(camera.matrixWorld);
    lastProjection.copy(camera.projectionMatrix);
    lastBucket = bucket;
    lastWidth = width;
    lastHeight = height;
    camera.matrixWorld.decompose(position, rotation, scale);
    skyCamera.position
      .copy(position)
      .multiplyScalar(1 / 16)
      .add(new T.Vector3(-8, 202, 308).multiplyScalar(0.0254));
    skyCamera.quaternion.copy(rotation);
    skyCamera.projectionMatrix.copy(camera.projectionMatrix);
    const near = 0.01,
      far = 2000;
    skyCamera.projectionMatrix.elements[10] = -(far + near) / (far - near);
    skyCamera.projectionMatrix.elements[14] = (-2 * far * near) / (far - near);
    skyCamera.projectionMatrixInverse.copy(skyCamera.projectionMatrix).invert();
    time.value = now;
    const destination = renderer.getRenderTarget(),
      autoClear = renderer.autoClear,
      toneMapping = renderer.toneMapping;
    renderer.getViewport(logicalViewport);
    try {
      renderer.autoClear = true;
      renderer.toneMapping = T.NoToneMapping;
      renderer.setRenderTarget(target);
      renderer.render(scene, skyCamera);
    } finally {
      renderer.setRenderTarget(destination);
      renderer.setViewport(logicalViewport);
      renderer.autoClear = autoClear;
      renderer.toneMapping = toneMapping;
    }
  }
  function dispose() {
    target.dispose();
    geometry.dispose();
    clouds.dispose();
    base.geometry.dispose();
    background.dispose();
    bundle.textures.forEach((texture) => texture.dispose());
  }
  return { texture: target.texture, viewport, update, dispose, scene };
}
