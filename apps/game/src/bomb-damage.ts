import { fetchGzipped } from "./gltf";
import { BakedBombDamage } from "@cs2go/simulation/bomb-damage";
export * from "@cs2go/simulation/bomb-damage";
export async function loadBombDamage(): Promise<BakedBombDamage> {
  return new BakedBombDamage(await fetchGzipped("/models/maps/dust2-bomb.bin.gz"));
}
