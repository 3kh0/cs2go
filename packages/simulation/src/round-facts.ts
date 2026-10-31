import native from "./data/round-strings.json";
export type RoundActor = number | "player";
export function roundString(key: keyof typeof native.strings, player = "", count = 0) {
  const entry = native.strings[key];
  const text = typeof entry === "string" ? entry : count === 1 ? entry.one : entry.other;
  return text.replaceAll("{player}", player).replaceAll("{d1}", String(count));
}
export type RoundHighlight = {
  name: string;
  kills: number;
  headshots: number;
  knives: number;
  grenades: number;
};
/** Only facts backed by measured round events can enter the banner. Selection is
 * authored; wording and singular/plural variants come from native localization. */
export function roundFact(input: {
  winner: "ct" | "t";
  reason: string;
  seconds: number;
  enemyCount: number;
  winningDeaths: number;
  players: RoundHighlight[];
  firstKill?: { name: string; seconds: number };
}) {
  const { winner, reason, players } = input;
  const best = [...players].sort((a, b) => b.kills - a.kills)[0];
  if (best && input.enemyCount > 1 && best.kills >= input.enemyCount)
    return roundString("funfact_ace:f", best.name);
  for (const [field, key, minimum] of [
    ["knives", "funfact_knife_kills:f", 2],
    ["grenades", "funfact_kills_grenades:f", 2],
    ["headshots", "funfact_kills_headshots:f", 3],
  ] as const) {
    const actor = [...players].sort((a, b) => b[field] - a[field])[0];
    if (actor && actor[field] >= minimum) return roundString(key, actor.name, actor[field]);
  }
  const seconds = Math.max(1, Math.round(input.seconds));
  if (seconds <= 45) return roundString("funfact_short_round:f", "", seconds);
  if (players.every((p) => p.kills === 0))
    return roundString(winner === "ct" ? "funfact_ct_win_no_kills:f" : "funfact_t_win_no_kills:f");
  if (input.winningDeaths === 0)
    return roundString(
      winner === "ct" ? "funfact_ct_win_no_casualties:f" : "funfact_t_win_no_casualties:f",
    );
  if (best && best.kills >= 3)
    return roundString("funfact_killed_enemies:f", best.name, best.kills);
  if (reason.endsWith("eliminated"))
    return roundString(
      winner === "ct" ? "funfact_ct_win_time:f" : "funfact_ter_win_time:f",
      "",
      seconds,
    );
  if (input.firstKill)
    return roundString(
      "funfact_first_kill:f",
      input.firstKill.name,
      Math.max(1, Math.round(input.firstKill.seconds)),
    );
  return roundString("funfact_killed_enemies:f", best?.name ?? "", best?.kills ?? 0);
}
