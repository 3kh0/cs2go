import * as T from "three";

// Source lightmap charts can split a position shared by the optimized glTF.
// Duplicate only conflicting corners, retaining indexed geometry and every
// original (possibly quantized/interleaved) vertex attribute.
export function applyCornerLightmap(
  geometry: T.BufferGeometry,
  cornerUV: Uint16Array,
  valid: Uint8Array,
  fallback: Uint8Array,
  confidence?: Uint8Array,
) {
  const count = geometry.attributes.position.count;
  const oldIndex = geometry.getIndex();
  const corners = oldIndex?.count ?? count;
  if (
    corners % 3 ||
    cornerUV.length !== corners * 2 ||
    valid.length !== corners / 3 ||
    fallback.length !== count * 4 ||
    (confidence !== undefined && confidence.length !== count)
  )
    throw new Error("Native lighting corner layout does not match map geometry");
  const index = new Uint32Array(corners);
  const originalUV = new Uint16Array(count * 3);
  const assigned = new Uint8Array(count);
  const extraSources: number[] = [],
    extraUV: number[] = [];
  const splits = new Map<number, number[]>();
  for (let corner = 0; corner < corners; corner++) {
    const source = oldIndex ? oldIndex.getX(corner) : corner;
    const mapped = valid[Math.floor(corner / 3)] !== 0;
    const usable = mapped ? (confidence?.[source] ?? 255) * 257 : 0;
    // A boundary vertex can have zero atlas weight while its UV still belongs
    // to a valid chart. Retain that UV for interpolation inside the triangle.
    const u = mapped ? cornerUV[corner * 2] : 0;
    const v = mapped ? cornerUV[corner * 2 + 1] : 0;
    const base = source * 3;
    if (!assigned[source]) {
      assigned[source] = 1;
      originalUV[base] = u;
      originalUV[base + 1] = v;
      originalUV[base + 2] = usable;
      index[corner] = source;
    } else if (
      originalUV[base] === u &&
      originalUV[base + 1] === v &&
      originalUV[base + 2] === usable
    ) {
      index[corner] = source;
    } else {
      const candidates = splits.get(source) ?? [];
      let split = candidates.find(
        (i) => extraUV[i * 3] === u && extraUV[i * 3 + 1] === v && extraUV[i * 3 + 2] === usable,
      );
      if (split === undefined) {
        split = extraSources.length;
        extraSources.push(source);
        extraUV.push(u, v, usable);
        candidates.push(split);
        splits.set(source, candidates);
      }
      index[corner] = count + split;
    }
  }
  const total = count + extraSources.length;
  if (extraSources.length) {
    for (const [name, attribute] of Object.entries(geometry.attributes)) {
      const interleaved = attribute instanceof T.InterleavedBufferAttribute;
      const original = interleaved ? attribute.data.array : attribute.array;
      const Data = original.constructor as { new (length: number): T.TypedArray };
      const array = new Data(total * attribute.itemSize);
      const stride = interleaved ? attribute.data.stride : attribute.itemSize;
      const offset = interleaved ? attribute.offset : 0;
      for (let i = 0; i < total; i++) {
        const source = i < count ? i : extraSources[i - count];
        for (let component = 0; component < attribute.itemSize; component++)
          array[i * attribute.itemSize + component] =
            original[source * stride + offset + component];
      }
      const next =
        attribute instanceof T.Float16BufferAttribute
          ? new T.Float16BufferAttribute(array, attribute.itemSize, attribute.normalized)
          : new T.BufferAttribute(array, attribute.itemSize, attribute.normalized);
      next.name = attribute.name;
      geometry.setAttribute(name, next);
    }
  }
  const uv = new Uint16Array(total * 3);
  uv.set(originalUV);
  uv.set(extraUV, count * 3);
  const probe = new Uint8Array(total * 4);
  probe.set(fallback);
  extraSources.forEach((source, extra) =>
    probe.set(fallback.subarray(source * 4, source * 4 + 4), (count + extra) * 4),
  );
  geometry.setIndex(new T.BufferAttribute(index, 1));
  geometry.setAttribute("sourceUv", new T.Uint16BufferAttribute(uv, 3, true));
  geometry.setAttribute("sourceProbe", new T.Uint8BufferAttribute(probe, 4, true));
  return extraSources.length;
}
