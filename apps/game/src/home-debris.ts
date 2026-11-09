import * as T from "three";
import { homeCurlNoise, homeValueNoise } from "./home-particle-noise";

const unit = 0.0254;
const paperOrigins = [
  [1172, 1052, 24],
  [1256.403076171875, 2077.015380859375, 76],
  [1256.403076171875, 2224, 152],
  [1164, 2708, 236],
];
const sourcePosition = (x: number, y: number, z: number) =>
  new T.Vector3(x * unit, z * unit, -y * unit);
const paperCapacity = 128; // Four native emitters, cap 32 each.
const dustCapacity = 128;
interface Debris {
  position: T.Vector3;
  velocity: T.Vector3;
  age: number;
  life: number;
  radius: number;
  phase: number;
  floor: number;
  emitter: number;
  model: number;
  spin: number;
  color?: T.Color;
  force?: number;
}

/** Authored bounds/forces, reconstructed integration (not the Source particle VM). */
export class HomeDebris {
  private time = 0;
  private accumulator = 0;
  private seed = 0x42d057;
  private papers: Debris[] = [];
  private dust: Debris[] = [];
  private emitters = paperOrigins.map(() => ({ remainder: 0, rate: 0 }));
  private dustRemainder = 0;
  private rateTime = 0;
  private paperMeshes: T.InstancedMesh[][] = [];
  private dustMesh: T.InstancedMesh;
  private dummy = new T.Object3D();
  private ray = new T.Raycaster();
  private dustOpacity = new T.InstancedBufferAttribute(new Float32Array(dustCapacity), 1);
  private dustFrame = new T.InstancedBufferAttribute(new Float32Array(dustCapacity), 1);
  private dustTint = new T.InstancedBufferAttribute(new Float32Array(dustCapacity * 3), 3);
  private dustNormal = new T.Quaternion().setFromUnitVectors(
    new T.Vector3(0, 0, 1),
    new T.Vector3(0, 1, 0.25).normalize(),
  );
  private roll = new T.Quaternion();
  private axis = new T.Vector3(0, 0, 1);
  private curl = new T.Vector3();
  private counts = new Uint16Array(5);
  private background: T.Object3D;
  private floor: number;
  private dustFrames: number;

  constructor(
    models: T.Group[],
    dustMaterial: T.ShaderMaterial,
    paperRoot: T.Group,
    hazeRoot: T.Group,
    background: T.Object3D,
    floor: number,
    dustFrames: number,
  ) {
    this.background = background;
    this.floor = floor;
    this.dustFrames = dustFrames;
    this.counts = new Uint16Array(models.length);
    this.paperMeshes = models.map((model, i) => {
      const meshes: T.InstancedMesh[] = [];
      model.updateMatrixWorld(true);
      model.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        object.geometry.applyMatrix4(object.matrixWorld);
        object.geometry.setAttribute(
          "paperOpacity",
          new T.InstancedBufferAttribute(new Float32Array(paperCapacity).fill(1), 1),
        );
        const mesh = new T.InstancedMesh(object.geometry, object.material, paperCapacity);
        mesh.name = `home-paper-${i}`;
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        mesh.setColorAt(0, new T.Color(1, 1, 1));
        paperRoot.add(mesh);
        meshes.push(mesh);
      });
      return meshes;
    });
    const plane = new T.PlaneGeometry(2, 2);
    plane.setAttribute("color", new T.BufferAttribute(new Float32Array(16).fill(1), 4));
    plane.setAttribute("dustOpacity", this.dustOpacity);
    plane.setAttribute("dustFrame", this.dustFrame);
    plane.setAttribute("dustTint", this.dustTint);
    this.dustMesh = new T.InstancedMesh(plane, dustMaterial, dustCapacity);
    this.dustMesh.name = "home-ground-dust";
    this.dustMesh.frustumCulled = false;
    this.dustMesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    hazeRoot.add(this.dustMesh);
    // Warm a steady ambient scene under the splash rather than filling it in visibly.
    for (let i = 0; i < 15 * 60; i++) this.step(1 / 60);
    this.writeInstances();
  }

  private random() {
    this.seed ^= this.seed << 13;
    this.seed ^= this.seed >>> 17;
    this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  }
  private between(a: number, b: number) {
    return a + (b - a) * this.random();
  }
  private spawnPaper(emitter: number) {
    if (
      this.papers.length >= paperCapacity ||
      this.papers.filter((p) => p.emitter === emitter).length >= 32
    )
      return;
    const origin = paperOrigins[emitter];
    const position = sourcePosition(origin[0], origin[1] + this.between(-256, 256), origin[2]);
    this.ray.set(new T.Vector3(position.x, position.y + 2, position.z), new T.Vector3(0, -1, 0));
    this.ray.far = 12;
    const floor = this.ray.intersectObject(this.background, true)[0]?.point.y ?? this.floor;
    position.y = Math.max(position.y, floor + 0.08);
    this.papers.push({
      position,
      velocity: sourcePosition(this.between(24, 100), this.between(-64, 64), this.between(20, 50)),
      age: 0,
      life: this.between(11, 15),
      radius: this.between(0.01, 1.1),
      phase: this.between(0, Math.PI * 2),
      spin: T.MathUtils.degToRad(this.between(700, 2000)),
      floor,
      emitter,
      model: Math.floor(this.random() * this.paperMeshes.length),
      color: new T.Color().setRGB(
        this.between(210, 255) / 255,
        this.between(207, 255) / 255,
        this.between(207, 255) / 255,
        T.SRGBColorSpace,
      ),
      force: 1 - 0.9 * T.MathUtils.clamp((this.between(0.1, 1) - 0.1) / 0.15, 0, 1),
    });
  }
  private spawnDust() {
    if (this.dust.length >= dustCapacity) return;
    const x = this.between(-60, -300),
      y = this.between(-60, -150);
    const yaw = T.MathUtils.degToRad(285);
    const position = sourcePosition(
      1324.5792236328125 + Math.cos(yaw) * x - Math.sin(yaw) * y,
      825 + Math.sin(yaw) * x + Math.cos(yaw) * y,
      -4 + this.between(1, 2),
    );
    const size = this.random();
    this.dust.push({
      position,
      velocity: new T.Vector3(0, this.between(50, 120) * unit, 0),
      age: 0,
      life: 8 + size * 7,
      radius: (10 + size * 15) * unit,
      phase: this.between(0, Math.PI * 2),
      spin: T.MathUtils.degToRad(15 - size * 10),
      floor: this.floor + 0.04,
      emitter: 0,
      model: Math.floor(this.random() * 4), // Native second sequence range 0–3.
    });
  }
  private step(dt: number) {
    this.time += dt;
    this.rateTime -= dt;
    if (this.rateTime <= 0) {
      this.rateTime += 0.25;
      for (const emitter of this.emitters) emitter.rate = Math.max(0, this.between(-8, 2.5));
    }
    this.emitters.forEach((emitter, i) => {
      emitter.remainder += emitter.rate * dt;
      while (emitter.remainder >= 1) {
        emitter.remainder--;
        this.spawnPaper(i);
      }
    });
    this.dustRemainder +=
      (3 + Math.max(0, -1.5 + 6.5 * homeValueNoise(this.time * 0.5, 0, 0))) * dt;
    while (this.dustRemainder >= 1) {
      this.dustRemainder--;
      this.spawnDust();
    }
    // env_wind: 60 baseline, 80–120 gust range, five-second gust/delay,
    // 20-degree direction variation. Engine wind phase is reconstructed.
    const gust = Math.pow(Math.max(0, Math.sin((this.time * Math.PI) / 5)), 2);
    const wind = (60 + gust * 40) * unit;
    for (let i = this.papers.length - 1; i >= 0; i--) {
      const p = this.papers[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.papers.splice(i, 1);
        continue;
      }
      const noise = this.time + p.phase;
      homeCurlNoise(
        (p.position.x / unit + this.time) * 0.022,
        (-p.position.z / unit + this.time * 2) * 0.021,
        (p.position.y / unit + this.time * 3) * 0.023,
        this.curl,
      );
      const force = p.force! * T.MathUtils.lerp(1, 0.2, Math.min(1, this.time / 10));
      p.velocity.x += (wind - p.velocity.x + (this.curl.x * 150 + 200 * force) * unit) * dt;
      p.velocity.z +=
        (Math.sin(noise * 0.7) * wind * Math.sin(T.MathUtils.degToRad(20)) -
          p.velocity.z -
          this.curl.y * 150 * unit) *
        dt;
      p.velocity.y += (-20 + this.curl.z * 150) * unit * dt;
      p.velocity.clampLength(0, 60 * unit);
      p.position.addScaledVector(p.velocity, dt);
      if (p.position.y < p.floor + 0.025) {
        p.position.y = p.floor + 0.025;
        p.velocity.y = Math.abs(p.velocity.y) * 0.75;
      }
    }
    const yaw = T.MathUtils.degToRad(285);
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const p = this.dust[i];
      p.age += dt;
      if (p.age >= p.life) {
        this.dust.splice(i, 1);
        continue;
      }
      const life = p.age / p.life;
      const strength = 1.35 - 1.1 * life;
      const noise =
        -0.5 +
        0.5 *
          homeValueNoise(
            (p.position.x / unit) * 0.116942 - this.time * 5,
            (-p.position.z / unit) * 0.116942 + this.time * 2,
            (p.position.y / unit) * 0.116942 + this.time,
          );
      const fx = (150 * strength + 80 * noise) * unit;
      const fy = (130 * strength - 350 * noise) * unit;
      p.velocity.x += (Math.cos(yaw) * fx - Math.sin(yaw) * fy) * dt;
      p.velocity.z -= (Math.sin(yaw) * fx + Math.cos(yaw) * fy) * dt;
      p.velocity.y += (-30 + 10 * strength + Math.sin(this.time + p.phase) * 20) * unit * dt;
      p.velocity.multiplyScalar(Math.exp(-0.3 * dt));
      p.position.addScaledVector(p.velocity, dt);
      if (p.position.y < p.floor) {
        p.position.y = p.floor;
        p.velocity.y = 0;
      }
    }
  }

  update(dt: number) {
    this.accumulator += dt;
    while (this.accumulator >= 1 / 60) {
      this.step(1 / 60);
      this.accumulator -= 1 / 60;
    }
    this.writeInstances();
  }
  setVisible(visible: boolean) {
    this.dustMesh.visible = visible;
  }
  private writeInstances() {
    const counts = this.counts;
    counts.fill(0);
    for (const p of this.papers) {
      const fade = T.MathUtils.clamp((p.life - p.age) / (p.life * 0.25), 0, 1);
      this.dummy.position.copy(p.position);
      const spin = p.age * p.spin * (0.15 + p.radius * 0.3);
      this.dummy.rotation.set(spin + p.phase, spin * 0.43, spin * 0.71);
      this.dummy.scale.setScalar(p.radius);
      this.dummy.updateMatrix();
      const index = counts[p.model]++;
      for (const mesh of this.paperMeshes[p.model]) {
        mesh.setMatrixAt(index, this.dummy.matrix);
        mesh.setColorAt(index, p.color!);
        (mesh.geometry.getAttribute("paperOpacity") as T.InstancedBufferAttribute).setX(
          index,
          fade,
        );
      }
    }
    this.paperMeshes.forEach((meshes, i) => {
      for (const mesh of meshes) {
        mesh.count = counts[i];
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor!.needsUpdate = true;
        mesh.geometry.getAttribute("paperOpacity").needsUpdate = true;
      }
    });
    this.dust.forEach((p, i) => {
      const t = p.age / p.life;
      this.dummy.position.copy(p.position);
      this.dummy.quaternion
        .copy(this.dustNormal)
        .multiply(this.roll.setFromAxisAngle(this.axis, p.phase + p.age * p.spin));
      const radiusBias = t / ((1 / 0.75 - 2) * (1 - t) + 1);
      this.dummy.scale.setScalar(p.radius * (1 + 2 * radiusBias));
      this.dummy.updateMatrix();
      this.dustMesh.setMatrixAt(i, this.dummy.matrix);
      const fade = Math.min(1, p.age / 0.5) * Math.min(1, (1 - t) / 0.5);
      this.dustOpacity.setX(i, fade * (1 - ((p.life - 8) / 7) * 0.65));
      const sequenceFrames = this.dustFrames / 4;
      this.dustFrame.setX(i, p.model * sequenceFrames + t * (sequenceFrames - 1));
      this.dustTint.setXYZ(i, 1 - t * 0.54, 1 - t * 0.5, 1 - t * 0.46);
    });
    this.dustMesh.count = this.dust.length;
    this.dustMesh.instanceMatrix.needsUpdate = true;
    this.dustOpacity.needsUpdate = this.dustFrame.needsUpdate = this.dustTint.needsUpdate = true;
  }
  dispose() {
    for (const meshes of this.paperMeshes)
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material])
          material.dispose();
        mesh.removeFromParent();
        mesh.dispose();
      }
    this.dustMesh.dispose();
    // Its geometry/material are disposed by the atmosphere root's owner.
  }
}
