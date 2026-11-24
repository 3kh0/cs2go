// Server bots on a native map: they route over NAV, buy, fight and give up
// seats to people. Seeded for repeatable outcomes.
import assert from "node:assert/strict";
import { loadServerMap } from "../src/map";
import { createMatch, createPlayer, joinMatch, stepMatch } from "@cs2go/simulation/match";
import { BotNavigation, balanceBots, botInput, type BotRoster } from "../src/bots";
import type { Input, MatchMode } from "@cs2go/protocol";

const map = await loadServerMap(undefined, "dust2");
const nav = new BotNavigation(map.nav!);
function run(mode: MatchMode, seconds: number) {
  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const match = createMatch(mode, map);
  const person = createPlayer("person", "Person", "ct");
  joinMatch(match, person);
  const bots: BotRoster = new Map();
  balanceBots(match, bots, 8, 10, random);
  // Past the pistol round: enough money for rifles.
  for (const player of match.players.values()) player.money = 5000;
  let shots = 0,
    kills = 0,
    travel = 0;
  for (let tick = 0; tick < 128 * seconds; tick++) {
    person.health = 0; // Spectate so only bots fight.
    const inputs = new Map<string, Input>();
    for (const [id, brain] of bots)
      inputs.set(id, botInput(match, match.players.get(id)!, brain, nav, random));
    const before = new Map([...bots.keys()].map((id) => [id, { ...match.players.get(id)! }]));
    for (const event of stepMatch(match, inputs)) {
      if (event.kind === "shot" && !event.pellet) shots++;
      if (event.kind === "kill") kills++;
    }
    for (const [id, was] of before) {
      const now = match.players.get(id)!;
      const step = Math.hypot(now.x - was.x, now.z - was.z);
      if (now.health > 0 && step < 1) travel += step;
    }
  }
  return { match, bots, shots, kills, travel: travel / bots.size, random };
}
const deathmatch = run("deathmatch", 45);
assert.equal(deathmatch.bots.size, 7, "bots fill the room around the person");
assert(deathmatch.travel > 40, `bots roam the map (${deathmatch.travel.toFixed(1)} m)`);
assert(deathmatch.shots > 50, "bots engage each other");
assert(deathmatch.kills > 2, "bots eliminate each other");
const casual = run("casual", 40);
assert(casual.travel > 40, "casual bots leave spawn");
assert(
  [...casual.match.players.values()].some((player) => player.bot && player.primary !== null),
  "bots buy primaries",
);
// People displace bots, and an empty room keeps no bots.
const second = createPlayer("second", "Second", "t");
joinMatch(casual.match, second);
balanceBots(casual.match, casual.bots, 8, 10, casual.random);
assert.equal(casual.bots.size, 6);
for (const id of ["person", "second"]) casual.match.players.delete(id);
balanceBots(casual.match, casual.bots, 8, 10, casual.random);
assert.equal(casual.bots.size, 0);
console.log(
  `Server bots passed: deathmatch ${deathmatch.kills} kills / ${deathmatch.shots} shots, casual travel ${casual.travel.toFixed(0)} m`,
);
