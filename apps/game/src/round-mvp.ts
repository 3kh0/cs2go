import native from "./data/round-strings.json";
type Player = { id: number | "player"; name: string; team: "ct" | "t"; kills: number };
export function roundMvp(
  players: Player[],
  winner: "ct" | "t",
  reason: string,
  startingKills: Map<number | "player", number>,
  objective?: number | "player" | null,
) {
  const eligible = players.filter((player) => player.team === winner);
  if (reason === "Bomb defused" || reason === "Bomb detonated") {
    const player = eligible.find((candidate) => candidate.id === objective);
    if (player)
      return {
        ...player,
        reason: (reason === "Bomb defused"
          ? native.strings.winpanel_mvp_award_bombdefuse
          : native.strings.winpanel_mvp_award_bombplant
        ).replace("MVP: %s1", "MVP"),
      };
  }
  const ranked = eligible
    .map((player) => ({
      ...player,
      roundKills: player.kills - (startingKills.get(player.id) ?? player.kills),
    }))
    .sort((a, b) => b.roundKills - a.roundKills);
  if (!ranked[0] || ranked[0].roundKills <= 0) return undefined;
  const enemies = players.filter((player) => player.team !== winner).length;
  const key =
    enemies > 1 && ranked[0].roundKills >= enemies
      ? "winpanel_mvp_award_ace"
      : "winpanel_mvp_award_kills";
  return { ...ranked[0], reason: native.strings[key].replace("MVP: %s1", "MVP") };
}
