import { expect, test } from "vitest";
import { RadarContacts, type RadarPlayer, type RadarSnapshot } from "./radar-state";

const point = (x: number, y = 0) => ({ x, y, z: 0 });
const self: RadarPlayer = { id: "self", team: "ct", alive: true, position: point(0), yaw: 0.5 };
const ally: RadarPlayer = {
  id: "ally",
  team: "ct",
  alive: true,
  position: point(2),
  yaw: 1,
  number: 2,
};
const enemy: RadarPlayer = { id: "enemy", team: "t", alive: true, position: point(5), yaw: 2 };
const frame = (overrides: Partial<RadarSnapshot> = {}): RadarSnapshot => ({
  now: 0,
  round: 1,
  observer: self,
  players: [self, ally, enemy],
  sightings: [],
  ...overrides,
});
const contact = (state: ReturnType<RadarContacts["update"]>, id: string) =>
  state.markers.find((m) => m.id === id);

test("hidden actors never become radar contacts merely because full world snapshots contain them", () => {
  const radar = new RadarContacts();
  const result = radar.update(frame());
  expect(result.markers.map((m) => m.kind)).toEqual(["self", "ally"]);
  expect(contact(result, "ally")?.number).toBe(2);
  expect(
    contact(
      radar.update(frame({ now: 1, players: [self, ally, { ...enemy, position: point(900) }] })),
      "enemy",
    ),
  ).toBeUndefined();
});

test("spotting memory freezes copied position and altitude, fades, and expires without wall tracking", () => {
  const radar = new RadarContacts();
  const observed = point(5, 3);
  expect(
    contact(
      radar.update(frame({ sightings: [{ id: "enemy", position: observed, yaw: 2 }] })),
      "enemy",
    )?.altitude,
  ).toBe(1);
  observed.x = 700;
  observed.y = -300;
  const hidden = contact(
    radar.update(
      frame({ now: 2.5, players: [self, ally, { ...enemy, position: point(900, -10) }] }),
    ),
    "enemy",
  )!;
  expect(hidden.position).toEqual(point(5, 3));
  expect(hidden.altitude).toBe(1);
  expect(hidden.uncertain).toBe(true);
  expect(hidden.opacity).toBeCloseTo(0.5);
  expect(contact(radar.update(frame({ now: 3 })), "enemy")).toBeUndefined();
});

test("fresh sight replaces last known position, but delayed or future reports cannot overwrite it", () => {
  const radar = new RadarContacts();
  radar.update(frame({ now: 2, sightings: [{ id: "enemy", position: point(10), at: 2 }] }));
  const result = radar.update(
    frame({
      now: 2.1,
      sightings: [
        { id: "enemy", position: point(20), at: 1 },
        { id: "enemy", position: point(30), at: 10 },
      ],
    }),
  );
  expect(contact(result, "enemy")?.position.x).toBe(10);
  const fresh = radar.update(
    frame({ now: 2.2, sightings: [{ id: "enemy", position: point(11) }] }),
  );
  expect(contact(fresh, "enemy")?.position.x).toBe(11);
});

test("friendly death markers stay at death location instead of following a moving corpse", () => {
  const radar = new RadarContacts();
  radar.update(frame());
  const dead = { ...ally, alive: false };
  expect(contact(radar.update(frame({ now: 1, players: [self, dead, enemy] })), "ally")?.kind).toBe(
    "death",
  );
  const marker = contact(
    radar.update(frame({ now: 2, players: [self, { ...dead, position: point(20) }, enemy] })),
    "ally",
  )!;
  expect(marker.position.x).toBe(2);
  expect(
    contact(radar.update(frame({ now: 6, players: [self, dead, enemy] })), "ally"),
  ).toBeUndefined();
  expect(contact(radar.update(frame({ now: 7 })), "ally")?.kind).toBe("ally");
});

test("hidden enemy health changes do not expose death coordinates; observed deaths do", () => {
  const radar = new RadarContacts();
  radar.update(frame({ sightings: [{ id: "enemy", position: point(5) }] }));
  const dead = { ...enemy, alive: false, position: point(100) };
  const hidden = contact(radar.update(frame({ now: 1, players: [self, ally, dead] })), "enemy")!;
  expect(hidden.kind).toBe("enemy");
  expect(hidden.position.x).toBe(5);
  const observed = contact(
    radar.update(
      frame({
        now: 1.1,
        players: [self, ally, dead],
        deaths: [{ id: "enemy", position: point(6) }],
      }),
    ),
    "enemy",
  )!;
  expect(observed.kind).toBe("death");
  expect(observed.position.x).toBe(6);
  expect(
    contact(
      radar.update(
        frame({
          now: 6.2,
          players: [self, ally, dead],
          deaths: [{ id: "enemy", position: point(100) }],
        }),
      ),
      "enemy",
    ),
  ).toBeUndefined();
  expect(
    contact(
      radar.update(frame({ now: 6.3, sightings: [{ id: "enemy", position: point(9) }] })),
      "enemy",
    )?.kind,
  ).toBe("enemy");
});

test("local death remains stationary and observing death never implicitly reveals opponents", () => {
  const radar = new RadarContacts();
  const dead = { ...self, alive: false };
  expect(
    contact(radar.update(frame({ observer: dead, players: [dead, ally, enemy] })), "self")?.kind,
  ).toBe("death");
  const next = radar.update(
    frame({
      now: 1,
      observer: { ...dead, position: point(200) },
      players: [{ ...dead, position: point(200) }, ally, enemy],
    }),
  );
  expect(contact(next, "self")?.position.x).toBe(0);
  expect(contact(next, "enemy")).toBeUndefined();
});

test("same-faction opponents in free-for-all require sightings and mode/round/viewpoint changes clear memory", () => {
  const radar = new RadarContacts();
  expect(contact(radar.update(frame({ mode: "ffa" })), "ally")).toBeUndefined();
  radar.update(frame({ mode: "ffa", sightings: [{ id: "ally", position: point(2) }] }));
  expect(contact(radar.update(frame({ now: 1, mode: "ffa" })), "ally")?.kind).toBe("enemy");
  expect(contact(radar.update(frame({ now: 2, round: 2, mode: "ffa" })), "ally")).toBeUndefined();
  radar.update(frame({ now: 3, sightings: [{ id: "enemy", position: point(5) }] }));
  expect(
    contact(radar.update(frame({ now: 4, observer: { ...self, id: "new-self" } })), "enemy"),
  ).toBeUndefined();
  radar.update(frame({ now: 5, sightings: [{ id: "enemy", position: point(5) }] }));
  expect(contact(radar.update(frame({ now: 0 })), "enemy")).toBeUndefined();
});

test("bomb markers require explicitly known information and preserve independent altitude", () => {
  const radar = new RadarContacts();
  expect(radar.update(frame()).bomb).toBeUndefined();
  const position = point(9, -3);
  const result = radar.update(frame({ bomb: { state: "carried", carrier: "ally", position } }));
  expect(result.bomb?.altitude).toBe(-1);
  expect(contact(result, "ally")?.carryingBomb).toBe(true);
  position.x = 400;
  expect(result.bomb?.position.x).toBe(9);
  expect(radar.update(frame({ now: 1 })).bomb).toBeUndefined();
});

test("bounded contacts, disconnect pruning, explicit spectator reveal and reset", () => {
  const radar = new RadarContacts({ maxContacts: 1 });
  const extra = { ...enemy, id: "extra", position: point(9) };
  const result = radar.update(
    frame({
      players: [self, enemy, extra],
      sightings: [
        { id: "enemy", position: point(5) },
        { id: "extra", position: point(9) },
      ],
    }),
  );
  expect(result.markers.filter((m) => m.kind === "enemy")).toHaveLength(1);
  expect(radar.update(frame({ now: 1, players: [self] })).markers).toHaveLength(1);
  expect(contact(radar.update(frame({ now: 2, revealAll: true })), "enemy")?.position.x).toBe(5);
  radar.reset();
  expect(contact(radar.update(frame({ now: 3 })), "enemy")).toBeUndefined();
});
