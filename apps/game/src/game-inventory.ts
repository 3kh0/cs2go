import * as T from "three";
import { advanceDroppedWeapon, canPickupDroppedWeapon } from "@cs2go/simulation/dropped-weapon";
import type { Game } from "./game";
import { weapons, weaponIcons, isKnife, weaponSlot } from "./physics";
import { createWeaponInstance, type WeaponInstance } from "./weapon-instance";
import { disposeWorldGun, createWorldGun } from "./weapons";
import { setSoldierWeapon } from "./soldier";
import { addMoney, weaponPrice } from "./economy";
import { defaultLoadouts, loadoutCategory, readLoadouts, loadoutChoices } from "./loadouts";
import { BuyPreview } from "./buy-preview";
import { assetUrl } from "./asset-url";
import { skinChoices, skinCatalog, type Skin } from "./skins";
import "./loadout-menu.css";
import { weaponThumbnail } from "./weapon-thumbnails";

type Drop = {
  id: number;
  instance: WeaponInstance;
  ammo: number;
  reserve: number;
  suppressed: boolean;
  mesh: T.Group;
  velocity: T.Vector3;
  tossed: boolean;
  age: number;
  sleeping: boolean;
  owner: number | "player";
  buyDrop?: boolean;
};
type EquipmentKind = "kevlar" | "helmet" | "kit";
type EquipmentState = { armor: number; helmet: boolean; kit: boolean };
type EquipmentReceipt = {
  kind: EquipmentKind;
  price: number;
  before: EquipmentState;
  after: EquipmentState;
};
type Receipt = { price: number; ammo: number; reserve: number };
/** Dropped weapons retain their identity and release any owned painted models. */
export class GameInventory {
  drops: Drop[] = [];
  instances = new Map<number, WeaponInstance>();
  playerWeapon(id: number) {
    let instance = this.instances.get(id);
    if (!instance) {
      instance = createWeaponInstance(id, "player", true);
      this.instances.set(id, instance);
    }
    return instance;
  }
  newPlayerWeapon(id: number) {
    const instance = createWeaponInstance(id, "player", true);
    this.instances.set(id, instance);
    return instance;
  }

  receipts = new Map<number, Receipt>();
  sidearmDropped = false;
  equipmentReceipts: EquipmentReceipt[] = [];
  loadouts = defaultLoadouts();
  roundLoadout: number[] | null = null;
  private editorTeam: "t" | "ct" = "ct";
  private editorCategory = "Pistols";
  private editorSlot = 0;
  private previews: BuyPreview[] = [];
  private skinCatalog: Skin[] = [];
  private playerAlive = true;
  private alive = new WeakMap<object, boolean>();
  private clock = 0;
  private dropEye = new T.Vector3();
  private botEye = new T.Vector3();
  private game: Game;
  constructor(game: Game) {
    this.game = game;
    try {
      this.loadouts = readLoadouts(JSON.parse(localStorage.getItem("cs2go-loadouts") || "null"));
    } catch {
      /* Defaults when storage is unavailable. */
    }
    document.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-refund], #inventory-button, [data-inventory-team], [data-inventory-slot], [data-loadout-weapon], #close-loadout-editor, [data-grenade]",
      );
      if (!target) return;
      if (target.dataset.grenade)
        game.utility.buy(target.dataset.grenade as import("./utility").GrenadeKind);
      else if (target.id === "inventory-button") {
        this.editorTeam = game.team;
        this.showLoadout();
      } else if (target.dataset.inventoryTeam) {
        this.editorTeam = target.dataset.inventoryTeam as "t" | "ct";
        this.showLoadout();
      } else if (target.dataset.inventorySlot !== undefined) {
        this.editorTeam = target.dataset.previewTeam as "t" | "ct";
        this.editorCategory = target.dataset.category!;
        this.editorSlot = Number(target.dataset.inventorySlot);
        this.showLoadout();
      } else if (target.id === "close-loadout-editor") this.closeLoadout();
      else if (target.dataset.refund !== undefined) this.refund(Number(target.dataset.refund));
      else if (target.dataset.loadoutWeapon !== undefined) {
        const id = Number(target.dataset.loadoutWeapon);
        const list = this.loadouts[this.editorTeam];
        if (!loadoutChoices(this.editorTeam, this.editorCategory, this.editorSlot).includes(id))
          return;
        const choices = list.filter((other) => loadoutCategory(other) === this.editorCategory);
        const previous = choices[this.editorSlot];
        const existing = list.indexOf(id);
        const position = list.indexOf(previous);
        // Swap occupied choices, so replacing one slot never creates duplicates.
        if (position >= 0) {
          if (existing >= 0) list[existing] = previous;
          list[position] = id;
        } else if (existing < 0) list.push(id);
        try {
          localStorage.setItem("cs2go-loadouts", JSON.stringify(this.loadouts));
          window.dispatchEvent(new Event("cs2go-loadouts-change"));
        } catch {
          /* Session selection remains usable. */
        }
        this.showLoadout();
      }
      game.updateBuyMenu();
    });
  }
  allowed(id: number) {
    return (
      !this.game.teamMode ||
      isKnife(id) ||
      (this.roundLoadout ?? this.loadouts[this.game.team]).includes(id)
    );
  }
  closeLoadout() {
    for (const preview of this.previews) preview.dispose();
    this.previews = [];
    document.getElementById("loadout-editor")?.remove();
  }
  renderPreviews(renderer: T.WebGLRenderer) {
    if (!document.getElementById("loadout-editor")) {
      if (this.previews.length) this.closeLoadout();
      return;
    }
    const clear = renderer.getClearColor(new T.Color()),
      alpha = renderer.getClearAlpha();
    renderer.setClearColor(0x596777, 1);
    renderer.clear();
    for (const [i, team] of (["ct", "t"] as const).entries())
      this.previews[i]?.render(
        renderer,
        team,
        this.loadouts[team].find((id) => loadoutCategory(id) === "Rifles") ??
          (team === "ct" ? 9 : 0),
      );
    renderer.setClearColor(clear, alpha);
  }
  showLoadout() {
    if (!this.game.assetsReady) {
      return;
    }
    this.closeLoadout();
    const overlay = document.createElement("section");
    overlay.id = "loadout-editor";
    overlay.className = "overlay loadout-page";
    overlay.setAttribute("aria-label", "Loadout");
    overlay.innerHTML = `<header class="loadout-page-heading"><span>LOADOUT</span><small>Changes apply next round</small><button id="close-loadout-editor" aria-label="Close loadout">×</button></header><div class="loadout-teams">${(
      ["ct", "t"] as const
    )
      .map(
        (team) =>
          `<section class="loadout-team" data-team="${team}" data-selected="${this.editorTeam === team}"><button class="loadout-team-title" data-inventory-team="${team}" aria-pressed="${this.editorTeam === team}">EQUIP ${team.toUpperCase()}</button><div class="loadout-agent" id="loadout-agent-${team}"></div><div class="loadout-slot-columns">${[
            "Pistols",
            "Mid-Tier",
            "Rifles",
          ]
            .map((category) => {
              const choices = this.loadouts[team].filter((id) => loadoutCategory(id) === category);
              return `<section><h3>${category === "Pistols" ? "STARTING PISTOL" : category.toUpperCase()}</h3>${Array.from(
                { length: 5 },
                (_, slot) => {
                  const id = choices[slot];
                  const skin =
                    id === undefined
                      ? undefined
                      : this.skinCatalog.find(
                          (s) => s.weapon === id && s.id === skinChoices[id].id,
                        );
                  return `${category === "Pistols" && slot === 1 ? '<h3 class="loadout-other-pistols">OTHER PISTOLS</h3>' : ""}<button class="loadout-slot" data-loadout-slot data-inventory-slot="${slot}" data-preview-team="${team}" data-category="${category}" ${id === undefined ? "" : `data-weapon="${id}"`} aria-pressed="${this.editorTeam === team && this.editorCategory === category && this.editorSlot === slot}">${id === undefined ? "<span>Empty slot</span>" : `<img src="${assetUrl(skin?.image ?? `/icons/${weaponIcons[id]}.png`)}" alt=""><small>$${weaponPrice(id).toLocaleString()}</small><b>${weapons[id].name}</b>`}</button>`;
                },
              ).join("")}</section>`;
            })
            .join("")}</div></section>`,
      )
      .join(
        "",
      )}</div><footer class="loadout-candidates"><div class="loadout-filter"><label>Category <select id="loadout-category">${["Pistols", "Mid-Tier", "Rifles"].map((c) => `<option ${c === this.editorCategory ? "selected" : ""}>${c}</option>`).join("")}</select></label><span>${this.editorTeam.toUpperCase()} - ${this.editorCategory === "Pistols" && this.editorSlot === 0 ? "Starting pistol" : `Slot ${this.editorSlot + 1}`} - Select a weapon to replace this slot</span></div><div class="inventory-choices">${loadoutChoices(
      this.editorTeam,
      this.editorCategory,
      this.editorSlot,
    )
      .map((id) => {
        const skin = this.skinCatalog.find((s) => s.weapon === id && s.id === skinChoices[id].id);
        return `<button data-loadout-weapon="${id}" aria-pressed="${this.loadouts[this.editorTeam].filter((other) => loadoutCategory(other) === this.editorCategory)[this.editorSlot] === id}"><img src="${assetUrl(skin?.image ?? `/icons/${weaponIcons[id]}.png`)}" alt=""><b>${weapons[id].name}</b><small>$${weaponPrice(id).toLocaleString()}</small></button>`;
      })
      .join("")}</div></footer>`;
    document.body.append(overlay);
    // Fill default tiles from small native renders; painted tiles use their catalog preview.
    overlay.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
      const card = image.closest<HTMLElement>("[data-weapon], [data-loadout-weapon]");
      const id = Number(card?.dataset.weapon ?? card?.dataset.loadoutWeapon);
      if (Number.isInteger(id) && !skinChoices[id]?.id)
        image.src = weaponThumbnail(this.game.renderer, id);
    });
    this.previews = [
      new BuyPreview("loadout-agent-ct", "loadout-editor", "ct"),
      new BuyPreview("loadout-agent-t", "loadout-editor", "t"),
    ];
    overlay.querySelector<HTMLSelectElement>("#loadout-category")!.onchange = (event) => {
      this.editorCategory = (event.target as HTMLSelectElement).value;
      this.editorSlot = this.editorCategory === "Pistols" ? 1 : 0;
      this.showLoadout();
    };
    overlay.onkeydown = (event) => {
      if (event.code === "Escape") {
        event.stopPropagation();
        this.closeLoadout();
      }
    };
    if (!this.skinCatalog.length)
      void skinCatalog()
        .then((catalog) => {
          this.skinCatalog = catalog;
          if (document.getElementById("loadout-editor")) this.showLoadout();
        })
        .catch(() => {});
  }
  reset(preserve = false) {
    this.receipts.clear();
    if (!preserve) this.instances.clear();
    this.equipmentReceipts = [];
    if (!preserve) this.sidearmDropped = false;
    this.playerAlive = true;
    for (const bot of this.game.bots) this.alive.set(bot, bot.health > 0);
  }
  equipmentState(): EquipmentState {
    return { armor: this.game.armor, helmet: this.game.helmet, kit: this.game.defuseKit };
  }
  equipmentPurchased(kind: EquipmentKind, price: number, before: EquipmentState) {
    this.equipmentReceipts.push({ kind, price, before, after: this.equipmentState() });
  }
  invalidateEquipment(kitOnly = false) {
    this.equipmentReceipts = this.equipmentReceipts.filter((receipt) =>
      kitOnly ? receipt.kind !== "kit" : receipt.kind === "kit",
    );
  }
  canRefundEquipment(kind: EquipmentKind) {
    if (this.game.network)
      return (
        this.game.canBuy() &&
        !!this.game.network.connection.local?.refundableEquipment.includes(kind)
      );
    const receipt = this.equipmentReceipts.findLast((r) => r.kind === kind);
    if (!receipt || !this.game.canBuy()) return false;
    if (kind === "kit") return this.game.defuseKit && this.game.bomb?.defuser !== "player";
    const latestArmor = this.equipmentReceipts.findLast((r) => r.kind !== "kit");
    return (
      latestArmor === receipt &&
      this.game.armor === receipt.after.armor &&
      this.game.helmet === receipt.after.helmet
    );
  }
  refundEquipment(kind: EquipmentKind) {
    if (this.game.network) {
      this.game.network.request.refundEquipment = kind;
      return true;
    }
    if (!this.canRefundEquipment(kind)) return false;
    const receipt = this.equipmentReceipts.findLast((r) => r.kind === kind)!;
    this.equipmentReceipts.splice(this.equipmentReceipts.indexOf(receipt), 1);
    if (kind === "kit") this.game.defuseKit = receipt.before.kit;
    else {
      this.game.armor = receipt.before.armor;
      this.game.helmet = receipt.before.helmet;
    }
    this.game.money = addMoney(
      this.game.money,
      receipt.price,
      this.game.competitive ? "competitive" : "casual",
    );
    this.game.updateUI();
    this.game.updateBuyMenu();
    return true;
  }
  updateEquipmentRefunds() {
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-equipment]")) {
      const kind = button.dataset.equipment as EquipmentKind;
      let refund = button.parentElement?.querySelector<HTMLButtonElement>(
        `[data-equipment-refund="${kind}"]`,
      );
      if (!refund) {
        refund = document.createElement("button");
        refund.className = "buy-refund";
        refund.dataset.equipmentRefund = kind;
        refund.textContent = "↶";
        refund.title = `Refund ${kind === "kit" ? "Defuse Kit" : kind === "helmet" ? "Armor + Helmet" : "Kevlar"}`;
        refund.setAttribute("aria-label", refund.title);
        refund.onclick = () => this.refundEquipment(kind);
        button.after(refund);
      }
      refund.hidden = !this.canRefundEquipment(kind);
    }
  }
  clearDrops() {
    for (const drop of this.drops) disposeWorldGun(drop.mesh);
    this.drops.length = 0;
  }
  purchased(id: number, price: number) {
    if (weaponSlot(id) === 2) this.sidearmDropped = false;
    this.receipts.set(id, { price, ...this.game.magazines[id] });
  }
  used(id: number) {
    this.receipts.delete(id);
  }
  canRefund(id: number) {
    if (this.game.network)
      return (
        this.game.canBuy() && !!this.game.network.connection.local?.refundableWeapons.includes(id)
      );
    const g = this.game,
      receipt = this.receipts.get(id);
    const state = g.selected === id ? g : g.magazines[id];
    return (
      !!receipt &&
      g.canBuy() &&
      g.inventory().includes(id) &&
      state.ammo === receipt.ammo &&
      state.reserve === receipt.reserve
    );
  }
  refund(id: number) {
    if (this.game.network) {
      this.game.network.request.refund = id;
      return true;
    }
    if (!this.canRefund(id)) return false;
    const g = this.game,
      receipt = this.receipts.get(id)!;
    this.receipts.delete(id);
    if (weaponSlot(id) === 1) g.primary = null;
    else this.sidearmDropped = true;
    g.money = addMoney(g.money, receipt.price, g.competitive ? "competitive" : "casual");
    g.equip(g.primary ?? (!this.sidearmDropped ? g.secondary : g.knife));
    g.updateUI();
    g.updateBuyMenu();
    return true;
  }
  spawn(
    id: number,
    ammo: number,
    reserve: number,
    position: T.Vector3,
    yaw: number,
    owner: Drop["owner"],
    suppressed = true,
    instance = owner === "player"
      ? this.playerWeapon(id)
      : this.game.bots[owner]?.rig.weaponIndex === id
        ? this.game.bots[owner].rig.weaponInstance
        : createWeaponInstance(id, `bot:${owner}`),
  ) {
    if (isKnife(id)) return;
    if (this.drops.length >= 64) disposeWorldGun(this.drops.shift()!.mesh);
    const mesh = new T.Group();
    const gun = createWorldGun(id, suppressed, instance);
    mesh.userData.ownedWorldGun = gun.userData.ownedWorldGun;
    gun.rotation.z = Math.PI / 2;
    mesh.add(gun);
    mesh.position.copy(position).add(new T.Vector3(0, 0.7, 0));
    mesh.rotation.y = yaw;
    this.game.scene.add(mesh);
    const drop: Drop = {
      id,
      instance,
      ammo,
      reserve,
      mesh,
      velocity: new T.Vector3(-Math.sin(yaw) * 2.5, 1, -Math.cos(yaw) * 2.5),
      age: 0,
      sleeping: false,
      tossed: false,
      owner,
      suppressed,
    };
    this.drops.push(drop);
    return drop;
  }
  drop(id = this.game.selected, toss = false) {
    if (this.game.network) return false;
    const g = this.game;
    if (!g.active || g.dead || isKnife(id) || !g.inventory().includes(id)) return false;
    const state = g.selected === id ? g : g.magazines[id];
    const drop = this.spawn(
      id,
      state.ammo,
      state.reserve,
      g.position,
      g.yaw,
      "player",
      g.isSuppressed(id),
    );
    if (toss && drop) {
      const forward = new T.Vector3(
        -Math.sin(g.yaw) * Math.cos(g.pitch),
        Math.sin(g.pitch),
        -Math.cos(g.yaw) * Math.cos(g.pitch),
      );
      const eye = g.position.clone().add(new T.Vector3(0, g.eye - 0.25, 0));
      const release = eye
        .clone()
        .addScaledVector(forward, 0.55)
        .add(new T.Vector3(Math.cos(g.yaw) * 0.18, 0, -Math.sin(g.yaw) * 0.18));
      drop.mesh.position.copy(g.visible(eye, release) ? release : eye);
      drop.velocity.copy(forward).multiplyScalar(5);
      drop.velocity.x += g.velocity.x * 0.5;
      drop.velocity.z += g.velocity.z * 0.5;
      drop.velocity.y += 1.4;
      drop.tossed = true;
    }
    this.used(id);
    this.instances.delete(id);
    if (weaponSlot(id) === 1) g.primary = null;
    else this.sidearmDropped = true;
    g.equip(g.primary ?? (!this.sidearmDropped ? g.secondary : g.knife));
    g.updateUI();
    return true;
  }
  pickup(use = false) {
    if (this.game.network) return false;
    const g = this.game;
    if (g.dead || !g.active) return false;
    const drop = this.drops.find(
      (d) =>
        (use || !d.buyDrop || d.owner !== "player") &&
        canPickupDroppedWeapon(
          d.mesh.position,
          d.age,
          d.owner === "player",
          g.position,
          (from, to) => g.visible(from, to),
        ) &&
        (use || (weaponSlot(d.id) === 1 ? g.primary === null : this.sidearmDropped)),
    );
    if (!drop) return false;
    drop.mesh.removeFromParent();
    this.drops.splice(this.drops.indexOf(drop), 1);
    const slot = weaponSlot(drop.id),
      previous = slot === 1 ? g.primary : this.sidearmDropped ? null : g.secondary;
    if (previous !== null) this.drop(previous);
    if (slot === 1) g.primary = drop.id;
    else {
      g.secondary = drop.id;
      this.sidearmDropped = false;
    }
    // Equip saves the outgoing magazine. Set the pickup's ammo after that save,
    // including same-weapon replacements.
    g.suppressors[drop.id].attached = drop.suppressed;
    g.suppressors[drop.id].cancel();
    this.instances.set(drop.id, drop.instance);
    g.equip(drop.id);
    disposeWorldGun(drop.mesh);
    g.ammo = drop.ammo;
    g.reserve = drop.reserve;
    g.magazines[drop.id] = { ammo: drop.ammo, reserve: drop.reserve };
    this.receipts.delete(drop.id);
    g.updateUI();
    return true;
  }
  update(dt: number) {
    const g = this.game;
    if (!g.active) return;
    if (g.bomb?.defuser === "player") this.invalidateEquipment(true);
    const armorReceipt = this.equipmentReceipts.findLast((r) => r.kind !== "kit");
    if (
      armorReceipt &&
      (g.armor < armorReceipt.after.armor || g.helmet !== armorReceipt.after.helmet)
    )
      this.invalidateEquipment();
    const living = !g.dead && g.health > 0;
    if (this.playerAlive && !living) {
      for (const id of g.inventory()) {
        const state = g.selected === id ? g : g.magazines[id];
        this.spawn(id, state.ammo, state.reserve, g.position, g.yaw, "player", g.isSuppressed(id));
      }
      this.receipts.clear();
    }
    this.playerAlive = living;
    g.bots.forEach((bot, index) => {
      const living = bot.health > 0;
      if (this.alive.get(bot) === true && !living && bot.group.visible)
        this.spawn(
          bot.rig.weaponIndex,
          bot.ammo,
          bot.reserve,
          bot.group.position,
          bot.facing,
          index,
          bot.rig.suppressed,
        );
      this.alive.set(bot, living);
    });
    for (const d of this.drops) {
      advanceDroppedWeapon(d.mesh.position, d.velocity, d.mesh.rotation, d, dt, g.world.collision);
    }
    this.clock += dt;
    if (this.clock < 0.15) return;
    this.clock = 0;
    this.pickup();
    // Bots recover nearby better guns, enabling gifts and scavenging without
    // omniscient routing to unseen weapons across the map.
    for (let index = 0; index < g.bots.length; index++) {
      const bot = g.bots[index];
      if (bot.health <= 0 || bot.target !== null || bot.reloadTime > 0) continue;
      this.botEye.copy(bot.group.position).y += 0.6;
      const drop = this.drops.find(
        (d) =>
          d.age > 1 &&
          d.owner !== index &&
          d.ammo + d.reserve > 0 &&
          d.mesh.position.distanceToSquared(bot.group.position) < 2.56 &&
          weaponSlot(d.id) === 1 &&
          (weaponSlot(bot.rig.weaponIndex) !== 1 ||
            weaponPrice(d.id) > weaponPrice(bot.rig.weaponIndex)) &&
          g.visible(this.botEye, this.dropEye.copy(d.mesh.position).setY(d.mesh.position.y + 0.15)),
      );
      if (!drop) continue;
      drop.mesh.removeFromParent();
      this.drops.splice(this.drops.indexOf(drop), 1);
      this.spawn(
        bot.rig.weaponIndex,
        bot.ammo,
        bot.reserve,
        bot.group.position,
        bot.facing,
        index,
        bot.rig.suppressed,
      );
      setSoldierWeapon(bot.rig, drop.id, drop.suppressed, drop.instance);
      disposeWorldGun(drop.mesh);
      bot.ammo = drop.ammo;
      bot.reserve = drop.reserve;
      bot.reloadTime = 0;
    }
  }
}
