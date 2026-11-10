import * as T from "three";
/** Installed build26445667 PS856/d2: PerViewConstantBuffer_t set1/binding1,
 * mat4 member at byte128. World-position→linear view-depth use identifies its
 * role; pinned VRF9e2e6c7 Camera.SetViewConstants and water_csgo.frag.slang
 * independently name WorldToView and reproduce this operation. The browser
 * still supplies its own qualified camera matrix, not captured CS2 uploads. */
export const nativeWaterReflectionNormalGLSL = `
mat4 sourceWaterViewRowFromBrowser(mat4 browserView){
 mat4 sourceToBrowser=mat4(1.,0.,0.,0.,0.,0.,-1.,0.,0.,1.,0.,0.,0.,0.,0.,1.);
 return transpose(mat4(mat3(browserView))*sourceToBrowser);
}
vec3 sourceWaterReflectionNormal(vec3 normalSource,mat4 worldToViewRow){
 vec3 amplified=normalize(vec3(normalSource.xy*6.0,normalSource.z));
 vec3 viewNormal=(vec4(amplified,0.0)*worldToViewRow).xyz;
 viewNormal.yz*=2.0;
 return (worldToViewRow*vec4(normalize(viewNormal),0.0)).xyz;
}
`;

/** CPU control for the source equation. The supplied row-vector view matrix
 * must have an orthonormal linear frame; translation has no effect at w=0. */
export function nativeWaterReflectionNormal(normal: T.Vector3, worldToViewRow: T.Matrix4) {
  if (!normal.toArray().every(Number.isFinite) || normal.lengthSq() === 0)
    throw new Error("Native water reflection normal is invalid");
  const e = worldToViewRow.elements;
  if (!e.every(Number.isFinite)) throw new Error("Native water reflection frame is invalid");
  const axes = [0, 4, 8].map((offset) => new T.Vector3(e[offset], e[offset + 1], e[offset + 2]));
  if (
    axes.some((axis) => Math.abs(axis.lengthSq() - 1) > 1e-6) ||
    Math.abs(axes[0].dot(axes[1])) > 1e-6 ||
    Math.abs(axes[0].dot(axes[2])) > 1e-6 ||
    Math.abs(axes[1].dot(axes[2])) > 1e-6
  )
    throw new Error("Native water reflection requires an orthonormal view frame");
  const n = normal
    .clone()
    .multiply(new T.Vector3(6, 6, 1))
    .normalize();
  const v = new T.Vector3(n.dot(axes[0]), n.dot(axes[1]) * 2, n.dot(axes[2]) * 2).normalize();
  return axes[0]
    .clone()
    .multiplyScalar(v.x)
    .addScaledVector(axes[1], v.y)
    .addScaledVector(axes[2], v.z);
}

/** Normal-only equivalent of the existing Source-unit camera-row bridge. */
export function nativeWaterBrowserViewRow(browserView: T.Matrix4) {
  const frame = browserView.clone().setPosition(0, 0, 0);
  const basis = new T.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1);
  return frame.multiply(basis).transpose();
}
