import * as T from "three";

/** Names must come from original VMAT IntAttributes containing
 * tools.toolsmaterial (VRF RenderMaterial.LoadRenderState). Compiler surfaces
 * are not identified by a material/file-name heuristic. */
export function excludeNativeToolsMaterials(root: T.Object3D, sourceNames: readonly string[]) {
  if (sourceNames.some((name) => typeof name !== "string" || !name))
    throw new Error("Invalid native tools-material evidence");
  const names = new Set(sourceNames);
  let excluded = 0;
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    if (!materials.some((material) => names.has(material.name))) return;
    if (!materials.every((material) => names.has(material.name)))
      throw new Error("Mixed native tools/renderable material batch");
    object.visible = false;
    object.userData.nativeToolsMaterial = true;
    excluded++;
  });
  return excluded;
}
