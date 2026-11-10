import * as T from "three";
import { fetchGzipped } from "./gltf";

export interface NativeLocalCookieAtlas {
  width: number;
  height: number;
  layers: {
    resource: string;
    file: string;
    bytes: number;
    sha256: string;
    sourceSha256: string;
    nativeMip: 0;
    authoredMipCount: 1;
    flags: number;
  }[];
  qualification: string;
}
/** Both admitted resources are authored 512² BGRA8888/NO_LOD, one mip.
 * Transport swaps B/R without resampling; API sRGB interpretation follows the
 * pinned VRF cookie atlas, not captured Valve-private atlas allocation. */
export async function loadNativeLocalCookies(directory: string, source: NativeLocalCookieAtlas) {
  if (
    !source.qualification ||
    !Number.isInteger(source.width) ||
    !Number.isInteger(source.height) ||
    source.width < 1 ||
    source.height < 1 ||
    !source.layers.length
  )
    throw new Error("Invalid qualified native cookie atlas");
  const layers = await Promise.all(
    source.layers.map(async (layer) => {
      if (
        !layer.resource ||
        !layer.file ||
        layer.file.startsWith("/") ||
        layer.file.split("/").includes("..") ||
        layer.bytes !== source.width * source.height * 4 ||
        layer.nativeMip !== 0 ||
        layer.authoredMipCount !== 1 ||
        !(layer.flags & 8) ||
        !/^[a-f0-9]{64}$/.test(layer.sha256) ||
        !/^[a-f0-9]{64}$/.test(layer.sourceSha256)
      )
        throw new Error("Invalid native NO_LOD cookie payload");
      const data = new Uint8Array(await fetchGzipped(directory + layer.file));
      if (data.byteLength !== layer.bytes) throw new Error("Native cookie byte count changed");
      // Match other native payload loaders on HTTP LAN development: gzip CRC
      // and exact size are always checked; secure contexts also verify SHA256.
      // Original transport/source SHA provenance is verified during staging.
      if (globalThis.crypto?.subtle) {
        const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", data))]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        if (hash !== layer.sha256) throw new Error("Native cookie bytes changed");
      }
      return data;
    }),
  );
  const data = new Uint8Array(layers.reduce((sum, layer) => sum + layer.byteLength, 0));
  layers.forEach((layer, index) => data.set(layer, index * source.width * source.height * 4));
  const texture = new T.DataArrayTexture(data, source.width, source.height, layers.length);
  texture.format = T.RGBAFormat;
  texture.type = T.UnsignedByteType;
  texture.colorSpace = T.SRGBColorSpace;
  texture.internalFormat = "SRGB8_ALPHA8";
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
  texture.generateMipmaps = false;
  texture.flipY = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}

/** Selected native PS5120/d4 positive-cookie branch: planar FMA UV, sample RGB
 * at LOD0 with linear black-border filtering. WebGL has no ClampToBorder, so
 * perform those same four decoded taps explicitly. Array layers replace native
 * private 3D-atlas packing; original logical images/UVs remain unchanged. */
export const nativeLocalCookieSampling = /* glsl */ `
uniform highp sampler2DArray nativeLocalCookies;
vec3 nativeLocalCookieTap(ivec2 p,int layer,ivec2 size){
 if(any(lessThan(p,ivec2(0)))||any(greaterThanEqual(p,size)))return vec3(0.);
 return texelFetch(nativeLocalCookies,ivec3(p,layer),0).rgb;
}
vec3 nativeLocalCookieSample(vec3 uvw){
 ivec2 size=textureSize(nativeLocalCookies,0).xy;
 vec2 pixel=uvw.xy*vec2(size)-.5;ivec2 lo=ivec2(floor(pixel));vec2 t=fract(pixel);int layer=int(uvw.z);
 return mix(mix(nativeLocalCookieTap(lo,layer,size),nativeLocalCookieTap(lo+ivec2(1,0),layer,size),t.x),
 mix(nativeLocalCookieTap(lo+ivec2(0,1),layer,size),nativeLocalCookieTap(lo+ivec2(1,1),layer,size),t.x),t.y);
}
`;
