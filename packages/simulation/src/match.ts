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
  type PlayerConfiguration,
} from "@cs2go/protocol";
import { roundFact } from "./round-facts";
import nativeStrings from "./data/round-strings.json";
import {
  createWeaponActions,
  advanceWeaponActions,
  cancelWeaponActions,
  canTrigger,
  commitTrigger,
  type WeaponActions,
} from "./weapon-actions";
import { shoot, advanceCombat, createCombatMemory, type CombatMemory } from "./combat";
import {
  createUtilityMemory,
  playerUtility,
  stepUtility,
  type UtilityMemory,
} from "./match-utility";
import { createReceipts, equipmentState, publishReceipts, refund, type Receipts } from "./receipts";
import { emptyGrenades } from "./utility";
import { advanceDroppedWeapon, canPickupDroppedWeapon } from "./dropped-weapon";
import { applyLandingInaccuracy } from "./accuracy";
import { readLoadouts } from "./loadouts";
import { WorldBallPhysics } from "./world-ball";
import ballOrigin from "./data/world-ball-origin.json";
import { movePlayer } from "./movement";
import { isKnife, movement, weaponSlot, weapons } from "./physics";
import {
  rulesFor,
  addMoney,
  equipmentPrice,
  weaponAvailable,
  weaponPrice,
  roundReward,
  nextLossLevel,
} from "./economy";
import { dust2BombSites, dust2BuyZones } from "./buy-zones";
import { groundCorrectedBombSample } from "./bomb-damage";
import type { DustMap } from "./dust-map";
export const STEP = 1 / TICK_RATE;
export type Match = {
  ball: WorldBallPhysics;
  firstKill?: { name: string; seconds: number };
  highlights: Map<string, { headshots: number; knives: number; grenades: number }>;
  receipts: Map<string, Receipts>;
  configurations: Map<string, PlayerConfiguration>;
  nextAppearance: number;
  utility: Map<string, UtilityMemory>;
  nextUtility: number;
  actions: Map<string, WeaponActions>;
  combat: Map<string, CombatMemory>;
  nextDrop: number;
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
    ball: new WorldBallPhysics(map.collision, new T.Vector3(...ballOrigin.origin)),
    highlights: new Map(),
    receipts: new Map(),
    configurations: new Map(),
    nextAppearance: 1,
    utility: new Map(),
    nextUtility: 1,
    actions: new Map(),
    combat: new Map(),
    nextDrop: 1,
    players: new Map(),
    map,
    loss: { ct: rulesFor(mode).startingLossLevel, t: rulesFor(mode).startingLossLevel },
    startingKills: new Map(),
    shotsHeld: new Set(),
    weaponCooldowns: new Map(),
    state: {
      ball: {
        x: ballOrigin.origin[0],
        y: ballOrigin.origin[1],
        z: ballOrigin.origin[2],
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
      },
      clock: 0,
      projectiles: [],
      effects: [],
      drops: [],
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
    allowedWeapons: [],
    refundableWeapons: [],
    refundableEquipment: [],
    grenadeReceipts: emptyGrenades(),
    appearances: {},
    agent: `default-${team}`,
    grenades: emptyGrenades(),
    blind: 0,
    accuracy: { penalty: 0, mode: 0 },
    recoilIndex: 0,
    burstRemaining: 0,
    scope: 0,
    suppressed: weapons[secondary].suppressed,
    reloadPhase: "intro",
    reloadEmpty: false,
    suppressorAction: "",
    suppressorTime: 0,
    suppressorDuration: 0,
    charge: 0,
    punch: { pitch: 0, yaw: 0, pitchVelocity: 0, yawVelocity: 0 },
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
    knife: 4,
    secondary,
    magazines: {},
    money: 0,
    armor: 0,
    helmet: false,
    kit: false,
    waiting: false,
  };
}
export function newAppearance(match: Match, player: PlayerState, weapon: number) {
  const skin = match.configurations.get(player.id)?.skins[weapon] ?? {
    id: "",
    wear: 0.01,
    seed: 1,
  };
  return (player.appearances[weapon] = {
    serial: match.nextAppearance++,
    weapon,
    creator: player.id,
    skin: { ...skin },
  });
}
export function configurePlayer(
  match: Match,
  player: PlayerState,
  configuration: PlayerConfiguration,
) {
  const first = !match.configurations.has(player.id);
  configuration = { ...configuration, loadouts: readLoadouts(configuration.loadouts) };
  match.configurations.set(player.id, configuration);
  if (configuration.profile) {
    player.name = configuration.profile.name.trim();
    player.avatar = configuration.profile.avatar;
  }
  player.agent = configuration.agents[player.team];
  if (first) player.allowedWeapons = [...configuration.loadouts[player.team]];
  if (
    first &&
    (match.state.phase === "waiting" || (match.state.round === 1 && match.state.phase === "freeze"))
  ) {
    if (player.team === "ct" && player.secondary === 2) {
      const starting = configuration.loadouts.ct.find((id) => id === 2 || id === 12) ?? 2;
      if (starting !== player.secondary) {
        delete player.magazines[player.secondary];
        delete player.appearances[player.secondary];
        const selected = player.weapon === player.secondary;
        player.secondary = starting;
        player.magazines[starting] = {
          ammo: weapons[starting].mag,
          reserve: weapons[starting].reserve,
        };
        if (selected) {
          player.weapon = starting;
          Object.assign(player, player.magazines[starting]);
        }
      }
    }
    const knife = configuration.knife ?? player.knife;
    if (knife !== player.knife) {
      const selected = player.weapon === player.knife;
      delete player.magazines[player.knife];
      delete player.appearances[player.knife];
      player.knife = knife;
      player.magazines[knife] = { ammo: 1, reserve: 0 };
      if (selected) {
        player.weapon = knife;
        player.ammo = 1;
        player.reserve = 0;
      }
    }
    for (const id of Object.keys(player.magazines)) newAppearance(match, player, Number(id));
  }
}
export function respawn(player: PlayerState, match: Match, preserve = false) {
  match.weaponCooldowns.set(player.id, {});
  match.combat.set(player.id, createCombatMemory());
  match.actions.set(player.id, createWeaponActions());
  match.utility.set(player.id, createUtilityMemory());
  match.receipts.set(player.id, createReceipts());
  match.highlights.set(player.id, { headshots: 0, knives: 0, grenades: 0 });
  player.refundableWeapons = [];
  player.allowedWeapons = [...(match.configurations.get(player.id)?.loadouts[player.team] ?? [])];
  player.refundableEquipment = [];
  player.blind = 0;
  player.scope = 0;
  player.agent =
    match.configurations.get(player.id)?.agents[player.team] ?? `default-${player.team}`;
  player.punch = match.combat.get(player.id)!.punch;
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
    player.knife = match.configurations.get(player.id)?.knife ?? player.knife;
    player.grenades = emptyGrenades();
    player.primary = null;
    player.secondary =
      player.team === "t"
        ? 7
        : (match.configurations.get(player.id)?.loadouts.ct.find((id) => id === 2 || id === 12) ??
          2);
    player.weapon = player.secondary;
    player.magazines = Object.fromEntries(
      [player.secondary, player.knife].map((id) => [
        id,
        { ammo: weapons[id].mag, reserve: weapons[id].reserve },
      ]),
    );
    player.appearances = {};
    for (const id of [player.secondary, player.knife]) newAppearance(match, player, id);
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
  match.combat.delete(id);
  match.actions.delete(id);
  match.utility.delete(id);
  match.configurations.delete(id);
  match.receipts.delete(id);
  match.highlights.delete(id);
}
export function startRound(match: Match) {
  match.ball.reset();
  match.firstKill = undefined;
  match.state.drops = [];
  match.state.projectiles = [];
  match.state.effects = [];
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
    firstKill: match.firstKill,
    players: ranked.map((p) => ({
      name: p.name,
      kills: Math.max(0, p.kills - (match.startingKills.get(p.id) ?? p.kills)),
      ...(match.highlights.get(p.id) ?? { headshots: 0, knives: 0, grenades: 0 }),
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
export function dropWeapon(match: Match, player: PlayerState, toss = false) {
  if (isKnife(player.weapon)) return;
  match.receipts.get(player.id)!.weapons.delete(player.weapon);
  const position = new T.Vector3(player.x, player.y + 0.7, player.z);
  const velocity = new T.Vector3(-Math.sin(player.yaw) * 2.5, 1, -Math.cos(player.yaw) * 2.5);
  if (toss) {
    const forward = new T.Vector3(
      -Math.sin(player.yaw) * Math.cos(player.pitch),
      -Math.sin(player.pitch),
      -Math.cos(player.yaw) * Math.cos(player.pitch),
    );
    const eye = new T.Vector3(player.x, player.y + player.eye - 0.25, player.z);
    const release = eye
      .clone()
      .addScaledVector(forward, 0.55)
      .add(new T.Vector3(Math.cos(player.yaw) * 0.18, 0, -Math.sin(player.yaw) * 0.18));
    position.copy(match.map.collision.visible(eye, release) ? release : eye);
    velocity.copy(forward).multiplyScalar(5);
    velocity.x += player.vx * 0.5;
    velocity.z += player.vz * 0.5;
    velocity.y += 1.4;
  }
  const id = match.nextDrop++;
  match.state.drops.push({
    id,
    weapon: player.weapon,
    ammo: player.ammo,
    reserve: player.reserve,
    owner: player.id,
    appearance: player.appearances[player.weapon] ?? newAppearance(match, player, player.weapon),
    suppressed: match.actions.get(player.id)!.attached[player.weapon],
    x: position.x,
    y: position.y,
    z: position.z,
    vx: velocity.x,
    vy: velocity.y,
    vz: velocity.z,
    rx: 0,
    rz: 0,
    sleeping: false,
    tossed: toss,
    yaw: player.yaw,
    age: 0,
  });
  if (match.state.drops.length > 64) match.state.drops.shift();
  if (player.primary === player.weapon) player.primary = null;
  delete player.magazines[player.weapon];
  delete player.appearances[player.weapon];
  player.weapon =
    player.primary ?? (player.magazines[player.secondary] ? player.secondary : player.knife);
  Object.assign(player, player.magazines[player.weapon]);
  player.reloadTime = 0;
  player.cooldown = weapons[player.weapon].deploy;
}
function pickupWeapon(match: Match, player: PlayerState, manual: boolean) {
  const index = match.state.drops.findIndex((drop) => {
    const empty =
      weaponSlot(drop.weapon) === 1 ? player.primary === null : !player.magazines[player.secondary];
    return (
      (empty || manual) &&
      canPickupDroppedWeapon(drop, drop.age, drop.owner === player.id, player, (from, to) =>
        match.map.collision.visible(from, to),
      )
    );
  });
  if (index < 0) return;
  const [drop] = match.state.drops.splice(index, 1);
  const slot = weaponSlot(drop.weapon);
  const previous =
    slot === 1 ? player.primary : player.magazines[player.secondary] ? player.secondary : null;
  if (previous !== null) {
    player.magazines[player.weapon] = { ammo: player.ammo, reserve: player.reserve };
    player.weapon = previous;
    Object.assign(player, player.magazines[previous]);
    dropWeapon(match, player);
  } else player.magazines[player.weapon] = { ammo: player.ammo, reserve: player.reserve };
  if (slot === 1) player.primary = drop.weapon;
  else player.secondary = drop.weapon;
  player.appearances[drop.weapon] = drop.appearance;
  match.actions.get(player.id)!.attached[drop.weapon] = drop.suppressed;
  player.magazines[drop.weapon] = { ammo: drop.ammo, reserve: drop.reserve };
  player.weapon = drop.weapon;
  player.ammo = drop.ammo;
  player.reserve = drop.reserve;
  player.cooldown = weapons[drop.weapon].deploy;
  player.reloadTime = 0;
}
function buy(match: Match, player: PlayerState, input: Input) {
  const index = input.buy;
  if (isKnife(index) && player.health > 0 && match.state.phase !== "finished") {
    const locks = match.weaponCooldowns.get(player.id)!;
    locks[player.weapon] = Math.max(
      locks[player.weapon] ?? 0,
      player.cooldown,
      match.actions.get(player.id)!.inserted ? player.reloadTime : 0,
    );
    player.magazines[player.weapon] = { ammo: player.ammo, reserve: player.reserve };
    delete player.magazines[player.knife];
    delete player.appearances[player.knife];
    player.knife = index;
    player.weapon = index;
    player.magazines[index] = { ammo: 1, reserve: 0 };
    player.ammo = 1;
    player.reserve = 0;
    newAppearance(match, player, index);
    cancelWeaponActions(player, match.actions.get(player.id)!);
    player.cooldown = Math.max(weapons[index].deploy, locks[4] ?? 0, locks[5] ?? 0, locks[6] ?? 0);
    const configuration = match.configurations.get(player.id);
    if (configuration) configuration.knife = index;
    return;
  }

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
  refund(match, player, input);

  if (
    index >= 0 &&
    !isKnife(index) &&
    (!match.configurations.has(player.id) || player.allowedWeapons.includes(index)) &&
    weaponAvailable(index, player.team) &&
    !player.magazines[index] &&
    player.money >= weaponPrice(index)
  ) {
    const previous = weaponSlot(index) === 1 ? player.primary : player.secondary;
    if (previous !== null && player.magazines[previous]) {
      player.magazines[player.weapon] = { ammo: player.ammo, reserve: player.reserve };
      player.weapon = previous;
      Object.assign(player, player.magazines[previous]);
      dropWeapon(match, player);
    }
    cancelWeaponActions(player, match.actions.get(player.id)!);
    if (weaponSlot(index) === 1) player.primary = index;
    else player.secondary = index;
    newAppearance(match, player, index);
    player.magazines[index] = { ammo: weapons[index].mag, reserve: weapons[index].reserve };
    match.receipts.get(player.id)!.weapons.set(index, {
      price: weaponPrice(index),
      ammo: weapons[index].mag,
      reserve: weapons[index].reserve,
    });
    player.money = addMoney(player.money, -weaponPrice(index), state.mode);
    player.weapon = index;
    player.cooldown = weapons[index].deploy;
    player.reloadTime = 0;
    Object.assign(player, player.magazines[index]);
  }
  if (input.equipment && (input.equipment !== "kit" || player.team === "ct")) {
    const price = equipmentPrice(input.equipment, player.armor, player.helmet);
    if (price > 0 && player.money >= price && !(input.equipment === "kit" && player.kit)) {
      const before = equipmentState(player);
      player.money = addMoney(player.money, -price, state.mode);
      if (input.equipment === "kit") player.kit = true;
      else {
        player.armor = 100;
        if (input.equipment === "helmet") player.helmet = true;
      }
      match.receipts.get(player.id)!.equipment.push({
        kind: input.equipment === "vest" ? "kevlar" : input.equipment,
        price,
        before,
        after: equipmentState(player),
      });
    }
  }
}
export function stepMatch(match: Match, inputs: Map<string, Input>): MatchEvent[] {
  const events: MatchEvent[] = [],
    state = match.state,
    rules = rulesFor(state.mode);
  if (state.phase === "waiting") {
    for (const player of match.players.values())
      if (player.health <= 0) {
        player.respawnTime += STEP;
        if (player.respawnTime >= 3) respawn(player, match);
      }
    if (
      [...match.players.values()].some((p) => p.team === "ct") &&
      [...match.players.values()].some((p) => p.team === "t")
    )
      startRound(match);
    if (state.phase !== "waiting") return events;
  }
  if (state.phase === "finished") return events;
  for (const drop of state.drops) {
    const position = new T.Vector3(drop.x, drop.y, drop.z),
      velocity = new T.Vector3(drop.vx, drop.vy, drop.vz),
      rotation = { x: drop.rx, z: drop.rz };
    advanceDroppedWeapon(position, velocity, rotation, drop, STEP, match.map.collision);
    drop.x = position.x;
    drop.y = position.y;
    drop.z = position.z;
    drop.vx = velocity.x;
    drop.vy = velocity.y;
    drop.vz = velocity.z;
    drop.rx = rotation.x;
    drop.rz = rotation.z;
  }
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
    const mode: 0 | 1 = input.scope || player.suppressed || input.burst || input.alternate ? 1 : 0;
    advanceCombat(player, match.combat.get(player.id)!, STEP, mode);
    const action = match.actions.get(player.id)!;
    const locks = match.weaponCooldowns.get(player.id) ?? {};
    for (const id of Object.keys(locks)) locks[Number(id)] = Math.max(0, locks[Number(id)] - STEP);
    match.weaponCooldowns.set(player.id, locks);
    if (input.drop) dropWeapon(match, player, true);
    pickupWeapon(match, player, input.pickup);
    buy(match, player, input);
    playerUtility(match, player, input, STEP);
    if (input.utility) cancelWeaponActions(player, action);
    if (input.select >= 0 && player.magazines[input.select] && input.select !== player.weapon) {
      player.magazines[player.weapon] = { ammo: player.ammo, reserve: player.reserve };
      locks[player.weapon] = Math.max(
        locks[player.weapon] ?? 0,
        player.cooldown,
        action.inserted ? player.reloadTime : 0,
      );
      cancelWeaponActions(player, action);
      player.weapon = input.select;
      Object.assign(player, player.magazines[player.weapon]);
      player.reloadTime = 0;
      player.cooldown = Math.max(weapons[player.weapon].deploy, locks[player.weapon] ?? 0);
    }
    const wasGrounded = player.grounded,
      fallingSpeed = Math.max(0, -player.vertical);
    if (!frozen) movePlayer(player, input, STEP, match.map, [...match.players.values()]);
    else {
      player.vx = player.vz = player.vertical = 0;
    }
    if (!wasGrounded && player.grounded)
      applyLandingInaccuracy(
        match.combat.get(player.id)!.accuracy[player.weapon],
        player.weapon,
        mode,
        fallingSpeed,
      );
    player.cooldown = Math.max(0, player.cooldown - STEP);
    player.scope = Math.min(weapons[player.weapon].zoomLevels, input.scope);
    advanceWeaponActions(
      player,
      action,
      frozen
        ? { ...input, fire: false, stab: false, alternate: false, toggleSuppressor: false }
        : input,
      STEP,
    );
    player.suppressed = action.attached[player.weapon];
    player.reloadPhase = action.shell;
    player.reloadEmpty = action.empty;
    player.suppressorAction = action.suppressor;
    player.suppressorTime = action.suppressorTime;
    player.suppressorDuration = action.suppressorDuration;
    player.charge = action.charge;
    player.burstRemaining = action.burst;
    if (
      !frozen &&
      !input.utility &&
      !input.throwKind &&
      canTrigger(player, action, input, match.shotsHeld.has(player.id))
    ) {
      match.receipts.get(player.id)!.weapons.delete(player.weapon);
      const shot = commitTrigger(player, action, input);
      locks[player.weapon] = player.cooldown;
      if (isKnife(player.weapon)) for (const id of [4, 5, 6]) locks[id] = player.cooldown;
      events.push(...shoot(match, player, input.stab, shot.alternate, input.burst));
    }
    if (input.fire || input.alternate) match.shotsHeld.add(player.id);
    else match.shotsHeld.delete(player.id);
    player.magazines[player.weapon] = { ammo: player.ammo, reserve: player.reserve };
    player.accuracy = match.combat.get(player.id)!.accuracy[player.weapon];
    player.recoilIndex = match.combat.get(player.id)!.recoil[player.weapon].index;
    publishReceipts(match, player);
  }
  for (const player of match.players.values())
    if (player.health > 0)
      match.ball.touch(new T.Vector3(player.x, player.y, player.z), player.vx, player.vz, STEP);
  match.ball.update(STEP);
  const ball = match.ball.mesh!;
  Object.assign(state.ball, {
    x: ball.position.x,
    y: ball.position.y,
    z: ball.position.z,
    qx: ball.quaternion.x,
    qy: ball.quaternion.y,
    qz: ball.quaternion.z,
    qw: ball.quaternion.w,
  });
  stepUtility(match, STEP, events);
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
