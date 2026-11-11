import type { Object3D } from "three";

/** Stop automatic recursion into an admitted, already-updated imported scene.
 * Descendants never depend on automatic transforms; moving doors update their
 * own world matrices explicitly. Other new/moving descendants must first call restore().
 * Explicit updateWorldMatrix calls and direct updateMatrixWorld calls retain
 * Three's behavior. Parent recursion's force=true is deliberately insufficient
 * to invalidate this contract: ordinary Scene updates propagate it every frame.
 */
export function retainImportedSceneryMatrices(scenery: Object3D): () => void {
  const parent = scenery.parent;
  if (!parent || scenery.matrixAutoUpdate || scenery.matrixWorldAutoUpdate) return () => {};
  let admitted = true;
  scenery.traverse((object) => {
    if (object.matrixAutoUpdate) admitted = false;
  });
  if (!admitted) return () => {};
  const local = scenery.matrix.clone(),
    world = scenery.matrixWorld.clone(),
    parentWorld = parent.matrixWorld.clone(),
    parentLocal = parent.matrix.clone();
  const parentParent = parent.parent,
    parentAuto = parent.matrixAutoUpdate,
    parentWorldAuto = parent.matrixWorldAutoUpdate;
  const updateScenery = scenery.updateMatrixWorld,
    updateParent = parent.updateMatrixWorld;
  let inParentUpdate = false,
    retained = true;
  const restore = () => {
    if (!retained) return;
    retained = false;
    scenery.updateMatrixWorld = updateScenery;
    parent.updateMatrixWorld = updateParent;
  };
  parent.updateMatrixWorld = function (force) {
    const previous = inParentUpdate;
    inParentUpdate = true;
    try {
      updateParent.call(this, force);
    } finally {
      inParentUpdate = previous;
    }
  };
  scenery.updateMatrixWorld = function (force) {
    if (
      retained &&
      inParentUpdate &&
      this.parent === parent &&
      !this.matrixAutoUpdate &&
      !this.matrixWorldAutoUpdate &&
      !this.matrixWorldNeedsUpdate &&
      this.matrix.equals(local) &&
      this.matrixWorld.equals(world) &&
      parent.parent === parentParent &&
      parent.matrixAutoUpdate === parentAuto &&
      parent.matrixWorldAutoUpdate === parentWorldAuto &&
      parent.matrix.equals(parentLocal) &&
      parent.matrixWorld.equals(parentWorld)
    )
      return;
    // Boundary changes or an explicit update leave optimization permanently;
    // delegate with the original flags/force, including frozen-child semantics.
    restore();
    updateScenery.call(this, force);
  };
  return restore;
}
