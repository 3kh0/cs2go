import { expect, test, vi } from "vitest";
import * as T from "three";
import { MapCollision } from "./map-collision";
import { FootstepStride } from "./footsteps";
import { movePlayer } from "./movement";
import { createMatch, createPlayer, joinMatch, respawn, stepMatch, STEP } from "./match";
import { neutralInput } from "@cs2go/protocol";
import { testMap } from "./test-map";

function sample(x: number, audible = true, spawn = 1) {
  return { x, y: -10, z: 0, audible, spawn };
}
test("fixed-step stride alternates feet without banking silent, airborne or teleport travel", () => {
  const stride = new FootstepStride();
  const feet: string[] = [];
  for (let tick = 0; tick < 128; tick++) {
    const foot = stride.advance(sample(tick * 0.05), STEP);
    if (foot) feet.push(foot);
  }
  expect(feet).toEqual(["left", "right", "left"]);
  stride.advance(sample(100), STEP);
  for (let i = 1; i <= 20; i++)
    expect(stride.advance(sample(100 + i * 0.05), STEP)).toBeUndefined();
  stride.advance(sample(101, false), STEP);
  for (let i = 1; i <= 20; i++)
    expect(stride.advance(sample(101 + i * 0.05), STEP)).toBeUndefined();
  expect(stride.advance(sample(102, true, 2), STEP)).toBeUndefined();
  const respawnFeet: string[] = [];
  for (let i = 1; i <= 40; i++) {
    const foot = stride.advance(sample(102 + i * 0.05, true, 2), STEP);
    if (foot) respawnFeet.push(foot);
  }
  expect(respawnFeet).toEqual(["left"]);
});

test("authoritative movement emits bounded source support events per room; quiet inputs and respawn reset", () => {
  const map = testMap();
  const floor = new T.Mesh(new T.PlaneGeometry(300, 300).rotateX(-Math.PI / 2));
  floor.userData.SurfaceProperty = "metalgrate";
  map.collision = new MapCollision([floor]);
  const match = createMatch("casual", map);
  const otherRoom = createMatch("casual", map);
  const player = createPlayer("one", "Runner", "t");
  const ct = createPlayer("two", "Observer", "ct");
  joinMatch(match, player);
  joinMatch(match, ct);
  match.state.phase = "live";
  match.state.remaining = 100;
  const support = vi.spyOn(map.collision, "supportingSurface");
  const run = (quiet: "walk" | "duck" | undefined, ticks = 128) => {
    const events = [];
    for (let tick = 0; tick < ticks; tick++)
      events.push(
        ...stepMatch(
          match,
          new Map([
            [player.id, { ...neutralInput(), forward: 1, ...(quiet ? { [quiet]: true } : {}) }],
          ]),
        ),
      );
    return events.filter((event) => event.kind === "footstep");
  };
  const running = run(undefined);
  expect(running.length).toBeGreaterThan(1);
  expect(running.map((event) => event.side).slice(0, 2)).toEqual(["left", "right"]);
  expect(
    running.every(
      (event) => event.actor === player.id && event.team === "t" && event.surface === "metalgrate",
    ),
  ).toBe(true);
  expect(support).toHaveBeenCalledTimes(running.length);
  expect(run("walk")).toEqual([]);
  expect(run("duck")).toEqual([]);
  expect(otherRoom.footsteps.size).toBe(0);
  respawn(player, match);
  expect(match.footsteps.has(player.id)).toBe(false);
  expect(run(undefined)[0]?.side).toBe("left");
});

test("local fixed-step prediction emits the same running feet at the same positions as authority", () => {
  const match = createMatch("casual", testMap());
  const player = createPlayer("runner", "Runner", "t");
  joinMatch(match, player);
  joinMatch(match, createPlayer("observer", "Observer", "ct"));
  match.state.phase = "live";
  match.state.remaining = 100;
  const predicted = structuredClone(player),
    stride = new FootstepStride();
  const input = { ...neutralInput(), forward: 1 };
  const localSteps: { side: string; x: number; z: number }[] = [];
  const remoteSteps: { side: string; x: number; z: number }[] = [];
  for (let tick = 0; tick < 128; tick++) {
    movePlayer(predicted, input, STEP, match.map);
    const foot = stride.advance(
      {
        ...predicted,
        audible: predicted.grounded && !predicted.ladder?.id && !input.walk && !input.duck,
      },
      STEP,
    );
    if (foot) localSteps.push({ side: foot, x: predicted.x, z: predicted.z });
    for (const event of stepMatch(match, new Map([[player.id, input]])))
      if (event.kind === "footstep" && event.actor === player.id)
        remoteSteps.push({ side: event.side, x: event.point.x, z: event.point.z });
  }
  expect(localSteps.length).toBeGreaterThan(1);
  expect(remoteSteps).toEqual(localSteps);
});
