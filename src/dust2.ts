import * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { MapCollision } from "./map-collision";
import { Navigation } from "./navigation";
import type { MapNavigation } from "./navigation";
import type { Wall } from "./physics";
export async function loadDust2(scene: T.Scene) {
  const [asset, response] = await Promise.all([
    new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync("/models/maps/dust2.glb"),
    fetch("/models/maps/dust2-nav.json"),
  ]);
  if (!response.ok) throw new Error("Dust II navigation could not load");
  const navigation = new Navigation((await response.json()) as MapNavigation);
  const root = new T.Group();
  root.name = "Dust II · CS:GO";
  root.add(asset.scene);
  const meshes: T.Mesh[] = [];
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
    for (const tex of [material.map, material.normalMap]) if (tex) tex.anisotropy = 8;
    // Decorative foliage, cables and distant sky surfaces have no player hull.
    if (!/weed|grass|foliage|bush|wire|skybox|sky_dust/.test(name)) meshes.push(object);
  });
  const collision = new MapCollision(meshes);
  const proxy = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial());
  proxy.raycast = (raycaster, hits) => {
    const far = Math.min(raycaster.far, 250);
    hits.push(
      ...collision
        .intersections(raycaster.ray, far)
        .filter((hit) => hit.distance >= raycaster.near),
    );
  };
  root.add(new T.HemisphereLight(0xe5f0ff, 0x786347, 1.8));
  const sun = new T.DirectionalLight(0xffe9c8, 2.5);
  sun.position.set(-40, 90, -10);
  sun.target.position.set(0, 0, -30);
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
  sun.shadow.bias = -0.0003;
  root.add(sun, sun.target);
  root.visible = false;
  scene.add(root);
  return { root, walls: [] as Wall[], solids: [proxy], collision, navigation };
}
