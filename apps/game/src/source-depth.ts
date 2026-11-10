import * as T from "three";

/** Source material families supply only their coverage/vertex contract. The
 * consumer keeps its own depth packing, light-distance output and ownership. */
export interface SourceDepthHook {
  cacheKey: string;
  apply(shader: T.WebGLProgramParametersWithUniforms, renderer: T.WebGLRenderer): void;
}
const hooks = new WeakMap<T.Material, SourceDepthHook>();
const bindings = new WeakMap<
  T.Material,
  { compile: T.Material["onBeforeCompile"]; key: string; hookKey: string }
>();
const shadows = new WeakMap<
  T.Material,
  { depth: T.MeshDepthMaterial; distance: T.MeshDistanceMaterial }
>();
export function registerSourceDepth(material: T.Material, hook: SourceDepthHook) {
  hooks.set(material, hook);
}
export function copySourceDepth(source: T.Material, target: T.Material) {
  const hook = hooks.get(source);
  if (hook) hooks.set(target, hook);
  return target;
}
/** Cached smoke/depth variants may be revisited each frame. Install once per
 * source contract, without stacking shader transforms or losing a prior hook. */
export function applySourceDepth(source: T.Material, target: T.Material) {
  const hook = hooks.get(source);
  if (!hook) return false;
  let binding = bindings.get(target);
  if (binding?.hookKey === hook.cacheKey) return true;
  if (!binding) {
    binding = {
      compile: target.onBeforeCompile.bind(target),
      key: target.customProgramCacheKey(),
      hookKey: hook.cacheKey,
    };
    bindings.set(target, binding);
  }
  binding.hookKey = hook.cacheKey;
  const { compile, key } = binding;
  target.onBeforeCompile = (shader, renderer) => {
    compile(shader, renderer);
    hook.apply(shader, renderer);
  };
  target.customProgramCacheKey = () => `${key}:source-depth:${hook.cacheKey}`;
  target.needsUpdate = true;
  return true;
}
/** Source static batches must retain homogeneous alpha contracts. These
 * per-material shadow variants are map owned, not shared actor templates. */
export function installSourceShadowDepth(mesh: T.Mesh) {
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const source = materials[0],
    hook = hooks.get(source);
  if (!hook) {
    if (materials.some((material) => hooks.has(material)))
      throw new Error("Mixed native alpha depth batch");
    return false;
  }
  if (materials.some((material) => hooks.get(material)?.cacheKey !== hook.cacheKey))
    throw new Error("Mixed native alpha depth batch");
  let variants = shadows.get(source);
  if (!variants) {
    variants = {
      depth: new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }),
      distance: new T.MeshDistanceMaterial(),
    };
    variants.depth.side = variants.distance.side = source.side;
    applySourceDepth(source, variants.depth);
    applySourceDepth(source, variants.distance);
    shadows.set(source, variants);
  }
  mesh.customDepthMaterial = variants.depth;
  mesh.customDistanceMaterial = variants.distance;
  return true;
}
