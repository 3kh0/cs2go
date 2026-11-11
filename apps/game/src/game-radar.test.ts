import { expect, test, vi } from "vitest";
import * as T from "three";
import type { Team } from "@cs2go/protocol";
import type { Game } from "./game";
import { GameRadar } from "./game-radar";
import { MapCollision } from "./map-collision";
import { segmentNearSphere } from "./utility";

function setup() {
  const wall = new T.Mesh(new T.BoxGeometry(4, 4, 0.4), new T.MeshBasicMaterial());
  wall.name = "wall";
  wall.position.set(0, 1, -5);
  wall.updateMatrixWorld(true);
  const collision = new MapCollision([wall]);
  collision.setMeshEnabled("wall", false);
  const bot = (team: Team, x: number, z: number) => {
    const group = new T.Group();
    group.position.set(x, 0, z);
    return { group, team, health: 100, facing: Math.PI };
  };
  const game = {
    dead: 0,
    teamMode: true,
    team: "ct" as Team,
    mapId: "dust2",
    round: 1,
    mode: "casual",
    position: new T.Vector3(),
    yaw: 0,
    bots: [bot("t", 0, -10)],
    bomb: undefined as
      | { position: T.Vector3; planted: boolean; carrier: number | "player" | null }
      | undefined,
    utility: {
      blind: new Map<number | "player", number>(),
      smoke: false,
      clearSight(from: T.Vector3, to: T.Vector3) {
        return !this.smoke || !segmentNearSphere(from, to, new T.Vector3(0, 1.3, -5), 2);
      },
    },
    visible: (from: T.Vector3, to: T.Vector3) => collision.visible(from, to),
  };
  const radar = new GameRadar();
  return {
    game,
    radar,
    bot,
    collision,
    sample: (now: number) => radar.sample(game as unknown as Game, now),
  };
}
const enemies = (frame: ReturnType<GameRadar["sample"]>) =>
  frame.markers.filter((m) => m.kind === "enemy");

test("CTs learn carried C4 through team sightings without tracking its hidden movement", () => {
  const a = setup();
  a.game.bomb = { position: new T.Vector3(900, 0, 900), planted: false, carrier: 0 };
  a.game.utility.blind.set("player", 2);
  expect(a.sample(0).bomb).toBeUndefined();
  a.game.bots.push(a.bot("ct", 0, 20));
  const seen = a.sample(1);
  expect(seen.bomb).toMatchObject({ state: "carried", carrier: 0, position: { z: -10 } });
  expect(enemies(seen)[0].carryingBomb).toBe(true);
  a.game.utility.blind.set(1, 2);
  a.game.bots[0].group.position.z = -40;
  const lost = a.sample(1.1);
  expect(lost.bomb).toMatchObject({ position: { z: -10 }, uncertain: true });
  expect(a.sample(5).bomb).toBeUndefined();
});

test("seeing the old carrier without C4 clears its badge without revealing the hidden drop", () => {
  const a = setup();
  a.game.bomb = { position: new T.Vector3(900, 0, 900), planted: false, carrier: 0 };
  expect(a.sample(0).bomb?.carrier).toBe(0);
  a.game.bomb.carrier = -1;
  const frame = a.sample(1);
  expect(frame.bomb).toBeUndefined();
  expect(enemies(frame)[0].carryingBomb).toBe(false);
});

test("self and friendly poses update between spotting samples without additional visibility work", () => {
  const a = setup();
  a.game.bots.push(a.bot("ct", 1, 1));
  const visible = vi.fn(a.game.visible);
  a.game.visible = visible;
  a.sample(0);
  const checks = visible.mock.calls.length;
  for (let i = 1; i <= 5; i++) {
    a.game.position.x = i * 0.01;
    a.game.yaw = i * 0.02;
    a.game.bots[1].group.position.z += 0.01;
    const frame = a.sample(i / 100);
    expect(frame.markers.find((m) => m.kind === "self")?.position.x).toBe(a.game.position.x);
    expect(frame.markers.find((m) => m.kind === "self")?.yaw).toBe(a.game.yaw);
    expect(frame.markers.find((m) => m.id === 1)?.position.z).toBe(a.game.bots[1].group.position.z);
  }
  expect(visible.mock.calls.length).toBe(checks);
});

test("moving enemies and carried C4 interpolate authorized observations, then freeze when lost", () => {
  const a = setup();
  a.game.bomb = { position: new T.Vector3(), planted: false, carrier: 0 };
  a.sample(0);
  a.game.bots[0].group.position.z = -10.2;
  expect(enemies(a.sample(0.0625))[0].position.z).toBe(-10);
  const between = a.sample(0.09375);
  expect(enemies(between)[0].position.z).toBeCloseTo(-10.1);
  expect(between.bomb?.position.z).toBeCloseTo(-10.1);
  a.game.bots[0].group.position.z = -40;
  expect(enemies(a.sample(0.11))[0].position.z).toBeGreaterThan(-10.2);
  a.game.utility.blind.set("player", 2);
  const lost = a.sample(0.125);
  expect(enemies(lost)[0].position.z).toBe(-10.2);
  expect(lost.bomb?.position.z).toBe(-10.2);
});

test("spectator preferences reveal opponents only with unrestricted Casual observation", () => {
  const a = setup();
  a.game.dead = 1;
  a.game.yaw = Math.PI;
  Object.assign(a.game, { competitive: true, settings: { radarSpectatorAll: true } });
  expect(enemies(a.sample(0))).toHaveLength(0);
  Object.assign(a.game, { competitive: false });
  expect(enemies(a.sample(1))).toHaveLength(1);
  Object.assign(a.game, { settings: { radarSpectatorAll: false } });
  expect(enemies(a.sample(2))).toHaveLength(0);
});

test("multiplayer ally sightings use replicated view headings rather than unused AI facing", () => {
  const a = setup();
  a.game.utility.blind.set("player", 2);
  const friend = a.bot("ct", 0, 20);
  friend.facing = 0;
  friend.group.rotation.y = Math.PI;
  a.game.bots.push(friend);
  Object.assign(a.game, { network: {} });
  expect(enemies(a.sample(0))).toHaveLength(1);
  friend.group.rotation.y = 0;
  expect(enemies(a.sample(4))).toHaveLength(0);
});

test("actual wall triangles stop sightings and last-known contacts do not track motion behind them", () => {
  const { game, collision, sample } = setup();
  expect(enemies(sample(0))).toHaveLength(1);
  collision.setMeshEnabled("wall", true);
  game.bots[0].group.position.z = -20;
  const hidden = enemies(sample(1))[0];
  expect(hidden.position.z).toBe(-10);
  expect(hidden.uncertain).toBe(true);
  expect(enemies(sample(4))).toHaveLength(0);
  collision.setMeshEnabled("wall", false);
  expect(enemies(sample(5))[0].position.z).toBe(-20);
});

test("crouching uses the actual local eye height rather than spotting over low cover", () => {
  const a = setup();
  const cover = new T.Mesh(new T.BoxGeometry(4, 1.2, 0.4), new T.MeshBasicMaterial());
  cover.position.set(0, 0.6, -5);
  cover.updateMatrixWorld(true);
  const collision = new MapCollision([cover]);
  a.game.visible = (from, to) => collision.visible(from, to);
  Object.assign(a.game, { eye: 1.6 });
  expect(enemies(a.sample(0))).toHaveLength(1);
  Object.assign(a.game, { eye: 1 });
  const crouched = enemies(a.sample(1))[0];
  expect(crouched.uncertain).toBe(true);
  expect(enemies(a.sample(4))).toHaveLength(0);
});

test("a real smoke volume or flash blindness prevents fresh enemy information", () => {
  const a = setup();
  a.game.utility.smoke = true;
  expect(enemies(a.sample(0))).toHaveLength(0);
  a.game.utility.smoke = false;
  a.game.utility.blind.set("player", 2);
  expect(enemies(a.sample(1))).toHaveLength(0);
  a.game.utility.blind.clear();
  expect(enemies(a.sample(2))).toHaveLength(1);
  a.game.utility.smoke = true;
  a.game.bots[0].group.position.z = -30;
  expect(enemies(a.sample(3))[0].position.z).toBe(-10);
  expect(enemies(a.sample(6))).toHaveLength(0);
});

test("alive allies share sightings in team play, but faction alone grants no shared intel in FFA", () => {
  const a = setup();
  a.game.utility.blind.set("player", 2);
  a.game.bots.push(a.bot("ct", 0, 20));
  expect(enemies(a.sample(0)).some((m) => m.id === 0)).toBe(true);
  for (const mode of ["deathmatch", "practice"]) {
    a.game.mode = mode;
    expect(enemies(a.sample(1))).toHaveLength(0);
  }
});

test("view cone prevents rear enemies and dead allies cannot supply sightings", () => {
  const a = setup();
  a.game.yaw = Math.PI;
  expect(enemies(a.sample(0))).toHaveLength(0);
  const friend = a.bot("ct", 0, 20);
  friend.health = 0;
  a.game.bots.push(friend);
  expect(enemies(a.sample(1))).toHaveLength(0);
  a.game.yaw = 0;
  expect(enemies(a.sample(2))).toHaveLength(1);
});

test("round/map/team/mode switches invalidate contacts before the16Hz throttle", () => {
  for (const change of [
    (g: ReturnType<typeof setup>["game"]) => {
      g.round++;
    },
    (g: ReturnType<typeof setup>["game"]) => {
      g.mapId = "mirage";
    },
    (g: ReturnType<typeof setup>["game"]) => {
      g.team = "t";
    },
    (g: ReturnType<typeof setup>["game"]) => {
      g.mode = "deathmatch";
    },
  ]) {
    const a = setup();
    expect(enemies(a.sample(0))).toHaveLength(1);
    a.game.utility.blind.set("player", 2);
    change(a.game);
    expect(enemies(a.sample(0.001))).toHaveLength(0);
  }
});

test("known bomb memory cannot survive a map/round/team knowledge boundary", () => {
  for (const boundary of ["map", "round", "team"]) {
    const a = setup();
    a.game.team = "t";
    a.game.bomb = { position: new T.Vector3(8, 0, -20), planted: false, carrier: -1 };
    expect(a.sample(0).bomb?.position.x).toBe(8);
    a.game.team = "ct";
    a.game.utility.blind.set("player", 2);
    if (boundary === "map") a.game.mapId = "mirage";
    if (boundary === "round") a.game.round++;
    a.game.bomb.position.x = 800;
    expect(a.sample(1).bomb).toBeUndefined();
  }
});

test("interpolation history resets with explicit reset, time rewind and knowledge changes", () => {
  const boundaries = [
    (a: ReturnType<typeof setup>) => a.radar.reset(),
    (a: ReturnType<typeof setup>) => a.game.round++,
    (a: ReturnType<typeof setup>) => (a.game.mapId = "mirage"),
    (a: ReturnType<typeof setup>) => (a.game.mode = "practice"),
    (_a: ReturnType<typeof setup>) => {},
  ];
  for (const [index, boundary] of boundaries.entries()) {
    const a = setup();
    a.sample(0);
    a.game.bots[0].group.position.z = -10.2;
    a.sample(0.0625);
    expect(enemies(a.sample(0.09375))[0].position.z).toBeCloseTo(-10.1);
    boundary(a);
    a.game.bots[0].group.position.z = -10.4;
    const now = index === boundaries.length - 1 ? 0.03 : 0.1;
    expect(enemies(a.sample(now))[0].position.z).toBe(-10.4);
  }
});

test("a reacquired contact does not interpolate from an expired observation", () => {
  const a = setup();
  a.sample(0);
  a.game.utility.blind.set("player", 2);
  expect(enemies(a.sample(4))).toHaveLength(0);
  a.game.utility.blind.clear();
  a.game.bots[0].group.position.z = -10.5;
  expect(enemies(a.sample(4.0625))[0].position.z).toBe(-10.5);
});

test("each spotting sample refreshes viewer directions for multiple enemies", () => {
  const a = setup();
  a.game.bots.push(a.bot("t", 0, 10));
  expect(enemies(a.sample(0)).map((marker) => marker.id)).toEqual([0]);
  a.game.yaw = Math.PI;
  const rotated = enemies(a.sample(0.0625));
  expect(rotated.find((marker) => marker.id === 0)?.uncertain).toBe(true);
  expect(rotated.find((marker) => marker.id === 1)?.uncertain).toBe(false);
  a.game.utility.blind.set("player", 2);
  const blinded = enemies(a.sample(0.125));
  expect(blinded.every((marker) => marker.uncertain)).toBe(true);
});
