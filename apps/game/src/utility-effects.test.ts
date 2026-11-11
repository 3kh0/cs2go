import { expect, test } from "vitest";
import * as T from "three";
import { UtilityVisual } from "./utility-effects";

test.each(["fire", "blast", "flash"] as const)(
  "%s bounds contain shader-expanded vertices for every instance and camera orientation",
  (kind) => {
    // A spread across all axes catches bounds based only on the detonation or
    // first cell. The shader consumes these matrices after float32 upload.
    const positions = Array.from(
      { length: 48 },
      (_, i) => new T.Vector3(21 + Math.sin(i) * 4, i * 0.08, -13 + Math.cos(i) * 4),
    );
    const visual = new UtilityVisual(kind, positions);
    const parent = new T.Group();
    parent.position.set(-7, 3, 2);
    parent.rotation.set(0.2, 0.6, -0.3);
    parent.add(visual.mesh);
    parent.updateMatrixWorld(true);
    const camera = new T.PerspectiveCamera();
    const matrix = new T.Matrix4();
    const center = new T.Vector3();
    const column = new T.Vector3();
    const vertex = new T.Vector3();
    let maxOverflow = -Infinity;
    for (const age of [0, 0.01, 0.149, 0.15, 0.9, 1, 7, 8, 9, 100]) {
      visual.update(age, 1);
      for (let i = 0; i < visual.mesh.count; i++) {
        visual.mesh.getMatrixAt(i, matrix);
        center.setFromMatrixPosition(matrix);
        // Analytic invariant, independent of camera samples below: sin lies
        // in [-1,1] and shifted y in [0,1]. The farthest point of that
        // rectangle is this corner. Rotations preserve its length, and the
        // triangle inequality covers every interior vertex, phase and view.
        const maxOffset =
          kind === "fire"
            ? new T.Vector2(
                0.575 * column.setFromMatrixColumn(matrix, 0).length(),
                column.setFromMatrixColumn(matrix, 1).length(),
              ).length()
            : new T.Vector2(0.5, 0.5).length() * Math.abs(0.25 + 2.4 * age);
        expect(
          center.distanceTo(visual.mesh.boundingSphere!.center) + maxOffset,
        ).toBeLessThanOrEqual(visual.mesh.boundingSphere!.radius + 1e-9);
      }
      for (const rotation of [
        [0, 0, 0],
        [Math.PI / 2, 0, 0],
        [0, Math.PI / 2, 0],
        [0.4, 1.7, 0.8],
        [-1.1, -2.4, 2.9],
      ]) {
        camera.position.set(5, 2, 11);
        camera.rotation.set(rotation[0], rotation[1], rotation[2]);
        camera.updateMatrixWorld(true);
        const bounds = visual.mesh
          .boundingSphere!.clone()
          .applyMatrix4(visual.mesh.matrixWorld)
          .applyMatrix4(camera.matrixWorldInverse);
        for (let i = 0; i < visual.mesh.count; i++) {
          visual.mesh.getMatrixAt(i, matrix);
          center
            .setFromMatrixPosition(matrix)
            .applyMatrix4(visual.mesh.matrixWorld)
            .applyMatrix4(camera.matrixWorldInverse);
          const width = column.setFromMatrixColumn(matrix, 0).length();
          const height = column.setFromMatrixColumn(matrix, 1).length();
          const phase = matrix.elements[12] * 17.13 + matrix.elements[14] * 9.7;
          // Include quad corners and interior heights: fire sway is nonlinear
          // in y, while the blast grows throughout (and beyond) its lifetime.
          for (const x of [-0.5, 0.5])
            for (const y of [-0.5, -0.25, 0, 0.25, 0.5]) {
              vertex.copy(center);
              if (kind === "fire") {
                const shiftedY = y + 0.5;
                vertex.x +=
                  (x + Math.sin(age * 7 + phase + shiftedY * 5) * shiftedY * 0.075) * width;
                vertex.y += shiftedY * height;
              } else {
                vertex.x += x * (0.25 + age * 2.4);
                vertex.y += y * (0.25 + age * 2.4);
              }
              maxOverflow = Math.max(maxOverflow, vertex.distanceTo(bounds.center) - bounds.radius);
            }
        }
      }
    }
    expect(visual.mesh.frustumCulled).toBe(true);
    expect(maxOverflow).toBeLessThanOrEqual(1e-9);
    visual.dispose();
  },
);

test.each(["fire", "blast", "flash"] as const)(
  "%s bounds retain a float32 rounding margin at map coordinates and after age updates",
  (kind) => {
    const visual = new UtilityVisual(kind, [new T.Vector3(8192, -1024, -4096)]);
    const matrix = new T.Matrix4();
    const center = new T.Vector3();
    const column = new T.Vector3();
    for (const age of [0, 0.15, 1, 8, 100]) {
      visual.update(age, 1);
      for (let i = 0; i < visual.mesh.count; i++) {
        visual.mesh.getMatrixAt(i, matrix);
        center.setFromMatrixPosition(matrix);
        const extent =
          kind === "fire"
            ? Math.hypot(
                0.575 * column.setFromMatrixColumn(matrix, 0).length(),
                column.setFromMatrixColumn(matrix, 1).length(),
              )
            : Math.SQRT1_2 * (0.25 + 2.4 * age);
        const unpadded = center.distanceTo(visual.mesh.boundingSphere!.center) + extent;
        // At least sixteen float32 relative ulps of the largest coordinate,
        // including the static fire path and every dynamic blast update.
        expect(visual.mesh.boundingSphere!.radius - unpadded).toBeGreaterThan(0.0156);
      }
    }
    visual.dispose();
  },
);

test.each(["fire", "blast", "flash"] as const)(
  "%s remains visible when the center leaves the frustum but a billboard enters it",
  (kind) => {
    const visual = new UtilityVisual(kind, [new T.Vector3(3.4, 0, -5)]);
    const camera = new T.PerspectiveCamera(60, 1, 0.1, 100);
    camera.updateMatrixWorld(true);
    const frustum = new T.Frustum().setFromProjectionMatrix(camera.projectionMatrix);
    visual.update(1, 1);
    visual.mesh.updateMatrixWorld(true);
    expect(frustum.containsPoint(new T.Vector3(3.4, 0, -5))).toBe(false);
    // This point is inside both the expanded fire and blast quads at this age.
    expect(frustum.containsPoint(new T.Vector3(2.8, 0.2, -5))).toBe(true);
    expect(frustum.intersectsObject(visual.mesh)).toBe(true);

    // A remote effect can now be rejected instead of always submitted.
    visual.mesh.position.x = 100;
    visual.mesh.updateMatrixWorld(true);
    expect(frustum.intersectsObject(visual.mesh)).toBe(false);
    visual.dispose();
  },
);
