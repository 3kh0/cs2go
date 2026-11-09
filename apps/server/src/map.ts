import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { dustCollision, type DustMap } from "@cs2go/simulation/dust-map";
import { BakedBombDamage } from "@cs2go/simulation/bomb-damage";
import { resolve } from "node:path";
import { isMapId, type MapId } from "@cs2go/protocol";
import { mapTriggers } from "@cs2go/simulation/buy-zones";
export async function loadServerMap(
  directory = process.env.MAP_DIRECTORY ??
    resolve(import.meta.dir, "../../../packages/assets/public/models/maps"),
  id: MapId = "dust2",
): Promise<DustMap> {
  if (!isMapId(id)) throw new Error("Unsupported map identifier");
  const bombFile = Bun.file(resolve(directory, `${id}-bomb.bin.gz`));
  const [physics, nav, bomb] = await Promise.all([
    Bun.file(resolve(directory, `${id}-physics.glb.gz`)).arrayBuffer(),
    Bun.file(resolve(directory, `${id}-nav.json`)).json(),
    bombFile.arrayBuffer(),
  ]);
  const bytes = Bun.gunzipSync(new Uint8Array(physics));
  const model = await new GLTFLoader()
    .setMeshoptDecoder(MeshoptDecoder)
    .parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const map: DustMap = {
    id,
    ...dustCollision(model.scene),
    triggers: nav.triggers,
    ladders: nav.ladders,
    worldBallOrigin: nav.worldBallOrigin,
    spawns: nav.spawns,
    spawnAngles: nav.spawnAngles,
    bombDamage: new BakedBombDamage(Bun.gunzipSync(new Uint8Array(bomb)).buffer as ArrayBuffer),
  };
  // Reject absent native objective data at startup rather than admitting peers
  // into a match that accidentally uses Dust II's buy/plant brushes.
  mapTriggers(map);
  if (["ct", "t"].some((team) => !map.spawns[team as "ct" | "t"]?.length))
    throw new Error(`Native spawns are missing for ${id}`);
  return map;
}
