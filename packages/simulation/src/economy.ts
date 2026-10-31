import stats from "./data/weapon-stats.json";
export type MatchMode = "casual" | "competitive";
export type Team = "ct" | "t";
export type RoundReason = "elimination" | "bomb" | "defuse" | "timeout";
// Valve shipped cfg/gamemode_{casual,competitive}.cfg and DumpSource2/convars.txt
// at the same pinned commit as src/data/weapon-stats.json.
const rules = {
  casual: {
    startMoney: 1000,
    maxMoney: 10000,
    freeArmor: true,
    freeKit: true,
    freezeTime: 5,
    buyTime: 45,
    roundTime: 135,
    roundEndTime: 10,
    teamSize: 10,
    plantReward: 200,
    defuseReward: 200,
    teamKillPenalty: -300,
    startingLossLevel: 0,
    maxRounds: 15,
  },
  competitive: {
    startMoney: 800,
    maxMoney: 16000,
    freeArmor: false,
    freeKit: false,
    freezeTime: 15,
    buyTime: 20,
    roundTime: 115.2,
    roundEndTime: 7,
    teamSize: 5,
    plantReward: 300,
    defuseReward: 300,
    teamKillPenalty: -300,
    startingLossLevel: 1,
    maxRounds: 24,
  },
} as const;
export function rulesFor(mode: MatchMode) {
  return rules[mode];
}
export function weaponPrice(id: number) {
  return stats.weapons[id]?.price ?? Infinity;
}
export function killReward(id: number, mode: MatchMode) {
  return (stats.weapons[id]?.killAward ?? 300) * (mode === "casual" ? 0.5 : 1);
}
export function weaponAvailable(id: number, team: Team) {
  const weapon = stats.weapons[id];
  return !!weapon && (weapon.team === "both" || weapon.team === team);
}
/** Helmet purchase is the assault suit: upgrades a full vest for $350;
 * replenishing damaged armor with a helmet costs $1000, existing helmet $650. */
export function equipmentPrice(kind: "vest" | "helmet" | "kit", armor: number, helmet: boolean) {
  if (kind === "kit") return 400;
  if (kind === "vest") return armor >= 100 ? 0 : 650;
  return helmet ? (armor >= 100 ? 0 : 650) : armor >= 100 ? 350 : 1000;
}
export function addMoney(balance: number, amount: number, mode: MatchMode) {
  return Math.max(0, Math.min(rules[mode].maxMoney, balance + amount));
}
/** Call once after paying this round. Winning reduces accumulated loss level by one. */
export function nextLossLevel(level: number, won: boolean) {
  return Math.max(0, Math.min(4, level + (won ? -1 : 1)));
}
/** lossLevel is the counter entering this round; planted is true only for T.
 * The caller suppresses timeout loss income for a surviving terrorist. */
export function roundReward(
  mode: MatchMode,
  won: boolean,
  reason: RoundReason,
  lossLevel: number,
  planted: boolean,
) {
  if (mode === "casual") return won ? 2700 : 2400 + (planted && reason === "defuse" ? 200 : 0);
  if (won) return reason === "bomb" || reason === "defuse" ? 3500 : 3250;
  return (
    1400 + Math.max(0, Math.min(4, lossLevel)) * 500 + (planted && reason === "defuse" ? 600 : 0)
  );
}
