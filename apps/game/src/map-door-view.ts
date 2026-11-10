import * as T from "three";
import type { DoorState } from "@cs2go/protocol";
import { nativeDoorDestroyed, type NativeDoorDefinition } from "@cs2go/simulation/doors";
import { sourceSunCaster } from "./source-sun";

/** Exact authored leaf hierarchy, transformed about its native hinge; frames
 * remain static. This view never changes authoritative collision or use state. */
export class NativeMapDoorView {
  private readonly entries = new Map<
    string,
    {
      definition: NativeDoorDefinition;
      stages: { object: T.Object3D; closedWorld: T.Matrix4; parentInverse: T.Matrix4 }[][];
      angle: number;
      stage: number;
      hidden: boolean;
    }
  >();
  private readonly rotation = new T.Matrix4();
  private readonly delta = new T.Matrix4();
  private readonly translate = new T.Matrix4();
  private readonly axis = new T.Vector3();
  constructor(root: T.Object3D, definitions: readonly NativeDoorDefinition[]) {
    const names = new Map<string, T.Object3D[]>();
    root.updateMatrixWorld(true);
    root.traverse((object) => {
      const matches = names.get(object.name) ?? [];
      matches.push(object);
      names.set(object.name, matches);
    });
    for (const definition of definitions) {
      const stages = [
        definition.renderNames,
        ...(definition.damage?.stages.map((s) => s.renderNames) ?? []),
      ].map((renderNames) => {
        const objects = new Set<T.Object3D>();
        for (const name of renderNames) {
          const matches = names.get(name) ?? names.get(T.PropertyBinding.sanitizeNodeName(name));
          if (!matches?.length)
            throw new Error(`Native door render leaf missing: ${definition.id}/${name}`);
          for (const object of matches) objects.add(object);
        }
        const parts = [...objects]
          .filter((object) => {
            for (let parent = object.parent; parent; parent = parent.parent)
              if (objects.has(parent)) return false;
            return true;
          })
          .map((object) => {
            const closedWorld = object.matrixWorld.clone();
            object.traverse((part) => {
              part.matrixAutoUpdate = false;
              part.matrixWorldAutoUpdate = true;
            });
            sourceSunCaster(object, true);
            return {
              object,
              closedWorld,
              parentInverse: object.parent?.matrixWorld.clone().invert() ?? new T.Matrix4(),
            };
          });
        if (!parts.length) throw new Error(`Native door render geometry missing: ${definition.id}`);
        return parts;
      });
      stages.forEach((parts, index) =>
        parts.forEach(({ object }) => {
          object.visible = index === 0;
        }),
      );
      this.entries.set(definition.id, { definition, stages, angle: NaN, stage: -1, hidden: false });
    }
  }
  sync(states: readonly DoorState[]) {
    let changed = false;
    for (const state of states) {
      const entry = this.entries.get(state.id);
      const stage = state.stage ?? 0;
      const hidden = entry ? nativeDoorDestroyed(entry.definition, state) : false;
      if (
        !entry ||
        !Number.isFinite(state.angle) ||
        !Number.isInteger(stage) ||
        stage < 0 ||
        stage >= entry.stages.length ||
        (state.angle === entry.angle && stage === entry.stage && hidden === entry.hidden)
      )
        continue;
      entry.angle = state.angle;
      entry.stage = stage;
      entry.hidden = hidden;
      entry.stages.forEach((parts, index) =>
        parts.forEach(({ object }) => {
          object.visible = index === stage && !hidden;
        }),
      );
      const { pivot, axis } = entry.definition;
      this.rotation.makeRotationAxis(this.axis.fromArray(axis), T.MathUtils.degToRad(state.angle));
      this.delta
        .makeTranslation(...pivot)
        .multiply(this.rotation)
        .multiply(this.translate.makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
      for (const { object, closedWorld, parentInverse } of entry.stages[stage]) {
        object.matrix.copy(parentInverse).multiply(this.delta).multiply(closedWorld);
        object.updateWorldMatrix(false, true, true);
      }
      changed = true;
    }
    return changed;
  }
}
