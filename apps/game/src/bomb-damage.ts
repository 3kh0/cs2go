import type { MapId } from "@cs2go/protocol";
import { fetchGzipped } from "./gltf";
import { BakedBombDamage } from "@cs2go/simulation/bomb-damage";
export * from "@cs2go/simulation/bomb-damage";
export async function loadBombDamage(id: MapId = "dust2"): Promise<BakedBombDamage> {
  return new BakedBombDamage(await fetchGzipped(`/models/maps/${id}-bomb.bin.gz`));
}
