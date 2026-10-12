import * as T from "three";
import type { MapCollision } from "./map-collision";
import type { Navigation } from "./navigation";
import type { Wall } from "./physics";
export function createWorld(scene: T.Scene) {
  const root = new T.Group();
  scene.add(root);
  const walls: Wall[] = [],
    solids: T.Mesh[] = [];
  const geo = new T.BoxGeometry(1, 1, 1);
  const batches = new Map<T.Material, T.Matrix4[]>();
  function texture(color: string, brick: boolean) {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 256, 256);
    let seed = 72;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 18000; i++) {
      ctx.fillStyle = `rgba(${random() > 0.5 ? "255,245,219" : "55,42,25"},${random() * 0.08})`;
      ctx.fillRect(random() * 256, random() * 256, random() * 3 + 1, 1);
    }
    if (brick) {
      ctx.strokeStyle = "#8e80684a";
      ctx.lineWidth = 2;
      for (let y = 0; y < 256; y += 32) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
        for (let x = y % 64 ? 32 : 0; x < 256; x += 64) {
          ctx.strokeRect(x, y, 64, 32);
        }
      }
    }
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.colorSpace = T.SRGBColorSpace;
    return tex;
  }
  const sand = new T.MeshStandardMaterial({ map: texture("#d0b68c", true), roughness: 1 });
  const plaster = new T.MeshStandardMaterial({ map: texture("#ddd0b2", false), roughness: 1 });
  const blue = new T.MeshStandardMaterial({ color: 0x738c91, roughness: 0.9 });
  const wood = new T.MeshStandardMaterial({ map: texture("#8a7149", false), roughness: 1 });
  const metal = new T.MeshStandardMaterial({ color: 0x424d50, roughness: 0.8 });
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: T.Material,
    collide = true,
  ) {
    const m = new T.Mesh(geo, mat);
    m.userData.bulletMaterial = mat === wood ? "wood" : mat === metal ? "metal" : "concrete";
    m.position.set(x, y + h / 2, z);
    m.scale.set(w, h, d);
    m.castShadow = true;
    m.receiveShadow = true;
    m.updateMatrixWorld(true);
    const batch = batches.get(mat) ?? [];
    batch.push(m.matrixWorld.clone());
    batches.set(mat, batch);
    if (collide) {
      walls.push({ x, z, w, d, h: y + h, y });
      solids.push(m);
    }
    return m;
  }
  const floor = box(
    0,
    -0.2,
    0,
    58,
    0.2,
    58,
    new T.MeshStandardMaterial({ map: texture("#b9a17c", false), roughness: 1 }),
    false,
  );
  solids.push(floor);
  box(-22, 0, 0, 2, 7, 46, sand);
  box(22, 0, 0, 2, 7, 46, sand);
  box(0, 0, -22, 46, 7, 2, sand);
  box(0, 0, 22, 46, 7, 2, sand);
  // Three connected lanes, open courtyard, and a covered passage.
  box(-9, 0, -3, 8, 6, 13, plaster);
  box(8, 0, 8, 9, 6, 10, sand);
  box(8, 0, -14, 9, 6, 5, plaster);
  box(-9, 0, 14, 8, 5, 4, sand);
  box(-17, 3, -8, 7, 0.6, 4, sand);
  box(-17, 0, -8, 0.7, 3, 4, sand);
  box(1, 0, -5, 3, 2.5, 3, wood);
  box(-1, 0, 4, 3, 2.5, 3, wood);
  box(15, 0, -3, 3, 2.5, 3, wood);
  box(-15, 0, 6, 3, 2, 3, wood);
  box(1, 2.5, -5, 2.6, 2.2, 2.6, wood);
  box(15, 2.5, -3, 2.6, 2.2, 2.6, wood);
  // Crate reinforcing strips.
  for (const b of [...walls].filter((b) => b.h < 5 && b.w === 3)) {
    for (const offset of [-1.3, 1.3]) {
      box(b.x + offset, 0.05, b.z, 0.12, b.h - 0.1, 3.04, metal, false);
    }
    box(b.x, 0.12, b.z, 3.06, 0.15, 3.06, wood, false);
  }
  for (const b of [...walls].filter((b) => b.h >= 5)) {
    box(b.x, b.h - 0.2, b.z, b.w + 0.2, 0.25, b.d + 0.2, sand, false);
  }
  // Window shutters, doors, pipes and rooftop details.
  for (const x of [-20.95, 20.95])
    for (const z of [-15, -6, 4, 14]) {
      box(x, 3.8, z, 0.12, 1.4, 1.1, blue, false);
      for (let k = 0; k < 6; k++)
        box(x + (x < 0 ? 0.07 : -0.07), 3.9 + k * 0.2, z, 0.03, 0.045, 1.05, metal, false);
    }
  for (const z of [-21, 21])
    for (const x of [-15, -6, 5, 15]) {
      box(x, 3.8, z, 1.3, 1.5, 0.12, blue, false);
      box(x, 3.65, z, 1.6, 0.15, 0.3, sand, false);
    }
  for (const [x, z] of [
    [-4.95, -2],
    [3.45, 9],
    [8, -11.45],
  ]) {
    box(x, 0, z, 0.15, 2.7, 1.5, wood, false);
  }
  for (const [x, z] of [
    [-9, -3],
    [8, 8],
    [8, -14],
  ]) {
    box(x, 6, z, 1, 1, 1, plaster, false);
    box(x + 2, 6, z, 1.3, 0.65, 1.3, metal, false);
  }
  for (const x of [-19, 19])
    for (const z of [-18, 18]) {
      const barrel = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1.3, 12), metal);
      barrel.position.set(x, 0.65, z);
      barrel.castShadow = true;
      root.add(barrel);
    }
  // Distant city silhouette, outside the playable boundary.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2,
      r = 34;
    box(
      Math.cos(a) * r,
      0,
      Math.sin(a) * r,
      5,
      8 + ((i * 7) % 9),
      5,
      i % 3 ? plaster : blue,
      false,
    );
  }
  function sign(
    text: string,
    x: number,
    y: number,
    z: number,
    rotation: number,
    color = "#a63e24",
  ) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = color;
    ctx.font = "bold 135px Arial";
    ctx.textAlign = "center";
    ctx.fillText(text, 256, 176);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const m = new T.Mesh(
      new T.PlaneGeometry(3, 1.5),
      new T.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
      }),
    );
    m.position.set(x, y, z);
    m.rotation.y = rotation;
    root.add(m);
  }
  sign("A →", -4.93, 3, -6, Math.PI / 2);
  sign("← B", 3.43, 3, 6, -Math.PI / 2);
  sign("A", 10, 2, 13.02, 0);
  sign("B", -9, 2, 11.98, Math.PI);
  const ring = new T.Mesh(
    new T.RingGeometry(2.2, 2.28, 40),
    new T.MeshBasicMaterial({ color: 0xae5938, side: T.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(13, 0.015, 16);
  root.add(ring);
  scene.background = new T.Color("#b8d1df");
  scene.fog = new T.Fog("#b8d1df", 30, 90);
  root.add(new T.HemisphereLight(0xe3f1ff, 0x80684a, 2));
  const sun = new T.DirectionalLight(0xffe4bb, 3);
  sun.position.set(-18, 30, 15);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -30,
    right: 30,
    top: 30,
    bottom: -30,
    near: 1,
    far: 80,
  });
  sun.shadow.bias = -0.001;
  root.add(sun);
  // Render static architecture in one draw call per material. Keep the small
  // collision meshes separate for precise hitscan and surface normals.
  for (const [material, matrices] of batches) {
    const instances = new T.InstancedMesh(geo, material, matrices.length);
    matrices.forEach((matrix, index) => instances.setMatrixAt(index, matrix));
    instances.castShadow = true;
    instances.receiveShadow = true;
    instances.computeBoundingSphere();
    root.add(instances);
  }
  // The range never moves; skip its per-frame matrix work.
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    object.matrixAutoUpdate = object.matrixWorldAutoUpdate = false;
  });
  return {
    walls,
    solids,
    root,
    collision: undefined as MapCollision | undefined,
    navigation: undefined as Navigation | undefined,
  };
}
