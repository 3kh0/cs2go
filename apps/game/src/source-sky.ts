import * as T from "three";
import { fetchGzipped } from "./gltf";
import { setSourceFogSky } from "./source-fog";
import { sourceSkyLayer } from "./source-sky-layer";

const skyPreparation = new WeakMap<T.Object3D, () => Promise<void>>();
export async function warmSourceSky(sky?: T.Object3D, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const prepared = sky ? skyPreparation.get(sky)?.() : undefined;
  if (!prepared) return;
  if (!signal) return prepared;
  let aborted: () => void = () => {};
  try {
    await Promise.race([
      prepared,
      new Promise<never>((_, reject) => {
        aborted = () => reject(signal.reason);
        signal.addEventListener("abort", aborted, { once: true });
      }),
    ]);
  } finally {
    signal.removeEventListener("abort", aborted);
  }
}

const skyUpdates = new WeakMap<T.Object3D, (camera: T.Camera) => void>();

export function bindSourceSky(scene: T.Scene, sky: T.Object3D, root: T.Object3D) {
  const before = scene.onBeforeRender.bind(scene),
    after = scene.onAfterRender.bind(scene);
  let reset = false;
  scene.onBeforeRender = function (...args) {
    before.apply(this, args);
    if (!root.visible) return;
    reset = args[0].info.autoReset;
    if (reset) args[0].info.reset();
    args[0].info.autoReset = false;
    skyUpdates.get(sky)?.(args[2]);
  };
  scene.onAfterRender = function (...args) {
    try {
      after.apply(this, args);
    } finally {
      if (reset) args[0].info.autoReset = true;
      reset = false;
    }
  };
}

// Native BC6H cube faces/mips, sampled in Source's Z-up axes
export async function loadSourceSky(renderer: T.WebGLRenderer) {
  if (!renderer.extensions.has("EXT_texture_compression_bptc")) {
    setSourceFogSky();
    return undefined;
  }
  const data = await fetchGzipped("/models/maps/lighting/native/sky.bin.gz");
  if (data.byteLength !== 2097120) throw new Error("Invalid native Dust II sky");
  const faces = Array.from({ length: 6 }, () => ({
    width: 512,
    height: 512,
    mipmaps: [] as { width: number; height: number; data: Uint8Array }[],
  }));
  let offset = 0;
  for (let level = 0; level < 8; level++) {
    const size = 512 >> level;
    const bytes = Math.ceil(size / 4) ** 2 * 16;
    for (const face of faces) {
      face.mipmaps.push({ width: size, height: size, data: new Uint8Array(data, offset, bytes) });
      offset += bytes;
    }
  }
  const texture = new T.CompressedCubeTexture(faces, T.RGB_BPTC_UNSIGNED_Format);
  texture.colorSpace = T.NoColorSpace;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  setSourceFogSky(texture);
  const layer = await sourceSkyLayer(renderer, texture);
  const material = new T.ShaderMaterial({
    uniforms: {
      sourceSkyFrame: { value: layer.texture },
      sourceSkyViewport: { value: layer.viewport },
    },
    vertexShader: `varying vec3 sourceSkyDirection;
      void main() {
        sourceSkyDirection = position;
        gl_Position = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `uniform sampler2D sourceSkyFrame; uniform vec4 sourceSkyViewport;
      void main() {
        vec2 uv=(gl_FragCoord.xy-sourceSkyViewport.xy)/sourceSkyViewport.zw;
        gl_FragColor=vec4(texture2D(sourceSkyFrame,uv).rgb,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: T.BackSide,
    depthWrite: false,
  });
  const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), material);
  mesh.name = "Native Dust II sky";
  mesh.frustumCulled = false;
  skyUpdates.set(mesh, layer.update);
  skyPreparation.set(mesh, layer.prepare);
  material.addEventListener("dispose", layer.dispose);
  mesh.renderOrder = -1000;
  return mesh;
}
