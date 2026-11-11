import { expect, it } from "vitest";
import {
  BotRoundStrategy,
  type BotStrategyRoutes,
  type StrategyUpdate,
  type StrategyPoint,
} from "./bot-strategy";
const p = (x: number, z: number): StrategyPoint => [x, 0, z];
const w = (x: number, z: number) => ({ position: p(x, z), radius: 2, timeout: 15 });
const routes: BotStrategyRoutes = {
  lanes: {
    longA: [w(20, 10), w(30, 20)],
    shortA: [w(5, 10), w(10, 20)],
    tunnelsB: [w(-20, 10), w(-30, 20)],
    midB: [w(0, 10), w(-15, 20)],
  },
  sites: { a: p(40, 40), b: p(-40, 40) },
  anchors: { a: [p(36, 38), p(38, 36)], b: [p(-36, 38), p(-38, 36)] },
  ctRotate: [w(0, 30)],
};
const members = Array.from({ length: 9 }, (_, i) => i);
function strategy(plan: string, team: "t" | "ct" = "t") {
  for (let round = 1; round <= 6; round++) {
    const s = new BotRoundStrategy({ team, round, seed: 0, members, routes, roundTime: 115 });
    if (s.plan === plan) return s;
  }
  throw new Error("Unknown plan");
}
function state(overrides: Partial<StrategyUpdate> = {}): StrategyUpdate {
  return {
    dt: 0.25,
    remaining: 100,
    allies: members.map((index) => ({ index, position: p(0, 0), alive: true })),
    reports: [],
    bomb: { planted: false, position: p(0, 0), carrier: 0 },
    ...overrides,
  };
}
it("chooses all six seeded plays across rounds and preserves split lanes", () => {
  const choices = new Set<string>();
  for (let round = 1; round <= 6; round++) {
    const s = new BotRoundStrategy({ team: "t", round, seed: 54, members, routes, roundTime: 115 });
    choices.add(s.plan);
  }
  expect(choices.size).toBe(6);
  const s = strategy("splitA");
  s.update(state({ dt: 0 }));
  expect(s.order(0)?.lane).toBe("longA");
  expect(s.order(1)?.lane).toBe("shortA");
  expect(s.order(99)).toBeNull();
});
it("carrier follows lane stages and timeout prevents forever waiting", () => {
  const s = strategy("rushB");
  s.update(state({ dt: 0 }));
  expect(s.order(0)?.goal).toEqual(routes.lanes.tunnelsB[0].position);
  for (let i = 0; i < 140; i++) s.update(state());
  expect(s.order(0)?.stage).toBe(2);
  expect(s.order(0)?.goal).toEqual(routes.sites.b);
});
it("rotates once from sustained distinct observations and ignores stale or duplicate reports", () => {
  const fresh = [
    { position: p(38, 38), age: 0 },
    { position: p(44, 38), age: 0 },
  ];
  for (const reports of [fresh.map((r) => ({ ...r, age: 4 })), [fresh[0], fresh[0]]]) {
    const s = strategy("longA");
    for (let i = 0; i < 80; i++) s.update(state({ reports }));
    expect(s.rotations).toBe(0);
  }
  const s = strategy("longA");
  for (let i = 0; i < 80; i++) s.update(state({ reports: fresh }));
  expect(s.site).toBe("b");
  expect(s.rotations).toBe(1);
  expect(s.rotationReason).toBe("resistance");
  for (let i = 0; i < 80; i++)
    s.update(
      state({
        reports: [
          { position: p(-38, 38), age: 0 },
          { position: p(-44, 38), age: 0 },
        ],
      }),
    );
  expect(s.rotations).toBe(1);
});
it("default rotation and low clock commit without unbounded setup", () => {
  const s = strategy("defaultRotate");
  for (let i = 0; i < 90; i++) s.update(state());
  expect(s.site).toBe("b");
  expect(s.rotationReason).toBe("default");
  const clock = strategy("longA");
  for (let i = 0; i < 44; i++) clock.update(state());
  clock.update(
    state({
      remaining: 19,
      allies: members.map((index) => ({ index, position: p(-38, 38), alive: true })),
    }),
  );
  expect(clock.site).toBe("b");
  expect(clock.order(0)?.goal).toEqual(routes.sites.b);
  expect(clock.rotationReason).toBe("clock");
});
it("rotates from current positions without returning to spawn approach checkpoints", () => {
  const nativeRoutes = { ...routes, directRotations: true };
  const choices = Array.from(
    { length: 6 },
    (_, index) =>
      new BotRoundStrategy({
        team: "t",
        round: index + 1,
        seed: 0,
        members,
        routes: nativeRoutes,
        roundTime: 115,
      }),
  );
  const s = choices.find((choice) => choice.plan === "defaultRotate")!;
  s.update(
    state({
      dt: 22.5,
      allies: members.map((index) => ({ index, position: routes.sites.a, alive: true })),
    }),
  );
  expect(s.rotationReason).toBe("default");
  for (const member of members) {
    const order = s.order(member)!;
    expect(order.site).toBe("b");
    expect(order.stage).toBe(routes.lanes[order.lane].length);
    expect([routes.sites.b, ...routes.anchors.b]).toContainEqual(order.goal);
  }
});
it("retains CT anchors and rotates supports only on recent reports, with a cooldown", () => {
  const s = strategy("balanced", "ct");
  const quiet = state({ bomb: { planted: false, position: null, carrier: -1 } });
  for (let i = 0; i < 20; i++) s.update(quiet);
  const before = members.map((i) => s.order(i)?.site);
  const report = (site: "a" | "b") => ({
    ...quiet,
    reports: [{ position: routes.sites[site], age: 0 }],
  });
  for (let i = 0; i < 16; i++) s.update(report("b"));
  expect(s.order(2)?.site).toBe("b");
  for (const i of members)
    if (s.order(i)?.role === "anchor") expect(s.order(i)?.site).toBe(before[i]);
  for (let i = 0; i < 12; i++) s.update(report("a"));
  expect(s.order(2)?.site).toBe("b");
  for (let i = 0; i < 24; i++) s.update(report("a"));
  expect(s.order(2)?.site).toBe("a");
});
it("postplant defenders spread while CT supports finish a bounded retake lane", () => {
  const t = strategy("longA"),
    ct = strategy("balanced", "ct");
  const planted = state({
    bomb: { planted: true, position: routes.sites.b, carrier: -1, site: "b" },
  });
  t.update(planted);
  ct.update(planted);
  expect(new Set(members.map((i) => JSON.stringify(t.order(i)?.goal))).size).toBeGreaterThan(1);
  expect(members.every((i) => t.order(i)?.site === "b")).toBe(true);
  expect(ct.order(0)?.goal).toEqual(routes.ctRotate![0].position);
  for (let i = 0; i < 64; i++) ct.update(planted);
  expect(ct.order(0)?.stage).toBe(1);
  expect(new Set(members.map((i) => JSON.stringify(ct.order(i)?.goal))).size).toBeGreaterThan(1);
  expect(ct.order(0)?.urgent).toBe(true);
});
it("only one living T recovers dropped C4 and resumes its existing lane afterward", () => {
  const s = strategy("longA");
  const dropped = state({ bomb: { planted: false, position: p(-5, 2), carrier: -1 } });
  s.update(dropped);
  expect(
    members.filter((i) => JSON.stringify(s.order(i)?.goal) === JSON.stringify(p(-5, 2))),
  ).toEqual([0]);
  expect(s.site).toBe("a");
  s.update(state());
  expect(s.order(0)?.goal).toEqual(routes.lanes.longA[0].position);
  s.update({ ...dropped, allies: dropped.allies.map((a) => ({ ...a, alive: a.index !== 0 })) });
  expect(s.order(0)).toBeNull();
  expect(s.order(1)?.goal).toEqual(p(-5, 2));
});
it("dropped C4 chooses the nearest assigned living ally and preserves input-order ties", () => {
  const s = strategy("longA");
  const ally = (index: number, x: number, alive = true) => ({
    index,
    position: p(x, 0),
    alive,
  });
  const dropped = state({
    dt: 0,
    bomb: { planted: false, position: p(0, 0), carrier: -1 },
    allies: [ally(-2, 0), ally(0, 0, false), ally(1, 8), ally(5, -3), ally(2, 3)],
  });
  s.update(dropped);
  expect(s.order(-2)).toBeNull();
  expect(s.order(0)).toBeNull();
  expect(s.order(5)?.goal).toEqual(p(0, 0));
  expect(s.order(2)?.goal).not.toEqual(p(0, 0));
  s.update({ ...dropped, allies: [...dropped.allies].reverse() });
  expect(s.order(2)?.goal).toEqual(p(0, 0));
  expect(s.order(5)?.goal).not.toEqual(p(0, 0));
});
it("keeps hold and watch slots for missing and dead CTs across contact and plant rotations", () => {
  const complete = strategy("balanced", "ct"),
    partial = strategy("balanced", "ct");
  const allies = state().allies.map((ally) => ({ ...ally, alive: ally.index >= 5 }));
  const sparse = [allies[8], allies[6], allies[2], allies[7], allies[5]];
  const updates: Partial<StrategyUpdate>[] = [
    { dt: 0 },
    { dt: 4, reports: [{ position: routes.sites.b, age: 0 }] },
    { dt: 2, reports: [{ position: routes.sites.b, age: 0 }] },
    { dt: 8, reports: [{ position: routes.sites.a, age: 0 }] },
    { dt: 2, reports: [{ position: routes.sites.a, age: 0 }] },
    { dt: 0, bomb: { planted: true, position: routes.sites.b, carrier: -1, site: "b" } },
  ];
  for (const [step, update] of updates.entries()) {
    complete.update(state({ ...update, allies }));
    partial.update(state({ ...update, allies: sparse }));
    for (const index of [5, 6, 7, 8]) expect(partial.order(index)).toEqual(complete.order(index));
    expect(partial.order(2)).toBeNull();
    if (step === 0) {
      expect(partial.order(6)?.goal).toEqual(routes.anchors.a[1]);
      expect(partial.order(6)?.watch).toEqual(routes.lanes.shortA.at(-1)?.position);
    } else if (step === 2) {
      expect(partial.rotationReason).toBe("contact");
      expect(partial.order(5)?.site).toBe("b");
      expect(partial.order(5)?.goal).toEqual(routes.anchors.b[1]);
      expect(partial.order(6)?.goal).toEqual(routes.anchors.a[0]);
    } else if (step === 4) {
      expect(partial.order(5)?.site).toBe("a");
      expect(partial.order(5)?.goal).toEqual(routes.anchors.a[1]);
    }
  }
  expect(partial.rotationReason).toBe("plant");
  expect(partial.order(6)?.site).toBe("b");
});
it("preserves a support's original utility ordinal and previously returned orders", () => {
  const s = strategy("longA");
  const ally = { index: 5, position: p(24, 28), alive: true };
  s.update(state({ dt: 15, allies: [ally] }));
  const previous = s.order(5)!;
  expect(previous.utility).toBe("smoke");
  expect(previous.stage).toBe(1);
  s.update(state({ dt: 15, allies: [ally] }));
  expect(s.order(5)?.stage).toBe(2);
  expect(s.order(5)?.utility).toBeNull();
  expect(previous.stage).toBe(1);
  expect(previous.utility).toBe("smoke");
  expect(s.order(5)).not.toBe(previous);
});
it("support uses actual entry utility intent while lurker traverses an alternate lane", () => {
  const s = strategy("longA");
  const initial = state({ dt: 0 });
  s.update(initial);
  expect(s.order(4)?.role).toBe("lurk");
  expect(s.order(4)?.lane).toBe("shortA");
  expect(s.order(0)?.lane).toBe("longA");
  expect(s.order(1)?.utility).toBeNull();
  s.update({
    ...initial,
    dt: 15,
    allies: initial.allies.map((ally) => ({ ...ally, position: p(24, 28) })),
  });
  expect(s.order(1)?.utility).toBe("smoke");
  expect(s.order(1)?.utilityTarget).toEqual(routes.sites.a);
  expect(s.order(0)?.utility).toBeNull();
  s.update({ ...initial, allies: initial.allies.map((a) => ({ ...a, position: p(-100, 0) })) });
  expect(s.order(1)?.utility).toBeNull();
  for (let i = 0; i < 140; i++) s.update(state());
  expect(s.order(4)?.stage).toBe(2);
  expect(routes.anchors.a).toContainEqual(s.order(4)?.goal);
});
it("CT playbooks change distributions and an empty update clears dead orders", () => {
  const a = strategy("heavyA", "ct"),
    b = strategy("heavyB", "ct");
  a.update(state());
  b.update(state());
  expect(members.filter((i) => a.order(i)?.site === "a").length).toBeGreaterThan(6);
  expect(members.filter((i) => b.order(i)?.site === "b").length).toBeGreaterThan(6);
  a.update(state({ allies: [] }));
  expect(a.order(0)).toBeNull();
});
it("retake setup keeps reserves spread instead of piling all CTs on one rotation point", () => {
  const s = strategy("retake", "ct");
  s.update(state({ bomb: { planted: false, position: null, carrier: -1 } }));
  expect(new Set(members.map((i) => JSON.stringify(s.order(i)?.goal))).size).toBeGreaterThan(2);
  expect(
    members.every(
      (i) => JSON.stringify(s.order(i)?.goal) !== JSON.stringify(routes.ctRotate![0].position),
    ),
  ).toBe(true);
});
it("follows one clear friendly human carrier site commitment without a stationary spawn leash", () => {
  const s = strategy("longA");
  const spawn = state({ bomb: { planted: false, position: p(0, 0), carrier: "player" } });
  for (let i = 0; i < 80; i++) s.update(spawn);
  expect(s.site).toBe("a");
  expect(s.rotations).toBe(0);
  s.update({ ...spawn, bomb: { planted: false, position: p(-34, 36), carrier: "player" } });
  expect(s.site).toBe("b");
  expect(s.rotationReason).toBe("carrier");
  expect(s.rotations).toBe(1);
  expect(members.every((i) => s.order(i)?.site === "b")).toBe(true);
  for (let i = 0; i < 80; i++)
    s.update({ ...spawn, bomb: { planted: false, position: p(40, 40), carrier: "player" } });
  expect(s.site).toBe("b");
  expect(s.rotations).toBe(1);
  const early = strategy("longA");
  early.update(
    state({ dt: 1, bomb: { planted: false, position: routes.sites.b, carrier: "player" } }),
  );
  expect(early.site).toBe("a");
});
it("spreads final T holds while reserving the plant center for the numeric C4 carrier", () => {
  const s = strategy("longA");
  for (let i = 0; i < 140; i++) s.update(state());
  expect(s.order(0)?.goal).toEqual(routes.sites.a);
  expect(
    members
      .slice(1)
      .every((i) => JSON.stringify(s.order(i)?.goal) !== JSON.stringify(routes.sites.a)),
  ).toBe(true);
  expect(
    new Set(members.slice(1).map((i) => JSON.stringify(s.order(i)?.goal))).size,
  ).toBeGreaterThan(1);
  expect(s.order(1)?.watch).toBeDefined();
  expect(s.order(1)?.watch).not.toEqual(s.order(2)?.watch);
  const human = strategy("longA");
  for (let i = 0; i < 140; i++)
    human.update(
      state({ remaining: 19, bomb: { planted: false, position: p(0, 0), carrier: "player" } }),
    );
  expect(new Set(members.map((i) => JSON.stringify(human.order(i)?.goal))).size).toBeGreaterThan(1);
  expect(
    members.every(
      (i) => JSON.stringify(human.order(i)?.goal) !== JSON.stringify(routes.sites[human.site]),
    ),
  ).toBe(true);
});
