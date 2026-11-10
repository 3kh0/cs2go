import * as T from "three";
import type { EnvironmentShaderParameters } from "./native-environment-parameters";
import type { SourceEnvironmentMaterial } from "./native-map-environment";

type Mip = { data: Uint8Array; width: number; height: number };
export type EnvironmentTextureBank = {
  name: string;
  layer: number;
  texture: T.CompressedArrayTexture;
};
export type EnvironmentTextureBanks = Map<string, EnvironmentTextureBank>;

/** Keep native bytes, dimensions and mip levels verbatim. Compatible BC7/RGBA
 * resources share a WebGL2 array sampler; each material still selects its own
 * original layer and independently transformed UVs. No resampling or baking. */
export function createEnvironmentTextureBanks(
  textures: ReadonlyMap<string, T.Texture>,
  maxLayers: number,
  compressedFormats: readonly T.CompressedPixelFormat[] = [T.RGBA_BPTC_Format],
) {
  if (!Number.isInteger(maxLayers) || maxLayers < 1)
    throw new Error("Invalid environment texture array layer limit");
  const groups = new Map<string, [string, T.Texture, Mip[]][]>();
  for (const [id, texture] of [...textures].sort(([a], [b]) => a.localeCompare(b))) {
    const compressed =
      texture instanceof T.CompressedTexture &&
      !(texture instanceof T.CompressedArrayTexture) &&
      compressedFormats.includes(texture.format as T.CompressedPixelFormat);
    const rgba =
      texture instanceof T.DataTexture &&
      texture.format === T.RGBAFormat &&
      texture.type === T.UnsignedByteType;
    if (!compressed && !rgba) continue;
    const mips = texture.mipmaps.length
      ? (texture.mipmaps as Mip[])
      : rgba
        ? [
            {
              data: texture.image.data as Uint8Array,
              width: texture.image.width,
              height: texture.image.height,
            },
          ]
        : [];
    if (!mips.length || mips.some((mip) => !(mip.data instanceof Uint8Array))) continue;
    const key = JSON.stringify([
      texture.format,
      texture.type,
      texture.colorSpace,
      texture.wrapS,
      texture.wrapT,
      texture.minFilter,
      texture.magFilter,
      texture.anisotropy,
      mips.map((mip) => [mip.width, mip.height, mip.data.byteLength]),
    ]);
    const group = groups.get(key) ?? [];
    group.push([id, texture, mips]);
    groups.set(key, group);
  }
  const bindings: EnvironmentTextureBanks = new Map();
  const arrays: T.CompressedArrayTexture[] = [];
  let bytes = 0;
  for (const group of groups.values())
    for (let start = 0; start < group.length; start += maxLayers) {
      const entries = group.slice(start, start + maxLayers);
      if (entries.length < 2) continue;
      const source = entries[0][1],
        original = entries[0][2];
      const mips = original.map((mip, level) => {
        const data = new Uint8Array(mip.data.byteLength * entries.length);
        for (const [layer, [, , originalMips]] of entries.entries())
          data.set(originalMips[level].data, layer * mip.data.byteLength);
        bytes += data.byteLength;
        return { data, width: mip.width, height: mip.height };
      });
      const texture = new T.CompressedArrayTexture(
        mips,
        original[0].width,
        original[0].height,
        entries.length,
        source.format as T.CompressedPixelFormat, // Three supports RGBA mip arrays in this class too.
        source.type,
      );
      texture.colorSpace = source.colorSpace;
      texture.wrapS = source.wrapS;
      texture.wrapT = source.wrapT;
      texture.minFilter = source.minFilter;
      texture.magFilter = source.magFilter;
      texture.anisotropy = source.anisotropy;
      texture.generateMipmaps = false;
      texture.flipY = false;
      texture.needsUpdate = true;
      const name = `environmentBank${arrays.length}`;
      arrays.push(texture);
      entries.forEach((entry, layer) => {
        const [id, originalTexture, originalMips] = entry;
        const views = mips.map((mip, level) => ({
          width: mip.width,
          height: mip.height,
          data: mip.data.subarray(
            layer * originalMips[level].data.byteLength,
            (layer + 1) * originalMips[level].data.byteLength,
          ),
        }));
        // The bank is the sole CPU byte owner. Keep exact per-texture views
        // available for optional depth/inspection without retaining another
        // complete fetched ArrayBuffer beside the concatenated native bank.
        originalTexture.mipmaps = views;
        entry[2] = views;
        if (originalTexture instanceof T.DataTexture)
          originalTexture.image = { ...originalTexture.image, data: views[0].data };
        bindings.set(id, { name, layer, texture });
      });
    }
  return { bindings, arrays, bytes };
}
const literal = (value: number) => (Number.isInteger(value) ? `${value}.0` : `${value}`);
const vector = (values: readonly number[]) =>
  `vec${values.length}(${values.map(literal).join(",")})`;

/** Material-local sampler declarations and constant functions. Constant RGBA is
 * supplied only after every authored mip/texel was verified by the converter. */
export function bindEnvironmentTextures(
  source: Pick<
    SourceEnvironmentMaterial,
    "textures" | "constants" | "nativeTextureDimensions" | "textureDimensions"
  >,
  nativeNames: readonly string[],
  textures: ReadonlyMap<string, T.Texture>,
  banks: EnvironmentTextureBanks | undefined,
  shader: T.WebGLProgramParametersWithUniforms,
  parameters?: EnvironmentShaderParameters,
) {
  const declarations: string[] = [],
    reads: string[] = [],
    signature: string[] = [];
  const bound = new Set<string>();
  const canonical = new Map<string, string>();
  const canonicalBanks = new Map<T.Texture, string>();
  for (const native of nativeNames) {
    const name = native.replace(/^g_t/, "environment"),
      id = source.textures[native],
      constant = source.constants?.[native];
    if (!id) throw new Error(`Native environment sampler missing: ${native}`);
    if (constant) {
      if (constant.length !== 4 || constant.some((value) => !Number.isFinite(value)))
        throw new Error(`Invalid verified environment constant: ${native}`);
      reads.push(
        `vec4 ${name}Read(vec2 uv){return ${vector(constant)};}vec4 ${name}Read(vec2 uv,float bias){return ${vector(constant)};}vec4 ${name}GradRead(vec2 uv,vec2 dx,vec2 dy){return ${vector(constant)};}`,
      );
      signature.push(`${name}:constant:${constant.join(",")}`);
    } else {
      const bank = banks?.get(id);
      if (bank) {
        let sampler = canonicalBanks.get(bank.texture);
        if (!sampler) {
          sampler = parameters ? `environmentBank${canonicalBanks.size}` : bank.name;
          canonicalBanks.set(bank.texture, sampler);
        }
        if (!bound.has(sampler)) {
          declarations.push(`uniform highp sampler2DArray ${sampler};`);
          shader.uniforms[sampler] = { value: bank.texture };
          bound.add(sampler);
        }
        const layer =
          parameters?.value(`textureLayer:${native}`, [bank.layer]) ?? literal(bank.layer);
        reads.push(
          `vec4 ${name}Read(vec2 uv){return texture(${sampler},vec3(uv,${layer}));}vec4 ${name}Read(vec2 uv,float bias){return texture(${sampler},vec3(uv,${layer}),bias);}vec4 ${name}GradRead(vec2 uv,vec2 dx,vec2 dy){return textureGrad(${sampler},vec3(uv,${layer}),dx,dy);}`,
        );
        signature.push(
          parameters ? `${name}:${sampler}:uniformLayer` : `${name}:${bank.name}:${bank.layer}`,
        );
      } else {
        let sampler = canonical.get(id);
        if (!sampler) {
          const texture = textures.get(id);
          if (!texture) throw new Error(`Native environment texture missing: ${native}/${id}`);
          sampler = name;
          canonical.set(id, sampler);
          bound.add(sampler);
          declarations.push(`uniform sampler2D ${sampler};`);
          shader.uniforms[sampler] = { value: texture };
        }
        reads.push(
          `vec4 ${name}Read(vec2 uv){return texture2D(${sampler},uv);}vec4 ${name}Read(vec2 uv,float bias){return texture2D(${sampler},uv,bias);}vec4 ${name}GradRead(vec2 uv,vec2 dx,vec2 dy){return textureGrad(${sampler},uv,dx,dy);}`,
        );
        signature.push(`${name}:${sampler}`);
      }
    }
    const dimensions =
      source.nativeTextureDimensions?.[native] ?? source.textureDimensions?.[native];
    const image = textures.get(id)?.image as { width?: number; height?: number } | undefined;
    const bank = banks?.get(id);
    const size =
      dimensions ??
      (image?.width && image.height
        ? [image.width, image.height]
        : bank
          ? [bank.texture.image.width, bank.texture.image.height]
          : undefined);
    if (size) {
      if (size.length !== 2 || size.some((value) => !Number.isSafeInteger(value) || value < 1))
        throw new Error(`Invalid native environment texture dimensions: ${native}`);
      reads.push(
        `vec2 ${name}Size(){return ${parameters?.value(`textureSize:${native}`, size) ?? vector(size)};}`,
      );
    } else if (native.startsWith("g_tHeight"))
      throw new Error(`Native environment height dimensions unavailable: ${native}`);
  }
  return {
    code: declarations.join("\n") + "\n" + reads.join("\n"),
    samplers: bound.size,
    signature: signature.join(";"),
  };
}
