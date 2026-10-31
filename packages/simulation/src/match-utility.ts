import * as T from "three";
import type {
  Input,
  MatchEvent,
  PlayerState,
  UtilityEffect,
  UtilityProjectile,
} from "@cs2go/protocol";
import type { Match } from "./match";
import { damagePlayer } from "./combat";
import { dust2BuyZones } from "./buy-zones";
import { movement } from "./physics";
import {
  canCarryGrenade,
  emptyGrenades,
  fireCellCandidates,
  fireParameters,
  fireTickDamage,
  flashExposure,
  grenadeAvailable,
  grenadeData,
  heDamage,
  utilityDamageScale,
} from "./utility";
import { advanceGrenade, grenadeLaunch, grenadePhysics } from "./grenade-physics";
export function createUtilityMemory() {
  return { receipts: emptyGrenades(), held: 0 };
}
export type UtilityMemory = ReturnType<typeof createUtilityMemory>;
function sight(match: Match, from: T.Vector3, to: T.Vector3) {
  const delta = to.clone().sub(from),
    distance = delta.length();
  return (
    distance < 0.001 ||
    !match.map.collision.intersections(new T.Ray(from, delta.normalize()), distance - 0.03).length
  );
}
function sweep(match: Match, from: T.Vector3, delta: T.Vector3, normal: T.Vector3) {
  let fraction = match.map.collision.sweepSphere(from, delta, grenadePhysics.radius, normal);
  if (match.map.grenadeCollision) {
    const other = new T.Vector3();
    const clipped = match.map.grenadeCollision.sweepSphere(
      from,
      delta,
      grenadePhysics.radius,
      other,
    );
    if (clipped < fraction) {
      fraction = clipped;
      normal.copy(other);
    }
  }
  return fraction;
}
export function playerUtility(match: Match, player: PlayerState, input: Input, dt: number) {
  const memory = match.utility.get(player.id)!;
  memory.held = input.utility && player.grenades[input.utility] ? memory.held + dt : memory.held;
  player.blind = Math.max(0, player.blind - dt);
  const canBuy =
    match.state.buyRemaining > 0 &&
    ["freeze", "live"].includes(match.state.phase) &&
    dust2BuyZones.contains(player, player.team, {
      halfWidth: movement.hullRadius,
      height: player.eye + 0.2,
    });
  if (
    canBuy &&
    input.grenadeBuy &&
    grenadeAvailable(input.grenadeBuy, player.team) &&
    canCarryGrenade(player.grenades, input.grenadeBuy, match.state.mode === "competitive") &&
    player.money >= grenadeData[input.grenadeBuy].price
  ) {
    player.money -= grenadeData[input.grenadeBuy].price;
    player.grenades[input.grenadeBuy]++;
    memory.receipts[input.grenadeBuy]++;
  }
  if (
    canBuy &&
    input.grenadeRefund &&
    memory.receipts[input.grenadeRefund] > 0 &&
    player.grenades[input.grenadeRefund] > 0
  ) {
    player.grenades[input.grenadeRefund]--;
    memory.receipts[input.grenadeRefund]--;
    player.money += grenadeData[input.grenadeRefund].price;
  }
  const kind = input.throwKind;
  if (
    !kind ||
    !player.grenades[kind] ||
    player.cooldown > 0 ||
    memory.held < 0.5 ||
    ["freeze", "halftime", "finished"].includes(match.state.phase) ||
    match.state.projectiles.length >= 32
  ) {
    if (!input.utility) memory.held = 0;
    return;
  }
  const direction = new T.Vector3(0, 0, -1).applyEuler(
    new T.Euler(-player.pitch, player.yaw, 0, "YXZ"),
  );
  const launch = grenadeLaunch(
    kind,
    input.throwStrength,
    new T.Vector3(player.x, player.y + player.eye, player.z),
    direction,
    new T.Vector3(player.vx, player.vertical, player.vz),
  );
  const offset = launch.direction.clone().multiplyScalar(22 * 0.0254),
    normal = new T.Vector3();
  const fraction = sweep(match, launch.position, offset, normal);
  launch.position
    .addScaledVector(offset, Math.min(1, fraction))
    .addScaledVector(launch.direction, -6 * 0.0254);
  match.state.projectiles.push({
    id: match.nextUtility++,
    kind,
    owner: player.id,
    team: player.team,
    weapon: player.weapon,
    x: launch.position.x,
    y: launch.position.y,
    z: launch.position.z,
    vx: launch.velocity.x,
    vy: launch.velocity.y,
    vz: launch.velocity.z,
    age: 0,
    resting: false,
    lastBounce: -1,
  });
  player.grenades[kind]--;
  memory.receipts[kind] = Math.max(0, memory.receipts[kind] - 1);
  memory.held = 0;
  player.cooldown = 0.7;
}
function areaDamage(
  match: Match,
  effect: UtilityEffect,
  fixed: number,
  radius: number,
  events: MatchEvent[],
) {
  const source = new T.Vector3(effect.x, effect.y, effect.z);
  const fire = effect.kind === "molotov" || effect.kind === "incendiary";
  for (const victim of match.players.values()) {
    if (victim.health <= 0) continue;
    const center = new T.Vector3(victim.x, victim.y + 0.8, victim.z),
      distance = source.distanceTo(center);
    if (distance > radius || !sight(match, source, center)) continue;
    if (
      fire &&
      !effect.cells.some(
        (cell) =>
          Math.hypot(cell.x - victim.x, cell.z - victim.z) < 0.8 &&
          Math.abs(cell.y - victim.y) < 0.8,
      )
    )
      continue;
    const damage =
      (fixed || heDamage(distance)) *
      utilityDamageScale(
        match.state.mode,
        effect.kind,
        victim.id === effect.owner,
        victim.team === effect.team,
      );
    const deaths = damagePlayer(
      match,
      match.players.get(effect.owner),
      victim,
      damage,
      false,
      -1,
      1,
      fire,
    );
    for (const death of deaths) if (death.kind === "kill") death.utility = effect.kind;
    events.push(...deaths);
  }
}
function detonate(match: Match, projectile: UtilityProjectile, events: MatchEvent[]) {
  const effect: UtilityEffect = {
    id: projectile.id,
    kind: projectile.kind,
    owner: projectile.owner,
    team: projectile.team,
    weapon: projectile.weapon,
    x: projectile.x,
    y: projectile.y,
    z: projectile.z,
    age: 0,
    pulse: 0,
    cleared: -1,
    cells: [],
    holes: [],
  };
  const origin = new T.Vector3(effect.x, effect.y, effect.z),
    data = grenadeData[effect.kind];
  if (effect.kind === "he") {
    areaDamage(match, effect, 0, data.radius, events);
    for (const other of match.state.effects)
      if (
        other.kind === "smoke" &&
        origin.distanceTo(new T.Vector3(other.x, other.y, other.z)) < 8 &&
        sight(match, origin, new T.Vector3(other.x, other.y, other.z))
      )
        other.cleared = 2;
  }
  if (effect.kind === "flash") {
    for (const player of match.players.values()) {
      if (player.health <= 0) continue;
      const eye = new T.Vector3(player.x, player.y + player.eye, player.z),
        delta = origin.clone().sub(eye),
        distance = delta.length();
      if (distance > 30 || !sight(match, eye, origin)) continue;
      const facing = new T.Vector3(0, 0, -1).applyEuler(
        new T.Euler(-player.pitch, player.yaw, 0, "YXZ"),
      );
      player.blind = Math.max(
        player.blind,
        4.8 * flashExposure(distance, facing.dot(delta.normalize())),
      );
    }
  }
  const fire = effect.kind === "molotov" || effect.kind === "incendiary";
  if (effect.kind === "smoke")
    for (const other of match.state.effects)
      if (
        (other.kind === "molotov" || other.kind === "incendiary") &&
        origin.distanceTo(new T.Vector3(other.x, other.y, other.z)) < 5 &&
        sight(match, origin, new T.Vector3(other.x, other.y, other.z))
      )
        other.age = grenadeData[other.kind].duration;
  if (fire) {
    effect.pulse = fireParameters.interval;
    for (const offset of fireCellCandidates(effect.kind as "molotov" | "incendiary")) {
      const cell = origin.clone().add(offset);
      if (!sight(match, origin, cell)) continue;
      const floor = match.map.collision.floor(cell.x, cell.z, cell.y + 0.5, cell.y - 1);
      if (!Number.isFinite(floor)) continue;
      cell.y = floor + 0.16;
      effect.cells.push(cell);
      if (effect.cells.length >= fireParameters.maxCells) break;
    }
  }
  match.state.effects.push(effect);
  if (match.state.effects.length > 48) match.state.effects.shift();
}
export function stepUtility(match: Match, dt: number, events: MatchEvent[]) {
  if (["freeze", "halftime", "finished"].includes(match.state.phase)) return;
  match.state.clock += dt;
  for (let i = match.state.projectiles.length - 1; i >= 0; i--) {
    const p = match.state.projectiles[i];
    p.age += dt;
    let fireContact = false;
    if (!p.resting) {
      const position = new T.Vector3(p.x, p.y, p.z),
        velocity = new T.Vector3(p.vx, p.vy, p.vz);
      const result = advanceGrenade(
        position,
        velocity,
        dt,
        (from, delta, normal) => sweep(match, from, delta, normal),
        p.kind === "molotov" || p.kind === "incendiary",
      );
      p.x = position.x;
      p.y = position.y;
      p.z = position.z;
      p.vx = velocity.x;
      p.vy = velocity.y;
      p.vz = velocity.z;
      p.resting = result.resting;
      fireContact = result.fireContact;
      if (result.impact > 1.5 && p.age - p.lastBounce >= 0.08) {
        events.push({
          kind: "utility-sound",
          sound: "bounce",
          utility: p.kind,
          point: position,
          weapon: p.weapon,
        });
        p.lastBounce = p.age;
      }
    }
    const fire = p.kind === "molotov" || p.kind === "incendiary";
    if (p.age > 30 || p.y < -100) {
      match.state.projectiles.splice(i, 1);
      continue;
    }
    if (
      (fire && fireContact) ||
      (p.age >= grenadeData[p.kind].fuse &&
        (fire || p.kind === "he" || p.kind === "flash" || p.resting))
    ) {
      detonate(match, p, events);
      match.state.projectiles.splice(i, 1);
    }
  }
  for (let i = match.state.effects.length - 1; i >= 0; i--) {
    const effect = match.state.effects[i];
    effect.age += dt;
    effect.pulse -= dt;
    effect.cleared -= dt;
    if ((effect.kind === "molotov" || effect.kind === "incendiary") && effect.pulse <= 1e-9) {
      effect.pulse += fireParameters.interval;
      areaDamage(
        match,
        effect,
        fireTickDamage(effect.kind),
        grenadeData[effect.kind].radius,
        events,
      );
    } else if (effect.kind === "decoy" && effect.pulse <= 0) {
      effect.pulse = 0.35 + Math.random() * 0.5;
      events.push({
        kind: "utility-sound",
        sound: "decoy-shot",
        utility: effect.kind,
        point: { x: effect.x, y: effect.y, z: effect.z },
        weapon: effect.weapon,
      });
    }
    if (effect.age >= grenadeData[effect.kind].duration) {
      if (effect.kind === "decoy") {
        areaDamage(match, effect, 5, 2, events);
        events.push({
          kind: "utility-sound",
          sound: "decoy-explode",
          utility: effect.kind,
          point: { x: effect.x, y: effect.y, z: effect.z },
          weapon: effect.weapon,
        });
      }
      match.state.effects.splice(i, 1);
    }
  }
}
