import * as T from "three";

let frozenPose: object | undefined;

/** A synchronous render-only transaction. Bone poses, root transforms, inverse
 * binds and bone layout must remain unchanged until callback returns. A new
 * transaction always rebuilds palettes; no renderer frame counters are altered.
 */
export function renderFrozenPose<Result>(callback: () => Result): Result {
  const previous = frozenPose;
  frozenPose = {};
  try {
    return callback();
  } finally {
    frozenPose = previous;
  }
}

/** Reuse an owned palette only inside the explicit immutable render transaction.
 * Ordinary updates retain Three.js behavior, without scanning bone matrices.
 */
export class CachedSkeleton extends T.Skeleton {
  private transaction?: object;
  private palette?: Float32Array | null;
  private texture?: T.DataTexture | null;

  override update() {
    if (
      frozenPose &&
      this.transaction === frozenPose &&
      this.palette === this.boneMatrices &&
      this.texture === this.boneTexture
    )
      return;
    super.update();
    this.transaction = frozenPose;
    this.palette = this.boneMatrices;
    this.texture = this.boneTexture;
  }
}

/** Only for owned runtime clones; shared import templates retain their skeletons. */
export function cacheOwnedSkeletons(root: T.Object3D) {
  const replacements = new Map<T.Skeleton, CachedSkeleton>();
  root.traverse((object) => {
    if (!(object instanceof T.SkinnedMesh) || object.skeleton instanceof CachedSkeleton) return;
    const original = object.skeleton;
    let cached = replacements.get(original);
    if (!cached) {
      cached = new CachedSkeleton(original.bones, original.boneInverses);
      replacements.set(original, cached);
    }
    object.bind(cached, object.bindMatrix);
  });
  for (const original of replacements.keys()) original.dispose();
}
