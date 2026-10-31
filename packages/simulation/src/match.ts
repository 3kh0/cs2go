import {
  TICK_RATE,
  neutralInput,
  type Input,
  type MatchEvent,
  type PlayerState,
  type Vec3,
} from "@cs2go/protocol";
import { movePlayer } from "./movement";
import { movement, reloadMagazine, weapons } from "./physics";
import { yardSpawns, yardWalls } from "./yard";
export const STEP = 1 / TICK_RATE;
export const RESPAWN_SECONDS = 3;
export function createPlayer(id: string, name: string, team: "ct" | "t"): PlayerState {
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
    ammo: weapons[0].mag,
    reserve: weapons[0].reserve,
    cooldown: 0,
    reloadTime: 0,
    respawnTime: 0,
    spawn: 0,
    kills: 0,
    deaths: 0,
    ack: 0,
  };
}
export function respawn(player: PlayerState, players: Iterable<PlayerState>) {
  const others = [...players].filter((other) => other.id !== player.id && other.health > 0);
  const point = [...yardSpawns].sort((a, b) => {
    const distance = (p: Vec3) =>
      others.length
        ? Math.min(...others.map((other) => (p.x - other.x) ** 2 + (p.z - other.z) ** 2))
        : 0;
    return distance(b) - distance(a);
  })[0];
  Object.assign(player, point, {
    vx: 0,
    vz: 0,
    vertical: 0,
    eye: movement.standingEye,
    pitch: 0,
    grounded: true,
    health: 100,
    ammo: weapons[0].mag,
    reserve: weapons[0].reserve,
    cooldown: 0.6,
    reloadTime: 0,
    respawnTime: 0,
    spawn: player.spawn + 1,
  });
}
export function rayBox(origin: Vec3, direction: Vec3, min: Vec3, max: Vec3): number {
  let near = 0,
    far = 100;
  for (const axis of ["x", "y", "z"] as const) {
    if (Math.abs(direction[axis]) < 1e-9) {
      if (origin[axis] < min[axis] || origin[axis] > max[axis]) return Infinity;
    } else {
      const a = (min[axis] - origin[axis]) / direction[axis];
      const b = (max[axis] - origin[axis]) / direction[axis];
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
      if (near > far) return Infinity;
    }
  }
  return near;
}
function shoot(shooter: PlayerState, players: Map<string, PlayerState>): MatchEvent[] {
  const from = { x: shooter.x, y: shooter.y + shooter.eye, z: shooter.z };
  const direction = {
    x: -Math.sin(shooter.yaw) * Math.cos(shooter.pitch),
    y: -Math.sin(shooter.pitch),
    z: -Math.cos(shooter.yaw) * Math.cos(shooter.pitch),
  };
  let distance = 100;
  for (const wall of yardWalls)
    distance = Math.min(
      distance,
      rayBox(
        from,
        direction,
        { x: wall.x - wall.w / 2, y: wall.y ?? 0, z: wall.z - wall.d / 2 },
        { x: wall.x + wall.w / 2, y: wall.h, z: wall.z + wall.d / 2 },
      ),
    );
  let victim: PlayerState | undefined;
  for (const other of players.values()) {
    if (other === shooter || other.health <= 0) continue;
    const radius = movement.hullRadius;
    const hit = rayBox(
      from,
      direction,
      { x: other.x - radius, y: other.y, z: other.z - radius },
      { x: other.x + radius, y: other.y + other.eye + 0.2, z: other.z + radius },
    );
    if (hit < distance) {
      distance = hit;
      victim = other;
    }
  }
  const to = {
    x: from.x + direction.x * distance,
    y: from.y + direction.y * distance,
    z: from.z + direction.z * distance,
  };
  const events: MatchEvent[] = [{ kind: "shot", shooter: shooter.id, from, to }];
  if (victim) {
    const headshot = to.y > victim.y + victim.eye - 0.15;
    // Initial arena uses unarmored hull hits, no penetration or spread yet.
    victim.health = Math.max(
      0,
      victim.health - weapons[0].damage * (headshot ? weapons[0].head : 1),
    );
    if (victim.health === 0) {
      victim.deaths++;
      victim.respawnTime = RESPAWN_SECONDS;
      victim.reloadTime = 0;
      victim.vx = victim.vz = 0;
      shooter.kills++;
      events.push({ kind: "kill", killer: shooter.id, victim: victim.id, headshot });
    }
  }
  return events;
}
export function stepMatch(
  players: Map<string, PlayerState>,
  inputs: Map<string, Input>,
): MatchEvent[] {
  const events: MatchEvent[] = [];
  for (const player of players.values()) {
    if (player.health <= 0) {
      player.respawnTime = Math.max(0, player.respawnTime - STEP);
      if (player.respawnTime === 0) respawn(player, players.values());
      continue;
    }
    movePlayer(player, inputs.get(player.id) ?? neutralInput(), STEP);
    player.cooldown = Math.max(0, player.cooldown - STEP);
    if (player.reloadTime > 0) {
      player.reloadTime = Math.max(0, player.reloadTime - STEP);
      if (player.reloadTime === 0)
        Object.assign(player, reloadMagazine(0, player.ammo, player.reserve));
    }
  }
  for (const player of players.values()) {
    const input = inputs.get(player.id);
    if (!input || player.health <= 0) continue;
    if (
      input.reload &&
      player.reloadTime === 0 &&
      player.ammo < weapons[0].mag &&
      player.reserve > 0
    )
      player.reloadTime = weapons[0].reload;
    if (input.fire && player.reloadTime === 0 && player.cooldown === 0 && player.ammo > 0) {
      player.ammo--;
      player.cooldown = weapons[0].delay;
      events.push(...shoot(player, players));
    }
  }
  return events;
}
