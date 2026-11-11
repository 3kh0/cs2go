import { afterEach, expect, test, vi } from "vitest";
import * as T from "three";
import { neutralInput, type PlayerState } from "@cs2go/protocol";
import { createPlayer } from "@cs2go/simulation/match";
import { FootstepStride } from "@cs2go/simulation/footsteps";
import { MultiplayerMatch } from "./multiplayer-match";
import { INTERPOLATION_DELAY_MS, type MatchConnection } from "./multiplayer-connection";

afterEach(() => vi.restoreAllMocks());

function present(beforePlayers: PlayerState[], afterPlayers: PlayerState[], fraction = 0.5) {
  const group = new T.Group();
  group.position.set(-100, -100, -100);
  const bot = { health: 100, group, velocity: new T.Vector2(), rig: {}, anim: 0 };
  const history: MatchConnection["history"] = [beforePlayers, afterPlayers].map((players, i) => ({
    tick: i * 4,
    at: i * 100,
    players,
    playersById: new Map(players.map((player) => [player.id, player])),
  }));
  for (const entry of history)
    vi.spyOn(entry.players, "find").mockImplementation(() => {
      throw new Error("Per-peer snapshot scan");
    });
  const game = {
    utility: { update() {} },
    updateBombSelection() {},
    locked: false,
    yaw: 0,
    viewPitch: 0,
    position: new T.Vector3(),
    velocity: new T.Vector3(),
    ladderState: {},
    selected: 0,
    suppressors: [{}],
    aimPunch: { pitch: 0, yaw: 0, pitchVelocity: 0, yawVelocity: 0 },
    weaponAccuracy: [{ penalty: 0 }],
    weaponRecoil: [{ index: 0 }],
    playerAccuracyPose() {},
    world: {},
    updateAimCamera() {},
    notices: { tick() {} },
  };
  const match = Object.assign(Object.create(MultiplayerMatch.prototype), {
    game,
    request: neutralInput(),
    footstepStride: new FootstepStride(),
    peers: new Map([["peer", bot]]),
    connection: { history, local: createPlayer("local", "Local", "ct"), step: () => false },
  }) as MultiplayerMatch;
  vi.spyOn(performance, "now").mockReturnValue(INTERPOLATION_DELAY_MS + fraction * 100);
  match.simulate(1 / 128);
  return { bot, connection: match.connection };
}

test("remote peers retain exact delayed interpolation despite reordered snapshot players", () => {
  const a = { ...createPlayer("peer", "Peer", "t"), x: 2, y: 4, z: 6, spawn: 1 };
  const b = { ...a, x: 10, y: 16, z: -2 };
  const other = createPlayer("other", "Other", "t");
  const { bot, connection } = present([a, other], [other, b], 0.25);
  expect(bot.group.position.toArray()).toEqual([4, 7, 4]);
  expect(connection.renderTick).toBe(1);
  expect(a).toMatchObject({ x: 2, y: 4, z: 6 });
  expect(b).toMatchObject({ x: 10, y: 16, z: -2 });
});

test("a new spawn snaps to the new position instead of crossing the old life", () => {
  const a = { ...createPlayer("peer", "Peer", "t"), x: 2, y: 4, z: 6, spawn: 1 };
  const b = { ...a, x: 10, y: 16, z: -2, spawn: 2 };
  expect(present([a], [b]).bot.group.position.toArray()).toEqual([10, 16, -2]);
});

test.each([true, false])(
  "missing peer on either side does not reuse another entry (%s)",
  (left) => {
    const peer = createPlayer("peer", "Peer", "t");
    const other = createPlayer("other", "Other", "t");
    const { bot, connection } = present(left ? [peer] : [other], left ? [other] : [peer]);
    expect(bot.group.position.toArray()).toEqual([-100, -100, -100]);
    expect(connection.renderTick).toBeUndefined();
  },
);
