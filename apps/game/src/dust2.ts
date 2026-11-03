import { assetFetch, assetUrl } from "./asset-url";
import { WorldBall } from "./world-ball";
import { applySourceMapLighting, loadSourceMapLighting } from "./source-map-lighting";
import { loadBombDamage } from "./bomb-damage";
import { loadSourceSky } from "./source-sky";
import { addSourceDynamicSun } from "./source-sun";
import * as T from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { loadGzipped } from "./gltf";
import { dustCollision } from "@cs2go/simulation/dust-map";
import { Navigation } from "./navigation";
import type { MapNavigation } from "./navigation";
import type { Wall } from "./physics";
export async function loadDust2(scene: T.Scene, renderer: T.WebGLRenderer) {
  const [asset, response, physics, sky, bombDamage, lighting, skybox, cables] = await Promise.all([
    loadGzipped("/models/maps/dust2.glb.gz", 1),
    assetFetch("/models/maps/dust2-nav.json"),
    loadGzipped("/models/maps/dust2-physics.glb.gz", 1),
    new HDRLoader().loadAsync(assetUrl("/models/maps/dust2-sky.hdr")),
    loadBombDamage(),
    loadSourceMapLighting(renderer),
    loadSourceSky(renderer),
    loadGzipped("/models/maps/dust2-cables.glb.gz", 1),
  ]);
  // Native particle ropes are absent from the world export. Their settled tubes are baked offline and share static map lighting; native static_collision=false!
  asset.scene.add(cables.scene);
  sky.mapping = T.EquirectangularReflectionMapping;
  if (!response.ok) throw new Error("Dust II navigation could not load");
  const navigation = new Navigation((await response.json()) as MapNavigation);
  const root = new T.Group();
  root.name = "Dust II - CS2";
  root.add(asset.scene);
  if (skybox) root.add(skybox);
  asset.scene.updateMatrixWorld(true);
  asset.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const material = (
      Array.isArray(object.material) ? object.material[0] : object.material
    ) as T.MeshStandardMaterial;
    const name = material.name.toLowerCase();
    if (/wrongway|timer/.test(name)) {
      object.visible = false;
      return;
    }
    object.userData.bulletMaterial = /wood|crate|door|basket/.test(name)
      ? "wood"
      : /metal|car|iron|barrel/.test(name)
        ? "metal"
        : "concrete";
    object.castShadow = object.receiveShadow = true;
    // Preserve the native albedo. The shared scenery grade runs once, after lighting.
    for (const tex of [material.map, material.normalMap]) if (tex) tex.anisotropy = 8;
  });
  applySourceMapLighting(asset.scene, lighting);
  // The imported architecture never moves; skip its per-frame matrix updates.
  asset.scene.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
  const { collision, grenadeCollision } = dustCollision(physics.scene);
  const ball = new WorldBall(root, collision);
  physics.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    object.geometry.dispose();
    for (const material of Array.isArray(object.material) ? object.material : [object.material])
      material.dispose();
  });
  const proxy = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial());
  proxy.raycast = (raycaster, hits) => {
    const far = Math.min(raycaster.far, 250);
    hits.push(
      ...collision
        .intersections(raycaster.ray, far)
        .filter((hit) => hit.distance >= raycaster.near),
    );
  };
  // Compatibility fill for unregistered transient objects. Native map materials
  // and registered actors replace diffuse fill with their baked atlas/probe data.
  const bounce = new T.Color(0x979797).multiplyScalar(1.7);
  root.add(new T.HemisphereLight(0xd3e2f8, bounce, 2.4));
  // CT fixtures 20086/20088 are directlight=1 without baked-shadow indices:
  // their direct light and bounce are already in the native atlases/probes.
  // Source direct diffuse omits Lambert's 1/pi; Three.js includes it.
  const sun = new T.DirectionalLight(0xffdebd, 2.5 * Math.PI);
  sun.target.position.set(0, 0, -30);
  // Source pitch/yaw 50/43 degrees, Z-up inches -> Three.js Y-up meters.
  const pitch = T.MathUtils.degToRad(50),
    yaw = T.MathUtils.degToRad(43);
  sun.position.set(
    -Math.cos(pitch) * Math.cos(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.sin(yaw),
  );
  sun.position.multiplyScalar(100).add(sun.target.position);
  sun.castShadow = true;
  // Imported architecture is static; retain its shadow map between frames.
  sun.shadow.autoUpdate = false;
  sun.shadow.needsUpdate = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -90,
    right: 90,
    top: 90,
    bottom: -90,
    near: 1,
    far: 220,
  });
  sun.shadow.bias = -0.0001;
  sun.shadow.normalBias = 0.025;
  root.add(sun, sun.target);
  // Spend the existing 2048 shadow texels on playable terrain rather than a
  // fixed 180m square. Keep depth broad so off-nav roofs still cast shadows.
  // NAV hulls include tunnels and elevation; padding covers walls around them.
  root.updateMatrixWorld(true);
  sun.shadow.updateMatrices(sun);
  const shadowBounds = new T.Box3();
  const shadowPoint = new T.Vector3();
  for (const area of navigation.areas) {
    for (const corner of area.corners) {
      shadowPoint.fromArray(corner).applyMatrix4(sun.shadow.camera.matrixWorldInverse);
      shadowBounds.expandByPoint(shadowPoint);
      shadowPoint.fromArray(corner);
      shadowPoint.y += 5;
      shadowPoint.applyMatrix4(sun.shadow.camera.matrixWorldInverse);
      shadowBounds.expandByPoint(shadowPoint);
    }
  }
  if (!shadowBounds.isEmpty()) {
    Object.assign(sun.shadow.camera, {
      left: shadowBounds.min.x - 8,
      right: shadowBounds.max.x + 8,
      bottom: shadowBounds.min.y - 8,
      top: shadowBounds.max.y + 8,
    });
    sun.shadow.camera.updateProjectionMatrix();
  }
  addSourceDynamicSun(root, sun, asset.scene);
  root.visible = false;
  scene.add(root);
  return {
    root,
    scenery: asset.scene,
    ball,
    walls: [] as Wall[],
    solids: [proxy],
    collision,
    grenadeCollision,
    navigation,
    sky,
    skybox,
    bombDamage,
  };
}
