import { PerspectiveCamera, Vector3 } from "three";
import { SpatialAudio } from "../src/spatial-audio";
export { Vector3 };

export async function renderProbe(x: number, distance: number, blocked: boolean, yaw = 0) {
  const offline = new OfflineAudioContext(2, 24000, 48000);
  const context = offline as unknown as AudioContext;
  const spatial = new SpatialAudio();
  spatial.obstructed = () => blocked;
  const camera = new PerspectiveCamera();
  camera.rotation.y = yaw;
  camera.updateMatrixWorld();
  const source = offline.createBufferSource();
  const buffer = offline.createBuffer(1, 18000, 48000);
  const signal = buffer.getChannelData(0);
  // A deterministic broadband signal exposes HRTF direction and lowpass filtering.
  let seed = 234567;
  for (let i = 0; i < signal.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    signal[i] = (seed / 4294967296 - 0.5) * 0.2;
  }
  source.buffer = buffer;
  const release = spatial.connect(
    context,
    source,
    offline.destination,
    new Vector3(x, 0, -distance),
  );
  source.onended = release;
  spatial.update(context, camera);
  source.start();
  const rendered = await offline.startRendering();
  const energy = [0, 0];
  for (let channel = 0; channel < 2; channel++) {
    const data = rendered.getChannelData(channel);
    for (let i = 6000; i < 16000; i++) energy[channel] += data[i] ** 2;
  }
  return { energy, voices: spatial.voiceCount };
}

export async function renderEnvironment(room: "outside" | "small" | "large", reset = false) {
  const offline = new OfflineAudioContext(2, 96000, 48000);
  const context = offline as unknown as AudioContext;
  const spatial = new SpatialAudio();
  spatial.obstructed = (from, to) => {
    if (room === "outside") return false;
    if (to.y > from.y) return to.y - from.y >= (room === "small" ? 3 : 8);
    return room === "small";
  };
  const camera = new PerspectiveCamera();
  // Let the real throttled room sampler complete one cycle before the shot.
  for (let i = 1; i <= 6; i++) {
    const at = i * 0.0625;
    const suspended = offline.suspend(at);
    void suspended.then(() => {
      spatial.update(context, camera);
      void offline.resume();
    });
  }
  const source = offline.createBufferSource();
  const signal = offline.createBuffer(1, 480, 48000);
  signal.getChannelData(0)[0] = 1;
  source.buffer = signal;
  source.connect(offline.destination);
  spatial.connectRoom(context, source, offline.destination);
  source.start(0.8);
  if (reset) {
    const suspended = offline.suspend(0.84);
    void suspended.then(() => {
      spatial.resetRooms();
      void offline.resume();
    });
  }
  const rendered = await offline.startRendering();
  let tail = 0,
    late = 0;
  for (let channel = 0; channel < 2; channel++) {
    const data = rendered.getChannelData(channel);
    for (let i = 42000; i < 72000; i++) tail += data[i] ** 2;
    for (let i = 55000; i < 72000; i++) late += data[i] ** 2;
  }
  return { tail, late, room: spatial.roomState, convolvers: spatial.convolverCount };
}

export async function renderCorner(open: boolean) {
  const offline = new OfflineAudioContext(2, 24000, 48000);
  const context = offline as unknown as AudioContext;
  const spatial = new SpatialAudio();
  let traces = 0;
  // A vertical wall at z=-3: the finite version has an exposed right edge.
  spatial.obstructed = (from, to) => {
    traces++;
    if ((from.z + 3) * (to.z + 3) >= 0) return false;
    const fraction = (-3 - from.z) / (to.z - from.z);
    const x = from.x + fraction * (to.x - from.x);
    return !open || x < 1.8;
  };
  const camera = new PerspectiveCamera();
  const source = offline.createBufferSource();
  const signal = offline.createBuffer(1, 18000, 48000);
  for (let i = 0; i < signal.length; i++) signal.getChannelData(0)[i] = Math.sin(i * 0.13) * 0.1;
  source.buffer = signal;
  spatial.connect(context, source, offline.destination, new Vector3(0, 0, -8));
  spatial.update(context, camera);
  source.start();
  const rendered = await offline.startRendering();
  let energy = 0;
  for (let channel = 0; channel < 2; channel++) {
    const data = rendered.getChannelData(channel);
    for (let i = 6000; i < 16000; i++) energy += data[i] ** 2;
  }
  return { energy, traces };
}

export async function auditNativePathing() {
  const { loadGzipped, fetchGzipped } = await import("../src/gltf");
  const { MapCollision } = await import("../src/map-collision");
  const { NativeAcoustics } = await import("../src/room-acoustics");
  const { Mesh } = await import("three");
  const native = new NativeAcoustics(await fetchGzipped("/audio/acoustics/dust2-pathing.bin.gz"));
  const physics = await loadGzipped("/models/maps/dust2-physics.glb.gz");
  const meshes: InstanceType<typeof Mesh>[] = [];
  physics.scene.updateMatrixWorld(true);
  physics.scene.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    let metadata = object as import("three").Object3D;
    while (metadata.parent && !metadata.userData.InteractAs) metadata = metadata.parent;
    const interactions = metadata.userData.InteractAs as string[] | undefined;
    if (
      interactions?.some((flag) =>
        ["csgo_grenadeclip", "sky", "playerclip", "npcclip", "passbullets"].includes(flag),
      )
    )
      return;
    meshes.push(object);
  });
  const collision = new MapCollision(meshes);
  const from = new Vector3(),
    to = new Vector3();
  let upperAgreement = 0,
    lowerAgreement = 0,
    count = 0,
    floorMatches = 0;
  for (let i = 0; i < native.count; i += 7) {
    from.fromArray(native.probes, i * 4);
    if (Math.abs(from.y - collision.floor(from.x, from.z, from.y, from.y - 4) - 1.5) < 0.4)
      floorMatches++;
    for (let j = i + 1; j < native.count; j += 31) {
      to.fromArray(native.probes, j * 4);
      const clear = collision.visible(from, to);
      const upper = native.path(i, j)!.ratio > 0.995;
      const lower = native.ratio[(j * (j - 1)) / 2 + i] / 255 > 0.995;
      if (upper === clear) upperAgreement++;
      if (lower === clear) lowerAgreement++;
      count++;
    }
  }
  return { count, upperAgreement, lowerAgreement, floorMatches, probes: native.count };
}

export async function renderWeaponRange(distance: number, suppressed: boolean, blocked: boolean) {
  const { WeaponAudio } = await import("../src/audio");
  const offline = new OfflineAudioContext(2, 24000, 48000);
  const context = offline as unknown as AudioContext;
  const spatial = new SpatialAudio();
  spatial.obstructed = () => blocked;
  const camera = new PerspectiveCamera();
  camera.updateMatrixWorld();
  spatial.update(context, camera);
  const bank = new WeaponAudio();
  bank.spatial = spatial;
  const clip = offline.createBuffer(1, 12000, 48000);
  const signal = clip.getChannelData(0);
  for (let i = 0; i < signal.length; i++) signal[i] = Math.sin((i * Math.PI) / 12) * 0.3;
  bank.buffers.set("usp1", clip);
  bank.buffers.set("suppressor-2-single", clip);
  bank.play(context, "bot", 2, 100, 0, 0, new Vector3(0, 0, -distance), suppressed);
  const allocated = bank.voices.size;
  const rendered = await offline.startRendering();
  let energy = 0,
    attack = 0;
  for (let c = 0; c < 2; c++) {
    const data = rendered.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      energy += data[i] * data[i];
      if (i < 1500) attack += data[i] * data[i];
    }
  }
  return { energy, attack, allocated };
}

/** Select an actual connected wood-crate collider from the shipped Dust II map. */
export async function auditC4Cover() {
  const { loadGzipped } = await import("../src/gltf");
  const { MapCollision } = await import("../src/map-collision");
  const { Mesh, Box3, Ray } = await import("three");
  const physics = await loadGzipped("/models/maps/dust2-physics.glb.gz");
  physics.scene.updateMatrixWorld(true);
  const meshes: InstanceType<typeof Mesh>[] = [];
  physics.scene.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    let metadata: import("three").Object3D = o;
    while (metadata.parent && !metadata.userData.InteractAs) metadata = metadata.parent;
    const interactions = metadata.userData.InteractAs as string[] | undefined;
    if (
      interactions?.some((flag) =>
        ["csgo_grenadeclip", "sky", "playerclip", "npcclip", "passbullets"].includes(flag),
      )
    )
      return;
    meshes.push(o);
  });
  const collision = new MapCollision(meshes);
  const crates = physics.scene;
  const bounds: InstanceType<typeof Box3>[] = [];
  crates.traverse((o) => {
    if (!(o instanceof Mesh)) return;
    let owner: import("three").Object3D = o;
    while (owner.parent && !owner.userData.SurfaceProperty) owner = owner.parent;
    if (!/^(wood|wood_crate|wood_solid)$/.test(owner.userData.SurfaceProperty ?? "")) return;
    const positions = o.geometry.getAttribute("position"),
      indices = o.geometry.index;
    const parents: number[] = [],
      points: InstanceType<typeof Vector3>[] = [],
      weld = new Map<string, number>(),
      ids: number[] = [];
    const find = (i: number): number => (parents[i] === i ? i : (parents[i] = find(parents[i])));
    for (let i = 0; i < positions.count; i++) {
      const p = new Vector3().fromBufferAttribute(positions, i).applyMatrix4(o.matrixWorld);
      const key = p
        .toArray()
        .map((v) => Math.round(v * 1000))
        .join(",");
      let id = weld.get(key);
      if (id === undefined) {
        id = points.length;
        points.push(p);
        parents.push(id);
        weld.set(key, id);
      }
      ids.push(id);
    }
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      const a = ids[indices ? indices.getX(i) : i];
      for (let j = 1; j < 3; j++)
        parents[find(ids[indices ? indices.getX(i + j) : i + j])] = find(a);
    }
    const components = new Map<number, InstanceType<typeof Box3>>();
    points.forEach((p, i) => {
      const root = find(i);
      const box = components.get(root) ?? new Box3();
      box.expandByPoint(p);
      components.set(root, box);
    });
    bounds.push(...components.values());
  });
  for (const box of bounds) {
    const size = box.getSize(new Vector3());
    if (size.y < 1.1 || size.y > 3.5 || size.x < 0.4 || size.z < 0.4 || size.x > 4 || size.z > 4)
      continue;
    const middle = box.getCenter(new Vector3());
    for (const axis of ["x", "z"] as const) {
      const bomb = middle.clone();
      bomb[axis] = box.min[axis] - 0.65;
      const floor = collision.floor(bomb.x, bomb.z, box.max.y + 0.4, box.min.y - 3);
      if (!Number.isFinite(floor)) continue;
      bomb.y = floor;
      const blocked = middle.clone();
      blocked[axis] = box.max[axis] + 0.65;
      const otherFloor = collision.floor(blocked.x, blocked.z, box.max.y + 0.4, box.min.y - 3);
      if (!Number.isFinite(otherFloor) || Math.abs(otherFloor - floor) > 0.15) continue;
      blocked.y = otherFloor + 1.65;
      const open = blocked.clone();
      open[axis] = bomb[axis] - (blocked[axis] - bomb[axis]);
      open.y = blocked.y;
      const source = bomb.clone();
      source.y += 20 * 0.0254;
      if (!collision.visible(source, open) || collision.visible(source, blocked)) continue;
      const direction = blocked.clone().sub(source),
        distance = direction.length();
      const hits = collision.intersections(new Ray(source, direction.normalize()), distance);
      if (
        !hits.some((hit) => {
          let o = hit.object;
          while (o.parent && !o.userData.SurfaceProperty) o = o.parent;
          return /^(wood|wood_crate|wood_solid)$/.test(o.userData.SurfaceProperty);
        })
      )
        continue;
      return {
        bomb: bomb.toArray(),
        open: open.toArray(),
        blocked: blocked.toArray(),
        crate: [box.min.toArray(), box.max.toArray()],
        clear: true,
        occluded: true,
        rawFloorOccluded: !collision.visible(bomb, open),
        obstructed: (from: InstanceType<typeof Vector3>, to: InstanceType<typeof Vector3>) =>
          !collision.visible(from, to),
      };
    }
  }
  throw new Error("No supported real native wood crate cover fixture found");
}
