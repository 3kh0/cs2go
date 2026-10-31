import { expect, test } from "vitest";
import { roundFact, roundString } from "./round-facts";
const player = { name: "Player", kills: 1, headshots: 0, knives: 0, grenades: 0 };
const round = {
  winner: "ct" as const,
  reason: "Terrorists eliminated",
  seconds: 32,
  enemyCount: 5,
  winningDeaths: 2,
  players: [player],
};
test("native short-round strings use actual seconds and the right plural", () => {
  expect(roundFact(round)).toBe("That round took only 32 seconds!");
  expect(roundFact({ ...round, seconds: 1 })).toBe("That round took only 1 second!");
});
test("aces require the entire enemy team and highlights need real recorded events", () => {
  expect(roundFact({ ...round, players: [{ ...player, kills: 5 }] })).toBe(
    "Ace!  Player killed the entire enemy team.",
  );
  expect(roundFact({ ...round, players: [{ ...player, kills: 4 }] })).toBe(
    "That round took only 32 seconds!",
  );
  expect(roundFact({ ...round, players: [{ ...player, kills: 3, headshots: 3 }] })).toBe(
    "Player killed 3 enemies with headshots that round.",
  );
  expect(roundFact({ ...round, players: [{ ...player, kills: 2, knives: 2 }] })).toBe(
    "Player had 2 knife kills this round.",
  );
});
test("long rounds select truthful team or elimination facts instead of saying only", () => {
  expect(roundFact({ ...round, seconds: 100 })).toBe(
    "The CT team eliminated the T team in 100 seconds.",
  );
  expect(
    roundFact({
      ...round,
      seconds: 100,
      reason: "Bomb defused",
      players: [{ ...player, kills: 0 }],
    }),
  ).toBe("Counter-Terrorists won without killing any Terrorists.");
  expect(roundFact({ ...round, seconds: 100, winningDeaths: 0 })).toBe(
    "Counter-Terrorists won without taking any casualties.",
  );
  expect(roundString("funfact_first_kill:f", "Player", 2)).toBe(
    "2 seconds into the round, Player got the first kill.",
  );
});
