import * as T from "three";
import {
  TICK_RATE,
  neutralInput,
  type Input,
  type MatchEvent,
  type PlayerState,
  type RoundState,
  type MatchMode,
  type Team,
  type Vec3,
} from "@cs2go/protocol";
import { roundFact } from "./round-facts";
import nativeStrings from "./data/round-strings.json";
import { movePlayer } from "./movement";
import { isKnife, movement, reloadMagazine, weaponSlot, weapons } from "./physics";
import {
  rulesFor,
  addMoney,
  equipmentPrice,
  weaponAvailable,
  weaponPrice,
  killReward,
  roundReward,
  nextLossLevel,
} from "./economy";
import { applyArmorDamage, friendlyFireScale } from "./damage";
import { dust2BombSites, dust2BuyZones } from "./buy-zones";
import { groundCorrectedBombSample } from "./bomb-damage";
import type { DustMap } from "./dust-map";
export const STEP = 1 / TICK_RATE;
export type Match = {
  players: Map<string, PlayerState>;
  state: RoundState;
  map: DustMap;
  loss: Record<Team, number>;
  startingKills: Map<string, number>;
  shotsHeld: Set<string>;
  weaponCooldowns: Map<string, Record<number, number>>;
};
export function createMatch(mode: MatchMode, map: DustMap): Match {
  return {
    players: new Map(),
    map,
    loss: { ct: rulesFor(mode).startingLossLevel, t: rulesFor(mode).startingLossLevel },
    startingKills: new Map(),
    shotsHeld: new Set(),
    weaponCooldowns: new Map(),
    state: {
      mode,
      phase: "waiting",
      round: 1,
      scores: { ct: 0, t: 0 },
      remaining: 0,
      buyRemaining: 0,
      pause: 0,
      elapsed: 0,
      result: null,
      bomb: {
        x: 0,
        y: 0,
        z: 0,
        carrier: null,
        planted: false,
        timer: 40,
        plantProgress: 0,
        defuser: null,
        progress: 0,
        planter: null,
      },
    },
  };
}
export function createPlayer(id: string, name: string, team: Team): PlayerState {
  const secondary = team === "t" ? 7 : 2;
  return {
    id,
    name,
    team,
    x: 0,
    y: 0,
    z: 0,
    vx: 0,
    vz: 0,
    vertical: 0,
    eye: movement.standingEye,
    grounded: true,
    yaw: 0,
    pitch: 0,
    health: 100,
    ammo: weapons[secondary].mag,
    reserve: weapons[secondary].reserve,
    cooldown: 0,
    reloadTime: 0,
    respawnTime: 0,
    spawn: 0,
    kills: 0,
    mvps: 0,
    deaths: 0,
    ack: 0,
    weapon: secondary,
    primary: null,
    secondary,
    magazines: {},
    money: 0,
    armor: 0,
    helmet: false,
    kit: false,
    waiting: false,
  };
}
export function respawn(player: PlayerState, match: Match, preserve = false) {
  match.weaponCooldowns.set(player.id, {});
  const points = match.map.spawns[player.team];
  const team = [...match.players.values()].filter((other) => other.team === player.team);
  const slot = Math.max(0, team.indexOf(player)) % points.length;
  const point = points[slot];
  const floor = match.map.collision.floor(point[0], point[2], point[1] + 0.5);
  Object.assign(player, {
    x: point[0],
    y: Number.isFinite(floor) ? floor : point[1],
    z: point[2],
    vx: 0,
    vz: 0,
    vertical: 0,
    eye: movement.standingEye,
    yaw: match.map.spawnAngles?.[player.team][slot] ?? 0,
    pitch: 0,
    grounded: true,
    health: 100,
    cooldown: 0.5,
    reloadTime: 0,
    respawnTime: 0,
    spawn: player.spawn + 1,
    waiting: false,
  });
  if (!preserve) {
    player.primary = null;
    player.secondary = player.team === "t" ? 7 : 2;
    player.weapon = player.secondary;
    player.magazines = Object.fromEntries(
      [player.secondary, 4].map((id) => [
        id,
        { ammo: weapons[id].mag, reserve: weapons[id].reserve },
      ]),
    );
    player.armor = 0;
    player.helmet = player.kit = false;
  }
  const rules = rulesFor(match.state.mode);
  if (rules.freeArmor) {
    player.armor = 100;
    player.helmet = true;
  }
  if (rules.freeKit && player.team === "ct") player.kit = true;
  Object.assign(player, player.magazines[player.weapon]);
}
export function joinMatch(match: Match, player: PlayerState) {
  match.players.set(player.id, player);
  player.money = rulesFor(match.state.mode).startMoney;
  respawn(player, match);
  if (match.state.phase !== "waiting") {
    player.health = 0;
    player.waiting = true;
  }
}
export function leaveMatch(match: Match, id: string) {
  const player = match.players.get(id);
  if (player && match.state.bomb.carrier === id) {
    Object.assign(match.state.bomb, {
      x: player.x,
      y: player.y,
      z: player.z,
      carrier: null,
      plantProgress: 0,
    });
  }
  if (match.state.bomb.defuser === id) {
    match.state.bomb.defuser = null;
    match.state.bomb.progress = 0;
  }
  match.players.delete(id);
  match.shotsHeld.delete(id);
  match.weaponCooldowns.delete(id);
}
export function startRound(match: Match) {
  const state = match.state,
    rules = rulesFor(state.mode);
  if (
    ![...match.players.values()].some((p) => p.team === "ct") ||
    ![...match.players.values()].some((p) => p.team === "t")
  ) {
    Object.assign(state, {
      phase: "waiting",
      remaining: 0,
      pause: 0,
      buyRemaining: 0,
      result: null,
    });
    state.bomb.planted = false;
    return;
  }
  const halftime = state.mode === "competitive" && state.round === 13;
  if (halftime) {
    state.scores = { ct: state.scores.t, t: state.scores.ct };
    match.loss = { ct: rules.startingLossLevel, t: rules.startingLossLevel };
    for (const player of match.players.values()) {
      player.team = player.team === "ct" ? "t" : "ct";
      player.money = rules.startMoney;
    }
  }
  for (const player of match.players.values()) {
    respawn(player, match, state.round > 1 && !halftime && player.health > 0 && !player.waiting);
    match.startingKills.set(player.id, player.kills);
  }
  Object.assign(state, {
    phase: "freeze",
    remaining: rules.freezeTime,
    buyRemaining: rules.freezeTime + rules.buyTime,
    elapsed: 0,
    pause: 0,
    result: null,
  });
  const carrier = [...match.players.values()].find((player) => player.team === "t");
  state.bomb = {
    x: carrier?.x ?? 0,
    y: carrier?.y ?? 0,
    z: carrier?.z ?? 0,
    carrier: carrier?.id ?? null,
    planted: false,
    timer: 40,
    plantProgress: 0,
    defuser: null,
    progress: 0,
    planter: null,
  };
  match.shotsHeld.clear();
}
export function endRound(
  match: Match,
  winner: Team,
  outcome: "elimination" | "bomb" | "defuse" | "timeout",
) {
  const state = match.state;
  if (state.phase !== "live") return;
  const reason = {
    elimination: winner === "ct" ? "Terrorists eliminated" : "Counter-Terrorists eliminated",
    bomb: "Bomb detonated",
    defuse: "Bomb defused",
    timeout: "Time expired",
  }[outcome];
  state.scores[winner]++;
  for (const player of match.players.values()) {
    const payout =
      player.team === "t" && player.health > 0 && outcome === "timeout"
        ? 0
        : roundReward(
            state.mode,
            player.team === winner,
            outcome,
            match.loss[player.team],
            player.team === "t" && state.bomb.planted,
          );
    player.money = addMoney(player.money, payout, state.mode);
  }
  const objective =
    outcome === "defuse" ? state.bomb.defuser : outcome === "bomb" ? state.bomb.planter : null;
  const ranked = [...match.players.values()]
    .filter((player) => player.team === winner)
    .sort(
      (a, b) =>
        b.kills -
        (match.startingKills.get(b.id) ?? b.kills) -
        (a.kills - (match.startingKills.get(a.id) ?? a.kills)),
    );
  const mvp =
    ranked.find((player) => player.id === objective) ??
    ranked.find((player) => player.kills > (match.startingKills.get(player.id) ?? player.kills));
  if (mvp) mvp.mvps++;
  state.result = {
    winner,
    reason,
    mvp: mvp
      ? {
          name: mvp.name,
          reason:
            objective === mvp.id
              ? outcome === "defuse"
                ? nativeStrings.strings.winpanel_mvp_award_bombdefuse.replace("MVP: %s1", "MVP")
                : nativeStrings.strings.winpanel_mvp_award_bombplant.replace("MVP: %s1", "MVP")
              : nativeStrings.strings.winpanel_mvp_award_kills.replace("MVP: %s1", "MVP"),
        }
      : undefined,
  };
  state.result.fact = roundFact({
    winner,
    reason,
    seconds: state.elapsed,
    enemyCount: [...match.players.values()].filter((p) => p.team !== winner).length,
    winningDeaths: [...match.players.values()].filter((p) => p.team === winner && p.health <= 0)
      .length,
    players: ranked.map((p) => ({
      name: p.name,
      kills: Math.max(0, p.kills - (match.startingKills.get(p.id) ?? p.kills)),
      headshots: 0,
      knives: 0,
      grenades: 0,
    })),
  });
  match.loss = {
    ct: nextLossLevel(match.loss.ct, winner === "ct"),
    t: nextLossLevel(match.loss.t, winner === "t"),
  };
  state.pause = rulesFor(state.mode).roundEndTime;
  state.phase =
    state.scores[winner] >= (state.mode === "competitive" ? 13 : 8) ||
    (state.mode === "competitive" && state.round >= 24)
      ? "finished"
      : state.mode === "competitive" && state.round === 12
        ? "halftime"
        : "post";
  state.bomb.defuser = null;
  state.bomb.progress = state.bomb.plantProgress = 0;
}
export function rayBox(origin: Vec3, direction: Vec3, min: Vec3, max: Vec3): number {
  let near = 0,
    far = 250;
  for (const axis of ["x", "y", "z"] as const) {
    if (Math.abs(direction[axis]) < 1e-9) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return Infinity;
    } else {
      const a = (min[axis] - origin[axis]) / direction[axis],
        b = (max[axis] - origin[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return Infinity;
    }
  }
  return near;
}
function shoot(match: Match, shooter: PlayerState): MatchEvent[] {
  const weapon = weapons[shooter.weapon],
    from = new T.Vector3(shooter.x, shooter.y + shooter.eye, shooter.z);
  const direction = new T.Vector3(
    -Math.sin(shooter.yaw) * Math.cos(shooter.pitch),
    -Math.sin(shooter.pitch),
    -Math.cos(shooter.yaw) * Math.cos(shooter.pitch),
  );
  let distance = Math.min(
    isKnife(shooter.weapon) ? 1.8 : 250,
    match.map.collision.intersections(new T.Ray(from, direction), 250)[0]?.distance ?? 250,
  );
  let victim: PlayerState | undefined;
  for (const other of match.players.values()) {
    if (
      other === shooter ||
      other.health <= 0 ||
      (other.team === shooter.team && match.state.mode === "casual")
    )
      continue;
    const r = movement.hullRadius;
    const hit = rayBox(
      from,
      direction,
      { x: other.x - r, y: other.y, z: other.z - r },
      { x: other.x + r, y: other.y + other.eye + 0.2, z: other.z + r },
    );
    if (hit < distance) {
      distance = hit;
      victim = other;
    }
  }
  const to = from.clone().addScaledVector(direction, distance);
  const events: MatchEvent[] = [
    { kind: "shot", shooter: shooter.id, from, to, weapon: shooter.weapon },
  ];
  if (victim) {
    const headshot = to.y > victim.y + victim.eye - 0.15;
    const damage =
      weapon.damage *
      (headshot ? weapon.head : 1) *
      (victim.team === shooter.team ? friendlyFireScale(match.state.mode, "bullet") : 1);
    const hit = applyArmorDamage(
      damage,
      headshot ? "head" : "chest",
      victim.armor,
      victim.helmet,
      weapon.armorRatio,
    );
    victim.armor = hit.armor;
    victim.health = Math.max(0, victim.health - Math.floor(hit.healthDamage));
    if (victim.health === 0) {
      victim.deaths++;
      victim.reloadTime = 0;
      victim.vx = victim.vz = 0;
      shooter.kills += victim.team === shooter.team ? -1 : 1;
      shooter.money = addMoney(
        shooter.money,
        victim.team === shooter.team ? -300 : killReward(shooter.weapon, match.state.mode),
        match.state.mode,
      );
      if (match.state.bomb.carrier === victim.id)
        Object.assign(match.state.bomb, {
          x: victim.x,
          y: victim.y,
          z: victim.z,
          carrier: null,
          plantProgress: 0,
        });
      events.push({
        kind: "kill",
        killer: shooter.id,
        victim: victim.id,
        headshot,
        weapon: shooter.weapon,
      });
    }
  }
  return events;
}
function buy(match: Match, player: PlayerState, input: Input) {
  const state = match.state;
  if (
    player.health <= 0 ||
    state.buyRemaining <= 0 ||
    !["freeze", "live"].includes(state.phase) ||
    !dust2BuyZones.contains(player, player.team, {
      halfWidth: movement.hullRadius,
      height: player.eye + 0.2,
    })
  )
    return;
  const index = input.buy;
  if (
    index >= 0 &&
    !isKnife(index) &&
    weaponAvailable(index, player.team) &&
    !player.magazines[index] &&
    player.money >= weaponPrice(index)
  ) {
    const previous = weaponSlot(index) === 1 ? player.primary : player.secondary;
    if (previous !== null) delete player.magazines[previous];
    if (weaponSlot(index) === 1) player.primary = index;
    else player.secondary = index;
    player.magazines[index] = { ammo: weapons[index].mag, reserve: weapons[index].reserve };
    player.money = addMoney(player.money, -weaponPrice(index), state.mode);
    player.weapon = index;
    player.cooldown = weapons[index].deploy;
    player.reloadTime = 0;
    Object.assign(player, player.magazines[index]);
  }
  if (input.equipment && (input.equipment !== "kit" || player.team === "ct")) {
    const price = equipmentPrice(input.equipment, player.armor, player.helmet);
    if (price > 0 && player.money >= price && !(input.equipment === "kit" && player.kit)) {
      player.money = addMoney(player.money, -price, state.mode);
      if (input.equipment === "kit") player.kit = true;
      else {
        player.armor = 100;
        if (input.equipment === "helmet") player.helmet = true;
      }
    }
  }
}
export function stepMatch(match: Match, inputs: Map<string, Input>): MatchEvent[] {
  const events: MatchEvent[] = [],
    state = match.state,
    rules = rulesFor(state.mode);
  if (state.phase === "waiting") {
    if (
      [...match.players.values()].some((p) => p.team === "ct") &&
      [...match.players.values()].some((p) => p.team === "t")
    )
      startRound(match);
    else
      for (const player of match.players.values())
        movePlayer(
          player,
          inputs.get(player.id) ?? { ...neutralInput(), yaw: player.yaw, pitch: player.pitch },
          STEP,
          match.map,
        );
    return events;
  }
  if (state.phase === "finished") return events;
  if (["post", "halftime"].includes(state.phase)) {
    state.pause = Math.max(0, state.pause - STEP);
    if (state.pause === 0) {
      state.round++;
      startRound(match);
      return events;
    }
  }
  const frozen = state.phase === "freeze" || state.phase === "halftime";
  state.buyRemaining = Math.max(0, state.buyRemaining - STEP);
  if (state.phase === "freeze") {
    state.remaining = Math.max(0, state.remaining - STEP);
    if (state.remaining === 0) {
      state.phase = "live";
      state.remaining = rules.roundTime;
    }
  }
  for (const player of match.players.values()) {
    const input = inputs.get(player.id) ?? {
      ...neutralInput(),
      yaw: player.yaw,
      pitch: player.pitch,
    };
    player.yaw = input.yaw;
    player.pitch = input.pitch;
    if (player.health <= 0) continue;
    const locks = match.weaponCooldowns.get(player.id) ?? {};
    for (const id of Object.keys(locks)) locks[Number(id)] = Math.max(0, locks[Number(id)] - STEP);
    match.weaponCooldowns.set(player.id, locks);
    buy(match, player, input);
    if (input.select >= 0 && player.magazines[input.select] && input.select !== player.weapon) {
      player.magazines[player.weapon] = { ammo: player.ammo, reserve: player.reserve };
      locks[player.weapon] = Math.max(
        locks[player.weapon] ?? 0,
        player.cooldown,
        player.reloadTime,
      );
      player.weapon = input.select;
      Object.assign(player, player.magazines[player.weapon]);
      player.reloadTime = 0;
      player.cooldown = Math.max(weapons[player.weapon].deploy, locks[player.weapon] ?? 0);
    }
    if (!frozen) movePlayer(player, input, STEP, match.map);
    else {
      player.vx = player.vz = player.vertical = 0;
    }
    player.cooldown = Math.max(0, player.cooldown - STEP);
    if (player.reloadTime > 0) {
      player.reloadTime = Math.max(0, player.reloadTime - STEP);
      if (player.reloadTime === 0)
        Object.assign(player, reloadMagazine(player.weapon, player.ammo, player.reserve));
    }
    const weapon = weapons[player.weapon];
    if (
      !frozen &&
      input.reload &&
      !isKnife(player.weapon) &&
      !player.reloadTime &&
      player.ammo < weapon.mag &&
      player.reserve > 0
    )
      player.reloadTime = weapon.reload;
    if (
      !frozen &&
      input.fire &&
      (weapon.auto || !match.shotsHeld.has(player.id)) &&
      player.reloadTime === 0 &&
      player.cooldown === 0 &&
      (player.ammo > 0 || isKnife(player.weapon))
    ) {
      if (!isKnife(player.weapon)) player.ammo--;
      player.cooldown = weapon.delay;
      locks[player.weapon] = weapon.delay;
      events.push(...shoot(match, player));
    }
    if (input.fire) match.shotsHeld.add(player.id);
    else match.shotsHeld.delete(player.id);
    player.magazines[player.weapon] = { ammo: player.ammo, reserve: player.reserve };
  }
  if (state.phase !== "live") return events;
  state.elapsed += STEP;
  state.remaining = Math.max(0, state.remaining - STEP);
  const alive = (team: Team) =>
    [...match.players.values()].filter((player) => player.team === team && player.health > 0);
  const bomb = state.bomb;
  if (!alive("ct").length) {
    endRound(match, "t", "elimination");
    return events;
  }
  if (!alive("t").length && !bomb.planted) {
    endRound(match, "ct", "elimination");
    return events;
  }
  if (!bomb.planted && !state.remaining) {
    endRound(match, "ct", "timeout");
    return events;
  }
  if (!bomb.planted) {
    if (!bomb.carrier)
      bomb.carrier =
        alive("t").find((p) => Math.hypot(p.x - bomb.x, p.y - bomb.y, p.z - bomb.z) < 1.5)?.id ??
        null;
    const carrier = bomb.carrier ? match.players.get(bomb.carrier) : undefined;
    if (carrier) {
      Object.assign(bomb, { x: carrier.x, y: carrier.y, z: carrier.z });
      const input = inputs.get(carrier.id);
      if (input?.dropBomb) {
        bomb.carrier = null;
        bomb.plantProgress = 0;
        const from = new T.Vector3(carrier.x, carrier.y + 0.4, carrier.z),
          direction = new T.Vector3(-Math.sin(carrier.yaw), 0, -Math.cos(carrier.yaw));
        const distance = Math.min(
          2,
          Math.max(
            0,
            (match.map.collision.intersections(new T.Ray(from, direction), 2)[0]?.distance ?? 2) -
              0.1,
          ),
        );
        bomb.x = carrier.x + direction.x * distance;
        bomb.z = carrier.z + direction.z * distance;
        const floor = match.map.collision.floor(bomb.x, bomb.z, carrier.y + 0.5);
        bomb.y = Number.isFinite(floor) ? floor : carrier.y;
        return events;
      }
      const canPlant =
        input?.use &&
        carrier.grounded &&
        Math.hypot(carrier.vx, carrier.vz) < 0.1 &&
        dust2BombSites.contains(carrier, {
          halfWidth: movement.hullRadius,
          height: carrier.eye + 0.2,
        });
      bomb.plantProgress = canPlant ? bomb.plantProgress + STEP : 0;
      if (bomb.plantProgress >= 3.2) {
        bomb.planted = true;
        bomb.planter = carrier.id;
        bomb.carrier = null;
        bomb.plantProgress = 0;
        bomb.timer = 40;
        carrier.money = addMoney(carrier.money, rules.plantReward, state.mode);
        events.push({ kind: "plant", actor: carrier.id });
      }
    }
  } else {
    bomb.timer = Math.max(0, bomb.timer - STEP);
    const eligible = alive("ct").filter(
      (player) =>
        inputs.get(player.id)?.use &&
        Math.hypot(player.vx, player.vz) < 0.1 &&
        Math.hypot(player.x - bomb.x, player.y - bomb.y, player.z - bomb.z) < 1.8,
    );
    const defuser = eligible.find((p) => p.id === bomb.defuser) ?? eligible[0];
    if (defuser?.id !== bomb.defuser) bomb.progress = 0;
    bomb.defuser = defuser?.id ?? null;
    if (defuser) bomb.progress += STEP;
    else bomb.progress = 0;
    if (defuser && bomb.progress >= (defuser.kit ? 5 : 10)) {
      defuser.money = addMoney(defuser.money, rules.defuseReward, state.mode);
      events.push({ kind: "defuse", actor: defuser.id });
      endRound(match, "ct", "defuse");
    } else if (!bomb.timer) {
      if (match.map.bombDamage)
        for (const player of match.players.values()) {
          if (player.health <= 0) continue;
          const sample = new T.Vector3(player.x, player.y + player.eye * 0.5, player.z),
            field = match.map.bombDamage;
          let hit = field.lookup(bomb, sample);
          if (!hit) continue;
          if (
            !match.map.collision.visible(
              sample,
              new T.Vector3(hit.nodePosition.x, hit.nodePosition.y, hit.nodePosition.z),
            )
          ) {
            const floor = match.map.collision.support(
              player.x,
              player.z,
              player.y,
              player.y - 1000,
              0.3,
            );
            if (Number.isFinite(floor))
              hit = field.lookup(bomb, groundCorrectedBombSample(sample, player, floor)) ?? hit;
          }
          player.health = Math.max(
            0,
            player.health -
              field.playerDamage(
                hit,
                new T.Vector3(
                  -Math.sin(player.yaw) * Math.cos(player.pitch),
                  -Math.sin(player.pitch),
                  -Math.cos(player.yaw) * Math.cos(player.pitch),
                ),
                player.eye < 1.4,
              ),
          );
          if (!player.health) {
            player.deaths++;
            events.push({
              kind: "kill",
              killer: "C4",
              victim: player.id,
              headshot: false,
              weapon: -1,
            });
          }
        }
      events.push({ kind: "explode", actor: bomb.planter ?? "C4" });
      endRound(match, "t", "bomb");
    }
  }
  return events;
}
