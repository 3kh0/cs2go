import * as T from "three";
import type { RoundState, PlayerState } from "@cs2go/protocol";
import type { Game } from "./game";
import {
  SmokeRenderer,
  SmokeComposite,
  smokeCellDensity,
  smokeSampleBudget,
  SMOKE_CELL_RADIUS,
} from "./smoke-renderer";
import { UtilityVisual } from "./utility-effects";
import { GrenadeHandling } from "./grenade-handling";
import { grenadeLaunch, grenadePhysics, advanceGrenade } from "./grenade-physics";
import { GrenadeView } from "./grenade-view";
import { createGrenadeModel, grenadeMotionDuration } from "./grenade-models";
import { applyArmorDamage } from "./damage";
import {
  canCarryGrenade,
  fireParameters,
  fireTickDamage,
  fireCellCandidates,
  utilityDamageScale,
  emptyGrenades,
  flashExposure,
  grenadeAvailable,
  grenadeData,
  grenadeTypes,
  heDamage,
  segmentNearSphere,
} from "./utility";
import type { GrenadeInventory, GrenadeKind } from "./utility";
type Owner = number | "player";
type Projectile = {
  networkId?: number;
  kind: GrenadeKind;
  owner: Owner;
  team: "t" | "ct";
  position: T.Vector3;
  velocity: T.Vector3;
  age: number;
  resting: boolean;
  mesh: T.Object3D;
  weapon: number;
  lastBounce: number;
};
type Effect = {
  networkId?: number;
  kind: GrenadeKind;
  owner: Owner;
  team: "t" | "ct";
  position: T.Vector3;
  age: number;
  mesh: T.Group;
  cells: T.Vector3[];
  materials: T.MeshStandardMaterial[];
  batch?: T.InstancedMesh;
  smoke?: SmokeRenderer;
  visual?: UtilityVisual;
  holes: number[];
  cleared: number;
  pulse: number;
  weapon: number;
};
export class GameUtility {
  game: Game;
  smokeComposite = new SmokeComposite();
  private visibleSmoke: SmokeRenderer[] = [];
  private smokeFrustum = new T.Frustum();
  private smokeViewProjection = new T.Matrix4();
  inventory = emptyGrenades();
  selected: GrenadeKind | null = null;
  projectiles: Projectile[] = [];
  effects: Effect[] = [];
  botInventories = new Map<number, GrenadeInventory>();
  blind = new Map<Owner, number>();
  botCooldown = new Map<number, number>();
  clock = 0;
  entries = new Map<number, { position: T.Vector3; at: number; until: number }>();
  lastAlive = new Map<number, boolean>();
  receipts = emptyGrenades();
  viewModel?: T.Group;
  grenadeView?: GrenadeView;
  handling = new GrenadeHandling();
  throwingKind: GrenadeKind | null = null;
  matrix = new T.Matrix4();
  projectileFrom = new T.Vector3();
  projectileDelta = new T.Vector3();
  projectileNormal = new T.Vector3();
  projectileClipNormal = new T.Vector3();
  projectileRay = new T.Ray();
  projectileCaster = new T.Raycaster();
  actorCenter = new T.Vector3();
  cooldown = 0;
  think = 0;
  overlay?: HTMLDivElement;
  sphere = new T.SphereGeometry(1, 18, 12);
  cylinder = new T.CylinderGeometry(0.045, 0.045, 0.14, 8);
  constructor(game: Game) {
    this.game = game;
  }
  buy(kind: GrenadeKind) {
    if (this.game.network) {
      this.game.network.request.grenadeBuy = kind;
      return true;
    }
    const g = this.game,
      price = g.teamMode ? grenadeData[kind].price : 0;
    if (
      !g.canBuy() ||
      !grenadeAvailable(kind, g.team) ||
      !canCarryGrenade(this.inventory, kind, !this.game.teamMode || this.game.competitive) ||
      g.money < price
    )
      return false;
    this.inventory[kind]++;
    this.receipts[kind]++;
    g.money -= price;
    g.updateUI();
    g.updateBuyMenu();
    this.updateBuyMenu();
    return true;
  }
  refund(kind: GrenadeKind) {
    if (this.game.network) {
      this.game.network.request.grenadeRefund = kind;
      return true;
    }
    if (!this.game.canBuy() || !this.receipts[kind] || !this.inventory[kind]) return false;
    this.receipts[kind]--;
    this.inventory[kind]--;
    this.game.money = Math.min(
      this.game.rules.maxMoney,
      this.game.money + (this.game.teamMode ? grenadeData[kind].price : 0),
    );
    if (!this.inventory[kind] && this.selected === kind) this.selected = null;
    this.game.updateUI();
    this.game.updateBuyMenu();
    return true;
  }
  renderSelection() {
    this.renderEffects();
    if (!this.grenadeView) {
      this.grenadeView = new GrenadeView();
      this.viewModel = this.grenadeView.group;
      this.game.view.add(this.viewModel);
    }
    const kind = this.selected ?? this.throwingKind;
    this.grenadeView.group.visible = !!kind && !this.game.dead && !this.game.planting;
    if (kind) this.grenadeView.update(kind, this.handling, this.clock, this.game.team);
  }
  cancelThrow() {
    this.handling.cancel();
    this.throwingKind = null;
    if (this.grenadeView) this.grenadeView.selected = null;
  }
  pressThrow(button: number) {
    if (
      !this.selected ||
      this.cooldown > 0 ||
      this.game.weaponsFrozen ||
      this.game.planting ||
      this.game.bomb?.defuser === "player"
    )
      return;
    if (this.handling.phase === "idle") this.game.soundscape.play(`utility-${this.selected}-pin`);
    this.handling.pinDuration = grenadeMotionDuration(this.selected, "pullpin") ?? 0.9667;
    this.handling.releaseDuration =
      grenadeMotionDuration(this.selected, button === 2 ? "throw_underhand" : "throw_overhand") ??
      0.7667;
    this.handling.press(button);
  }

  renderWorld() {
    this.visibleSmoke.length = 0;
    const camera = this.game.camera;
    camera.updateMatrixWorld();
    this.smokeViewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.smokeFrustum.setFromProjectionMatrix(this.smokeViewProjection);
    for (const effect of this.effects) {
      if (!effect.smoke?.batch.visible) continue;
      effect.smoke.batch.updateWorldMatrix(true, false);
      if (this.smokeFrustum.intersectsObject(effect.smoke.batch))
        this.visibleSmoke.push(effect.smoke);
    }
    this.smokeComposite.render(
      this.game.renderer,
      this.game.scene,
      this.game.camera,
      this.visibleSmoke,
      this.game.settings.effectsDetail === "low",
    );
  }
  renderEffects() {
    const g = this.game;
    if (!g.active) {
      // A grenade kill can finish a match while update() is iterating these
      // arrays. Clear transients at the render boundary, after simulation exits.
      if (this.projectiles.length || this.effects.length || this.blind.size || this.selected)
        this.reset(true);
      if (this.overlay) this.overlay.style.opacity = "0";
      return;
    }
    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.id = "flash-blindness";
      this.overlay.style.cssText =
        "position:fixed;inset:0;background:white;pointer-events:none;z-index:15;opacity:0";
      document.body.append(this.overlay);
    }
    this.overlay.style.opacity = g.dead
      ? "0"
      : String(Math.min(1, (this.blind.get("player") ?? 0) / 1.2));

    const smokeSamples = smokeSampleBudget(
      this.effects.reduce(
        (count, effect) => count + Number(!!effect.smoke && effect.cleared <= 0),
        0,
      ),
      g.settings.effectsDetail === "low",
    );
    for (const e of this.effects) {
      const fade = Math.min(1, e.age * 2, Math.max(0, grenadeData[e.kind].duration - e.age));
      if (e.visual) {
        e.visual.update(
          e.age,
          e.kind === "he" || e.kind === "flash"
            ? Math.max(0, 1 - e.age / grenadeData[e.kind].duration)
            : fade,
        );
        continue;
      }
      if (e.smoke) {
        e.smoke.update(e.age, fade, this.clock, e.holes, e.cleared, smokeSamples);
        continue;
      }
      if (!e.batch) {
        // Instant blasts must peak immediately; the smoke/fire fade-in made a
        // 300 ms HE flash almost invisible before its lifetime expired.
        const blast = e.kind === "he" || e.kind === "flash";
        const opacity = blast ? Math.max(0, 1 - e.age / grenadeData[e.kind].duration) : fade;
        for (const material of e.materials) material.opacity = opacity * 0.8;
        if (e.kind === "he") e.mesh.children[0]?.scale.setScalar(0.35 + e.age * 6);
        continue;
      }
      e.batch.visible = true;
      e.materials[0].opacity = fade * 0.8;
      for (let j = 0; j < e.cells.length; j++) {
        this.matrix
          .makeScale(0.6, 0.6 * (1 + Math.sin(e.age * 15 + j * 3) * 0.4), 0.6)
          .setPosition(e.cells[j]);
        e.batch.setMatrixAt(j, this.matrix);
      }
      e.batch.instanceMatrix.needsUpdate = true;
    }
  }
  updateBuyMenu() {
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-grenade]")) {
      const kind = button.dataset.grenade as GrenadeKind;
      button.hidden = !grenadeAvailable(kind, this.game.team);
      let refund = button.parentElement?.querySelector<HTMLButtonElement>(
        `[data-grenade-refund="${kind}"]`,
      );
      if (!refund) {
        refund = document.createElement("button");
        refund.className = "buy-refund";
        refund.dataset.grenadeRefund = kind;
        refund.textContent = "↶";
        refund.title = `Refund ${grenadeData[kind].name}`;
        refund.setAttribute("aria-label", refund.title);
        refund.onclick = () => this.refund(kind);
        button.after(refund);
      }
      refund.hidden = !this.receipts[kind] || !this.game.canBuy();

      button.disabled =
        !this.game.canBuy() ||
        !canCarryGrenade(this.inventory, kind, !this.game.teamMode || this.game.competitive) ||
        (this.game.teamMode && this.game.money < grenadeData[kind].price);
      button.querySelector("small")!.textContent = this.game.teamMode
        ? `$${grenadeData[kind].price}`
        : "FREE";
    }
  }
  selectNext() {
    const owned = grenadeTypes.filter((kind) => this.inventory[kind] > 0);
    if (!owned.length) {
      return;
    }
    this.select(owned[(owned.indexOf(this.selected!) + 1) % owned.length]);
  }
  select(kind: GrenadeKind) {
    if (!this.inventory[kind]) return;
    this.cancelThrow();
    this.selected = kind;
    this.game.soundscape.play(`utility-${this.selected}-draw`);
    this.game.firing = false;
    this.game.reload = this.game.revolverCharge = this.game.inspectTime = this.game.knifeTime = 0;
    this.game.knifePending = false;
    this.game.burstRemaining = this.game.rescope = this.game.boltTime = 0;
    this.game.setScope(0);
    this.game.updateUI();
  }
  throwSelected(weak: boolean | number = false) {
    const g = this.game,
      kind = this.selected;
    if (
      !kind ||
      !this.inventory[kind] ||
      this.cooldown > 0 ||
      g.dead ||
      g.weaponsFrozen ||
      g.planting ||
      g.bomb?.defuser === "player" ||
      !g.locked
    )
      return;
    if (g.network) {
      g.network.request.throwKind = kind;
      g.network.request.throwStrength = typeof weak === "number" ? weak : weak ? 0 : 1;
      this.throwingKind = kind;
      this.selected = null;
      this.cooldown = 0.7;
      g.firing = false;
      return;
    }
    const direction = new T.Vector3();
    g.camera.getWorldDirection(direction);
    const strength = typeof weak === "number" ? weak : weak ? 0 : 1;
    const launch = grenadeLaunch(
      kind,
      strength,
      g.position.clone().add(new T.Vector3(0, g.eye, 0)),
      direction,
      new T.Vector3(g.velocity.x, g.vertical, g.velocity.z),
    );
    const { position, velocity } = launch;
    // Sweep out of the hand, then pull six Source units back from contact.
    const offset = launch.direction.clone().multiplyScalar(22 * 0.0254);
    let fraction =
      g.world.collision?.sweepSphere(
        position,
        offset,
        grenadePhysics.radius,
        this.projectileNormal,
      ) ?? Infinity;
    const clipFraction = g.teamMode
      ? g.dust?.grenadeCollision?.sweepSphere(
          position,
          offset,
          grenadePhysics.radius,
          this.projectileClipNormal,
        )
      : undefined;
    if (clipFraction !== undefined) fraction = Math.min(fraction, clipFraction);
    if (!g.world.collision) {
      this.projectileCaster.set(position, launch.direction);
      this.projectileCaster.far = offset.length() + grenadePhysics.radius;
      const hit = this.projectileCaster.intersectObjects(g.world.solids, false)[0];
      if (hit) fraction = Math.max(0, (hit.distance - grenadePhysics.radius) / offset.length());
    }
    position
      .addScaledVector(offset, Math.min(1, fraction))
      .addScaledVector(launch.direction, -6 * 0.0254);
    if (!this.launch(kind, "player", g.team, position, velocity, g.selected)) return;
    this.inventory[kind]--;
    this.receipts[kind] = Math.max(0, this.receipts[kind] - 1);
    this.throwingKind = kind;
    this.selected = null;
    this.cooldown = 0.7;
    g.firing = false;
    g.updateUI();
  }
  launch(
    kind: GrenadeKind,
    owner: Owner,
    team: "t" | "ct",
    position: T.Vector3,
    velocity: T.Vector3,
    weapon: number,
  ) {
    if (this.projectiles.length >= 32) return false;
    const mesh =
      createGrenadeModel(kind, true) ??
      new T.Mesh(
        this.cylinder,
        new T.MeshStandardMaterial({
          color: grenadeData[kind].color,
          roughness: 0.55,
          metalness: 0.35,
        }),
      );
    mesh.position.copy(position);
    this.game.scene.add(mesh);
    this.projectiles.push({
      kind,
      owner,
      team,
      position,
      velocity,
      mesh,
      age: 0,
      resting: false,
      lastBounce: -Infinity,
      weapon,
    });
    this.game.soundscape.play(`utility-${kind}-throw`, false, "sand", position);
    return true;
  }
  reset(preserveInventory = false) {
    this.cancelThrow();
    for (const p of this.projectiles) this.removeProjectile(p);
    for (const e of this.effects) this.removeEffect(e);
    this.projectiles = [];
    this.effects = [];
    this.blind.clear();
    this.botCooldown.clear();
    this.entries.clear();
    this.lastAlive.clear();
    this.receipts = emptyGrenades();
    this.selected = null;
    this.cooldown = 0;
    if (!preserveInventory) this.inventory = emptyGrenades();
    if (this.overlay) this.overlay.style.opacity = "0";
  }
  spawnPlayer(preserve: boolean) {
    this.cancelThrow();
    if (!preserve) {
      this.inventory = emptyGrenades();
      this.receipts = emptyGrenades();
    }
    this.selected = null;
    this.blind.delete("player");
  }
  removeProjectile(p: Projectile) {
    this.game.scene.remove(p.mesh);
    if (p.mesh instanceof T.Mesh) (p.mesh.material as T.Material).dispose();
    p.mesh.traverse((node) => {
      if (node instanceof T.SkinnedMesh) node.skeleton.dispose();
    });
  }
  removeEffect(e: Effect) {
    this.game.scene.remove(e.mesh);
    for (const m of e.materials) m.dispose();
    e.batch?.dispose();
    e.smoke?.dispose();
    e.visual?.dispose();
  }
  clearSight(from: T.Vector3, to: T.Vector3) {
    return !this.effects.some(
      (e) =>
        e.kind === "smoke" &&
        e.cleared <= 0 &&
        e.age > 0.35 &&
        e.cells.some(
          (c, i) =>
            smokeCellDensity(this.clock, e.holes[i] ?? 0, e.cleared) > 0.3 &&
            segmentNearSphere(from, to, c, SMOKE_CELL_RADIUS),
        ),
    );
  }
  bullet(from: T.Vector3, to: T.Vector3) {
    for (const e of this.effects)
      if (e.kind === "smoke") {
        e.cells.forEach((cell, i) => {
          if (segmentNearSphere(from, to, cell, SMOKE_CELL_RADIUS)) e.holes[i] = this.clock + 0.25;
        });
      }
  }
  update(dt: number) {
    const g = this.game;
    this.clock += dt;
    if (g.dead || !g.locked || g.planting || g.bomb?.defuser === "player" || g.weaponsFrozen)
      this.cancelThrow();
    if (this.selected)
      this.handling.releaseDuration =
        grenadeMotionDuration(
          this.selected,
          this.handling.strength < 0.25 ? "throw_underhand" : "throw_overhand",
        ) ?? 0.7667;
    const strength = this.handling.update(dt);
    if (strength !== null) this.throwSelected(strength);
    if (this.handling.phase === "idle") this.throwingKind = null;
    this.cooldown = Math.max(0, this.cooldown - dt);
    for (const [id, duration] of this.blind) {
      if (duration <= dt) this.blind.delete(id);
      else this.blind.set(id, duration - dt);
    }
    if (g.weaponsFrozen || g.network) return;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.age += dt;
      let fireContact = false;
      if (!p.resting) {
        const result = advanceGrenade(
          p.position,
          p.velocity,
          dt,
          (from, delta, normal) => {
            const distance = delta.length();
            if (g.world.collision) {
              let fraction = g.world.collision.sweepSphere(
                from,
                delta,
                grenadePhysics.radius,
                normal,
              );
              const clipped = g.teamMode
                ? g.dust?.grenadeCollision?.sweepSphere(
                    from,
                    delta,
                    grenadePhysics.radius,
                    this.projectileClipNormal,
                  )
                : undefined;
              if (clipped !== undefined && clipped < fraction) {
                fraction = clipped;
                normal.copy(this.projectileClipNormal);
              }
              return fraction;
            }
            this.projectileCaster.set(from, this.projectileRay.direction.copy(delta).normalize());
            this.projectileCaster.far = distance + grenadePhysics.radius;
            const hit = this.projectileCaster.intersectObjects(g.world.solids, false)[0];
            if (!hit) return Infinity;
            normal
              .copy(hit.face?.normal ?? T.Object3D.DEFAULT_UP)
              .transformDirection(hit.object.matrixWorld);
            if (normal.dot(p.velocity) > 0) normal.negate();
            return Math.max(0, (hit.distance - grenadePhysics.radius) / distance);
          },
          p.kind === "molotov" || p.kind === "incendiary",
        );
        p.resting = result.resting;
        fireContact = result.fireContact;
        if (result.impact > 1.5 && p.age - p.lastBounce >= 0.08) {
          g.soundscape.play(`utility-${p.kind}-bounce`, false, "sand", p.position);
          p.lastBounce = p.age;
        }
      }
      p.mesh.position.copy(p.position);
      p.mesh.rotation.x += p.velocity.length() * dt;
      const fire = p.kind === "molotov" || p.kind === "incendiary";
      const settled = p.resting;
      const timed = p.age >= grenadeData[p.kind].fuse;
      // Lost projectiles are discarded; smoke/decoy must never bloom in midair
      // just because a cleanup deadline elapsed.
      if (p.age > 30 || p.position.y < -100) {
        this.removeProjectile(p);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (
        (fire && fireContact) ||
        (timed && (fire || p.kind === "he" || p.kind === "flash" || settled))
      ) {
        this.detonate(p);
        this.removeProjectile(p);
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i],
        data = grenadeData[e.kind];
      e.age += dt;
      e.cleared -= dt;
      e.pulse -= dt;
      if (e.kind === "molotov" || e.kind === "incendiary") {
        if (e.pulse <= 1e-9) {
          e.pulse += fireParameters.interval;
          this.areaDamage(e, fireTickDamage(e.kind), data.radius);
        }
      } else if (e.kind === "decoy" && e.pulse <= 0) {
        e.pulse = 0.35 + Math.random() * 0.5;
        g.worldSound("bot", e.position, e.weapon);
        for (const b of g.bots)
          if (b.health > 0 && b.team !== e.team && b.group.position.distanceTo(e.position) < 30) {
            b.memory.copy(e.position);
            b.alert = Math.max(b.alert, 1);
          }
      }
      if (e.age >= data.duration) {
        if (e.kind === "decoy") {
          this.areaDamage(e, 5, 2);
          g.soundscape.play("utility-decoy-explode", false, "sand", e.position);
        }
        this.removeEffect(e);
        this.effects.splice(i, 1);
      }
    }
    this.think -= dt;
    if (this.think <= 0) {
      this.think = 0.25;
      this.botTactics();
    }
  }
  detonate(p: Projectile) {
    this.game.soundscape.play(`utility-${p.kind}-explode`, false, "sand", p.position);
    const g = this.game,
      data = grenadeData[p.kind];
    const effect: Effect = {
      kind: p.kind,
      owner: p.owner,
      team: p.team,
      position: p.position.clone(),
      age: 0,
      mesh: new T.Group(),
      cells: [],
      materials: [],
      holes: [],
      cleared: -1,
      pulse: 0,
      weapon: p.weapon,
    };
    if (p.kind === "he") {
      this.areaDamage(effect, 0, data.radius);
      for (const e of this.effects)
        if (
          e.kind === "smoke" &&
          e.position.distanceTo(p.position) < 8 &&
          g.visible(p.position, e.position)
        )
          e.cleared = 2;
    } else if (p.kind === "flash" && !g.network) {
      const test = (id: Owner, position: T.Vector3, facing: T.Vector3) => {
        const delta = p.position.clone().sub(position),
          distance = delta.length();
        if (distance > 30 || !g.visible(position, p.position)) return;
        const duration = 4.8 * flashExposure(distance, facing.dot(delta.normalize()));
        this.blind.set(id, Math.max(this.blind.get(id) ?? 0, duration));
      };
      if (!g.dead)
        test(
          "player",
          g.position.clone().add(new T.Vector3(0, g.eye, 0)),
          g.camera.getWorldDirection(new T.Vector3()),
        );
      g.bots.forEach((b, i) => {
        if (b.health > 0)
          test(
            i,
            b.group.position.clone().add(new T.Vector3(0, 1.45, 0)),
            new T.Vector3(Math.sin(b.facing), 0, Math.cos(b.facing)),
          );
      });
    }
    const fire = p.kind === "molotov" || p.kind === "incendiary";
    if (fire) effect.pulse = fireParameters.interval;
    if (p.kind === "smoke") {
      for (const e of this.effects)
        if (
          (e.kind === "molotov" || e.kind === "incendiary") &&
          e.position.distanceTo(p.position) < 5 &&
          g.visible(p.position, e.position)
        )
          e.age = grenadeData[e.kind].duration;
    }
    if (p.kind === "smoke" || fire) {
      // Each cloud/fire cell must have a clear path from the detonation. This
      // bounds expansion at walls and keeps fire on the receiving floor.
      if (fire) {
        for (const offset of fireCellCandidates(p.kind as "molotov" | "incendiary")) {
          const cell = p.position.clone().add(offset);
          if (!g.visible(p.position, cell)) continue;
          const floor = g.world.collision?.floor(cell.x, cell.z, cell.y + 0.5, cell.y - 1);
          if (g.world.collision && !Number.isFinite(floor)) continue;
          cell.y = (floor ?? 0) + 0.16;
          effect.cells.push(cell);
          if (effect.cells.length >= fireParameters.maxCells) break;
        }
      }
      for (let x = -3; !fire && x <= 3; x++)
        for (let z = -3; z <= 3; z++)
          for (let y = 0; y <= (fire ? 0 : 2); y++) {
            if (Math.hypot(x, z) > data.radius - 0.3) continue;
            const cell = p.position.clone().add(new T.Vector3(x, y * 0.85 + 0.3, z));
            if (!fire) {
              cell.x += Math.sin(x * 17 + z * 5 + y) * 0.22;
              cell.z += Math.cos(x * 9 + z * 11 + y) * 0.22;
            }
            if (!g.visible(p.position, cell)) continue;
            if (fire) {
              const floor = g.world.collision?.floor(cell.x, cell.z, cell.y + 0.5, cell.y - 1);
              if (g.world.collision && !Number.isFinite(floor)) continue;
              cell.y = (floor ?? 0) + 0.16;
            }
            effect.cells.push(cell);
          }
      if (!fire) {
        effect.smoke = new SmokeRenderer(effect.cells, this.sphere);
        effect.mesh.add(effect.smoke.batch);
      } else {
        effect.visual = new UtilityVisual("fire", effect.cells);
        effect.mesh.add(effect.visual.mesh);
      }
    } else if (p.kind !== "decoy") {
      effect.visual = new UtilityVisual(p.kind === "flash" ? "flash" : "blast", [p.position]);
      effect.mesh.add(effect.visual.mesh);
    }
    if (this.effects.length >= 48) {
      this.removeEffect(this.effects[0]);
      this.effects.shift();
    }
    this.effects.push(effect);
    g.scene.add(effect.mesh);
  }
  areaDamage(effect: Effect, fixedDamage: number, radius: number) {
    if (this.game.network) return;
    const g = this.game;
    const hurt = (id: Owner, position: T.Vector3) => {
      const actor = id === "player" ? g : g.bots[id];
      if (actor.health <= 0 || (id === "player" && (g.dead || g.invulnerable > 0))) return;
      const center = this.actorCenter.copy(position);
      center.y += 0.8;
      const distance = center.distanceTo(effect.position);
      if (distance > radius || !g.visible(effect.position, center)) return;
      if (
        fixedDamage &&
        (effect.kind === "molotov" || effect.kind === "incendiary") &&
        (!effect.cells.length ||
          !effect.cells.some(
            (c) =>
              Math.hypot(c.x - position.x, c.z - position.z) < 0.8 &&
              Math.abs(c.y - position.y) < 0.8,
          ))
      )
        return;
      let damage = fixedDamage || heDamage(distance);
      if (g.teamMode)
        damage *= utilityDamageScale(
          g.competitive ? "competitive" : "casual",
          effect.kind,
          id === effect.owner,
          actor.team === effect.team,
        );
      if (damage <= 0) return;
      if (effect.kind !== "molotov" && effect.kind !== "incendiary") {
        const result = applyArmorDamage(damage, "chest", actor.armor, actor.helmet, 1);
        damage = result.healthDamage;
        actor.armor = result.armor;
      }
      actor.health = Math.max(0, actor.health - damage);
      if (id === "player") {
        g.damage = 0.2;
        if (damage > 0) g.groundInventory.invalidateEquipment();
      }
      if (actor.health > 0) return;
      const attacker = effect.owner === "player" ? "player" : g.bots[effect.owner];
      if (attacker && id !== effect.owner) g.rewardKill(attacker, actor.team, 0);
      actor.deaths++;
      if (id === "player") {
        g.dead = g.teamMode ? Infinity : 2.5;
        g.firing = false;
        g.revolverCharge = 0;
        g.reload = g.knifeTime = g.inspectTime = 0;
        g.knifePending = false;
        g.setScope(0);
        g.rescope = g.boltTime = 0;
        g.soundscape.play("death");
      } else {
        const b = g.bots[id];
        b.speed = 0;
        b.moving = false;
        b.respawn = g.teamMode ? Infinity : 3;
      }
      if (g.teamMode) g.dropBomb(id);
      g.feed(
        effect.owner === "player" ? "YOU" : (g.bots[effect.owner]?.name ?? "UTILITY"),
        id === "player" ? "YOU" : g.bots[id].name,
        false,
        -1,
        false,
        false,
        grenadeData[effect.kind].name,
      );
      if (
        g.mode === "deathmatch" &&
        (g.kills >= 20 || (attacker !== "player" && attacker?.kills >= 20))
      )
        g.finish();
    };
    hurt("player", g.position);
    g.bots.forEach((b, i) => hurt(i, b.group.position));
  }
  syncNetwork(state: RoundState, players: PlayerState[], localId: string) {
    const g = this.game;
    const owner = (id: string): Owner =>
      id === localId
        ? "player"
        : players.filter((p) => p.id !== localId).findIndex((p) => p.id === id);
    for (const p of this.projectiles.slice())
      if (!state.projectiles.some((wire) => wire.id === p.networkId)) {
        this.removeProjectile(p);
        this.projectiles.splice(this.projectiles.indexOf(p), 1);
      }
    for (const wire of state.projectiles) {
      let p = this.projectiles.find((p) => p.networkId === wire.id);
      if (!p) {
        if (
          !this.launch(
            wire.kind,
            owner(wire.owner),
            wire.team,
            new T.Vector3(wire.x, wire.y, wire.z),
            new T.Vector3(wire.vx, wire.vy, wire.vz),
            wire.weapon,
          )
        )
          continue;
        p = this.projectiles.at(-1)!;
        p.networkId = wire.id;
      }
      p.position.set(wire.x, wire.y, wire.z);
      p.velocity.set(wire.vx, wire.vy, wire.vz);
      p.age = wire.age;
      p.resting = wire.resting;
      p.mesh.position.copy(p.position);
    }
    for (const effect of this.effects.slice())
      if (!state.effects.some((wire) => wire.id === effect.networkId)) {
        this.removeEffect(effect);
        this.effects.splice(this.effects.indexOf(effect), 1);
      }
    for (const wire of state.effects) {
      let effect = this.effects.find((effect) => effect.networkId === wire.id);
      if (!effect) {
        this.detonate({
          kind: wire.kind,
          owner: owner(wire.owner),
          team: wire.team,
          position: new T.Vector3(wire.x, wire.y, wire.z),
          velocity: new T.Vector3(),
          mesh: new T.Group(),
          age: 0,
          resting: true,
          lastBounce: 0,
          weapon: wire.weapon,
        });
        effect = this.effects.at(-1)!;
        effect.networkId = wire.id;
      }
      effect.age = wire.age;
      effect.cleared = wire.cleared;
    }
    const local = players.find((p) => p.id === localId)!;
    this.inventory = { ...local.grenades };
    this.receipts = { ...local.grenadeReceipts };
    this.blind.set("player", local.blind);
    this.clock = state.clock;
    if (this.selected && !this.inventory[this.selected]) this.selected = null;
    g.updateBuyMenu();
  }
  takeover(index: number) {
    this.cancelThrow();
    this.inventory = { ...(this.botInventories.get(index) ?? emptyGrenades()) };
    this.botInventories.delete(index);
    this.lastAlive.delete(index);
    this.selected = null;
    this.receipts = emptyGrenades();
    const blindness = this.blind.get(index);
    this.blind.delete(index);
    if (blindness) this.blind.set("player", blindness);
    else this.blind.delete("player");
  }
  botGoal(index: number, normal: T.Vector3) {
    const g = this.game,
      b = g.bots[index],
      bomb = g.bomb;
    if (
      bomb?.planted &&
      b.team === "ct" &&
      bomb.timer <
        b.group.position.distanceTo(bomb.position) / 4 +
          (b.defuseKit ? 5 : 10) -
          (bomb.defuser === index ? bomb.progress : 0)
    ) {
      // A known planted bomb supplies a public deadline, not hidden opponent information.
      if (bomb.defuser === index) {
        bomb.defuser = null;
        bomb.progress = 0;
      }
      const direction = b.group.position.clone().sub(bomb.position);
      direction.y = 0;
      if (direction.lengthSq() < 0.1) direction.set(1, 0, 0);
      b.cover.copy(b.group.position).addScaledVector(direction.normalize(), 12);
      b.reposition = true;
      b.tactic = 1;
      return b.cover;
    }
    const entry = this.entries.get(index);
    if (!entry || entry.until < this.clock) {
      this.entries.delete(index);
      return normal;
    }
    if (entry.at > this.clock || this.blind.has(index)) return normal;
    b.reposition = true;
    b.tactic = 1;
    b.cover.copy(entry.position);
    return b.cover;
  }
  buyBot(index: number, preserve: boolean) {
    const g = this.game,
      b = g.bots[index];
    const inventory = preserve
      ? (this.botInventories.get(index) ?? emptyGrenades())
      : emptyGrenades();
    this.botInventories.set(index, inventory);
    if (!g.teamMode) return;
    const preferences: GrenadeKind[] =
      index % 3 === 0
        ? ["smoke", "flash", "he"]
        : index % 3 === 1
          ? ["flash", b.team === "t" ? "molotov" : "incendiary"]
          : ["he", "smoke"];
    for (const kind of preferences)
      if (
        canCarryGrenade(inventory, kind, g.competitive) &&
        b.money >= grenadeData[kind].price &&
        !inventory[kind]
      ) {
        inventory[kind]++;
        b.money -= grenadeData[kind].price;
      }
  }
  botTactics() {
    const g = this.game;
    if (!g.teamMode || g.freezeTime > 0 || g.roundPause > 0) return;
    g.bots.forEach((b, index) => {
      const living = b.health > 0;
      if (this.lastAlive.get(index) && !living && b.alert > 0) {
        g.bots.forEach((teammate, j) => {
          if (
            teammate.team === b.team &&
            teammate.health > 0 &&
            teammate.group.position.distanceTo(b.group.position) < 12
          ) {
            this.entries.set(j, {
              position: b.memory.clone(),
              at: this.clock + 0.2,
              until: this.clock + 3,
            });
            teammate.memory.copy(b.memory);
            teammate.alert = Math.max(teammate.alert, 2);
            teammate.nav = 0;
          }
        });
      }
      this.lastAlive.set(index, living);
      if (!living) return;
      const cooldown = Math.max(0, (this.botCooldown.get(index) ?? 0) - 0.25);
      this.botCooldown.set(index, cooldown);
      // Escape damaging fire rather than stopping inside it to shoot.
      const fire = this.effects.find(
        (e) =>
          (e.kind === "molotov" || e.kind === "incendiary") &&
          b.group.position.distanceTo(e.position) < grenadeData[e.kind].radius + 0.8,
      );
      if (fire) {
        const escape = b.group.position.clone().sub(fire.position);
        escape.y = 0;
        if (escape.lengthSq() < 0.1) escape.set(1, 0, 0);
        b.cover.copy(b.group.position).addScaledVector(escape.normalize(), 4);
        b.path = g.findPath(b.group.position, b.cover);
        b.reposition = true;
        b.moving = true;
        b.tactic = 1;
      }
      const inventory = this.botInventories.get(index);
      if (!inventory || cooldown || b.alert <= 0 || this.blind.has(index) || b.reloadTime > 0)
        return;
      const distance = b.group.position.distanceTo(b.memory);
      if (distance < 6 || distance > 23) return;
      // Use only personally seen or teammate-reported memory; no hidden enemy positions.
      const retreat = b.health < 40 || (g.bomb?.planted && b.team === "ct");
      const kind: GrenadeKind | undefined =
        retreat && inventory.smoke
          ? "smoke"
          : !b.tracking && inventory.flash
            ? "flash"
            : b.tracking && inventory.he
              ? "he"
              : b.tracking && inventory.molotov
                ? "molotov"
                : b.tracking && inventory.incendiary
                  ? "incendiary"
                  : undefined;
      if (!kind) return;
      const from = b.group.position.clone().add(new T.Vector3(0, 1.4, 0));
      const target = b.memory.clone().add(new T.Vector3(0, 0.5, 0));
      if (kind === "smoke") target.lerp(b.group.position, 0.45);
      // Avoid intentional HE/fire on teammates; share a team throw cooldown so
      // entries get staggered utility rather than ten simultaneous grenades.
      if (
        kind !== "smoke" &&
        g.bots.some(
          (other) =>
            other !== b &&
            other.team === b.team &&
            other.health > 0 &&
            other.group.position.distanceTo(target) < 5,
        )
      )
        return;
      if (b.team === g.team && !g.dead && g.position.distanceTo(target) < 5) return;
      if (kind === "flash")
        g.bots.forEach((teammate, j) => {
          if (
            teammate.team === b.team &&
            teammate.health > 0 &&
            teammate.group.position.distanceTo(from) < 16
          ) {
            this.entries.set(j, {
              position: b.memory.clone(),
              at: this.clock + 1.7,
              until: this.clock + 5,
            });
            teammate.nav = 0;
          }
        });
      const flight = Math.max(0.7, from.distanceTo(target) / 13);
      const velocity = target.sub(from).multiplyScalar(1 / flight);
      velocity.y += 0.5 * 8.128 * flight;
      if (!this.launch(kind, index, b.team, from, velocity, b.rig.weaponIndex)) return;
      inventory[kind]--;
      b.shot = Math.max(b.shot, 0.9);
      this.botCooldown.set(index, 8);
      g.bots.forEach((teammate, j) => {
        if (teammate.team === b.team)
          this.botCooldown.set(j, Math.max(this.botCooldown.get(j) ?? 0, 2));
      });
    });
  }
}
