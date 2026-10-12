import * as T from "three";
import { loadGzipped } from "./gltf";
import { MapCollision } from "./map-collision";
import { Navigation } from "./navigation";
import type { MapNavigation } from "./navigation";
import type { Wall } from "./physics";
export async function loadDust2(scene: T.Scene) {
  const [asset, response, physics] = await Promise.all([
    loadGzipped("/models/maps/dust2.glb.gz"),
    fetch("/models/maps/dust2-nav.json"),
    loadGzipped("/models/maps/dust2-physics.glb.gz"),
  ]);
  if (!response.ok) throw new Error("Dust II navigation could not load");
  const navigation = new Navigation((await response.json()) as MapNavigation);
  const root = new T.Group();
  root.name = "Dust II · CS2";
  root.add(asset.scene);
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
  });
  // The imported architecture never moves; skip its per-frame matrix updates.
  asset.scene.traverse((object) => {
    object.matrixAutoUpdate = false;
    object.matrixWorldAutoUpdate = false;
  });
  const meshes: T.Mesh[] = [],
    movementOnly: T.Mesh[] = [];
  // Native Source 2 world physics is independent of simplified render props.
  // Player clips and pass-bullet surfaces block movement but not weapon traces.
  physics.scene.updateMatrixWorld(true);
  physics.scene.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    let metadata: T.Object3D = object;
    while (metadata.parent && !metadata.userData.InteractAs) metadata = metadata.parent;
    const interactions = metadata.userData.InteractAs as string[] | undefined;
    if (interactions?.some((flag) => flag === "csgo_grenadeclip" || flag === "sky")) return;
    const surface = String(metadata.userData.SurfaceProperty || "concrete");
    object.userData.bulletMaterial = /wood/.test(surface)
      ? "wood"
      : /metal|chainlink/.test(surface)
        ? "metal"
        : "concrete";
    if (
      interactions?.some(
        (flag) => flag === "playerclip" || flag === "npcclip" || flag === "passbullets",
      )
    )
      movementOnly.push(object);
    else meshes.push(object);
  });
  if (!meshes.length || !movementOnly.length)
    throw new Error("Dust II native physics could not load");
  const collision = new MapCollision(meshes, movementOnly);
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
