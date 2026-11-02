import * as T from "three";

/** Sample only visible, posed geometry; hidden guns/LODs must not affect framing. */
export function previewBounds(roots: readonly T.Object3D[], target = new T.Box3()) {
  target.makeEmpty();
  const part = new T.Box3();
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverseVisible((object) => {
      if (!(object instanceof T.Mesh)) return;
      if (object instanceof T.SkinnedMesh) {
        object.computeBoundingBox();
        part.copy(object.boundingBox!);
      } else {
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        part.copy(object.geometry.boundingBox!);
      }
      target.union(part.applyMatrix4(object.matrixWorld));
    });
  }
  return target;
}

/** Keep the existing lens/angle and fit all eight corners with screen-space margin. */
export function framePreview(camera: T.PerspectiveCamera, bounds: T.Box3, aspect: number) {
  if (bounds.isEmpty() || !(aspect > 0)) return;
  const center = bounds.getCenter(new T.Vector3());
  const inverse = camera.quaternion.clone().invert();
  const point = new T.Vector3();
  const tangent = Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * 0.88;
  let distance = camera.near;
  for (let corner = 0; corner < 8; corner++) {
    point
      .set(
        corner & 1 ? bounds.max.x : bounds.min.x,
        corner & 2 ? bounds.max.y : bounds.min.y,
        corner & 4 ? bounds.max.z : bounds.min.z,
      )
      .sub(center)
      .applyQuaternion(inverse);
    distance = Math.max(
      distance,
      point.z + camera.near * 2,
      point.z + Math.abs(point.x) / (tangent * aspect),
      point.z + Math.abs(point.y) / tangent,
    );
  }
  camera.position.copy(center).addScaledVector(camera.getWorldDirection(point), -distance);
  camera.aspect = aspect;
  camera.far = Math.max(20, distance + bounds.getSize(point).length());
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
}
