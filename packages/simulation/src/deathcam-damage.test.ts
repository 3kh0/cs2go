import { expect, test } from "vitest";
import { createMatch, createPlayer, joinMatch } from "./match";
import { damagePlayer } from "./combat";
import { testMap } from "./test-map";

function exchange() {
  const match = createMatch("competitive", testMap());
  const shooter = createPlayer("s", "Shooter", "ct");
  const victim = createPlayer("v", "Victim", "t");
  joinMatch(match, shooter);
  joinMatch(match, victim);
  victim.health = 100;
  victim.armor = 100;
  return { match, shooter, victim };
}

test("authoritative damage reports integer post-armor damage on nonlethal and lethal hits", () => {
  const { match, shooter, victim } = exchange();
  expect(damagePlayer(match, shooter, victim, 57.9, false, 0, 1)).toEqual([
    { kind: "hurt", attacker: "s", victim: "v", damage: 28 },
  ]);
  expect(victim.health).toBe(72);
  victim.health = 10;
  const lethal = damagePlayer(match, shooter, victim, 80, false, 0, 1);
  expect(lethal[0]).toEqual({ kind: "hurt", attacker: "s", victim: "v", damage: 40 });
  expect(lethal[1]).toMatchObject({ kind: "kill", killer: "s", victim: "v" });
  expect(victim.health).toBe(0);
  expect(damagePlayer(match, shooter, victim, 80, false, 0, 1)).toEqual([]);
});

test("self and zero damage do not create a misleading opponent hit", () => {
  const { match, shooter, victim } = exchange();
  expect(damagePlayer(match, shooter, victim, 0, false, 0)).toEqual([]);
  expect(damagePlayer(match, victim, victim, 10, false, 0)).toEqual([]);
});
