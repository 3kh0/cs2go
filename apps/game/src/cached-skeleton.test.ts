import { expect, it, vi } from "vitest";
import * as T from "three";
import { CachedSkeleton, cacheOwnedSkeletons, renderFrozenPose } from "./cached-skeleton";

function rig(count = 6) {
  const root = new T.Group();
  const bones = Array.from({ length: count }, (_, i) => {
    const bone = new T.Bone();
    bone.position.set(i / 10, i / 20, -i / 30);
    root.add(bone);
    return bone;
  });
  root.updateMatrixWorld(true);
  const inverses = bones.map((bone) => bone.matrixWorld.clone().invert());
  const normal = new T.Skeleton(bones, inverses);
  const cached = new CachedSkeleton(bones, inverses);
  normal.computeBoneTexture();
  cached.computeBoneTexture();
  return { root, bones, inverses, normal, cached };
}

it("reuses one palette within a render transaction and recomputes outside it", () => {
  const { normal, cached } = rig();
  const version = cached.boneTexture!.version;
  renderFrozenPose(() => {
    for (let pass = 0; pass < 6; pass++) cached.update();
  });
  normal.update();
  expect(cached.boneMatrices).toEqual(normal.boneMatrices);
  expect(cached.boneTexture!.version).toBe(version + 1);
  cached.update();
  cached.update();
  expect(cached.boneTexture!.version).toBe(version + 3);
  renderFrozenPose(() => cached.update());
  expect(cached.boneTexture!.version).toBe(version + 4);
  normal.dispose();
  cached.dispose();
});

it("matches ordinary palettes for each new root/pose/inverse-binding generation", () => {
  const { root, bones, inverses, normal, cached } = rig();
  for (let frame = 0; frame < 48; frame++) {
    root.position.x = frame * 0.01;
    root.rotation.y = frame * 0.02;
    bones[frame % bones.length].rotation.z = frame * 0.03;
    if (frame === 20) inverses[1].elements[0] += 0.01;
    root.updateMatrixWorld(true);
    normal.update();
    renderFrozenPose(() => {
      cached.update();
      cached.update();
      expect(cached.boneMatrices).toEqual(normal.boneMatrices);
    });
  }
  normal.dispose();
  cached.dispose();
});

it("restores nested transactions and clears them even when rendering throws", () => {
  const { normal, cached } = rig();
  const version = cached.boneTexture!.version;
  renderFrozenPose(() => {
    cached.update();
    expect(() =>
      renderFrozenPose(() => {
        cached.update();
        cached.update();
        throw new Error("render failed");
      }),
    ).toThrow("render failed");
    cached.update();
    cached.update();
  });
  expect(cached.boneTexture!.version).toBe(version + 3);
  expect(() =>
    renderFrozenPose(() => {
      cached.update();
      throw new Error("outer render failed");
    }),
  ).toThrow("outer render failed");
  cached.update();
  cached.update();
  expect(cached.boneTexture!.version).toBe(version + 6);
  normal.dispose();
  cached.dispose();
});

it("rebuilds replaced palettes and newly allocated textures within a transaction", () => {
  const { normal, cached } = rig();
  renderFrozenPose(() => {
    cached.update();
    const version = cached.boneTexture!.version;
    cached.boneMatrices = new Float32Array(cached.boneMatrices!.length);
    cached.update();
    cached.update();
    expect(cached.boneTexture!.version).toBe(version + 1);
    const oldTexture = cached.boneTexture!;
    cached.computeBoneTexture();
    const fresh = cached.boneTexture!;
    const freshVersion = fresh.version;
    cached.update();
    cached.update();
    expect(fresh.version).toBe(freshVersion + 1);
    normal.update();
    expect(cached.boneMatrices).toEqual(normal.boneMatrices);
    oldTexture.dispose();
  });
  normal.dispose();
  cached.dispose();
});

it("preserves shared runtime bindings and leaves external templates intact", () => {
  const { normal: own, bones, inverses, cached: unused } = rig();
  const template = new T.Skeleton(bones, inverses);
  const originalDispose = vi.spyOn(own, "dispose");
  const templateDispose = vi.spyOn(template, "dispose");
  const root = new T.Group();
  const first = new T.SkinnedMesh();
  const second = new T.SkinnedMesh();
  const bind = new T.Matrix4().makeTranslation(2, 3, 4);
  first.bind(own, bind);
  second.bind(own, bind);
  root.add(first, second);
  cacheOwnedSkeletons(root);
  expect(first.skeleton).toBeInstanceOf(CachedSkeleton);
  expect(second.skeleton).toBe(first.skeleton);
  expect(first.bindMatrix).toEqual(bind);
  expect(first.bindMatrixInverse).toEqual(bind.clone().invert());
  expect(originalDispose).toHaveBeenCalledTimes(1);
  expect(templateDispose).not.toHaveBeenCalled();
  cacheOwnedSkeletons(root);
  expect(originalDispose).toHaveBeenCalledTimes(1);
  first.skeleton.dispose();
  template.dispose();
  unused.dispose();
});
