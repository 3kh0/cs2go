import * as T from "three";
import type { Game } from "../src/game";
import { movement } from "../src/physics";

/** Only initial placement is synthetic. Native collision, input, attacks, timers,
 * audio and all subsequent traversal stay on the real fixed-step game path. */
export function placeAtNativeBreakable(id: string, distance = 1.15) {
  const g = window.__game;
  const definition = g.world.breakables.definitions.find((record) => record.id === id)!;
  if (!definition) throw new Error(`Missing native breakable ${id}`);
  const [lo, hi] = definition.bounds;
  const axis = hi[0] - lo[0] < hi[2] - lo[2] ? 0 : 2;
  const tangent = axis === 0 ? 2 : 0;
  const center = new T.Vector3()
    .fromArray(lo)
    .add(new T.Vector3().fromArray(hi))
    .multiplyScalar(0.5);
  const failures = [];
  for (const side of [1, -1])
    for (const fraction of [0.5, 0.4, 0.6, 0.3, 0.7]) {
      const position = center.clone();
      position.setComponent(axis, center.getComponent(axis) + side * distance);
      position.setComponent(tangent, lo[tangent] + (hi[tangent] - lo[tangent]) * fraction);
      const floor = g.world.collision.support(
        position.x,
        position.z,
        lo[1] + 0.6,
        lo[1] - 4,
        movement.hullRadius,
      );
      if (!Number.isFinite(floor)) {
        failures.push({ side, fraction, floor: "missing" });
        continue;
      }
      position.y = floor + 0.003;
      if (
        g.world.collision.blocked(
          position.x,
          position.z,
          position.y,
          movement.hullRadius,
          movement.standingHeight,
        )
      ) {
        failures.push({ side, fraction, floor, blocked: true });
        continue;
      }
      const eye = position.clone().add(new T.Vector3(0, movement.standingEye, 0));
      const target = center.clone();
      target.setComponent(tangent, position.getComponent(tangent));
      target.y = T.MathUtils.clamp(eye.y, lo[1] + 0.15, hi[1] - 0.15);
      const delta = target.clone().sub(eye);
      const first = g.world.collision.intersections(
        new T.Ray(eye, delta.clone().normalize()),
        delta.length() + 0.2,
      )[0];
      if (!first || g.world.breakables.idForImpact(first) !== id) {
        failures.push({ side, fraction, floor, hit: first?.object.name });
        continue;
      }
      g.keys.clear();
      g.position.copy(position);
      g.eye = movement.standingEye;
      g.velocity.x = g.velocity.z = 0;
      g.vertical = 0;
      g.grounded = true;
      g.yaw = Math.atan2(-delta.x, -delta.z);
      g.pitch = Math.atan2(delta.y, Math.hypot(delta.x, delta.z));
      g.updateAimCamera(1);
      const beyond = target.clone();
      beyond.setComponent(axis, center.getComponent(axis) - side * 0.25);
      return {
        id,
        axis,
        side,
        center: center.toArray(),
        start: position.toArray(),
        eye: eye.toArray(),
        target: target.toArray(),
        beyond: beyond.toArray(),
        first: g.world.breakables.idForImpact(first),
        floor,
        yaw: g.yaw,
        pitch: g.pitch,
      };
    }
  throw new Error(`No natural clear approach for ${id}: ${JSON.stringify(failures)}`);
}

export function nativeBreakableStatus(id: string) {
  const g = window.__game;
  const definition = g.world.breakables.definitions.find((record) => record.id === id)!;
  const names = new Set(definition.renderNames);
  const parts: { name: string; visible: boolean }[] = [];
  const staticFrames: { name: string; visible: boolean }[] = [];
  g.world.scenery.traverse((object) => {
    if (names.has(object.name)) parts.push({ name: object.name, visible: object.visible });
    if (object.name.includes("wall_hole_diffuse"))
      staticFrames.push({ name: object.name, visible: object.visible });
  });
  const remainder = g.world.breakableView.manifest.enabledRemainders
    ?.flatMap((record) => record.renderNames)
    .map((name) => ({ name, visible: g.world.scenery.getObjectByName(name)?.visible }));
  return {
    health: g.world.breakables.health(id),
    parts,
    staticFrames,
    remainder,
    debris: g.world.breakableView.root.children.length,
    position: g.position.toArray(),
    cooldown: g.cooldown,
    knifePending: g.knifePending,
    selected: g.selected,
    ammo: g.ammo,
    lastCue: g.soundscape.lastCue,
  };
}

export function nativeCoverClear(from: number[], to: number[]) {
  return window.__game.world.collision.visible(
    new T.Vector3().fromArray(from),
    new T.Vector3().fromArray(to),
  );
}

export function nativeBreakAudio() {
  const soundscape = window.__game.soundscape;
  return {
    context: soundscape.context?.state,
    clips: [...soundscape.buffers]
      .filter(([name]) => name.startsWith("map-break-"))
      .map(([name, buffer]) => ({
        name,
        samples: buffer.length,
        duration: buffer.duration,
        nonzero: buffer.getChannelData(0).some((value) => Math.abs(value) > 0.00001),
      })),
  };
}
let botFixture:
  | {
      id: string;
      bot: Game["bots"][number];
      ammo: number;
      maxStuck: number;
      maxShot: number;
      restore: () => void;
    }
  | undefined;

export function startNativeBotObstruction(id: string) {
  const g = window.__game;
  const player = g.position.clone();
  const setup = placeAtNativeBreakable(id);
  const bot = g.bots[0];
  if (!bot) throw new Error("Native bot fixture requires the real practice roster");
  g.spawnBot(bot, 0);
  bot.group.position.fromArray(setup.start);
  bot.group.userData.groundY = setup.floor;
  const goal = bot.group.position.clone();
  goal.setComponent(setup.axis, setup.center[setup.axis] - setup.side * 1.4);
  const floor = g.world.collision.support(goal.x, goal.z, setup.floor + 0.6, setup.floor - 5, 0.35);
  if (!Number.isFinite(floor)) throw new Error("Native bot route has no far-side support");
  goal.y = floor;
  bot.path = [goal];
  bot.goal.copy(goal);
  bot.moving = true;
  bot.velocity.set(0, 0);
  bot.vertical = 0;
  bot.shot = 0;
  bot.stuck = bot.progressTime = 0;
  bot.progressPosition.copy(bot.group.position);
  bot.navArea = g.world.navigation.nearest(bot.group.position);
  bot.tracking = false;
  g.utility.botInventories.clear();
  // Keep the player out of the firing lane and native actor collision. This is
  // the initial fixture setup, before any movement or obstruction damage.
  g.position.copy(player);
  g.updateAimCamera(1);
  const planner = g.updateBots.bind(g);
  botFixture = {
    id,
    bot,
    ammo: bot.ammo,
    maxStuck: 0,
    maxShot: 0,
    restore: () => {
      g.updateBots = planner;
    },
  };
  // Freeze only unrelated tactical planning. The normal 128 Hz simulate and
  // moveBots paths remain live; actual combat cooldowns retain their 16 Hz step.
  g.updateBots = (dt, phase) => {
    if (phase !== 0 || !botFixture) return;
    botFixture.maxStuck = Math.max(botFixture.maxStuck, bot.stuck);
    botFixture.maxShot = Math.max(botFixture.maxShot, bot.shot);
    g.botCombat(bot, undefined, dt);
  };
  return { ...setup, ammo: bot.ammo, goal: goal.toArray() };
}
export function nativeBotObstructionStatus() {
  if (!botFixture) throw new Error("No native bot obstruction fixture");
  return {
    health: window.__game.world.breakables.health(botFixture.id),
    position: botFixture.bot.group.position.toArray(),
    spent: botFixture.ammo - botFixture.bot.ammo,
    stuck: botFixture.maxStuck,
    cooldown: botFixture.maxShot,
  };
}
export function stopNativeBotObstruction() {
  botFixture?.restore();
  botFixture = undefined;
}
