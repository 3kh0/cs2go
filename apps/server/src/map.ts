import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { dustCollision, type DustMap } from "@cs2go/simulation/dust-map";
import { BakedBombDamage } from "@cs2go/simulation/bomb-damage";
import { resolve } from "node:path";
export async function loadServerMap(
  directory = process.env.MAP_DIRECTORY ??
    resolve(import.meta.dir, "../../../packages/assets/public/models/maps"),
): Promise<DustMap> {
  const [physics, nav, bomb] = await Promise.all([
    Bun.file(resolve(directory, "dust2-physics.glb.gz")).arrayBuffer(),
    Bun.file(resolve(directory, "dust2-nav.json")).json(),
    Bun.file(resolve(directory, "dust2-bomb.bin.gz")).arrayBuffer(),
  ]);
  const bytes = Bun.gunzipSync(new Uint8Array(physics));
  const model = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  return {
    ...dustCollision(model.scene),
    spawns: nav.spawns,
    spawnAngles: nav.spawnAngles,
    bombDamage: new BakedBombDamage(Bun.gunzipSync(new Uint8Array(bomb)).buffer as ArrayBuffer),
  };
}
