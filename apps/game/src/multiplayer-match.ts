import * as T from "three";
import { neutralInput, type Input, type MatchMode, type ServerMessage } from "@cs2go/protocol";
import { MatchConnection } from "./multiplayer-connection";
import type { Game } from "./game";
import { weapons, movement, isKnife } from "./physics";
import { createWeaponInstance } from "./weapon-instance";
import { bindWeaponInstance, skinChoices } from "./skins";
import { advanceAimPunch, RECOIL_VIEW_SCALE } from "./recoil";
import { advanceWeaponAccuracy } from "./accuracy";
import { selectedAgentId, acquireAgentAppearance } from "./agent-roster";
import { setSoldierWeapon, disposeSoldier, resetSoldier, stepSoldierRagdoll } from "./soldier";
import { showRoundBanner, hideRoundBanner } from "./round-banner";
import { playerName, playerProfile } from "./player-profile";
import { createWorldGun, disposeWorldGun, weaponDrawDuration } from "./weapons";
import { grenadeData } from "./utility";
import { nativeShotDuration } from "./weapon-motion";

type Bot = Game["bots"][number];
export class MultiplayerMatch {
  connection: MatchConnection;
  request = neutralInput();
  applying = false;
  private drops = new Map<number, T.Group>();
  private peers = new Map<string, Bot>();
  private peerAgents = new Map<string, string>();
  private peerSpawns = new Map<string, number>();
  private lastSpawn = 0;
  private previousPhase = "waiting";
  private resultRound = 0;
  private closed = false;
  private health = 100;
  private beep = 0;
  private finished = false;
  private stepDistance = 0;
  private spectatingView = false;
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
        grenadeCollision: world.grenadeCollision,
      },
      password,
      (message) => this.receive(message),
      (reason) => {
        if (this.closed) return;
        this.disconnect();
        this.game.network = undefined;
        this.game.menu();
        document.getElementById("match-status")!.textContent = reason;
        document.getElementById("multiplayer-options")!.hidden = false;
      },
      {
        profile: this.profileConfiguration(),
        skins: Object.fromEntries(skinChoices.map((skin, index) => [index, { ...skin }])),
        agents: { ct: selectedAgentId("ct"), t: selectedAgentId("t") },
        loadouts: privateGame.groundInventory.loadouts,
        knife: privateGame.knife,
      },
    );
    for (const event of [
      "cs2go-skins-change",
      "cs2go-agent-selection",
      "cs2go-loadouts-change",
      "cs2go-profile-change",
    ])
      window.addEventListener(event, this.configurationChanged);
  }
  private profileConfiguration() {
    return {
      name: (playerName() === "YOU" ? "PLAYER" : playerName()).slice(0, 24),
      avatar: playerProfile()?.publicAvatar ?? null,
    };
  }
  private configurationChanged = () => {
    if (this.connection.socket.readyState === WebSocket.OPEN)
      this.connection.socket.send(
        JSON.stringify({
          type: "configure",
          configuration: {
            profile: this.profileConfiguration(),
            skins: Object.fromEntries(skinChoices.map((skin, index) => [index, { ...skin }])),
            agents: { ct: selectedAgentId("ct"), t: selectedAgentId("t") },
            loadouts: this.game.groundInventory.loadouts,
          },
        }),
      );
  };
  private game: Game;
  disconnect() {
    if (this.closed) return;
    this.closed = true;
    for (const event of [
      "cs2go-skins-change",
      "cs2go-agent-selection",
      "cs2go-loadouts-change",
      "cs2go-profile-change",
    ])
      window.removeEventListener(event, this.configurationChanged);
    this.game.groundInventory.drops = [];
    this.connection.close();
    this.peers.clear();
    for (const mesh of this.drops.values()) disposeWorldGun(mesh);
    this.drops.clear();
  }
  buy(index: number) {
    if (
      (!isKnife(index) && !this.game.canBuy()) ||
      this.game.dead ||
      !Number.isInteger(index) ||
      !weapons[index]
    )
      return false;
    this.request.buy = index;
    return true;
  }
  equipment(kind: "kevlar" | "helmet" | "kit") {
    if (!this.game.canBuy()) return false;
    this.request.equipment = kind === "kevlar" ? "vest" : kind;
    return true;
  }
  stateForBot(bot: Bot) {
    const id = [...this.peers].find(([, peer]) => peer === bot)?.[0];
    return this.connection.players.find((player) => player.id === id);
  }
  private receive(message: ServerMessage) {
    if (this.closed) return;
    if (message.type === "error") {
      this.game.notices.showAlert(message.message);
      return;
    }
    if (message.type !== "snapshot" || !this.connection.local) return;
    const g = this.game,
      local = this.connection.local,
      state = message.round;
    const previousTeam = g.team;
    if (this.previousPhase === "freeze" && state.phase === "live") g.soundscape.playMusic(null);
    this.previousPhase = state.phase;
    const previousBombTime = g.bomb?.timer ?? 40;
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
    if (g.dust?.ball.mesh) {
      g.dust.ball.mesh.position.set(state.ball.x, state.ball.y, state.ball.z);
      g.dust.ball.mesh.quaternion.set(state.ball.qx, state.ball.qy, state.ball.qz, state.ball.qw);
    }
    const peerIds = new Set(message.players.filter((p) => p.id !== local.id).map((p) => p.id));
    for (const [id, bot] of this.peers)
      if (!peerIds.has(id) || message.players.find((p) => p.id === id)?.team !== bot.team) {
        g.scene.remove(bot.group);
        disposeSoldier(bot.rig);
        this.peers.delete(id);
        this.peerSpawns.delete(id);
        this.peerAgents.delete(id);
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
        if (this.peerAgents.get(player.id) !== player.agent) {
          this.peerAgents.set(player.id, player.agent);
          if (!player.agent.startsWith("default-"))
            void acquireAgentAppearance(player.agent)
              .then((appearance) => {
                const current = this.peers.get(player.id);
                if (!appearance) return;
                if (
                  !current ||
                  this.closed ||
                  this.peerAgents.get(player.id) !== player.agent ||
                  current.health <= 0
                ) {
                  appearance.release();
                  return;
                }
                const replacement = g.makeBot(g.bots.indexOf(current), player.team, appearance);
                replacement.group.position.copy(current.group.position);
                replacement.group.rotation.copy(current.group.rotation);
                g.scene.remove(current.group);
                disposeSoldier(current.rig);
                current.group = replacement.group;
                current.rig = replacement.rig;
              })
              .catch(() => {});
        }
        bot.name = player.name;
        bot.health = player.health;
        bot.armor = player.armor;
        bot.helmet = player.helmet;
        bot.defuseKit = player.kit;
        bot.kills = player.kills;
        bot.deaths = player.deaths;
        bot.money = player.money;
        Object.assign(bot.aimPunch, player.punch);
        bot.recoilWeapon = player.weapon;
        bot.ammo = player.ammo;
        bot.reserve = player.reserve;
        bot.reloadTime = player.reloadTime;
        bot.respawn = player.health > 0 ? 0 : Infinity;
        if (
          bot.rig.weaponIndex !== player.weapon ||
          bot.rig.suppressed !== player.suppressed ||
          bot.rig.weaponInstance.serial !== player.appearances[player.weapon]?.serial
        )
          setSoldierWeapon(
            bot.rig,
            player.weapon,
            player.suppressed,
            player.appearances[player.weapon] ?? createWeaponInstance(player.weapon, player.id),
          );
        bot.rig.weapon.visible = player.health > 0;
      }
    g.bots = [...this.peers.values()];
    g.utility.syncNetwork(state, message.players, local.id);
    g.mvpCounts.set("player", local.mvps);
    g.bots.forEach((bot, index) =>
      g.mvpCounts.set(index, message.players.find((p) => this.peers.get(p.id) === bot)?.mvps ?? 0),
    );
    g.groundInventory.instances = new Map(
      Object.entries(local.appearances).map(([id, appearance]) => [Number(id), appearance]),
    );
    if (local.allowedWeapons.length) g.groundInventory.roundLoadout = [...local.allowedWeapons];
    g.primary = local.primary;
    g.secondary = local.secondary;
    g.groundInventory.sidearmDropped = !local.magazines[local.secondary];
    g.knife = local.knife;
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
      g.soundscape.playMusic(null);
      g.utility.cancelThrow();
      g.utility.selected = null;
      g.utility.blind.clear();
      g.deathBannerUntil = 0;
      document.getElementById("death-banner")!.classList.add("hidden");
      g.groundInventory.reset(false);
      hideRoundBanner();
    }
    if (
      g.selected !== local.weapon ||
      previousTeam !== local.team ||
      g.gun.userData.networkSpawn !== local.spawn ||
      g.gun.userData.networkAppearance !== local.appearances[local.weapon]?.serial
    ) {
      this.applying = true;
      g.equip(local.weapon);
      this.applying = false;
      bindWeaponInstance(
        g.gun,
        local.appearances[local.weapon] ?? createWeaponInstance(local.weapon, local.id),
      );
      g.gun.userData.networkAppearance = local.appearances[local.weapon]?.serial;
      g.gun.userData.networkSpawn = local.spawn;
    }
    Object.assign(g.aimPunch, local.punch);
    g.ammo = local.ammo;
    g.reserve = local.reserve;
    g.cooldown = local.cooldown;
    if (local.reloadTime > 0 && !g.reload && local.reloadPhase === "intro") {
      g.drawTime = g.inspectTime = g.shotTime = 0;
      g.emptyReload = local.reloadEmpty;
      g.animationSounds("reload", -1, 0);
      g.setScope(0);
    }
    g.reload = local.reloadTime;
    g.shellPhase = local.reloadPhase;
    g.emptyReload = local.reloadEmpty;
    if (local.charge > 0 && !g.revolverCharge) g.soundscape.play("revolver-prepare");
    g.revolverCharge = local.charge;
    g.burstRemaining = local.burstRemaining;
    Object.assign(g.weaponAccuracy[local.weapon], local.accuracy);
    g.weaponRecoil[local.weapon].index = local.recoilIndex;
    g.shots = local.recoilIndex;
    const suppressor = g.suppressors[local.weapon];
    suppressor.attached = local.suppressed;
    suppressor.action = local.suppressorAction || null;
    suppressor.elapsed = local.suppressorTime;
    suppressor.duration = local.suppressorDuration;

    const indexFor = (id: string | null) =>
      id === local.id ? ("player" as const) : id ? g.bots.indexOf(this.peers.get(id)!) : -1;
    const bomb = state.bomb;
    if (bomb.planted && previousBombTime > 10 && bomb.timer <= 10)
      g.soundscape.playMusic("bomb-countdown");
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
    if (this.health > 0 && local.health <= 0) {
      g.soundscape.play("death");
      g.firing = false;
      g.reload = g.knifeTime = g.inspectTime = g.boltTime = g.rescope = 0;
      g.setScope(0);
    }
    this.health = local.health;
    for (const event of message.events) {
      if (event.kind === "shot") {
        if (event.shooter === local.id && event.weapon === local.weapon && !event.pellet) {
          g.alternateShot = !!event.alternate;
          g.lastShot = local.ammo === 0;
          if (weapons[event.weapon].unzoomsAfterShot) {
            g.rescope = g.scopeLevel;
            g.setScope(0);
            g.boltTime = weapons[event.weapon].delay;
          }
          g.shotTime = nativeShotDuration(event.weapon, event.alternate, g.lastShot);
          g.weaponTime = g.inspectTime = 0;
          g.drawTime = 0;
          g.kick = 0.07;
          g.sound("shot");
        } else if (!event.pellet) {
          const peer = this.peers.get(event.shooter);
          if (peer) {
            peer.rig.shotTime = 0.25;
            peer.rig.recoil = 1;
            if (g.spectated === peer) {
              g.spectatorShotAt = g.animationTime;
              g.spectatorLastShot = event.weapon === 8 && peer.ammo === 0;
            }
            g.worldSound(
              "bot",
              new T.Vector3(event.from.x, event.from.y, event.from.z),
              event.weapon,
              event.suppressed,
            );
          }
        }
        const end = new T.Vector3(event.to.x, event.to.y, event.to.z);
        const muzzle =
          event.shooter === local.id && event.weapon === local.weapon
            ? g.muzzlePosition()
            : new T.Vector3(event.from.x, event.from.y, event.from.z);
        const remote = this.peers.get(event.shooter);
        const remoteMuzzle = remote?.rig.weapon.userData.muzzle as T.Vector3 | undefined;
        if (remote && remoteMuzzle) remote.rig.weapon.localToWorld(muzzle.copy(remoteMuzzle));
        g.trace(muzzle, end, event.weapon, event.suppressed);
        for (const impact of event.impacts ??
          (event.normal ? [{ point: event.to, normal: event.normal }] : [])) {
          const normal = new T.Vector3(
            impact.normal.x,
            impact.normal.y,
            impact.normal.z,
          ).normalize();
          g.decal(
            new T.Vector3(impact.point.x, impact.point.y, impact.point.z).addScaledVector(
              normal,
              0.01,
            ),
            normal,
          );
        }
        if (event.shooter === local.id && event.victim) {
          g.hit = 0.13;
          g.sound(event.headshot ? "head" : "hit");
          document.getElementById("hitmarker")!.style.color = event.headshot ? "#efac51" : "#fff";
        }
      } else if (event.kind === "melee") {
        const peer = this.peers.get(event.shooter);
        if (event.shooter === local.id && isKnife(local.weapon)) {
          g.knifeStab = event.stab;
          g.knifeAlternate = !g.knifeAlternate;
          g.knifeDuration = event.stab ? 1 : 0.5;
          g.knifeTime = g.knifeDuration;
          if (event.hit) {
            g.hit = 0.13;
            document.getElementById("hitmarker")!.style.color = "#fff";
          }
          g.weaponTime = g.inspectTime = g.drawTime = 0;
          g.soundscape.play(
            event.hit
              ? event.stab
                ? "knife-stab"
                : "knife-hit"
              : g.knifeAlternate
                ? "knife-swing1"
                : "knife-swing2",
          );
        } else if (peer) {
          const previous = peer.group.userData.networkMelee as { alternate: boolean } | undefined;
          peer.group.userData.networkMelee = {
            at: g.animationTime,
            stab: event.stab,
            alternate: !previous?.alternate,
          };
          peer.rig.shotTime = event.stab ? 1 : 0.5;
          g.soundscape.play(
            event.hit ? "knife-hit" : "knife-swing1",
            false,
            "concrete",
            peer.group.position,
          );
        }
      } else if (event.kind === "utility-sound") {
        const point = new T.Vector3(event.point.x, event.point.y, event.point.z);
        if (event.sound === "decoy-shot") g.worldSound("bot", point, event.weapon);
        else
          g.soundscape.play(
            event.sound === "bounce" ? `utility-${event.utility}-bounce` : "utility-decoy-explode",
            false,
            "sand",
            point,
          );
      } else if (event.kind === "kill") {
        const killer =
          event.killer === local.id ? "YOU" : (this.peers.get(event.killer)?.name ?? event.killer);
        const victim =
          event.victim === local.id ? "YOU" : (this.peers.get(event.victim)?.name ?? event.victim);
        g.feed(
          killer,
          victim,
          event.headshot,
          event.weapon,
          !!event.noScope,
          !!event.wallbang,
          event.utility ? grenadeData[event.utility].name : undefined,
          {
            appearance: event.appearance,
            killerTeam: message.players.find((p) => p.id === event.killer)?.team,
            victimTeam: message.players.find((p) => p.id === event.victim)?.team,
          },
        );
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
    const dropIds = new Set(state.drops.map((drop) => drop.id));
    for (const [id, mesh] of this.drops) {
      if (!dropIds.has(id)) {
        disposeWorldGun(mesh);
        this.drops.delete(id);
      }
    }
    for (const drop of state.drops) {
      let mesh = this.drops.get(drop.id);
      if (!mesh) {
        mesh = createWorldGun(drop.weapon, drop.suppressed, drop.appearance);
        this.drops.set(drop.id, mesh);
        g.scene.add(mesh);
      }
      mesh.position.set(drop.x, drop.y, drop.z);
      mesh.rotation.set(drop.rx, drop.yaw, drop.rz + Math.PI / 2);
    }
    g.groundInventory.drops = state.drops.flatMap((drop) => {
      const mesh = this.drops.get(drop.id);
      return mesh
        ? [
            {
              id: drop.weapon,
              instance: drop.appearance,
              ammo: drop.ammo,
              reserve: drop.reserve,
              suppressed: drop.suppressed,
              mesh,
              velocity: new T.Vector3(drop.vx, drop.vy, drop.vz),
              tossed: drop.tossed,
              age: drop.age,
              sleeping: drop.sleeping,
              owner: drop.owner === local.id ? ("player" as const) : indexFor(drop.owner),
            },
          ]
        : [];
    });
    g.updateUI();
  }
  syncSpectatorView() {
    const g = this.game;
    const followed =
      g.dead && g.spectatorMode === "first" && g.spectated
        ? this.stateForBot(g.spectated)
        : undefined;
    if (followed) {
      g.camera.rotation.set(
        -followed.pitch + followed.punch.pitch * RECOIL_VIEW_SCALE,
        followed.yaw + followed.punch.yaw * RECOIL_VIEW_SCALE,
        0,
        "YXZ",
      );
      const weapon = weapons[followed.weapon];
      document.getElementById("crosshair")!.classList.toggle("hidden", weapon.zoomLevels >= 2);
      const fov =
        followed.scope === 2
          ? weapon.zoomFov2
          : followed.scope === 1
            ? weapon.zoomFov1
            : g.settings.fov;
      if (g.camera.fov !== fov) {
        g.camera.fov = fov;
        g.camera.updateProjectionMatrix();
      }
      document
        .getElementById("scope")!
        .classList.toggle("hidden", !(followed.scope && weapon.zoomLevels > 1));
      this.spectatingView = true;
    } else if (this.spectatingView) {
      document
        .getElementById("crosshair")!
        .classList.toggle("hidden", weapons[g.selected].zoomLevels >= 2);
      document.getElementById("scope")!.classList.add("hidden");
      g.camera.fov = g.settings.fov;
      g.camera.updateProjectionMatrix();
      this.spectatingView = false;
    }
  }
  simulate(dt: number) {
    const g = this.game;
    g.utility.update(dt);
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
      duck:
        locked && (g.keys.has("ControlLeft") || g.keys.has("ControlRight") || g.keys.has("KeyC")),
      walk: locked && (g.keys.has("ShiftLeft") || g.keys.has("ShiftRight")),
      // Preserve a short click even if press/release both precede this frame.
      fire:
        locked && !g.utility.selected && !g.utility.throwingKind && (g.firing || this.request.fire),
      alternate: locked && this.request.alternate,
      burst: g.burstMode,
      utility: g.utility.selected ?? "",
      scope: g.scopeLevel,
      use: locked && g.keys.has("KeyE"),
    };
    const grounded = this.connection.local?.grounded;
    if (this.connection.step(input)) {
      this.request = neutralInput();
      g.jumpQueued = false;
    }
    const local = this.connection.local;
    if (!local) return;
    if (grounded && !local.grounded && local.vertical > 0) g.soundscape.play("jump");
    if (grounded === false && local.grounded) g.soundscape.play("land");
    if (local.grounded && Math.hypot(local.vx, local.vz) > 1.5 && !input.walk && !input.duck) {
      this.stepDistance += Math.hypot(local.vx, local.vz) * dt;
      if (this.stepDistance >= 1.8) {
        this.stepDistance %= 1.8;
        g.sound("step");
      }
    } else this.stepDistance = 0;
    g.position.set(local.x, local.y, local.z);
    g.velocity.x = local.vx;
    g.velocity.z = local.vz;
    g.vertical = local.vertical;
    g.grounded = local.grounded;
    g.eye = local.eye;
    g.damage = Math.max(0, g.damage - dt);
    g.hit = Math.max(0, g.hit - dt);
    g.kick = Math.max(0, g.kick - dt);
    if (g.shotTime > 0 && !isKnife(g.selected)) {
      const duration = nativeShotDuration(g.selected, false, g.lastShot);
      g.animationSounds(
        "shoot1",
        1 - g.shotTime / duration,
        1 - Math.max(0, g.shotTime - dt) / duration,
      );
    }
    g.shotTime = Math.max(0, g.shotTime - dt);
    if (!g.shotTime) g.lastShot = false;
    if (g.drawTime > 0) {
      const before = 1 - g.drawTime / weaponDrawDuration(g.selected);
      g.drawTime = Math.max(0, g.drawTime - dt);
      g.animationSounds("draw", before, 1 - g.drawTime / weaponDrawDuration(g.selected));
    }
    g.knifeTime = Math.max(0, g.knifeTime - dt);
    g.inspectTime = Math.max(0, g.inspectTime - dt);
    if (g.reload > 0) {
      const before = g.reloadProgress();
      g.reload = Math.max(0, g.reload - dt);
      g.animationSounds("reload", before, g.reloadProgress());
    }
    if (g.suppressors[g.selected].action) {
      const action = g.suppressors[g.selected];
      const before = action.progress;
      action.elapsed = Math.min(action.duration, action.elapsed + dt);
      g.animationSounds(action.action!, before, action.progress);
    }
    if (g.boltTime > 0) {
      const before = g.boltTime;
      g.boltTime = Math.max(0, g.boltTime - dt);
      g.animationSounds(
        "shoot1",
        1 - before / weapons[g.selected].delay,
        1 - g.boltTime / weapons[g.selected].delay,
      );
      if (!g.boltTime && g.rescope) {
        g.setScope(g.rescope);
        g.rescope = 0;
      }
    }
    if (g.scopeTransition > 0) {
      g.scopeTransition = Math.max(0, g.scopeTransition - dt);
      g.camera.fov =
        g.scopeTarget + ((g.scopeFrom - g.scopeTarget) * g.scopeTransition) / g.scopeDuration;
      g.camera.updateProjectionMatrix();
    }
    if (!g.drawTime && !g.knifeTime && !g.inspectTime) g.weaponTime += dt;
    g.animationTime += dt;
    advanceAimPunch(g.aimPunch, dt);
    advanceWeaponAccuracy(
      g.weaponAccuracy[g.selected],
      g.selected,
      g.weaponRecoil[g.selected].index,
      g.crouching,
      dt,
      g.playerAccuracyPose(g.selected),
    );
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
    else g.spectate();
    this.syncSpectatorView();
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
