import * as T from "three";
import type { NativeBreakableManifest } from "./map-breakable-view";

export interface NativeFoliageVisibilityLink {
  ownerId: string;
  originalRenderName: string;
  sidecarRenderNames: readonly string[];
}
export interface NativeFoliageVisibilitySource {
  originalMainMaterialIndices: readonly number[];
  visibilityLinks?: readonly NativeFoliageVisibilityLink[];
}
/** Call with a snapshot of original MAIN objects, before adding sidecars. Parser
 * material indices belong to their own GLTF; merged-scene index searches would
 * incorrectly hide unrelated piece or replacement materials. */
export function bindNativeFoliageVisibility(
  originalMainObjects: readonly T.Object3D[],
  replacementRoot: T.Object3D,
  source: NativeFoliageVisibilitySource,
  manifest?: NativeBreakableManifest,
) {
  const indices = new Set(source.originalMainMaterialIndices);
  if ([...indices].some((index) => !Number.isInteger(index) || index < 0))
    throw new Error("Invalid admitted native foliage material index");
  const originals = new Map<string, T.Object3D[]>(),
    replacements = new Map<string, T.Object3D[]>();
  const add = (map: Map<string, T.Object3D[]>, object: T.Object3D) => {
    const list = map.get(object.name) ?? [];
    list.push(object);
    map.set(object.name, list);
  };
  for (const object of new Set(originalMainObjects)) add(originals, object);
  replacementRoot.traverse((object) => add(replacements, object));
  const hidden = new Set<T.Object3D>(),
    bindings = new Map<string, readonly string[]>(),
    targets = new Set<T.Object3D>();
  for (const object of originalMainObjects) {
    if (!(object instanceof T.Mesh)) continue;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const selected = materials.map((material) =>
      indices.has(material.userData.nativeGltfMaterialIndex),
    );
    if (selected.some(Boolean) && !selected.every(Boolean))
      throw new Error("Mixed admitted foliage material batch requires exact primitive split");
    if (selected.every(Boolean) && selected.length) hidden.add(object);
  }
  const initialVisibility = new Map<T.Object3D, boolean>();
  for (const link of source.visibilityLinks ?? []) {
    if (
      !link.originalRenderName ||
      !link.sidecarRenderNames.length ||
      bindings.has(link.originalRenderName)
    )
      throw new Error("Invalid/duplicate native foliage visibility link");
    const old = originals.get(link.originalRenderName);
    if (!old?.length)
      throw new Error(`Native foliage original missing: ${link.originalRenderName}`);
    const definition = manifest?.breakables.find((d) => d.id === link.ownerId),
      remainder = manifest?.enabledRemainders?.find((d) => d.id === link.ownerId);
    if (
      !definition?.renderNames.includes(link.originalRenderName) &&
      !remainder?.renderNames.includes(link.originalRenderName)
    )
      throw new Error(
        `Native foliage owner binding missing: ${link.ownerId}/${link.originalRenderName}`,
      );
    const names = [...new Set(link.sidecarRenderNames)];
    for (const name of names) {
      const nodes = replacements.get(name);
      if (!name || name === link.originalRenderName || !nodes?.length)
        throw new Error(`Native foliage replacement missing: ${name}`);
      for (const node of nodes) {
        if (targets.has(node))
          throw new Error("Native foliage replacement claimed by multiple source links");
        targets.add(node);
        initialVisibility.set(
          node,
          old.some((part) => part.visible),
        );
      }
    }
    bindings.set(link.originalRenderName, names);
    for (const node of old) hidden.add(node);
  }
  for (const target of targets)
    for (let node: T.Object3D | null = target; node; node = node.parent)
      if (hidden.has(node))
        throw new Error("Native foliage replacement is beneath a hidden original");
  const replace = (names: readonly string[]) => [
    ...new Set(names.flatMap((name) => bindings.get(name) ?? [name])),
  ];
  const viewManifest = manifest
    ? {
        ...manifest,
        breakables: manifest.breakables.map((definition) => ({
          ...definition,
          renderNames: replace(definition.renderNames),
          physicsNames: [...definition.physicsNames],
          ...(definition.pieces
            ? {
                pieces: definition.pieces.map((piece) => ({
                  ...piece,
                  renderNames: [...piece.renderNames],
                })),
              }
            : {}),
        })),
        ...(manifest.enabledRemainders
          ? {
              enabledRemainders: manifest.enabledRemainders.map((remainder) => ({
                ...remainder,
                renderNames: replace(remainder.renderNames),
                physicsNames: [...remainder.physicsNames],
              })),
            }
          : {}),
      }
    : undefined;
  // Admission is atomic: all source/target/owner checks precede scene changes.
  const hideOriginals = () => {
    for (const object of hidden) object.visible = false;
  };
  for (const [target, visible] of initialVisibility) target.visible = visible;
  hideOriginals();
  return {
    manifest: viewManifest,
    hideOriginals,
    hiddenOriginals: [...hidden],
    replacedNames: bindings.size,
  };
}
