import * as T from "three";
import { fetchGzipped } from "./gltf";

export interface NativeCube {
  file: string;
  format: "BC6H";
  gpuBytes: number;
  mips: { width: number; height: number; bytes: number }[];
  fallbackFile: string;
  fallbackBytes: number;
  fallbackMips: { width: number; height: number; bytes: number }[];
}
export function validateNativeCube(entry: NativeCube) {
  const size = entry.mips?.[0]?.width;
  if (
    entry.format !== "BC6H" ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 1024 ||
    size & (size - 1) ||
    entry.mips.length < 1 ||
    entry.mips.length > Math.log2(size) + 1 ||
    entry.fallbackMips?.length !== entry.mips.length
  )
    throw new Error("Invalid native cube layout/budget");
  let compressed = 0,
    fallback = 0;
  entry.mips.forEach((mip, index) => {
    const width = Math.max(1, size >> index),
      other = entry.fallbackMips[index];
    if (
      mip.width !== width ||
      mip.height !== width ||
      mip.bytes !== Math.ceil(width / 4) ** 2 * 16 * 6 ||
      other.width !== width ||
      other.height !== width ||
      other.bytes !== width * width * 8 * 6
    )
      throw new Error("Invalid native cube mip/face lengths");
    compressed += mip.bytes;
    fallback += other.bytes;
  });
  if (
    compressed !== entry.gpuBytes ||
    fallback !== entry.fallbackBytes ||
    fallback > 64 * 1024 * 1024
  )
    throw new Error("Invalid native cube payload budget");
  return size;
}

/** Original native face layers and authored mips, without PMREM or reorientation. */
export async function loadNativeCube(
  renderer: T.WebGLRenderer,
  directory: string,
  entry: NativeCube,
) {
  const size = validateNativeCube(entry),
    compressed = renderer.extensions.has("EXT_texture_compression_bptc");
  const bytes = await fetchGzipped(directory + (compressed ? entry.file : entry.fallbackFile));
  if (bytes.byteLength !== (compressed ? entry.gpuBytes : entry.fallbackBytes))
    throw new Error("Invalid native cube bytes");
  let offset = 0;
  const mips = (compressed ? entry.mips : entry.fallbackMips).map((mip) => {
    const data = compressed
      ? new Uint8Array(bytes, offset, mip.bytes)
      : new Uint16Array(bytes, offset, mip.bytes / 2);
    offset += mip.bytes;
    return { width: mip.width, height: mip.height, data };
  });
  const texture = new T.CompressedArrayTexture(mips, size, size, 6, T.RGB_BPTC_UNSIGNED_Format);
  if (!compressed) {
    // Three 0.187 uploads manual array mips through this class's explicit
    // RGBA branch. DataArrayTexture only uploads level0, ignoring mipmaps.
    Object.assign(texture, { type: T.HalfFloatType, format: T.RGBAFormat });
  }
  texture.colorSpace = T.NoColorSpace;
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = T.LinearMipmapLinearFilter;
  texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
