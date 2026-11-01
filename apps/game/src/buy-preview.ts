import * as T from "three";
import { selectedAgentId } from "./agent-roster";
import { createSoldier, disposeSoldier, type Soldier, type AgentTeam } from "./soldier";
import { weapons, isKnife } from "./physics";
import { applyBuyPose, buyPoseToken, poseBuyProp, metricBuyGrip } from "./buy-poses";
import { createNativeWorldGun } from "./weapon-motion";
import { createWorldBayonet, disposeWorldGun } from "./weapons";
import { createInspectsWorldKnife } from "./inspects-knife";
import { bayonetWorldGrip } from "./knife-motion";
import { createGrenadeModel } from "./grenade-models";
import { type GrenadeKind } from "./utility";
import { movePreviewHands } from "./preview-arm";
import { unregisterSkinModel, skinChoices, skinName, skinRarityColor } from "./skins";

/** Uses the game's context and loaded templates; no extra model requests or render loop. */
export class BuyPreview {
  private scene = new T.Scene();
  private backdrop = new T.Scene();
  private backdropCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  private camera = new T.PerspectiveCamera(33, 1, 0.05, 20);
  private soldier?: Soldier;
  private item?: T.Group;
  private items = new Map<string, T.Group>();
  private attachment?: ReturnType<typeof applyBuyPose>;
  private placement = new T.Matrix4();
  private hovered?: HTMLElement;
  private current = "";
  private agentId = "";
  private clearColor = new T.Color();
  private viewport = new T.Vector4();
  private scissor = new T.Vector4();
  private size = new T.Vector2();
  private rect?: DOMRect;
  private open = false;
  private resizeObserver?: ResizeObserver;
  private menuObserver?: MutationObserver;
  private stageId: string;
  private menuId: string;
  private previewTeam?: AgentTeam;
  constructor(stageId = "buy-preview-stage", menuId = "loadout", previewTeam?: AgentTeam) {
    this.stageId = stageId;
    this.menuId = menuId;
    this.previewTeam = previewTeam;
    this.backdropCamera.position.z = 1;
    this.backdrop.add(
      new T.Mesh(
        new T.PlaneGeometry(2, 2),
        new T.MeshBasicMaterial({
          color: 0x24231f,
          transparent: true,
          opacity: 0.8,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    );
    this.scene.add(new T.HemisphereLight(0xe9f2ff, 0x6a5b40, 2.5));
    const key = new T.DirectionalLight(0xffe5bf, 3.5);
    key.position.set(-3, 4, 4);
    const rim = new T.DirectionalLight(0xbcd9ff, 2.5);
    rim.position.set(3, 2, -2);
    this.scene.add(key, rim);
    this.camera.position.set(0, 1.05, 3.7);
    this.camera.lookAt(0, 0.96, 0);
    const stage = document.getElementById(this.stageId)!;
    this.resizeObserver = new ResizeObserver(() => {
      this.rect = undefined;
    });
    this.resizeObserver.observe(stage);
    const menu = document.getElementById(this.menuId)!;
    this.menuObserver = new MutationObserver(() => {
      if (menu.classList.contains("hidden")) this.open = false;
    });
    this.menuObserver.observe(menu, { attributes: true, attributeFilter: ["class"] });
    const inspect = (event: Event) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>(
        ".buy-card, [data-loadout-slot]",
      );
      if (card && (!this.previewTeam || card.dataset.previewTeam === this.previewTeam))
        this.hovered = card;
    };
    // Delegation also previews unaffordable cards, without enabling purchases.
    menu.addEventListener("pointerover", inspect);
    menu.addEventListener("focusin", inspect);
  }
  dispose() {
    this.resizeObserver?.disconnect();
    this.menuObserver?.disconnect();
    if (this.soldier) disposeSoldier(this.soldier);
    for (const item of this.items.values()) {
      unregisterSkinModel(item);
      if (item.userData.ownedWorldGun) disposeWorldGun(item);
      else if (item.userData.previewOwned)
        item.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
        });
    }
    this.backdrop.traverse((object) => {
      if (object instanceof T.Mesh) {
        object.geometry.dispose();
        object.material.dispose();
      }
    });
    this.items.clear();
  }
  render(renderer: T.WebGLRenderer, team: AgentTeam, selected: number) {
    const menu = document.getElementById(this.menuId)!;
    if (menu.classList.contains("hidden")) {
      this.open = false;
      return;
    }
    if (this.stageId === "buy-preview-stage") renderer.render(this.backdrop, this.backdropCamera);
    if (!this.open) {
      this.open = true;
      this.hovered = undefined;
      this.rect = undefined;
    }
    const agentId = selectedAgentId(team);
    if (!this.soldier || this.soldier.team !== team || this.agentId !== agentId) {
      if (this.soldier) {
        this.scene.remove(this.soldier.group);
        disposeSoldier(this.soldier);
      }
      this.soldier = createSoldier(0, team);
      this.agentId = agentId;
      const stage = document.getElementById(this.stageId)!;
      stage.dataset.agent = agentId;
      stage.dataset.agentModel = this.soldier.model.userData.agentModel ?? "";
      this.soldier.group.visible = true;
      this.soldier.group.rotation.y = -0.4;
      this.scene.add(this.soldier.group);
      this.current = "";
    }
    const soldier = this.soldier;
    const card = this.hovered && !this.hovered.hidden ? this.hovered : undefined;
    const kind = card?.dataset.grenade as GrenadeKind | undefined;
    const equipment = card?.dataset.equipment;
    const index = card?.dataset.weapon === undefined ? selected : Number(card.dataset.weapon);
    const identity =
      kind ?? equipment ?? `${index}:${skinChoices[index].id}:${skinName(skinChoices[index].id)}`;
    if (identity !== this.current) {
      this.current = identity;
      this.item = undefined;
      for (const model of this.items.values()) model.visible = false;
      const token =
        kind === "he"
          ? "hegrenade"
          : (kind ??
            (equipment ? (equipment === "kit" ? "defuser" : "armor_helmet") : buyPoseToken(index)));
      this.attachment = applyBuyPose(soldier, token);
      if (!kind && !equipment && !isKnife(index))
        movePreviewHands(soldier.group, [soldier.rightHand, soldier.leftHand], 0.14);
      document.getElementById(this.stageId)!.dataset.pose = this.attachment.clip;
      if (!equipment) {
        const itemKey = `${team}:${soldier.animationTeam}:${kind ?? String(index)}`;
        let model = this.items.get(itemKey);
        if (!model) {
          if (kind) {
            const mesh = createGrenadeModel(kind);
            if (mesh) {
              model = new T.Group();
              model.add(mesh);
              model.userData.buyGrip = poseBuyProp(mesh, this.attachment.weaponBones).toArray();
            }
          } else if (!isKnife(index))
            model = createNativeWorldGun(index, true, this.attachment.weaponBones, true);
          else if (index === 4) {
            model = createWorldBayonet();
            model.userData.buyGrip = bayonetWorldGrip(model).toArray();
          } else {
            model = createInspectsWorldKnife(index);
            if (token === "push")
              model.userData.buyGrip = poseBuyProp(model, this.attachment.weaponBones).toArray();
          }
          if (model) {
            model.userData.previewOwned = !kind;
            this.items.set(itemKey, model);
            this.scene.add(model);
          }
        }
        this.item = model;
      }
      if (this.item && this.attachment) {
        metricBuyGrip(this.attachment.hand, this.attachment.matrix, this.placement).multiply(
          new T.Matrix4().fromArray(this.item.userData.buyGrip).invert(),
        );
        this.placement.decompose(this.item.position, this.item.quaternion, this.item.scale);
        this.item.visible = true;
      }
      if (this.stageId === "buy-preview-stage") {
        document.getElementById("buy-preview-team")!.textContent =
          team === "ct" ? "COUNTER-TERRORISTS" : "TERRORISTS";
        const name = document.getElementById("buy-preview-name")!;
        const finish = !kind && !equipment ? skinName(skinChoices[index].id) : "";
        name.textContent =
          (card?.querySelector("b")?.textContent ?? weapons[index].name) +
          (finish ? ` | ${finish}` : "");
        const rarity = finish ? skinRarityColor(skinChoices[index].id) : "";
        name.style.color = /^#[0-9a-f]{6}$/i.test(rarity) ? rarity : "";
        document.getElementById("buy-preview-detail")!.textContent =
          card?.querySelector("small")?.textContent ?? "Hover an item to inspect it.";
      }
      document.getElementById(this.stageId)!.dataset.item = kind ?? equipment ?? String(index);
    }
    const rect = (this.rect ??= document.getElementById(this.stageId)!.getBoundingClientRect());
    if (rect.width < 1 || rect.height < 1) return;
    // Renderer coordinates use its logical size, which may be capped for quality.
    renderer.getSize(this.size);
    const sx = this.size.x / window.innerWidth,
      sy = this.size.y / window.innerHeight;
    renderer.getViewport(this.viewport);
    renderer.getScissor(this.scissor);
    const scissorTest = renderer.getScissorTest();
    const x = rect.left * sx,
      y = (window.innerHeight - rect.bottom) * sy;
    renderer.setViewport(x, y, rect.width * sx, rect.height * sy);
    renderer.setScissor(x, y, rect.width * sx, rect.height * sy);
    renderer.setScissorTest(true);
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
    renderer.setClearColor(this.clearColor, clearAlpha);
    renderer.setViewport(this.viewport);
    renderer.setScissor(this.scissor);
    renderer.setScissorTest(scissorTest);
  }
}
