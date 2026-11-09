import { describe, expect, test } from "vitest";
import { DeathDamage } from "./deathcam";

describe("death damage exchange", () => {
  test("isolates damage exchanged with the killer, retaining post-armor overkill", () => {
    const damage = new DeathDamage();
    damage.record("killer", "taken", 28.7);
    damage.record("other", "taken", 20);
    damage.record("killer", "given", 45);
    damage.record("killer", "taken", 89.3);
    expect(damage.exchange("killer")).toEqual({
      taken: { damage: 117, hits: 2 },
      given: { damage: 45, hits: 1 },
    });
    const copy = damage.exchange("killer");
    copy.taken.hits = 99;
    expect(damage.exchange("killer").taken.hits).toBe(2);
  });
  test("a new life clears previous exchanges and invalid hits do not create feedback", () => {
    const damage = new DeathDamage();
    damage.record("killer", "taken", 60);
    damage.reset();
    for (const amount of [0, -20, NaN, Infinity, 0.9]) damage.record("killer", "given", amount);
    expect(damage.exchange("killer")).toEqual({
      taken: { damage: 0, hits: 0 },
      given: { damage: 0, hits: 0 },
    });
  });
});
