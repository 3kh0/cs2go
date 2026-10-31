import * as T from "three";
import type { MatchEvent, PlayerState } from "@cs2go/protocol";
import type { Match } from "./match";
import { rayBox, dropWeapon } from "./match";
import { weapons, movement, isKnife } from "./physics";
import { applyArmorDamage, friendlyFireScale } from "./damage";
import { addMoney, killReward } from "./economy";
import { ballistics } from "./ballistics";
import {
  solveBullet,
  fleshThickness,
  hitgroupMultiplier,
  type BulletSurface,
} from "./bullet-solver";
import {
  advanceAimPunch,
  advanceWeaponRecoil,
  applyWeaponRecoil,
  createAimPunch,
  createWeaponRecoil,
} from "./recoil";
import {
  advanceWeaponAccuracy,
  applyFiringInaccuracy,
  createWeaponAccuracy,
  weaponInaccuracy,
  weaponShotSpread,
  type AccuracyPose,
} from "./accuracy";
import { knifeBackstab, knifeDamage, knifeRange } from "./melee";
export function createCombatMemory() {
  return {
    punch: createAimPunch(),
    recoil: weapons.map(createWeaponRecoil),
    accuracy: weapons.map(createWeaponAccuracy),
    knifeAge: 10,
  };
}
export type CombatMemory = ReturnType<typeof createCombatMemory>;
export function accuracyPose(player: PlayerState, mode: 0 | 1): AccuracyPose {
  return {
    mode,
    speed: Math.hypot(player.vx, player.vz),
    crouch: (movement.standingEye - player.eye) / (movement.standingEye - movement.duckEye),
    grounded: player.grounded,
    verticalSpeed: player.vertical,
    reloading: player.reloadTime > 0,
  };
}
export function advanceCombat(
  player: PlayerState,
  state: CombatMemory,
  dt: number,
  mode: 0 | 1 = 0,
) {
  advanceAimPunch(state.punch, dt);
  state.knifeAge += dt;
  for (let i = 0; i < weapons.length; i++) {
    advanceWeaponAccuracy(
      state.accuracy[i],
      i,
      state.recoil[i].index,
      player.eye < 1.4,
      dt,
      accuracyPose(player, i === player.weapon ? mode : state.accuracy[i].mode),
    );
    advanceWeaponRecoil(state.recoil[i], i, dt);
  }
}
export function damagePlayer(
  match: Match,
  shooter: PlayerState | undefined,
  victim: PlayerState,
  damage: number,
  headshot: boolean,
  weapon: number,
  armorRatio = weapons[weapon]?.armorRatio ?? 1,
  ignoreArmor = false,
): MatchEvent[] {
  if (victim.health <= 0 || damage <= 0) return [];
  const result = ignoreArmor
    ? { armor: victim.armor, healthDamage: damage }
    : applyArmorDamage(
        damage,
        headshot ? "head" : "chest",
        victim.armor,
        victim.helmet,
        armorRatio,
      );
  if (result.healthDamage > 0)
    match.receipts.get(victim.id)!.equipment = match.receipts
      .get(victim.id)!
      .equipment.filter((receipt) => receipt.kind === "kit");
  victim.armor = result.armor;
  victim.health = Math.max(0, victim.health - Math.floor(result.healthDamage));
  if (victim.health > 0) return [];
  const appearance = shooter?.appearances[weapon];
  for (let i = 0; i < 2 && !isKnife(victim.weapon); i++) dropWeapon(match, victim);
  victim.deaths++;
  victim.reloadTime = 0;
  victim.vx = victim.vz = 0;
  if (shooter && shooter !== victim) {
    shooter.kills += victim.team === shooter.team ? -1 : 1;
    if (victim.team !== shooter.team) {
      match.firstKill ??= { name: shooter.name, seconds: match.state.elapsed };
      const highlights = match.highlights.get(shooter.id)!;
      if (headshot) highlights.headshots++;
      if (isKnife(weapon)) highlights.knives++;
      if (weapon < 0) highlights.grenades++;
    }
    shooter.money = addMoney(
      shooter.money,
      victim.team === shooter.team ? -300 : killReward(weapon >= 0 ? weapon : 0, match.state.mode),
      match.state.mode,
    );
  }
  if (match.state.bomb.carrier === victim.id)
    Object.assign(match.state.bomb, {
      x: victim.x,
      y: victim.y,
      z: victim.z,
      carrier: null,
      plantProgress: 0,
    });
  return [
    {
      kind: "kill",
      killer: shooter?.id ?? victim.id,
      victim: victim.id,
      headshot,
      weapon,
      appearance,
    },
  ];
}
type HitData = {
  point: T.Vector3;
  normal?: T.Vector3;
  victim?: PlayerState;
  head?: boolean;
  height?: number;
};
export function shoot(
  match: Match,
  shooter: PlayerState,
  stab = false,
  alternate = false,
  burst = false,
): MatchEvent[] {
  const memory = match.combat.get(shooter.id)!;
  const weapon = weapons[shooter.weapon];
  const from = new T.Vector3(shooter.x, shooter.y + shooter.eye, shooter.z);
  const aim = new T.Euler(
    -shooter.pitch + memory.punch.pitch,
    shooter.yaw + memory.punch.yaw,
    0,
    "YXZ",
  );
  if (isKnife(shooter.weapon)) {
    const direction = new T.Vector3(0, 0, -1).applyEuler(aim);
    let distance = Math.min(
      knifeRange(stab),
      match.map.collision.intersections(new T.Ray(from, direction), knifeRange(stab))[0]
        ?.distance ?? Infinity,
    );
    let victim: PlayerState | undefined;
    for (const other of match.players.values()) {
      if (
        other === shooter ||
        other.health <= 0 ||
        (other.team === shooter.team && match.state.mode === "casual")
      )
        continue;
      const r = movement.hullRadius + 0.08;
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
    const events: MatchEvent[] = [{ kind: "melee", shooter: shooter.id, stab, hit: !!victim }];
    if (victim)
      events.push(
        ...damagePlayer(
          match,
          shooter,
          victim,
          knifeDamage(
            stab,
            memory.knifeAge > 0.9,
            knifeBackstab(shooter, victim, victim.yaw + Math.PI),
          ) * (victim.team === shooter.team ? friendlyFireScale(match.state.mode, "bullet") : 1),
          false,
          shooter.weapon,
          1.7,
        ),
      );
    memory.knifeAge = 0;
    return events;
  }
  const mode: 0 | 1 = shooter.scope || shooter.suppressed || burst || alternate ? 1 : 0;
  const pose = accuracyPose(shooter, mode);
  const offsets = weaponShotSpread(
    shooter.weapon,
    mode,
    memory.recoil[shooter.weapon].index,
    weaponInaccuracy(shooter.weapon, memory.accuracy[shooter.weapon], pose),
    weapon.pellets,
  );
  const events: MatchEvent[] = [];
  for (const [pellet, offset] of offsets.entries()) {
    const direction = new T.Vector3(offset.x, offset.y, -1).normalize().applyEuler(aim);
    const ray = new T.Ray(from, direction),
      stats = ballistics[shooter.weapon];
    const far = stats.range * 0.0254;
    const surfaces: BulletSurface<HitData>[] = match.map.collision
      .intersections(ray, far)
      .map((impact) => ({
        distance: impact.distance,
        thickness: () => match.map.collision.thickness(impact, direction),
        material: impact.object.userData.bulletMaterial ?? "concrete",
        exit: impact.face ? impact.face.normal.dot(direction) > 0 : false,
        data: { point: impact.point, normal: impact.face?.normal },
      }));
    for (const other of match.players.values()) {
      if (other === shooter || other.health <= 0) continue;
      const r = movement.hullRadius;
      const distance = rayBox(
        from,
        direction,
        { x: other.x - r, y: other.y, z: other.z - r },
        { x: other.x + r, y: other.y + other.eye + 0.2, z: other.z + r },
      );
      if (!Number.isFinite(distance) || distance > far) continue;
      const point = from.clone().addScaledVector(direction, distance),
        head = point.y > other.y + other.eye - 0.15;
      surfaces.push({
        distance,
        thickness: fleshThickness(direction, other.yaw + Math.PI, head),
        material: "flesh",
        id: other.id,
        stop: other.team === shooter.team && match.state.mode === "casual",
        data: { point, victim: other, head, height: point.y - other.y },
      });
    }
    const result = solveBullet(stats, surfaces);
    match.ball.shoot(ray, result.endDistance);
    const impacts: { point: T.Vector3; normal: T.Vector3 }[] = [];
    const hits: { victim: string; headshot: boolean; passed: boolean }[] = [];
    const kills: MatchEvent[] = [];
    for (const contact of result.contacts) {
      const { data } = contact.surface;
      if (data.victim) {
        if (data.victim.team === shooter.team && match.state.mode === "casual") continue;
        hits.push({ victim: data.victim.id, headshot: !!data.head, passed: contact.passed });
        const damage =
          contact.damage *
          hitgroupMultiplier(!!data.head, data.height!, weapon.head, data.victim.eye < 1.4) *
          (data.victim.team === shooter.team ? friendlyFireScale(match.state.mode, "bullet") : 1);
        const deaths = damagePlayer(
          match,
          shooter,
          data.victim,
          damage,
          !!data.head,
          shooter.weapon,
        );
        for (const death of deaths)
          if (death.kind === "kill") {
            death.wallbang = contact.passed;
            death.noScope = weapon.zoomLevels > 1 && !shooter.scope;
            death.appearance = shooter.appearances[shooter.weapon];
          }
        kills.push(...deaths);
      } else if (data.normal) impacts.push({ point: data.point, normal: data.normal });
    }
    events.push(
      {
        kind: "shot",
        shooter: shooter.id,
        from: from.clone(),
        to: from.clone().addScaledVector(direction, result.endDistance),
        weapon: shooter.weapon,
        alternate,
        suppressed: shooter.suppressed,
        pellet,
        impacts,
        hits,
        ...(hits[0] ? { victim: hits[0].victim, headshot: hits.some((hit) => hit.headshot) } : {}),
        ...(impacts[0] ? { normal: impacts[0].normal } : {}),
      },
      ...kills,
    );
  }
  applyFiringInaccuracy(memory.accuracy[shooter.weapon], shooter.weapon, mode);
  applyWeaponRecoil(memory.punch, memory.recoil[shooter.weapon], shooter.weapon, mode);
  return events;
}
