import * as T from "three";

/** Main browser world metres → the material's own browser world metres.
 * Sky imports bake authored placement into geometry; material projection and
 * weather must undo that placement before converting to Source world units. */
export function createEnvironmentWorldFrame(worldToNative = new T.Matrix4()) {
  const elements = worldToNative.elements;
  if (
    elements.some((value) => !Number.isFinite(value)) ||
    Math.abs(elements[3]) + Math.abs(elements[7]) + Math.abs(elements[11]) > 1e-8 ||
    Math.abs(elements[15] - 1) > 1e-8
  )
    throw new Error("Invalid native environment world frame");
  const columns = [0, 1, 2].map((index) =>
    new T.Vector3().setFromMatrixColumn(worldToNative, index),
  );
  const scales = columns.map((column) => column.length()),
    scale = scales[0];
  if (
    !(scale > 0) ||
    scales.some((value) => Math.abs(value / scale - 1) > 1e-6) ||
    worldToNative.determinant() <= 0 ||
    columns.some((column, i) =>
      columns.some((other, j) => i !== j && Math.abs(column.dot(other) / (scale * scale)) > 1e-6),
    )
  )
    throw new Error("Native environment frame must be a positive uniform similarity");
  const nativeToWorld = worldToNative.clone().invert();
  return {
    worldToNative: worldToNative.clone(),
    worldToNativeNormal: new T.Matrix3().setFromMatrix4(
      new T.Matrix4().extractRotation(worldToNative),
    ),
    nativeToWorldNormal: new T.Matrix3().setFromMatrix4(
      new T.Matrix4().extractRotation(nativeToWorld),
    ),
    unitScale: 1 / scale,
  };
}
export type EnvironmentWorldFrame = ReturnType<typeof createEnvironmentWorldFrame>;
