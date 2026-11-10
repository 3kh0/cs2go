import * as T from "three";
import type { NativePieceMaterialAliases } from "./native-material-aliases";
import type { BreakableState } from "@cs2go/protocol";
import type { NativeBreakableDefinition } from "@cs2go/simulation/breakables";
import type { MapCollision } from "@cs2go/simulation/map-collision";
import { sourceSunCaster } from "./source-sun";

export type NativeBreakablePiece = {
  renderNames: string[];
  fadeTime: number;
  spawnChance: number;
  essential?: boolean;
  motionDisabled?: boolean;
};
export type NativeBreakableManifest = {
  version: number;
  mapId: string;
  renderModels?: string[];
  materialAliases?: NativePieceMaterialAliases;
  breakables: (NativeBreakableDefinition & {
    pieces?: NativeBreakablePiece[];
    debris?: { burstSpeed: number; fadeTime: number; twist?: number };
  })[];
  enabledRemainders?: { id: string; renderNames: string[]; physicsNames: string[] }[];
};
type Fragment = {
  root: T.Group;
  velocity: T.Vector3;
  spin: T.Vector3;
  radius: number;
  life: number;
  essential: boolean;
  legacy: boolean;
  motionDisabled: boolean;
};

/** Gameplay state owns destruction; the view owns only bounded, nonblocking debris. */
export class NativeMapBreakableView {
  visibilityChanged = false;
  readonly scene: T.Object3D;
  readonly scenery: T.Object3D;
  readonly manifest: NativeBreakableManifest;
  readonly collision: MapCollision;
  readonly root = new T.Group();
  private readonly parts = new Map<string, T.Object3D[]>();
  private readonly pieces = new Map<
    string,
    { definition: NativeBreakablePiece; parts: T.Object3D[] }[]
  >();
  private readonly remainders = new Map<string, T.Object3D[]>();
  private readonly health = new Map<string, number>();
  private readonly fragments: Fragment[] = [];
  private readonly delta = new T.Vector3();
  private readonly normal = new T.Vector3();
  constructor(
    scene: T.Object3D,
    scenery: T.Object3D,
    manifest: NativeBreakableManifest,
    collision: MapCollision,
  ) {
    this.scene = scene;
    this.scenery = scenery;
    this.manifest = manifest;
    this.collision = collision;
    this.root.name = "Map breakable debris";
    scene.add(this.root);
    const names = new Map<string, T.Object3D[]>();
    scenery.traverse((object) => {
      const matches = names.get(object.name) ?? [];
      matches.push(object);
      names.set(object.name, matches);
    });
    const find = (keys: string[]) =>
      keys.flatMap(
        (key) => names.get(key) ?? names.get(T.PropertyBinding.sanitizeNodeName(key)) ?? [],
      );
    for (const definition of manifest.breakables) {
      const parts = find(definition.renderNames);
      if (!parts.length) throw new Error(`Native breakable geometry missing: ${definition.id}`);
      this.parts.set(definition.id, parts);
      this.health.set(definition.id, definition.health);
      if (definition.pieces)
        this.pieces.set(
          definition.id,
          definition.pieces.map((piece) => {
            if (
              !Number.isFinite(piece.fadeTime) ||
              piece.fadeTime < 0 ||
              !Number.isFinite(piece.spawnChance) ||
              piece.spawnChance < 0 ||
              piece.spawnChance > 1 ||
              (piece.motionDisabled !== undefined && typeof piece.motionDisabled !== "boolean") ||
              !piece.renderNames.length
            )
              throw new Error(`Invalid native break piece: ${definition.id}`);
            const templates = find(piece.renderNames);
            if (!templates.length)
              throw new Error(`Native break piece geometry missing: ${definition.id}`);
            for (const template of templates) template.visible = false;
            return { definition: piece, parts: templates };
          }),
        );
    }
    for (const remainder of manifest.enabledRemainders ?? [])
      this.remainders.set(remainder.id, find(remainder.renderNames));
    this.sync(
      manifest.breakables.map(({ id, health }) => ({ id, health })),
      false,
    );
  }
  sync(
    states: readonly BreakableState[],
    animate = false,
    point?: T.Vector3,
    direction?: T.Vector3,
  ) {
    this.visibilityChanged = false;
    const broken: NativeBreakableManifest["breakables"] = [];
    let restored = false;
    const current = new Map(states.map((state) => [state.id, state.health]));
    for (const definition of this.manifest.breakables) {
      const next = current.get(definition.id) ?? definition.health;
      const was = this.health.get(definition.id) ?? definition.health;
      const parts = this.parts.get(definition.id)!;
      if (was <= 0 && next > 0) restored = true;
      if (was > 0 && next <= 0 && animate) {
        broken.push(definition);
        this.shatter(parts, definition, point, direction);
      }
      for (const part of parts) {
        if (part.visible !== next > 0) this.visibilityChanged = true;
        part.visible = next > 0;
      }
      this.health.set(definition.id, next);
    }
    for (const [id, objects] of this.remainders) {
      const enabled = this.manifest.breakables.some(
        (definition) =>
          (current.get(definition.id) ?? definition.health) <= 0 &&
          definition.onBreakEnable?.includes(id),
      );
      for (const object of objects) {
        if (object.visible !== enabled) this.visibilityChanged = true;
        object.visible = enabled;
      }
    }
    if (!animate || restored) this.clearDebris();
    return broken;
  }
  private shatter(
    parts: T.Object3D[],
    definition: NativeBreakableManifest["breakables"][number],
    point?: T.Vector3,
    direction?: T.Vector3,
  ) {
    const native = this.pieces.get(definition.id);
    if (native) {
      for (const piece of native)
        if (Math.random() < piece.definition.spawnChance)
          this.spawnFragment(piece.parts, definition, point, direction, piece.definition);
      return;
    }
    // Historical maps without an authored piece manifest retain their old
    // whole-panel reconstruction. Source-bound pieces never take this path.
    for (const part of parts) this.spawnFragment([part], definition, point, direction);
  }
  private spawnFragment(
    parts: T.Object3D[],
    definition: NativeBreakableManifest["breakables"][number],
    point?: T.Vector3,
    direction?: T.Vector3,
    piece?: NativeBreakablePiece,
  ) {
    const box = new T.Box3();
    for (const part of parts) box.union(new T.Box3().setFromObject(part));
    if (box.isEmpty()) return;
    const center = box.getCenter(new T.Vector3());
    const pivot = new T.Group();
    pivot.position.copy(center);
    for (const part of parts) {
      part.updateWorldMatrix(true, true);
      const clone = part.clone(true);
      clone.visible = true;
      clone.matrix.copy(
        new T.Matrix4().makeTranslation(-center.x, -center.y, -center.z).multiply(part.matrixWorld),
      );
      clone.matrixAutoUpdate = false;
      clone.matrixWorldAutoUpdate = true;
      const originals: T.Mesh[] = [];
      part.traverse((object) => {
        if (object instanceof T.Mesh) originals.push(object);
      });
      let index = 0;
      clone.traverse((object) => {
        object.matrixWorldAutoUpdate = true;
        object.raycast = () => {};
        if (object instanceof T.Mesh) {
          const source = originals[index++];
          object.customDepthMaterial = source.customDepthMaterial;
          object.customDistanceMaterial = source.customDistanceMaterial;
        }
      });
      pivot.add(clone);
    }
    sourceSunCaster(pivot, true);
    this.root.add(pivot);
    // Authored mesh/pose/fade parameter are separate from this bounded browser
    // rigid-body approximation. Native burst/twist commands are not guessed.
    const speed = definition.debris?.burstSpeed ?? 2;
    const velocity = center
      .clone()
      .sub(point ?? box.getCenter(new T.Vector3()))
      .multiplyScalar(0.5);
    if (direction) velocity.addScaledVector(direction, Math.min(speed, 4));
    velocity.add(
      new T.Vector3(
        (Math.random() - 0.5) * speed,
        1 + Math.random() * speed * 0.4,
        (Math.random() - 0.5) * speed,
      ),
    );
    const extent = box.getSize(new T.Vector3());
    const radius = Math.max(0.015, Math.min(0.1, Math.min(extent.x, extent.y, extent.z) * 0.4));
    this.fragments.push({
      root: pivot,
      velocity,
      spin: new T.Vector3(Math.random() * 8 - 4, Math.random() * 8 - 4, Math.random() * 8 - 4),
      radius,
      // Zero source fade currently retains the piece until round reset; native
      // zero-fade scheduling remains explicitly unverified in provenance.
      life: piece
        ? piece.fadeTime > 0
          ? piece.fadeTime
          : Infinity
        : Math.min(3, definition.debris?.fadeTime ?? 3),
      essential: piece?.essential ?? false,
      legacy: !piece,
      motionDisabled: piece?.motionDisabled === true,
    });
    // Never discard authored essential pieces. Their count is bounded by the
    // loaded manifest/one destruction per owner until reset. Only optional
    // visual debris uses this reconstructed recent-piece budget.
    while (
      this.fragments.filter((fragment) => !fragment.essential && !fragment.legacy).length > 96
    ) {
      const oldest = this.fragments.findIndex(
        (fragment) => !fragment.essential && !fragment.legacy,
      );
      this.fragments.splice(oldest, 1)[0].root.removeFromParent();
    }
    while (this.fragments.filter((fragment) => fragment.legacy).length > 24) {
      const oldest = this.fragments.findIndex((fragment) => fragment.legacy);
      this.fragments.splice(oldest, 1)[0].root.removeFromParent();
    }
  }
  update(dt: number) {
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const fragment = this.fragments[i];
      fragment.life -= dt;
      if (fragment.life <= 0) {
        fragment.root.removeFromParent();
        this.fragments.splice(i, 1);
        continue;
      }
      if (fragment.motionDisabled) continue;
      fragment.velocity.y -= 9.81 * dt;
      this.delta.copy(fragment.velocity).multiplyScalar(dt);
      const hit = this.collision.sweepSphere(
        fragment.root.position,
        this.delta,
        fragment.radius,
        this.normal,
      );
      if (hit >= 0 && hit <= 1) {
        fragment.root.position.addScaledVector(this.delta, Math.max(0, hit - 0.001));
        const inward = fragment.velocity.dot(this.normal);
        if (inward < 0) fragment.velocity.addScaledVector(this.normal, -inward * 1.25);
        fragment.velocity.multiplyScalar(0.65);
        fragment.spin.multiplyScalar(0.6);
      } else fragment.root.position.add(this.delta);
      fragment.root.rotation.x += fragment.spin.x * dt;
      fragment.root.rotation.y += fragment.spin.y * dt;
      fragment.root.rotation.z += fragment.spin.z * dt;
    }
  }
  clearDebris() {
    this.root.clear();
    this.fragments.length = 0;
  }
}
