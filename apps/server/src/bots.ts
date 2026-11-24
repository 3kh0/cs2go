// Authoritative server bots for the always-on lobbies. They produce ordinary
// Input frames for stepMatch, so they obey the same movement, weapon, economy
// and objective rules as connected players. Behaviour is deliberately simple:
// NAV-graph routing, line-of-sight perception with reaction time, imperfect
// turning aim and burst fire. It is not a port of Valve's bot behaviour tree.
import * as T from "three";
import { neutralInput, type Input, type PlayerState, type Team } from "@cs2go/protocol";
import { createPlayer, joinMatch, leaveMatch, STEP, type Match } from "@cs2go/simulation/match";
import { mapTriggers } from "@cs2go/simulation/buy-zones";
import { isKnife, movement, weapons } from "@cs2go/simulation/physics";
import { weaponAvailable, weaponPrice } from "@cs2go/simulation/economy";
import type { DustMap, NavAreaData } from "@cs2go/simulation/dust-map";

type Point = [number, number, number];
const NAMES = [
  "Ash",
  "Blaze",
  "Cobalt",
  "Dune",
  "Ember",
  "Flint",
  "Grit",
  "Hawk",
  "Iris",
  "Jinx",
  "Kite",
  "Lynx",
  "Moss",
  "Nova",
  "Onyx",
  "Pike",
  "Quill",
  "Rook",
  "Sage",
  "Talon",
];
const THINK = 1 / 16;
const wrap = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));

/** A* routing over native NAV areas, through the portals shared by neighbours. */
export class BotNavigation {
  private readonly areas: readonly NavAreaData[];
  private readonly index = new Map<number, number>();
  private readonly grid = new Map<string, number[]>();
  readonly sites: readonly Point[];
  constructor(nav: NonNullable<DustMap["nav"]>) {
    this.areas = nav.areas;
    this.sites = nav.sites.map((site) => [site[0], site[1], site[2]] as Point);
    nav.areas.forEach((area, i) => {
      this.index.set(area.id, i);
      const key = this.key(area.center[0], area.center[2]);
      const cell = this.grid.get(key);
      if (cell) cell.push(i);
      else this.grid.set(key, [i]);
    });
  }
  private key(x: number, z: number) {
    return `${Math.floor(x / 4)},${Math.floor(z / 4)}`;
  }
  nearest(x: number, y: number, z: number) {
    let best = -1,
      distance = Infinity;
    const cx = Math.floor(x / 4),
      cz = Math.floor(z / 4);
    for (let radius = 0; radius <= 6 && best < 0; radius++)
      for (let dx = -radius; dx <= radius; dx++)
        for (let dz = -radius; dz <= radius; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          for (const i of this.grid.get(`${cx + dx},${cz + dz}`) ?? []) {
            const c = this.areas[i].center;
            const d = Math.hypot(c[0] - x, (c[1] - y) * 3, c[2] - z);
            if (d < distance) {
              distance = d;
              best = i;
            }
          }
        }
    return best;
  }
  /** Waypoints from `from` to `to`, or an empty list when no route exists. */
  path(from: Point, to: Point): Point[] {
    const start = this.nearest(...from),
      goal = this.nearest(...to);
    if (start < 0 || goal < 0) return [];
    if (start === goal) return [to];
    const cost = new Map<number, number>([[start, 0]]);
    const parent = new Map<number, number>();
    const heap: [number, number][] = [[0, start]];
    const closed = new Set<number>();
    const estimate = (i: number) => {
      const a = this.areas[i].center,
        b = this.areas[goal].center;
      return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    };
    while (heap.length) {
      const [, current] = pop(heap);
      if (current === goal) break;
      if (closed.has(current) || closed.size > 4000) continue;
      closed.add(current);
      const area = this.areas[current];
      for (const link of area.links) {
        const next = this.index.get(link);
        if (next === undefined || closed.has(next)) continue;
        const c = this.areas[next].center;
        const step = Math.hypot(
          c[0] - area.center[0],
          c[1] - area.center[1],
          c[2] - area.center[2],
        );
        const total = cost.get(current)! + step;
        if (total >= (cost.get(next) ?? Infinity)) continue;
        cost.set(next, total);
        parent.set(next, current);
        push(heap, [total + estimate(next), next]);
      }
    }
    if (!parent.has(goal)) return [];
    const chain = [goal];
    while (chain[0] !== start) chain.unshift(parent.get(chain[0])!);
    const points: Point[] = [];
    for (let i = 1; i < chain.length; i++) {
      const previous = this.areas[chain[i - 1]],
        area = this.areas[chain[i]];
      const portal = previous.portals?.[String(area.id)];
      if (portal) points.push([portal[0], portal[1], portal[2]]);
      if (i < chain.length - 1) points.push([...area.center]);
    }
    points.push(to);
    return points;
  }
  /** A random area centre, optionally within `radius` metres of `near`. */
  random(random: () => number, near?: Point, radius = Infinity): Point | undefined {
    for (let attempt = 0; attempt < 24; attempt++) {
      const area = this.areas[Math.floor(random() * this.areas.length)];
      if (!area.links.length || area.flags & 0x10000) continue;
      if (near && Math.hypot(area.center[0] - near[0], area.center[2] - near[2]) > radius) continue;
      return [...area.center];
    }
    return near;
  }
}
function push(heap: [number, number][], item: [number, number]) {
  heap.push(item);
  for (let i = heap.length - 1; i > 0;) {
    const up = (i - 1) >> 1;
    if (heap[up][0] <= heap[i][0]) break;
    [heap[up], heap[i]] = [heap[i], heap[up]];
    i = up;
  }
}
function pop(heap: [number, number][]) {
  const top = heap[0];
  const last = heap.pop()!;
  if (heap.length) {
    heap[0] = last;
    for (let i = 0; ;) {
      const l = i * 2 + 1,
        r = l + 1;
      let m = i;
      if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
      if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
      if (m === i) break;
      [heap[m], heap[i]] = [heap[i], heap[m]];
      i = m;
    }
  }
  return top;
}

type Brain = {
  clock: number;
  skill: number;
  think: number;
  path: Point[];
  goal?: Point;
  holdUntil: number;
  target?: string;
  reactAt: number;
  aimError: [number, number];
  burst: number;
  pause: number;
  pulse: boolean;
  stuck: number;
  last: [number, number];
  jumpAt: number;
  boughtSpawn: number;
  yaw: number;
  pitch: number;
  site: number;
};
export type BotRoster = Map<string, Brain>;

const BUYS: Record<Team, number[][]> = {
  // Preferred primaries, best first, as [weapon, chance]. Price gates each.
  t: [
    [3, 0.15],
    [0, 1],
    [22, 0.3],
    [20, 1],
    [26, 1],
  ],
  ct: [
    [3, 0.15],
    [9, 0.5],
    [1, 1],
    [21, 0.3],
    [19, 1],
    [11, 1],
  ],
};
const DEATHMATCH_GUNS = [0, 9, 1, 3, 19, 20, 21, 22, 27, 30, 23];

/** Keeps a room at `target` total players, removing bots as people join. */
export function balanceBots(
  match: Match,
  bots: BotRoster,
  target: number,
  teamSize: number,
  random: () => number,
) {
  const humans = [...match.players.values()].filter((player) => !player.bot).length;
  const wanted = humans ? Math.max(0, Math.min(target, teamSize * 2) - humans) : 0;
  while (bots.size > wanted) {
    const counts = teamCounts(match);
    const team: Team = counts.ct > counts.t ? "ct" : counts.t > counts.ct ? "t" : "ct";
    if (!removeBot(match, bots, team) && !removeBot(match, bots, team === "ct" ? "t" : "ct")) break;
  }
  while (bots.size < wanted) {
    const counts = teamCounts(match);
    const team: Team = counts.t < counts.ct ? "t" : "ct";
    if (counts[team] >= teamSize) break;
    addBot(match, bots, team, random);
  }
}
function teamCounts(match: Match) {
  const counts = { ct: 0, t: 0 };
  for (const player of match.players.values()) counts[player.team]++;
  return counts;
}
function addBot(match: Match, bots: BotRoster, team: Team, random: () => number) {
  const used = new Set([...match.players.values()].map((player) => player.name));
  const name = `BOT ${NAMES.find((entry) => !used.has(`BOT ${entry}`)) ?? NAMES[bots.size % NAMES.length]}`;
  const player = createPlayer(`bot-${crypto.randomUUID()}`, name, team);
  player.bot = true;
  joinMatch(match, player);
  bots.set(player.id, {
    clock: 0,
    skill: 0.35 + random() * 0.45,
    think: random() * THINK,
    path: [],
    holdUntil: 0,
    reactAt: 0,
    aimError: [0, 0],
    burst: 0,
    pause: 0,
    pulse: false,
    stuck: 0,
    last: [player.x, player.z],
    jumpAt: 0,
    boughtSpawn: -1,
    yaw: player.yaw,
    pitch: 0,
    site: Math.floor(random() * 2),
  });
}
/** Remove one bot from `team`, preferring the dead. Returns false if none. */
export function removeBot(match: Match, bots: BotRoster, team: Team) {
  const candidates = [...bots.keys()]
    .map((id) => match.players.get(id)!)
    .filter((player) => player && player.team === team)
    .sort((a, b) => Number(a.health > 0) - Number(b.health > 0));
  if (!candidates.length) return false;
  leaveMatch(match, candidates[0].id);
  bots.delete(candidates[0].id);
  return true;
}

function enemies(match: Match, bot: PlayerState) {
  const deathmatch = match.state.mode === "deathmatch";
  return [...match.players.values()].filter(
    (other) =>
      other !== bot &&
      other.health > 0 &&
      (deathmatch || other.team !== bot.team) &&
      !other.protection,
  );
}

/** One authoritative input frame for a bot. */
export function botInput(
  match: Match,
  bot: PlayerState,
  brain: Brain,
  nav: BotNavigation | undefined,
  random: () => number,
): Input {
  const input: Input = { ...neutralInput(), yaw: wrap(brain.yaw), pitch: brain.pitch };
  const state = match.state;
  if (bot.health <= 0 || !["freeze", "live", "post", "waiting"].includes(state.phase)) {
    brain.path = [];
    brain.goal = undefined;
    brain.target = undefined;
    return input;
  }
  brain.clock += STEP;
  const deathmatch = state.mode === "deathmatch";
  const eye = new T.Vector3(bot.x, bot.y + bot.eye, bot.z);
  brain.think -= STEP;
  const thinking = brain.think <= 0;
  if (thinking) brain.think += THINK;

  // Buying: once per spawn, before moving (moving ends deathmatch protection).
  if (brain.boughtSpawn !== bot.spawn) {
    if (deathmatch) {
      if (bot.protection && random() < 0.6) {
        const choices = DEATHMATCH_GUNS.filter(
          (id) => weaponAvailable(id, bot.team) && id !== bot.primary,
        );
        input.buy = choices[Math.floor(random() * choices.length)] ?? -1;
      }
      brain.boughtSpawn = bot.spawn;
      return input;
    }
    if (state.buyRemaining > 0 && ["freeze", "live"].includes(state.phase)) {
      if (bot.primary === null) {
        const choice = BUYS[bot.team].find(
          ([id, chance]) => bot.money >= weaponPrice(id) + 200 && random() < chance,
        );
        if (choice) {
          input.buy = choice[0];
          return input;
        }
      } else if (bot.armor < 100 && bot.money >= 1000) {
        input.equipment = "helmet";
      }
      brain.boughtSpawn = bot.spawn;
      brain.site = Math.floor(random() * 2);
      return input;
    }
    brain.boughtSpawn = bot.spawn;
  }
  if (state.phase === "freeze") return input;

  // Perception at 16 Hz with a reaction delay on newly acquired targets.
  if (thinking) {
    let best: PlayerState | undefined,
      distance = Infinity;
    const forward = new T.Vector3(-Math.sin(brain.yaw), 0, -Math.cos(brain.yaw));
    const point = new T.Vector3();
    for (const other of enemies(match, bot)) {
      point.set(other.x, other.y + other.eye - 0.25, other.z);
      const d = eye.distanceTo(point);
      if (d > 60 || d >= distance) continue;
      const flat = new T.Vector3(point.x - eye.x, 0, point.z - eye.z).normalize();
      // Wide view cone; very close enemies are always noticed.
      if (d > 6 && flat.dot(forward) < -0.2 && other.id !== brain.target) continue;
      if (!match.map.collision.visible(eye, point)) continue;
      best = other;
      distance = d;
    }
    if (best?.id !== brain.target) {
      brain.target = best?.id;
      brain.reactAt = brain.clock + 0.18 + (1 - brain.skill) * 0.35 + random() * 0.15;
      brain.burst = 0;
    }
    const spread = 0.012 + (1 - brain.skill) * 0.05;
    brain.aimError = [(random() - 0.5) * spread * 2, (random() - 0.5) * spread * 2];
  }
  const target = brain.target ? match.players.get(brain.target) : undefined;
  const engaged = !!target && target.health > 0;

  // Keep a usable gun in hand.
  const preferred =
    bot.primary !== null && bot.magazines[bot.primary]
      ? bot.primary
      : bot.magazines[bot.secondary]
        ? bot.secondary
        : bot.knife;
  if (bot.weapon !== preferred && !bot.reloadTime) input.select = preferred;

  if (engaged && state.phase !== "waiting") {
    const head = new T.Vector3(target.x, target.y + target.eye - 0.12, target.z);
    const dx = head.x - eye.x,
      dy = head.y - eye.y,
      dz = head.z - eye.z;
    const flat = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz) + brain.aimError[0];
    const pitch = -Math.atan2(dy, flat) + brain.aimError[1];
    const turn = (6 + brain.skill * 8) * STEP;
    const yawDelta = wrap(yaw - brain.yaw);
    brain.yaw = wrap(brain.yaw + Math.max(-turn, Math.min(turn, yawDelta)));
    brain.pitch += Math.max(-turn, Math.min(turn, pitch - brain.pitch));
    input.yaw = brain.yaw;
    input.pitch = Math.max(-1.4, Math.min(1.4, brain.pitch));
    const weapon = weapons[bot.weapon];
    if (weapon.zoomLevels > 0 && flat > 8) input.scope = 1;
    const aligned = Math.abs(yawDelta) < 0.05 + 0.4 / Math.max(1, flat);
    if (brain.clock >= brain.reactAt && aligned && state.phase !== "post") {
      brain.pause = Math.max(0, brain.pause - STEP);
      if (!brain.pause) {
        if (weapon.auto) input.fire = true;
        else input.fire = brain.pulse = !brain.pulse;
        if (
          input.fire &&
          bot.cooldown <= 0 &&
          bot.ammo > 0 &&
          ++brain.burst >= 3 + brain.skill * 5
        ) {
          brain.burst = 0;
          brain.pause = flat > 15 ? 0.35 : 0.15;
        }
      }
    }
    if (flat < 2.5 && isKnife(bot.weapon)) input.forward = 1;
    if (!bot.ammo && bot.reserve > 0) input.reload = true;
    return input;
  }

  if (!bot.reloadTime && bot.ammo < weapons[bot.weapon].mag * 0.35 && bot.reserve > 0)
    input.reload = true;

  // Objectives (bomb modes): plant on site, defuse a planted bomb.
  const bomb = state.bomb;
  const here: Point = [bot.x, bot.y, bot.z];
  let objective: Point | undefined;
  let hold = false;
  if (!deathmatch && state.phase === "live") {
    const site = nav?.sites[brain.site % Math.max(1, nav.sites.length)];
    if (bomb.planted) {
      objective = [bomb.x, bomb.y, bomb.z];
      if (bot.team === "ct" && Math.hypot(bot.x - bomb.x, bot.y - bomb.y, bot.z - bomb.z) < 1.4) {
        input.use = true;
        hold = true;
      }
    } else if (bot.team === "t" && bomb.carrier === bot.id) {
      if (
        mapTriggers(match.map).bombSites.contains(bot, {
          halfWidth: movement.hullRadius,
          height: bot.eye + 0.2,
        })
      ) {
        input.use = true;
        hold = true;
      } else objective = site;
    } else if (bot.team === "t" && !bomb.carrier) objective = [bomb.x, bomb.y, bomb.z];
    else if (site && !brain.goal) objective = nav?.random(random, site, 12) ?? site;
  }
  if (hold) {
    brain.path = [];
    return input;
  }
  if (!nav) return input;

  // Choose a destination, then follow NAV waypoints toward it.
  const reached =
    brain.goal &&
    Math.hypot(brain.goal[0] - bot.x, brain.goal[2] - bot.z) < 1.2 &&
    !brain.path.length;
  if (
    objective &&
    (!brain.goal || Math.hypot(objective[0] - brain.goal[0], objective[2] - brain.goal[2]) > 3)
  )
    brain.goal = undefined;
  if (reached) {
    brain.goal = undefined;
    brain.holdUntil = brain.clock + (deathmatch ? 0.5 : 2 + random() * 4);
  }
  if (!brain.goal && brain.clock >= brain.holdUntil && thinking) {
    let goal = objective;
    if (!goal && deathmatch) {
      const others = enemies(match, bot);
      const hunt =
        others.length && random() < 0.5 ? others[Math.floor(random() * others.length)] : undefined;
      goal = hunt ? [hunt.x, hunt.y, hunt.z] : nav.random(random);
    }
    goal ??= nav.random(random, here, 20);
    if (goal) {
      brain.goal = goal;
      brain.path = nav.path(here, goal);
      brain.stuck = 0;
      if (!brain.path.length) brain.goal = undefined;
    }
  }
  while (brain.path.length && Math.hypot(brain.path[0][0] - bot.x, brain.path[0][2] - bot.z) < 0.55)
    brain.path.shift();
  const next = brain.path[0];
  if (!next) {
    brain.pitch *= 0.9;
    input.pitch = brain.pitch;
    return input;
  }
  const desired = Math.atan2(-(next[0] - bot.x), -(next[2] - bot.z));
  const turn = 9 * STEP;
  brain.yaw = wrap(brain.yaw + Math.max(-turn, Math.min(turn, wrap(desired - brain.yaw))));
  brain.pitch *= 0.9;
  input.yaw = brain.yaw;
  input.pitch = brain.pitch;
  // Move along the route; strafe-free forward motion once roughly facing it.
  input.forward = Math.abs(wrap(desired - brain.yaw)) < 1.2 ? 1 : 0;
  if (next[1] - bot.y > 0.45 && Math.hypot(next[0] - bot.x, next[2] - bot.z) < 1.6)
    input.jump = bot.grounded && brain.clock >= brain.jumpAt;
  // Unstick: jump, then give up on the route.
  if (thinking) {
    const moved = Math.hypot(bot.x - brain.last[0], bot.z - brain.last[1]);
    brain.last = [bot.x, bot.z];
    brain.stuck = moved < 0.05 ? brain.stuck + THINK : 0;
    if (brain.stuck > 0.6 && brain.clock >= brain.jumpAt) {
      input.jump = true;
      brain.jumpAt = brain.clock + 0.8;
    }
    if (brain.stuck > 2) {
      brain.goal = undefined;
      brain.path = [];
      brain.stuck = 0;
    }
  }
  if (input.jump) brain.jumpAt = brain.clock + 0.8;
  return input;
}
