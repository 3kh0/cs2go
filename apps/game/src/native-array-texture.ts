import * as T from "three";

/** Bound one image allocation, not total residency. Software Vulkan keeps a
 * decoded image beside BC blocks; RGB16F may also occupy RGBA16F storage.
 * Leave headroom below SwiftShader's 1 GiB limit without dropping any texels. */
export function nativeArrayLayerLimit(
  mips: readonly { width: number; height: number; bytes: number }[],
  format: T.PixelFormat | T.CompressedPixelFormat,
  maxLayers: number,
) {
  const hdr =
    format === T.RGBFormat ||
    format === T.RGB_BPTC_UNSIGNED_Format ||
    format === T.RGB_BPTC_SIGNED_Format;
  const compressed = format !== T.RGBAFormat && format !== T.RGBFormat;
  const bytes = mips.reduce(
    (sum, mip) => sum + mip.width * mip.height * (hdr ? 8 : 4) + (compressed ? mip.bytes : 0),
    0,
  );
  return Math.max(1, Math.min(maxLayers, Math.floor((768 * 1024 * 1024) / bytes)));
}
