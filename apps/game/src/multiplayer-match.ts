import * as T from "three";
import { neutralInput, type Input, type MatchMode, type ServerMessage } from "@cs2go/protocol";
import { MatchConnection } from "./multiplayer-connection";
import type { Game } from "./game";
import { weapons, movement } from "./physics";
import { createWeaponInstance } from "./weapon-instance";
import { bindWeaponInstance } from "./skins";
import { setSoldierWeapon, disposeSoldier, resetSoldier, stepSoldierRagdoll } from "./soldier";
import { showRoundBanner, hideRoundBanner } from "./round-banner";
import { playerName } from "./player-profile";

type Bot = Game["bots"][number];
export class MultiplayerMatch {
  connection: MatchConnection;
  request = neutralInput();
  applying = false;
  private peers = new Map<string, Bot>();
  private peerSpawns = new Map<string, number>();
  private lastSpawn = 0;
  private resultRound = 0;
  private closed = false;
  private health = 100;
  private beep = 0;
  private finished = false;
  constructor(privateGame: Game, url: string, room: string, password: string, mode: MatchMode) {
    this.game = privateGame;
    const world = privateGame.dust!;
    this.connection = new MatchConnection(
      url,
      room,
      playerName() === "YOU" ? "PLAYER" : playerName(),
      mode,
      privateGame.team,
      {
        collision: world.collision,
        spawns: world.navigation.data.spawns,
        spawnAngles: world.navigation.data.spawnAngles,
        bombDamage: world.bombDamage,
      },
      password,
      (message) => this.receive(message),
      (reason) => {
        if (this.closed) return;
        this.closed = true;
        this.game.network = undefined;
        this.game.menu();
        document.getElementById("match-status")!.textContent = reason;
        document.getElementById("multiplayer-options")!.hidden = false;
      },
    );
  }
  private game: Game;
  disconnect() {
    if (this.closed) return;
    this.closed = true;
    this.connection.close();
    this.peers.clear();
  }
  buy(index: number) {
    if (!this.game.canBuy() || !Number.isInteger(index) || !weapons[index]) return false;
    this.request.buy = index;
    return true;
  }
  equipment(kind: "kevlar" | "helmet" | "kit") {
    if (!this.game.canBuy()) return false;
    this.request.equipment = kind === "kevlar" ? "vest" : kind;
    return true;
  }
  private receive(message: ServerMessage) {
    if (message.type === "error") {
      this.game.notices.showAlert(message.message);
      return;
    }
    if (message.type !== "snapshot" || !this.connection.local) return;
    const g = this.game,
      local = this.connection.local,
      state = message.round;
    const previousTeam = g.team;
    g.team = local.team;
    g.round = state.round;
    g.teamScores = { ...state.scores };
    g.freezeTime = state.phase === "freeze" ? state.remaining : 0;
    g.buyRemaining = state.buyRemaining;
    g.time = state.remaining;
    g.roundPause = ["post", "halftime", "finished"].includes(state.phase)
      ? Math.max(0.01, state.pause)
      : 0;
    g.roundElapsed = state.elapsed;
    const peerIds = new Set(message.players.filter((p) => p.id !== local.id).map((p) => p.id));
    for (const [id, bot] of this.peers)
      if (!peerIds.has(id) || message.players.find((p) => p.id === id)?.team !== bot.team) {
        g.scene.remove(bot.group);
        disposeSoldier(bot.rig);
        this.peers.delete(id);
        this.peerSpawns.delete(id);
      }
    for (const player of message.players)
      if (player.id !== local.id) {
        let bot = this.peers.get(player.id);
        if (!bot) {
          bot = g.makeBot(this.peers.size, player.team);
          this.peers.set(player.id, bot);
        }
        const previousSpawn = this.peerSpawns.get(player.id);
        if (previousSpawn !== player.spawn) {
          resetSoldier(bot.rig);
          bot.group.visible = player.health > 0;
          this.peerSpawns.set(player.id, player.spawn);
        } else if (bot.health > 0 && player.health <= 0) {
          // Capture the final authoritative pose once; the corpse then owns its transform.
          bot.group.position.set(player.x, player.y, player.z);
          bot.group.rotation.y = player.yaw + Math.PI;
          bot.group.visible = true;
        }
        bot.name = player.name;
        bot.health = player.health;
        bot.armor = player.armor;
        bot.helmet = player.helmet;
        bot.defuseKit = player.kit;
        bot.kills = player.kills;
        bot.deaths = player.deaths;
        bot.money = player.money;
        bot.ammo = player.ammo;
        bot.reserve = player.reserve;
        bot.reloadTime = player.reloadTime;
        bot.respawn = player.health > 0 ? 0 : Infinity;
        if (bot.rig.weaponIndex !== player.weapon)
          setSoldierWeapon(
            bot.rig,
            player.weapon,
            weapons[player.weapon].suppressed,
            createWeaponInstance(player.weapon, player.id),
          );
      }
    g.bots = [...this.peers.values()];
    g.mvpCounts.set("player", local.mvps);
    g.bots.forEach((bot, index) =>
      g.mvpCounts.set(index, message.players.find((p) => this.peers.get(p.id) === bot)?.mvps ?? 0),
    );
    g.primary = local.primary;
    g.secondary = local.secondary;
    g.knife = 4;
    g.health = local.health;
    g.dead = local.health > 0 ? 0 : Infinity;
    g.armor = local.armor;
    g.helmet = local.helmet;
    g.defuseKit = local.kit;
    g.money = local.money;
    g.kills = local.kills;
    g.deaths = local.deaths;
    for (const [index, ammo] of Object.entries(local.magazines))
      g.magazines[Number(index)] = { ...ammo };
    if (local.spawn !== this.lastSpawn) {
      this.lastSpawn = local.spawn;
      g.yaw = local.yaw;
      g.pitch = -local.pitch;
      g.setScope(0);
      g.spectated = undefined;
      g.notices.reset();
      g.deathBannerUntil = 0;
      document.getElementById("death-banner")!.classList.add("hidden");
      g.groundInventory.reset(false);
      hideRoundBanner();
    }
    if (
      g.selected !== local.weapon ||
      previousTeam !== local.team ||
      g.gun.userData.networkSpawn !== local.spawn
    ) {
      this.applying = true;
      g.equip(local.weapon);
      this.applying = false;
      bindWeaponInstance(g.gun, createWeaponInstance(local.weapon, local.id));
      g.gun.userData.networkSpawn = local.spawn;
    }
    g.ammo = local.ammo;
    g.reserve = local.reserve;
    g.cooldown = local.cooldown;
    g.reload = local.reloadTime;
    g.drawTime = Math.min(g.drawTime, local.cooldown);
    const indexFor = (id: string | null) =>
      id === local.id ? ("player" as const) : id ? g.bots.indexOf(this.peers.get(id)!) : -1;
    const bomb = state.bomb;
    g.bomb = {
      position: new T.Vector3(bomb.x, bomb.y, bomb.z),
      planted: bomb.planted,
      timer: bomb.timer,
      progress: bomb.progress,
      defuser: bomb.defuser ? indexFor(bomb.defuser) : null,
      carrier: indexFor(bomb.carrier),
      planter: bomb.planter ? indexFor(bomb.planter) : undefined,
      plantProgress: bomb.plantProgress,
      beepRemaining: 1,
      beepPulse: 0,
    };
    g.bombMesh.visible = state.phase !== "waiting" && (bomb.planted || !bomb.carrier);
    g.bombMesh.position.set(bomb.x, bomb.y + 0.005, bomb.z);
    if (local.health < this.health) g.damage = 0.3;
    this.health = local.health;
    for (const event of message.events) {
      if (event.kind === "shot") {
        if (event.shooter === local.id) {
          g.shotTime = 0.15;
          g.kick = 0.08;
          g.lastShot = local.ammo === 0;
          g.sound("shot");
        } else {
          const peer = this.peers.get(event.shooter);
          if (peer) {
            peer.rig.shotTime = 0.25;
            g.worldSound(
              "bot",
              new T.Vector3(event.from.x, event.from.y, event.from.z),
              event.weapon,
            );
          }
        }
        g.trace(
          new T.Vector3(event.from.x, event.from.y, event.from.z),
          new T.Vector3(event.to.x, event.to.y, event.to.z),
          event.weapon,
        );
      } else if (event.kind === "kill") {
        const killer =
          event.killer === local.id ? "YOU" : (this.peers.get(event.killer)?.name ?? event.killer);
        const victim =
          event.victim === local.id ? "YOU" : (this.peers.get(event.victim)?.name ?? event.victim);
        g.feed(killer, victim, event.headshot, event.weapon);
      } else if (event.kind === "plant") {
        g.notices.showBombPlanted(bomb.timer);
        g.soundscape.play("bomb-plant", false, "concrete", g.bomb.position);
      } else if (event.kind === "defuse")
        g.soundscape.play("bomb-defuse", false, "concrete", g.bomb.position);
      else if (event.kind === "explode")
        g.soundscape.play("bomb-explode", false, "concrete", g.bomb.position);
    }
    if (state.result && this.resultRound !== state.round) {
      this.resultRound = state.round;
      g.notices.clearAlert();
      if (state.result.reason === "Bomb defused") g.notices.completeAction("defuse");
      showRoundBanner(
        state.result.winner,
        g.team,
        state.result.reason,
        state.result.mvp,
        state.result.fact,
      );
      g.roundHistory.push({ winner: state.result.winner, reason: state.result.reason });
      g.soundscape.playMusic(state.result.winner === g.team ? "win" : "lose");
    }
    g.notices.setWaiting(state.phase === "waiting");
    if (state.phase === "waiting") hideRoundBanner();
    if (state.phase === "finished" && !this.finished) {
      this.finished = true;
      g.finish();
    }
    g.updateUI();
  }
  simulate(dt: number) {
    const g = this.game;
    const base = neutralInput();
    const locked = g.locked && !g.dead;
    const input: Omit<Input, "seq"> = {
      ...base,
      ...this.request,
      forward: locked ? Number(g.keys.has("KeyW")) - Number(g.keys.has("KeyS")) : 0,
      right: locked ? Number(g.keys.has("KeyD")) - Number(g.keys.has("KeyA")) : 0,
      yaw: Math.atan2(Math.sin(g.yaw), Math.cos(g.yaw)),
      pitch: -g.pitch,
      jump: locked && (g.jumpQueued || (g.settings.autoBunnyhop && g.keys.has("Space"))),
      duck: locked && (g.keys.has("ControlLeft") || g.keys.has("KeyC")),
      walk: locked && g.keys.has("ShiftLeft"),
      // Preserve a short click even if press/release both precede this frame.
      fire: locked && (g.firing || this.request.fire),
      use: locked && g.keys.has("KeyE"),
    };
    this.connection.step(input);
    this.request = neutralInput();
    g.jumpQueued = false;
    const local = this.connection.local;
    if (!local) return;
    g.position.set(local.x, local.y, local.z);
    g.velocity.x = local.vx;
    g.velocity.z = local.vz;
    g.vertical = local.vertical;
    g.grounded = local.grounded;
    g.eye = local.eye;
    g.damage = Math.max(0, g.damage - dt);
    g.hit = Math.max(0, g.hit - dt);
    g.kick = Math.max(0, g.kick - dt);
    g.shotTime = Math.max(0, g.shotTime - dt);
    g.drawTime = Math.max(0, g.drawTime - dt);
    g.weaponTime += dt;
    g.animationTime += dt;
    g.sway += Math.hypot(local.vx, local.vz) * dt * 1.8;
    for (const [id, bot] of this.peers) {
      if (bot.health <= 0) {
        if (bot.group.visible) {
          stepSoldierRagdoll(bot.rig, bot.vertical, dt, g.world);
          bot.anim += dt;
        }
        continue;
      }
      const history = this.connection.history,
        target = performance.now() - 100;
      let before = history[0],
        after = history.at(-1)!;
      for (let i = 1; i < history.length; i++)
        if (history[i].at >= target) {
          before = history[i - 1];
          after = history[i];
          break;
        }
      const a = before.players.find((p) => p.id === id),
        b = after.players.find((p) => p.id === id);
      if (!a || !b) continue;
      const t =
        a.spawn === b.spawn
          ? T.MathUtils.clamp((target - before.at) / Math.max(1, after.at - before.at), 0, 1)
          : 1;
      bot.group.position.set(
        T.MathUtils.lerp(a.x, b.x, t),
        T.MathUtils.lerp(a.y, b.y, t),
        T.MathUtils.lerp(a.z, b.z, t),
      );
      bot.group.rotation.y = b.yaw + Math.PI;
      bot.group.visible = true;
      bot.vertical = b.vertical;
      bot.velocity.set(b.vx, b.vz);
      bot.speed = Math.hypot(b.vx, b.vz);
      bot.anim += dt;
      bot.rig.moveX = b.vx * Math.cos(bot.group.rotation.y) - b.vz * Math.sin(bot.group.rotation.y);
      bot.rig.moveZ = b.vx * Math.sin(bot.group.rotation.y) + b.vz * Math.cos(bot.group.rotation.y);
      bot.rig.crouch = (movement.standingEye - b.eye) / (movement.standingEye - movement.duckEye);
      bot.rig.airborne = !b.grounded;
    }
    if (!g.dead) g.updateAimCamera();
    else if (g.spectatorMode === "free") g.moveSpectator(dt);
    if (g.bomb?.planted && this.connection.round?.phase === "live") {
      this.beep -= dt;
      if (this.beep <= 0) {
        g.soundscape.play("bomb-beep", false, "concrete", g.bomb.position);
        this.beep = 0.15 + (0.85 * g.bomb.timer) / 40;
        g.bomb.beepPulse = 0.08;
      }
    }
    g.notices.tick(dt);
  }
}
