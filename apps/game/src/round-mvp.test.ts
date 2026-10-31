import { describe, expect, it } from "vitest";
import { roundMvp } from "./round-mvp";

describe("round MVP presentation", () => {
  const players = [
    { id: "player" as const, name: "YOU", team: "ct" as const, kills: 12 },
    { id: 0, name: "BOT", team: "ct" as const, kills: 8 },
    { id: 1, name: "ENEMY", team: "t" as const, kills: 40 },
  ];
  const before = new Map<number | "player", number>([
    ["player", 12],
    [0, 5],
    [1, 30],
  ]);
  it("credits the actual winning objective actor even without kills", () => {
    expect(roundMvp(players, "ct", "Bomb defused", before, "player")?.id).toBe("player");
    expect(roundMvp(players, "t", "Bomb detonated", before, 1)?.reason).toBe(
      "MVP for planting the bomb",
    );
  });
  it("uses kills from this round and rejects an objective actor from the losing team", () => {
    const mvp = roundMvp(players, "ct", "Bomb defused", before, 1);
    expect(mvp?.id).toBe(0);
    expect(mvp?.reason).toBe("MVP for most eliminations");
  });
  it("does not invent an MVP when no winning actor earned an objective or kill", () => {
    expect(
      roundMvp(players, "ct", "Time expired", new Map(players.map((p) => [p.id, p.kills]))),
    ).toBeUndefined();
  });
});
