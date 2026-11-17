import * as T from "three";

/** Static foliage can use tight bounds even after reflection partitioning.
 * Shared position buffers contain other partitions, so visit only drawn indices.
 * Coverage geometry can differ from color geometry and owns separate bounds. */
export function createStaticFoliageBounds() {
  const cached = new WeakMap<
    T.Mesh,
    {
      geometry: T.BufferGeometry;
      position: T.BufferAttribute | T.InterleavedBufferAttribute;
      index: T.BufferAttribute | null;
      positionVersion: number;
      indexVersion: number;
      start: number;
      count: number;
    }
  >();
  const point = new T.Vector3();
  const box = new T.Box3();
  const columns = [new T.Vector3(), new T.Vector3(), new T.Vector3()];
  return (root: T.Object3D) => {
    root.traverse((object) => {
      if (
        !(object instanceof T.Mesh) ||
        object instanceof T.InstancedMesh ||
        object instanceof T.SkinnedMesh ||
        object.morphTargetInfluences
      )
        return;
      const geometry = object.geometry;
      const position = geometry.getAttribute("position");
      if (!position) return;
      const index = geometry.index;
      const positionVersion = "version" in position ? position.version : position.data.version;
      const indexVersion = index?.version ?? -1;
      const { start, count } = geometry.drawRange;
      const previous = cached.get(object);
      if (
        !previous ||
        previous.geometry !== geometry ||
        previous.position !== position ||
        previous.index !== index ||
        previous.positionVersion !== positionVersion ||
        previous.indexVersion !== indexVersion ||
        previous.start !== start ||
        previous.count !== count
      ) {
        box.makeEmpty();
        const end = Math.min(index?.count ?? position.count, start + count);
        for (let i = start; i < end; i++) {
          point.fromBufferAttribute(position, index ? index.getX(i) : i);
          box.expandByPoint(point);
        }
        const sphere = box.getBoundingSphere(new T.Sphere());
        sphere.radius += 1e-4;
        (object as T.Mesh & { boundingSphere: T.Sphere }).boundingSphere = sphere;
        cached.set(object, {
          geometry,
          position,
          index,
          positionVersion,
          indexVersion,
          start,
          count,
        });
      }
      // Three's sphere transform assumes orthogonal axes. Keep arbitrary shear
      // uncullable rather than risk clipping a visible leaf.
      columns.forEach((column, i) => column.setFromMatrixColumn(object.matrixWorld, i));
      const sphere = (object as T.Mesh & { boundingSphere: T.Sphere }).boundingSphere;
      object.frustumCulled =
        Number.isFinite(sphere.radius) &&
        sphere.radius >= 0 &&
        columns.every((a, i) =>
          columns.every((b, j) => i === j || Math.abs(a.dot(b)) <= 1e-8 * a.length() * b.length()),
        );
    });
  };
}
