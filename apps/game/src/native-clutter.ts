import * as T from "three";
import { NativeClutterData, type NativeClutterFields } from "./native-clutter-data";
import {
  createNativeInstanceReflectionCandidates,
  nativeInstanceReflectionAttributes,
} from "./native-instance-reflections";
import type { SourceReflections } from "./source-reflections";
import type { MapResources } from "./map-resources";

export interface NativeClutterTemplate {
  scope: "main" | "sky";
  resource: string;
  nativeModelSha256: string;
  root: T.Object3D;
  family: "csgo_foliage.vfx" | "csgo_environment.vfx";
  /** Proven maximum per-axis own-browser displacement over the whole wind schedule. */
  windPadding: number;
}
const gltfToBrowser = new T.Matrix4().set(0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 0, 1);

/** Creates authored tile draws, not one draw per placement/probe window. Templates
 * remain outside the scene; all original instance ordering and FLOAT32 fields
 * are retained. Own-sky placement is applied once by the explicit parent frame. */
export function createNativeClutter(
  fields: NativeClutterFields,
  bytes: ArrayBuffer,
  templates: readonly NativeClutterTemplate[],
  reflections: Pick<SourceReflections, "volumes">,
  resources: MapResources,
  placement = new T.Matrix4(),
) {
  const data = new NativeClutterData(fields, bytes),
    root = new T.Group(),
    foliage = new T.Group(),
    environment = new T.Group();
  root.name = `native-clutter:${fields.scope}`;
  root.matrixAutoUpdate = false;
  root.matrix.copy(placement);
  root.add(foliage, environment);
  root.updateMatrixWorld(true);
  const inverse = placement.clone().invert(),
    slots = new Map(templates.map((t) => [t.resource, t]));
  if (slots.size !== templates.length)
    throw new Error("Duplicate native clutter template namespace");
  const instances = new Map<T.InstancedMesh, { perInstance: true; worldPadding: number }>();
  for (const group of fields.groups) {
    const template = slots.get(group.nativeResource);
    if (
      !template ||
      template.scope !== fields.scope ||
      template.nativeModelSha256 !== group.templateNativeSha256 ||
      group.materialGroup !== "" ||
      group.nativeLayer !== 0 ||
      group.nativeFlags !== "OBJECT_TYPE_NONE"
    )
      throw new Error("Native clutter template identity mismatch");
    if (!Number.isFinite(template.windPadding) || template.windPadding < 0)
      throw new Error("Native clutter wind envelope unavailable");
    template.root.updateMatrixWorld(true);
    const primitives: T.Mesh[] = [];
    template.root.traverse((o) => {
      if (o instanceof T.Mesh) primitives.push(o);
    });
    if (!primitives.length) throw new Error("Native clutter source geometry absent");
    for (const tile of group.nativeTiles) {
      const first = group.firstInstance + tile.m_nFirstInstance,
        count = tile.m_nLastInstance - tile.m_nFirstInstance;
      if (!count) continue;
      for (const primitive of primitives) {
        // Admitted model roots are identity; only the documented coordinate
        // conversion and retained packed placement may affect source streams.
        if (!primitive.matrixWorld.equals(new T.Matrix4()))
          throw new Error("Unexpected native clutter template transform");
        const geometry = primitive.geometry.clone(),
          materials = (
            Array.isArray(primitive.material) ? primitive.material : [primitive.material]
          ).map((source) => {
            const material = source.clone();
            material.userData.nativeModelMaterialIndex = source.userData.nativeGltfMaterialIndex;
            material.userData.nativeSourceModelSha256 = template.nativeModelSha256;
            delete material.userData.nativeGltfMaterialIndex;
            return material;
          });
        const mesh = new T.InstancedMesh(
          geometry,
          Array.isArray(primitive.material) ? materials : materials[0],
          count,
        );
        mesh.name = `${group.id}:${tile.m_nFirstInstance}:${primitive.name}`;
        mesh.userData.nativeClutter = {
          group: group.id,
          sourceResource: group.nativeResource,
          firstInstance: first,
          nativeBeginCullSize: group.nativeBeginCullSize,
          nativeEndCullSize: group.nativeEndCullSize,
          nativeLayer: group.nativeLayer,
          nativeFlags: group.nativeFlags,
        };
        for (let i = 0; i < count; i++) {
          const source = data.source(first + i);
          if (source.tint.some((v) => v !== 255))
            throw new Error("Native clutter palette requires a proved material tint binding");
          mesh.setMatrixAt(i, data.matrix(first + i).multiply(gltfToBrowser));
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        (template.family === "csgo_foliage.vfx" ? foliage : environment).add(mesh);
        root.updateMatrixWorld(true);
        resources.capture(mesh);
        const e = placement.elements,
          worldPadding =
            template.windPadding *
            Math.max(
              ...[0, 1, 2].map((r) => Math.abs(e[r]) + Math.abs(e[r + 4]) + Math.abs(e[r + 8])),
            );
        const candidates = createNativeInstanceReflectionCandidates(mesh, reflections, {
          worldToNative: inverse,
          worldPadding,
        });
        for (let slot = 0; slot < 2; slot++)
          geometry.setAttribute(
            nativeInstanceReflectionAttributes[slot],
            candidates.attributes[slot],
          );
        instances.set(mesh, { perInstance: true, worldPadding });
        mesh.computeBoundingBox();
        mesh.boundingBox!.expandByScalar(template.windPadding);
        mesh.boundingSphere = mesh.boundingBox!.getBoundingSphere(new T.Sphere());
      }
    }
  }
  resources.capture(root);
  resources.onDispose(() => resources.capture(root));
  return { root, foliage, environment, instances, sourceInstances: data.count };
}
