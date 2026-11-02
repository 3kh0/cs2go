import * as T from "three";
import { fetchGzipped } from "./gltf";
import { setSourceFogSky } from "./source-fog";

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
  const material = new T.ShaderMaterial({
    uniforms: { sourceSky: { value: texture } },
    vertexShader: `varying vec3 sourceSkyDirection;
      void main() {
        sourceSkyDirection = position;
        gl_Position = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: `uniform samplerCube sourceSky; varying vec3 sourceSkyDirection;
      void main() {
        vec3 d = normalize(sourceSkyDirection);
        vec3 color = textureCube(sourceSky, vec3(d.x, -d.z, d.y)).rgb * exp2(0.765);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: T.BackSide,
    depthWrite: false,
  });
  const mesh = new T.Mesh(new T.BoxGeometry(1, 1, 1), material);
  mesh.name = "Native Dust II sky";
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  return mesh;
}
