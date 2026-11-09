import * as T from "three";
import type { Game } from "../src/game";
import { MapCollision } from "../src/map-collision";
import { resetSoldier } from "../src/soldier";
import { soldierHitboxes } from "../src/soldier-hitboxes";
import { createAimPunch, createWeaponRecoil } from "../src/recoil";
import { movement } from "../src/physics";

// Isolated physical range for weapon contracts, independent of native map
// spawn changes. Actor hit volumes, bullets, reloads and life timers stay real.
export function weaponLaneFixture(game: Game) {
  const floor = new T.Mesh(new T.BoxGeometry(100, 0.5, 100), new T.MeshBasicMaterial());
  floor.position.y = -0.25;
  floor.updateMatrixWorld(true);
  game.world = { ...game.dust!, collision: new MapCollision([floor]), walls: [], solids: [floor] };
  game.position.set(-17, 0, 17);
  game.eye = movement.standingEye;
  game.velocity.x = game.velocity.z = game.vertical = 0;
  game.grounded = true;
  // Hold the test targets still while leaving normal bot respawn timers active.
  game.moveBots = () => {};
  for (const bot of game.bots) {
    bot.health = 0;
    bot.respawn = Infinity;
    bot.group.visible = false;
  }
  // Center dispersion: these contracts test hit volumes/penetration, not aiming.
  Math.random = () => 0;
}
export function placeWeaponTarget(game: Game, index: number, x: number, y: number, z: number) {
  const bot = game.bots[index];
  resetSoldier(bot.rig);
  bot.group.position.set(x, y, z);
  bot.group.rotation.set(0, 0, 0);
  bot.facing = 0;
  bot.health = 100;
  bot.armor = 0;
  bot.helmet = false;
  bot.spawnProtection = 0;
  bot.respawn = Infinity;
  bot.speed = bot.anim = 0;
  bot.velocity.set(0, 0);
  bot.rig.moveX = bot.rig.moveZ = 0;
  bot.group.visible = bot.rig.model.visible = true;
  bot.group.updateMatrixWorld(true);
}
export function weaponHitboxPoint(game: Game, index: number, group: 1 | 2) {
  const rig = game.bots[index].rig;
  rig.group.updateMatrixWorld(true);
  const box = soldierHitboxes(rig).find((capsule) => capsule.group === group)!;
  return box.start.clone().add(box.end).multiplyScalar(0.5).applyMatrix4(box.bone.matrixWorld);
}
export function aimWeaponAt(game: Game, point: T.Vector3) {
  const direction = point.clone().sub(game.position);
  direction.y -= game.eye;
  game.yaw = -Math.atan2(direction.x, -direction.z);
  game.pitch = Math.atan2(direction.y, Math.hypot(direction.x, direction.z));
  game.aimPunch = createAimPunch();
  game.weaponRecoil[game.selected] = createWeaponRecoil();
  game.weaponAccuracy[game.selected] = { penalty: 0, mode: 1 };
}
