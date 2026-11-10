import * as T from "three";

type SharedTexture = { source: T.Texture["source"]; mipmaps: T.Texture["mipmaps"] };
const entries = new Map<string, WeakRef<SharedTexture>>();
// A live wrapper retains its weak-cache entry; the cache never owns texture bytes.
const states = new WeakMap<T.Texture, { identity: string; entry?: SharedTexture }>();
const sourceIdentities = new WeakMap<T.Texture["source"], string>();
const cleanup = new FinalizationRegistry<string>((key) => {
  if (!entries.get(key)?.deref()) entries.delete(key);
});

/** Metadata narrows candidates; actual mip bytes must also match before sharing. */
export function nativeTextureIdentity(
  format: string,
  mips: readonly { width: number; height: number; bytes: number; sha256?: string }[],
  gpuSha256?: string,
  nativeMip = 0,
) {
  const sha = (value: string | undefined) => !!value && /^[a-f\d]{64}$/i.test(value);
  if (!mips.length || (!sha(gpuSha256) && mips.some((mip) => !sha(mip.sha256)))) return;
  return JSON.stringify([
    format,
    gpuSha256,
    nativeMip,
    mips.map((mip) => [mip.width, mip.height, mip.bytes, mip.sha256]),
  ]);
}

function signature(texture: T.Texture, identity: string) {
  const image = texture.image as { width?: number; height?: number; depth?: number };
  return JSON.stringify([
    identity,
    texture.constructor.name,
    texture.format,
    texture.type,
    texture.internalFormat,
    texture.colorSpace,
    texture.wrapS,
    texture.wrapT,
    "wrapR" in texture ? texture.wrapR : undefined,
    texture.minFilter,
    texture.magFilter,
    texture.anisotropy,
    texture.flipY,
    texture.premultiplyAlpha,
    texture.unpackAlignment,
    texture.generateMipmaps,
    "compareFunction" in texture ? texture.compareFunction : undefined,
    image?.width,
    image?.height,
    image?.depth,
    texture.mipmaps.map((mip) => [mip.width, mip.height]),
  ]);
}
function sameBytes(a: ArrayBufferView, b: ArrayBufferView) {
  if (a.byteLength !== b.byteLength) return false;
  if (a.buffer === b.buffer && a.byteOffset === b.byteOffset) return true;
  let offset = 0;
  if (!(a.byteOffset % 4) && !(b.byteOffset % 4)) {
    const length = Math.floor(a.byteLength / 4);
    const aa = new Uint32Array(a.buffer, a.byteOffset, length);
    const bb = new Uint32Array(b.buffer, b.byteOffset, length);
    for (let i = 0; i < length; i++) if (aa[i] !== bb[i]) return false;
    offset = length * 4;
  }
  const aa = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const bb = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (; offset < aa.length; offset++) if (aa[offset] !== bb[offset]) return false;
  return true;
}
function sameMips(a: T.Texture["mipmaps"], b: T.Texture["mipmaps"]) {
  const aa = a as { width: number; height: number; data?: unknown }[];
  const bb = b as { width: number; height: number; data?: unknown }[];
  return (
    aa.length > 0 &&
    aa.length === bb.length &&
    aa.every(
      (mip, i) =>
        mip.width === bb[i].width &&
        mip.height === bb[i].height &&
        ArrayBuffer.isView(mip.data) &&
        ArrayBuffer.isView(bb[i].data) &&
        sameBytes(mip.data, bb[i].data),
    )
  );
}

/** Separate wrappers retain independent sampler/disposal state. Three reference
 * counts matching TextureSources, including reupload after GPU/context loss. */
export function shareNativeTexture(texture: T.Texture, identity?: string) {
  const prior = states.get(texture);
  identity ??= prior?.identity;
  if (!identity) return;
  const key = signature(texture, identity);
  let entry = entries.get(key)?.deref();
  if (entry && !sameMips(texture.mipmaps, entry.mipmaps)) return;
  if (!entry) {
    entry = { source: texture.source, mipmaps: texture.mipmaps };
    entries.set(key, new WeakRef(entry));
    sourceIdentities.set(entry.source, identity);
    cleanup.register(entry, key);
  } else if (texture.source !== entry.source) {
    // Three reads the wrapper's current source during deallocation.
    texture.dispose();
    texture.source = entry.source;
    texture.mipmaps = entry.mipmaps;
    texture.needsUpdate = true;
  }
  states.set(texture, { identity, entry });
}

/** Bank packing and quality replace image/mip views. Detach first so another
 * map/quality consumer cannot observe those source mutations. */
export function detachNativeTexture(texture: T.Texture, forget = false) {
  const identity = states.get(texture)?.identity ?? sourceIdentities.get(texture.source);
  if (!identity) return;
  texture.dispose();
  texture.source = new T.TextureSource(texture.source.data);
  if (forget) states.delete(texture);
  else states.set(texture, { identity });
}
