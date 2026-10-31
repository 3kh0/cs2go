import * as T from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BombPlantModel } from "./bomb-motion";
import { registerActorLighting } from "./actor-lighting";

const segments = 24;
const sides = 6;
/** Persistent tube buffers: no per-frame geometry allocation or disposal. */
class DefuseWire extends T.Mesh<T.BufferGeometry, T.MeshStandardMaterial> {
  private point = new T.Vector3();
  private direction = new T.Vector3();
  private normal = new T.Vector3();
  private binormal = new T.Vector3();
  constructor(color: number) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute(
      "position",
      new T.BufferAttribute(new Float32Array((segments + 1) * sides * 3), 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "normal",
      new T.BufferAttribute(new Float32Array((segments + 1) * sides * 3), 3).setUsage(
        T.DynamicDrawUsage,
      ),
    );
    const indices = [];
    for (let i = 0; i < segments; i++)
      for (let j = 0; j < sides; j++) {
        const a = i * sides + j,
          b = i * sides + ((j + 1) % sides);
        indices.push(a, b, a + sides, b, b + sides, a + sides);
      }
    geometry.setIndex(indices);
    super(geometry, new T.MeshStandardMaterial({ color, roughness: 0.52, metalness: 0.08 }));
    this.frustumCulled = false;
  }
  connect(start: T.Vector3, end: T.Vector3) {
    const positions = this.geometry.getAttribute("position"),
      normals = this.geometry.getAttribute("normal");
    const sag = Math.min(0.18, start.distanceTo(end) * 0.12);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      this.point.lerpVectors(start, end, t);
      this.point.y -= Math.sin(t * Math.PI) * sag;
      this.direction.subVectors(end, start);
      this.direction.y -= Math.cos(t * Math.PI) * Math.PI * sag;
      this.direction.normalize();
      this.normal.set(1, 0, 0);
      if (Math.abs(this.direction.x) > 0.9) this.normal.set(0, 0, 1);
      this.binormal.crossVectors(this.direction, this.normal).normalize();
      this.normal.crossVectors(this.binormal, this.direction).normalize();
      for (let j = 0; j < sides; j++) {
        const a = (j / sides) * Math.PI * 2,
          c = Math.cos(a),
          s = Math.sin(a);
        const x = this.normal.x * c + this.binormal.x * s;
        const y = this.normal.y * c + this.binormal.y * s;
        const z = this.normal.z * c + this.binormal.z * s;
        const vertex = i * sides + j;
        positions.setXYZ(
          vertex,
          this.point.x + x * 0.004,
          this.point.y + y * 0.004,
          this.point.z + z * 0.004,
        );
        normals.setXYZ(vertex, x, y, z);
      }
    }
    positions.needsUpdate = normals.needsUpdate = true;
  }
}

/** Authored defuse tools with native hands; not presented as a Valve defuse clip. */
export class BombDefuseModel extends BombPlantModel {
  readonly wires = new T.Group();
  private kit = new T.Group();
  private tools = new T.Group();
  private leads = [new DefuseWire(0xffd329), new DefuseWire(0x268dff)];
  private kitLeads = [new DefuseWire(0x30c96b), new DefuseWire(0x268dff)];
  private sockets = [new T.Vector3(-0.045, -0.025, -0.43), new T.Vector3(0.045, -0.025, -0.43)];
  private start = new T.Vector3();
  private end = new T.Vector3();
  private direction = new T.Vector3();
  private kitMode = false;

  async load(renderer: T.WebGLRenderer) {
    await super.load(renderer);
    // The player works on the world bomb; do not draw a second C4 in their hands.
    this.weapon!.visible = false;
    this.source!.traverse((object) => {
      if (object instanceof T.Mesh) object.visible = false;
    });
    const rubber = new T.MeshStandardMaterial({ color: 0x243329, roughness: 0.86 });
    const metal = new T.MeshStandardMaterial({ color: 0x9da4a7, metalness: 0.8, roughness: 0.27 });
    const panel = new T.Mesh(new RoundedBoxGeometry(0.14, 0.18, 0.03, 3, 0.008), rubber);
    panel.position.set(0, -0.075, -0.47);
    this.kit.add(panel);
    const lcd = document.createElement("canvas");
    lcd.width = 512;
    lcd.height = 160;
    const context = lcd.getContext("2d")!;
    context.fillStyle = "#9aba90";
    context.fillRect(0, 0, 512, 160);
    context.fillStyle = "#25392a";
    context.font = 'bold 30px "Stratum2 Mono"';
    context.fillText("CIRCUIT CHECK", 30, 44);
    context.font = 'bold 55px "Stratum2 Mono"';
    context.fillText("CONNECTED", 28, 115);
    const screen = new T.CanvasTexture(lcd);
    screen.colorSpace = T.SRGBColorSpace;
    const display = new T.Mesh(
      new T.BoxGeometry(0.099, 0.034, 0.004),
      new T.MeshStandardMaterial({
        color: 0x77b18d,
        map: screen,
        emissive: 0x224c30,
        emissiveIntensity: 0.5,
        roughness: 0.5,
      }),
    );
    display.position.set(0, -0.024, -0.452);
    this.kit.add(display);
    for (const x of [-0.057, 0.057])
      for (const y of [-0.15, 0.002]) {
        const screw = new T.Mesh(new T.CylinderGeometry(0.003, 0.003, 0.004, 6), metal);
        screw.rotation.x = Math.PI / 2;
        screw.position.set(x, y, -0.453);
        this.kit.add(screw);
      }
    for (let i = 0; i < 3; i++) {
      const button = new T.Mesh(new T.CylinderGeometry(0.008, 0.008, 0.005, 12), metal);
      button.rotation.x = Math.PI / 2;
      button.position.set((i - 1) * 0.03, -0.083, -0.451);
      this.kit.add(button);
    }
    // Insulated terminals remain visible without a kit; the kit adds the tester.
    for (const socket of this.sockets) {
      const terminal = new T.Mesh(new T.CylinderGeometry(0.006, 0.006, 0.037, 10), metal);
      terminal.position.copy(socket);
      this.tools.add(terminal);
    }
    this.add(this.kit, this.tools);
    this.kit.add(...this.kitLeads);
    this.kit.name = "defuse-tester";
    this.tools.name = "defuse-terminals";
    this.leads.forEach((wire, i) => {
      wire.name = `defuse-wire-${i}`;
    });
    this.wires.add(...this.leads);
    this.wires.name = "defuse-wires";
    this.wires.visible = false;
    this.visible = false;
    registerActorLighting(this);
  }

  sample(progress: number, hasKit = false) {
    // Work within the native keypad interaction instead of replaying planting.
    this.sampleTime(1.9 + Math.sin(T.MathUtils.clamp(progress, 0, 1) * Math.PI * 12) * 0.09);
    if (this.weapon) this.weapon.visible = false;
    this.updateMatrixWorld(true);
    for (let i = 0; i < this.sockets.length; i++) {
      if (hasKit) {
        // Side connectors keep both colored leads visible around the tester.
        this.sockets[i].set(i === 0 ? -0.095 : 0.095, -0.035, -0.43);
        this.start.set(i === 0 ? -0.038 : 0.038, -0.06, -0.445);
        this.kitLeads[i].connect(this.start, this.sockets[i]);
      } else {
        const finger = this.arms?.getObjectByName(`finger_index_2_${i === 0 ? "L" : "R"}`);
        if (!finger) continue;
        finger.getWorldPosition(this.sockets[i]);
        this.worldToLocal(this.sockets[i]);
        this.sockets[i].z += 0.007;
      }
      this.tools.children[i]?.position.copy(this.sockets[i]);
    }
    this.kit.visible = hasKit;
    if (hasKit !== this.kitMode) {
      this.leads[0].material.color.setHex(hasKit ? 0x30c96b : 0xffd329);
      this.kitMode = hasKit;
    }
  }

  /** Match the viewmodel's screen-space sockets to wires ending on the world C4. */
  connect(
    bombPosition: T.Vector3,
    worldCamera: T.PerspectiveCamera,
    viewCamera: T.PerspectiveCamera,
  ) {
    this.wires.visible = this.visible;
    if (!this.visible) return;
    this.updateMatrixWorld(true);
    worldCamera.updateMatrixWorld(true);
    viewCamera.updateMatrixWorld(true);
    for (let i = 0; i < this.leads.length; i++) {
      this.start.copy(this.sockets[i]);
      this.localToWorld(this.start).project(viewCamera);
      this.start.z = 0;
      this.start.unproject(worldCamera);
      this.direction.subVectors(this.start, worldCamera.position).normalize();
      this.start.copy(worldCamera.position).addScaledVector(this.direction, 0.48);
      this.end.copy(bombPosition).add(this.direction.set(i === 0 ? -0.035 : 0.035, 0.085, 0));
      this.leads[i].connect(this.start, this.end);
    }
  }
}
