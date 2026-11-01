// Persistent inventory IDs: the original 0–36 entries must never move.
// Item definition numbers are Valve's economy IDs, not inventory array indices.
export const knifeDefinitions = [
  { id: 4, item: 500, name: "Bayonet", icon: "bayonet", token: "bayonet" },
  { id: 5, item: 515, name: "Butterfly Knife", icon: "butterfly", token: "knife_butterfly" },
  { id: 6, item: 507, name: "Karambit", icon: "karambit", token: "knife_karambit" },
  { id: 37, item: 42, name: "CT Knife", icon: "knife-ct", token: "knife" },
  { id: 38, item: 59, name: "T Knife", icon: "knife-t", token: "knife_t" },
  { id: 39, item: 503, name: "Classic Knife", icon: "classic", token: "knife_css" },
  { id: 40, item: 505, name: "Flip Knife", icon: "flip", token: "knife_flip" },
  { id: 41, item: 506, name: "Gut Knife", icon: "gut", token: "knife_gut" },
  { id: 42, item: 508, name: "M9 Bayonet", icon: "m9-bayonet", token: "knife_m9_bayonet" },
  { id: 43, item: 509, name: "Huntsman Knife", icon: "huntsman", token: "knife_tactical" },
  { id: 44, item: 512, name: "Falchion Knife", icon: "falchion", token: "knife_falchion" },
  { id: 45, item: 514, name: "Bowie Knife", icon: "bowie", token: "knife_survival_bowie" },
  { id: 46, item: 516, name: "Shadow Daggers", icon: "shadow-daggers", token: "knife_push" },
  { id: 47, item: 517, name: "Paracord Knife", icon: "paracord", token: "knife_cord" },
  { id: 48, item: 518, name: "Survival Knife", icon: "survival", token: "knife_canis" },
  { id: 49, item: 519, name: "Ursus Knife", icon: "ursus", token: "knife_ursus" },
  { id: 50, item: 520, name: "Navaja Knife", icon: "navaja", token: "knife_gypsy_jackknife" },
  { id: 51, item: 521, name: "Nomad Knife", icon: "nomad", token: "knife_outdoor" },
  { id: 52, item: 522, name: "Stiletto Knife", icon: "stiletto", token: "knife_stiletto" },
  { id: 53, item: 523, name: "Talon Knife", icon: "talon", token: "knife_widowmaker" },
  { id: 54, item: 525, name: "Skeleton Knife", icon: "skeleton", token: "knife_skeleton" },
  { id: 55, item: 526, name: "Kukri Knife", icon: "kukri", token: "knife_kukri" },
] as const;
export const WEAPON_COUNT = 56;
const knifeIds = new Set<number>(knifeDefinitions.map((knife) => knife.id));
export function isKnife(index: number) {
  return knifeIds.has(index);
}
