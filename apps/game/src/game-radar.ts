import * as T from "three";
import type { Game } from "./game";
import {
  RadarContacts,
  type RadarFrame,
  type RadarPlayer,
  type RadarSighting,
  type RadarMarker,
} from "./radar-state";

/** Spotting uses bounded 16 Hz cone/occlusion samples, not access to hidden live positions.
 * This is a browser visibility policy; Source2's private spotting routine is not exported. */
export class GameRadar {
  readonly contacts = new RadarContacts();
  private sampledAt = -Infinity;
  private frame: RadarFrame = { markers: [] };
  private lastBomb?: RadarFrame["bomb"];
  private knowledgeKey = "";
  private previous: RadarFrame = { markers: [] };
  private previousAt = -Infinity;
  reset() {
    this.contacts.reset();
    this.sampledAt = -Infinity;
    this.frame = { markers: [] };
    this.lastBomb = undefined;
    this.knowledgeKey = "";
    this.previous = { markers: [] };
    this.previousAt = -Infinity;
  }
  sample(game: Game, now: number) {
    const follow = game.dead && game.teamMode ? game.spectated : undefined;
    const observer = {
      id: follow ? game.bots.indexOf(follow) : "player",
      team: follow?.team ?? game.team,
      position: follow?.group.position ?? game.position,
      yaw: follow ? Math.PI + follow.group.rotation.y : game.yaw,
      alive: follow ? follow.health > 0 : !game.dead,
    };
    const unrestricted =
      !!game.dead &&
      game.teamMode &&
      !game.competitive &&
      game.settings?.radarSpectatorAll === true;
    const knowledgeKey = `${game.mapId}:${game.round}:${observer.id}:${observer.team}:${game.mode}:${unrestricted}`;
    if (knowledgeKey !== this.knowledgeKey || now < this.sampledAt) {
      this.reset();
      this.knowledgeKey = knowledgeKey;
    }
    if (now - this.sampledAt < 1 / 16) return this.present(game, now);
    this.previous = this.frame;
    this.previousAt = this.sampledAt;
    this.sampledAt = now;
    const players: RadarPlayer[] = [
      {
        id: "player",
        team: game.team,
        alive: !game.dead,
        position: game.position,
        yaw: game.yaw,
        number: 1,
      },
      ...game.bots.map((bot, id) => ({
        id,
        team: bot.team,
        alive: bot.health > 0,
        position: bot.group.position,
        yaw: Math.PI + (game.network ? bot.group.rotation.y : bot.facing),
        number: id + 2,
      })),
    ];
    for (const team of ["ct", "t"] as const) {
      let slot = 0;
      for (const player of players) if (player.team === team) player.number = ++slot;
    }
    const teamGame = game.mode === "casual" || game.mode === "competitive";
    const viewers = players.filter(
      (player) =>
        player.alive && (player.id === observer.id || (teamGame && player.team === observer.team)),
    );
    const from = new T.Vector3(),
      to = new T.Vector3();
    const canSpot = (position: { x: number; y: number; z: number }, height: number) =>
      viewers.some((viewer) => {
        if (game.utility.blind.has(viewer.id as number | "player")) return false;
        const dx = position.x - viewer.position.x,
          dz = position.z - viewer.position.z;
        const distance = Math.hypot(dx, dz);
        if (
          distance > 65 ||
          (distance > 0.01 &&
            (-Math.sin(viewer.yaw) * dx - Math.cos(viewer.yaw) * dz) / distance <
              Math.cos(Math.PI / 4))
        )
          return false;
        const viewerCrouch =
          typeof viewer.id === "number" ? (game.bots[viewer.id]?.rig?.crouch ?? 0) : 0;
        const eye = viewer.id === "player" ? (game.eye ?? 1.45) : 1.45 - viewerCrouch * 0.45;
        from.set(viewer.position.x, viewer.position.y + eye, viewer.position.z);
        to.set(position.x, position.y + height, position.z);
        return game.visible(from, to) && game.utility.clearSight(from, to);
      });
    const sightings: RadarSighting[] = [];
    const deaths: { id: string | number; position: { x: number; y: number; z: number } }[] = [];
    for (const player of players) {
      if (player.id === observer.id || (teamGame && player.team === observer.team)) continue;
      const crouch = typeof player.id === "number" ? (game.bots[player.id]?.rig?.crouch ?? 0) : 0;
      if (!canSpot(player.position, player.alive ? 1.3 - crouch * 0.4 : 0.3)) continue;
      if (player.alive)
        sightings.push({ id: player.id, position: player.position, yaw: player.yaw });
      else deaths.push({ id: player.id, position: player.position });
    }
    let bomb: Parameters<RadarContacts["update"]>[0]["bomb"];
    if (game.bomb && game.mode !== "deathmatch") {
      const native = game.bomb;
      const carrier =
        native.carrier === "player"
          ? players[0]
          : typeof native.carrier === "number" && native.carrier >= 0
            ? players[native.carrier + 1]
            : undefined;
      const position = carrier?.position ?? native.position;
      const state = native.planted ? "planted" : carrier ? "carried" : "dropped";
      const carrierSpotted = carrier && sightings.some((sighting) => sighting.id === carrier.id);
      if (
        unrestricted ||
        observer.team === "t" ||
        carrierSpotted ||
        (state !== "carried" && canSpot(position, 0.12))
      )
        bomb = {
          state,
          position,
          carrier: carrier?.id,
          defusing: observer.team === "ct" && native.defuser !== null,
        };
      // A discovered stationary objective stays known, without tracking a hidden pickup.
      else if (this.lastBomb && this.lastBomb.state !== "carried")
        bomb = { ...this.lastBomb, defusing: observer.team === "ct" && native.defuser !== null };
      else if (
        this.lastBomb?.state === "carried" &&
        !native.planted &&
        !sightings.some((sighting) => sighting.id === this.lastBomb!.carrier)
      )
        bomb = this.lastBomb;
    }
    this.frame = this.contacts.update({
      now,
      round: `${game.mapId}:${game.round}`,
      observer,
      players,
      sightings,
      deaths,
      bomb,
      mode: teamGame ? "team" : "ffa",
      revealAll: unrestricted,
    });
    if (this.frame.bomb?.state === "carried") {
      const marker = this.frame.markers.find((marker) => marker.id === this.frame.bomb!.carrier);
      if (!marker || marker.kind === "death") this.frame.bomb = undefined;
      else
        this.frame.bomb = {
          ...this.frame.bomb,
          position: { ...marker.position },
          age: marker.age,
          opacity: marker.opacity,
          uncertain: marker.uncertain,
          altitude: marker.altitude,
        };
    }
    this.lastBomb = this.frame.bomb;
    return this.present(game, now);
  }

  /** Rendering follows live friendly poses; enemy interpolation uses ONLY authorized
   * observations. No hidden actor position is read to animate a remembered contact. */
  private present(game: Game, now: number): RadarFrame {
    const elapsed = Math.max(0, now - this.sampledAt);
    const span = Math.max(1 / 16, Math.min(0.25, this.sampledAt - this.previousAt));
    const fraction = Number.isFinite(this.previousAt) ? Math.min(1, elapsed / span) : 1;
    const markers = this.frame.markers.map((marker): RadarMarker => {
      if (marker.kind === "self" || marker.kind === "ally") {
        const actor = typeof marker.id === "number" ? game.bots[marker.id] : undefined;
        const position = actor?.group.position ?? game.position;
        if (actor && (actor.health <= 0 || actor.team !== marker.team)) return marker;
        return {
          ...marker,
          position: { x: position.x, y: position.y, z: position.z },
          yaw: actor
            ? Math.PI +
              (game.network || marker.kind === "self" ? actor.group.rotation.y : actor.facing)
            : game.yaw,
        };
      }
      if (marker.uncertain || marker.kind === "death") {
        const age = marker.age + elapsed;
        const duration =
          marker.kind === "death"
            ? this.contacts.settings.deathSeconds
            : this.contacts.settings.enemySeconds;
        return {
          ...marker,
          age,
          opacity: Math.min(
            marker.opacity,
            Math.max(0, (duration - age) / this.contacts.settings.fadeSeconds),
          ),
        };
      }
      const previous = this.previous.markers.find((old) => old.id === marker.id);
      if (
        !previous ||
        previous.uncertain ||
        previous.kind !== marker.kind ||
        Math.hypot(
          marker.position.x - previous.position.x,
          marker.position.y - previous.position.y,
          marker.position.z - previous.position.z,
        ) > 2
      )
        return marker;
      return {
        ...marker,
        position: {
          x: previous.position.x + (marker.position.x - previous.position.x) * fraction,
          y: previous.position.y + (marker.position.y - previous.position.y) * fraction,
          z: previous.position.z + (marker.position.z - previous.position.z) * fraction,
        },
        yaw:
          previous.yaw +
          Math.atan2(Math.sin(marker.yaw - previous.yaw), Math.cos(marker.yaw - previous.yaw)) *
            fraction,
      };
    });
    const carrier =
      this.frame.bomb?.state === "carried"
        ? markers.find((marker) => marker.id === this.frame.bomb!.carrier)
        : undefined;
    const bomb =
      carrier && this.frame.bomb
        ? {
            ...this.frame.bomb,
            position: { ...carrier.position },
            age: carrier.age,
            opacity: carrier.opacity,
            uncertain: carrier.uncertain,
            altitude: carrier.altitude,
          }
        : this.frame.bomb;
    return { markers, bomb };
  }
}
