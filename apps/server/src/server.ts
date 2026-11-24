import type { ServerWebSocket } from "bun";
import {
  MAX_PLAYERS,
  MAPS,
  CHAT_INTERVAL_MS,
  MAX_PENDING_INPUTS,
  PROTOCOL_VERSION,
  SNAPSHOT_RATE,
  TICK_RATE,
  neutralInput,
  SnapshotEncoder,
  parseClientMessage,
  type MapId,
  type MatchMode,
  type Team,
  type Input,
  type MatchEvent,
  type PlayerState,
  type ServerMessage,
  type LobbyVisibility,
  type PublicLobby,
} from "@cs2go/protocol";
import {
  createPlayer,
  createMatch,
  joinMatch,
  switchTeam,
  leaveMatch,
  stepMatch,
  configurePlayer,
  STEP,
  type Match,
} from "@cs2go/simulation/match";

type Room = Match & {
  visibility: LobbyVisibility;
  /** Server-owned: never removed, reset when empty, rotates map after a match. */
  persistent: boolean;
  finishedFor: number;
  bots: BotRoster;
  /** Total players (people plus bots) the server keeps in the room. */
  botFill: number;
  name: string;
  players: Map<string, PlayerState>;
  connections: Set<ServerWebSocket<Connection>>;
  events: MatchEvent[];
  tick: number;
};
type Connection = {
  id: string;
  resume?: string;
  room?: Room;
  queue: Input[];
  last: Input;
  lastSeq: number;
  lastInput: number;
  joinedAt: number;
  messages: number;
  window: number;
  chatAt?: number;
};
import type { DustMap } from "@cs2go/simulation/dust-map";
import { rulesFor } from "@cs2go/simulation/economy";
import { BotNavigation, balanceBots, botInput, removeBot, type BotRoster } from "./bots";
export type ServerOptions = {
  map: DustMap;
  maps?: Partial<Record<MapId, DustMap>>;
  port: number;
  hostname?: string;
  origins: string[];
  maxRooms?: number;
  maxConnections?: number;
  log?: (message: string) => void;
  onTick?: (milliseconds: number) => void;
  /** Modes that always have one public room available. */
  persistentModes?: MatchMode[];
  /** Seconds a finished persistent match shows its result before rotating. */
  rotationDelay?: number;
  random?: () => number;
  /** Persistent rooms are topped up with bots to this many players per mode. */
  botFill?: Partial<Record<MatchMode, number>>;
};
const humans = (room: Match) => {
  let count = 0;
  for (const player of room.players.values()) if (!player.bot) count++;
  return count;
};
const PERSISTENT_NAMES: Record<MatchMode, string> = {
  casual: "Casual",
  competitive: "Competitive",
  deathmatch: "Deathmatch",
};

export function startServer(options: ServerOptions) {
  if (
    !options.origins.length ||
    options.origins.some(
      (origin) =>
        !["http:", "https:"].includes(new URL(origin).protocol) ||
        new URL(origin).origin !== origin,
    )
  )
    throw new Error("ALLOWED_ORIGINS must contain exact HTTP(S) origins.");
  const origins = new Set(options.origins);
  const defaultMap = options.map.id ?? "dust2";
  const maps = new Map<MapId, DustMap>([[defaultMap, options.map]]);
  for (const [id, map] of Object.entries(options.maps ?? {})) {
    if (map.id !== id) throw new Error(`Map registry ID does not match ${id}`);
    maps.set(id as MapId, map);
  }
  const rooms = new Map<string, Room>();
  const connections = new Set<ServerWebSocket<Connection>>();
  let stopping = false;
  const detached = new Map<string, { connection: Connection; expires: number }>();
  const roomLabels = new WeakMap<Room, number>();
  const rejected = new WeakSet<ServerWebSocket<Connection>>();
  const encoders = new WeakMap<Room, SnapshotEncoder>();
  const sentTicks = new WeakMap<ServerWebSocket<Connection>, number>();
  let nextRoomLabel = 1;
  const log = (message: string) => options.log?.(message);
  const random = options.random ?? Math.random;
  const rotationDelay = options.rotationDelay ?? 15;
  function newCode() {
    const start = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
    for (let offset = 0; offset < 1000000; offset++) {
      const code = String((start + offset) % 1000000).padStart(6, "0");
      if (!rooms.has(code)) return code;
    }
    return undefined;
  }
  function createRoom(
    code: string,
    mode: MatchMode,
    map: DustMap,
    visibility: LobbyVisibility,
    name: string,
    persistent = false,
  ) {
    const room: Room = {
      ...createMatch(mode, map),
      visibility,
      persistent,
      finishedFor: 0,
      bots: new Map(),
      botFill: persistent ? (options.botFill?.[mode] ?? 0) : 0,
      name,
      connections: new Set(),
      events: [],
      tick: 0,
    };
    rooms.set(code, room);
    roomLabels.set(room, nextRoomLabel++);
    log(
      `Room #${roomLabels.get(room)} created${persistent ? " (persistent)" : ""} - ${MAPS[map.id ?? defaultMap].name} - ${mode} - ${rulesFor(mode).teamSize}v${rulesFor(mode).teamSize}`,
    );
    return room;
  }
  /** Replace the room's match in place, keeping its PIN, name and visibility. */
  function resetRoom(room: Room, match: Match) {
    for (const [token, saved] of detached)
      if (saved.connection.room === room) detached.delete(token);
    Object.assign(room, match, { events: [], finishedFor: 0, bots: new Map() });
    encoders.delete(room);
  }
  const navigations = new Map<MapId, BotNavigation | undefined>();
  function navigationFor(room: Room) {
    const id = room.map.id ?? defaultMap;
    if (!navigations.has(id)) {
      const nav = maps.get(id)?.nav;
      navigations.set(id, nav ? new BotNavigation(nav) : undefined);
    }
    return navigations.get(id);
  }
  function fillBots(room: Room) {
    if (!room.botFill || room.state.phase === "finished") return;
    balanceBots(room, room.bots, room.botFill, rulesFor(room.state.mode).teamSize, random);
  }
  /** Bots give up their seat to a person joining a full team or room. */
  function seatFor(room: Room, team: Team) {
    const size = rulesFor(room.state.mode).teamSize;
    while (
      room.bots.size &&
      (room.players.size >= MAX_PLAYERS ||
        [...room.players.values()].filter((player) => player.team === team).length >= size)
    )
      if (
        !removeBot(room, room.bots, team) &&
        !removeBot(room, room.bots, team === "ct" ? "t" : "ct")
      )
        break;
  }
  function roomCode(room: Room) {
    for (const [key, value] of rooms) if (value === room) return key;
    return "";
  }
  /** Pick a different random map, then ask every peer to reload and rejoin. */
  function rotateRoom(room: Room) {
    const current = room.map.id ?? defaultMap;
    const choices = [...maps.keys()].filter((id) => id !== current);
    let next = choices.length ? choices[Math.floor(random() * choices.length)] : current;
    let match: Match;
    try {
      match = createMatch(room.state.mode, maps.get(next)!);
    } catch (error) {
      // Never strand players on a map that cannot host this mode.
      log(
        `Room #${roomLabels.get(room)} could not rotate to ${MAPS[next].name} - ${error instanceof Error ? error.message : String(error)}`,
      );
      next = current;
      match = createMatch(room.state.mode, maps.get(current)!);
    }
    const code = roomCode(room);
    for (const socket of room.connections) {
      send(socket, { type: "map-change", map: next, room: code });
      socket.data.room = undefined;
      socket.close(4001, "Map changing");
    }
    room.connections.clear();
    resetRoom(room, match);
    log(`Room #${roomLabels.get(room)} rotated - ${MAPS[current].name} -> ${MAPS[next].name}`);
  }
  /** Delete an empty lobby; persistent rooms instead start fresh on the same map. */
  function releaseEmptyRoom(room: Room) {
    if (humans(room)) {
      fillBots(room);
      return;
    }
    if (room.persistent) {
      resetRoom(room, createMatch(room.state.mode, maps.get(room.map.id ?? defaultMap)!));
      log(`Room #${roomLabels.get(room)} reset - empty`);
      return;
    }
    const code = roomCode(room);
    if (code) {
      rooms.delete(code);
      log(`Room #${roomLabels.get(room)} removed - empty`);
    }
  }
  const clientLabel = (socket: ServerWebSocket<Connection>) => socket.data.id.slice(0, 8);
  const headers = (origin: string) => ({
    ...(origins.has(origin) ? { "Access-Control-Allow-Origin": origin } : {}),
    Vary: "Origin",
    "Cache-Control": "no-store",
  });
  function stopInput(connection: Connection, player: PlayerState, now: number) {
    connection.queue = [];
    player.ack = connection.lastSeq;
    connection.last = {
      ...neutralInput(connection.lastSeq),
      yaw: player.yaw,
      pitch: player.pitch,
    };
    connection.lastInput = now;
  }
  function send(socket: ServerWebSocket<Connection>, message: ServerMessage | string) {
    if (socket.readyState !== 1) return false;
    if (socket.getBufferedAmount() > 512 * 1024) {
      socket.close(1013, "Connection too slow");
      return false;
    }
    return socket.send(typeof message === "string" ? message : JSON.stringify(message)) !== 0;
  }
  function reject(socket: ServerWebSocket<Connection>, message: string) {
    if (!rejected.has(socket)) {
      rejected.add(socket);
      log(`Client ${clientLabel(socket)} rejected - ${message}`);
    }
    send(socket, { type: "error", message });
    socket.close(1008, message);
  }
  const persistentModes = [...new Set<MatchMode>(options.persistentModes ?? [])];
  for (const mode of persistentModes) {
    const ids = [...maps.keys()];
    const code = newCode()!;
    createRoom(
      code,
      mode,
      maps.get(ids[Math.floor(random() * ids.length)])!,
      "public",
      PERSISTENT_NAMES[mode],
      true,
    );
  }
  const persistentCount = persistentModes.length;
  const server = Bun.serve<Connection>({
    port: options.port,
    hostname: options.hostname ?? "0.0.0.0",
    maxRequestBodySize: 1024,
    fetch(request, server) {
      const path = new URL(request.url).pathname;
      if (request.method === "GET" && path === "/healthz")
        return Response.json(
          {
            ok: !stopping,
            version: PROTOCOL_VERSION,
            map: defaultMap,
            maps: [...maps.keys()],
            publicLobbies: true,
            modes: ["casual", "competitive", "deathmatch"],
          },
          {
            status: stopping ? 503 : 200,
            headers: headers(request.headers.get("origin") ?? ""),
          },
        );
      if (request.method === "GET" && path === "/lobbies") {
        const origin = request.headers.get("origin") ?? "";
        if (!origins.has(origin)) return new Response("Origin not allowed", { status: 403 });
        const lobbies: PublicLobby[] = [];
        for (const [code, room] of rooms) {
          if (
            room.visibility !== "public" ||
            (!room.persistent && (!room.connections.size || room.state.phase === "finished"))
          )
            continue;
          const players = [...room.players.values()];
          const people = players.filter((player) => !player.bot).length;
          lobbies.push({
            room: code,
            name: room.name,
            mode: room.state.mode,
            map: room.map.id ?? "dust2",
            players: people,
            ...(room.bots.size ? { bots: room.bots.size } : {}),
            capacity: rulesFor(room.state.mode).teamSize * 2,
            teams: {
              ct: players.filter((player) => player.team === "ct").length,
              t: players.filter((player) => player.team === "t").length,
            },
            phase: room.state.phase,
            ...(room.persistent ? { persistent: true } : {}),
          });
        }
        lobbies.sort((a, b) => Number(!!b.persistent) - Number(!!a.persistent));
        return Response.json({ version: PROTOCOL_VERSION, lobbies }, { headers: headers(origin) });
      }
      if (request.method === "GET" && /^\/lobbies\/\d{6}$/.test(path)) {
        const origin = request.headers.get("origin") ?? "";
        if (!origins.has(origin)) return new Response("Origin not allowed", { status: 403 });
        const room = rooms.get(path.slice("/lobbies/".length));
        return Response.json(
          room
            ? { mode: room.state.mode, map: room.map.id ?? "dust2" }
            : { error: "Lobby not found" },
          {
            status: room ? 200 : 404,
            headers: headers(origin),
          },
        );
      }
      if (request.method !== "GET" || path !== "/ws")
        return new Response("Not found", { status: 404 });
      if (stopping || connections.size >= (options.maxConnections ?? 128))
        return new Response("Server full", { status: 503 });
      if (!origins.has(request.headers.get("origin") ?? ""))
        return new Response("Origin not allowed", { status: 403 });
      const now = performance.now();
      if (
        server.upgrade(request, {
          data: {
            id: crypto.randomUUID(),
            queue: [],
            last: neutralInput(),
            lastSeq: 0,
            lastInput: now,
            joinedAt: now,
            messages: 0,
            window: now,
          },
        })
      )
        return;
      return new Response("WebSocket upgrade required", { status: 426 });
    },
    websocket: {
      maxPayloadLength: 8192,
      idleTimeout: 30,
      perMessageDeflate: false,
      open(socket) {
        connections.add(socket);
        log(`Client ${clientLabel(socket)} connected - ${connections.size} sockets`);
      },
      message(socket, raw) {
        const connection = socket.data;
        const now = performance.now();
        if (now - connection.window >= 1000) {
          connection.window = now;
          connection.messages = 0;
        }
        if (++connection.messages > 80) return reject(socket, "Message rate exceeded");
        if (typeof raw !== "string") return reject(socket, "Text messages required");
        const message = parseClientMessage(raw);
        if (!message) return reject(socket, "Invalid message or incompatible game version");
        if (message.type === "join") {
          if (connection.room) return reject(socket, "Already joined");
          const requestedMap = message.map ?? defaultMap;
          const selectedMap = maps.get(requestedMap);
          if (!selectedMap) return reject(socket, "Map is not available on this server");
          let code = message.room;
          if (message.create) {
            if (rooms.size >= (options.maxRooms ?? 16) + persistentCount)
              return reject(socket, "Server full");
            const created = newCode();
            if (!created) return reject(socket, "Server full");
            code = created;
          }
          let room = rooms.get(code);
          if (!room && message.resume) return reject(socket, "Session expired; rejoin from Play");
          if (!room && !message.create)
            return reject(socket, "Lobby not found. Check the PIN and server.");
          if (!room)
            room = createRoom(
              code,
              message.mode,
              selectedMap,
              message.visibility ?? "private",
              `${message.name.trim()}'s lobby`,
            );
          if ((room.map.id ?? "dust2") !== requestedMap) {
            if (!room.persistent || message.resume)
              return reject(socket, "Lobby uses a different map. Return to Play and rejoin.");
            // The rotation raced this client's map load; send it to the new map.
            send(socket, { type: "map-change", map: room.map.id ?? defaultMap, room: code });
            socket.close(4001, "Map changing");
            return;
          }
          if (message.resume && room.state.mode !== message.mode)
            return reject(socket, "Room uses a different game mode");
          if (!message.resume) seatFor(room, message.team);
          if (
            !message.resume &&
            (room.players.size >= MAX_PLAYERS ||
              [...room.players.values()].filter((p) => p.team === message.team).length >=
                rulesFor(room.state.mode).teamSize)
          )
            return reject(socket, "Team is full");
          const previousSocket = message.resume
            ? [...room.connections].find((peer) => peer.data.resume === message.resume)
            : undefined;
          const saved = message.resume
            ? (detached.get(message.resume) ??
              (previousSocket
                ? { connection: previousSocket.data, expires: now + 20000 }
                : undefined))
            : undefined;
          if (message.resume && (!saved || saved.expires <= now || saved.connection.room !== room))
            return reject(socket, "Session expired; rejoin from Play");
          const player = saved
            ? room.players.get(saved.connection.id)!
            : createPlayer(connection.id, message.name.trim(), message.team);
          if (saved) {
            detached.delete(message.resume!);
            if (previousSocket) {
              room.connections.delete(previousSocket);
              previousSocket.data.room = undefined;
              previousSocket.close(1000, "Session recovered on a new connection");
            }
            connection.id = player.id;
            player.ack = 0;
          } else {
            joinMatch(room, player);
            fillBots(room);
          }
          connection.resume = crypto.randomUUID();
          room.connections.add(socket);
          connection.room = room;
          log(
            `Client ${clientLabel(socket)} joined room #${roomLabels.get(room)} - ${message.team.toUpperCase()} - ${room.players.size} players`,
          );
          connection.last = { ...neutralInput(), yaw: player.yaw, pitch: player.pitch };
          send(socket, {
            type: "welcome",
            version: PROTOCOL_VERSION,
            id: player.id,
            resume: connection.resume,
            room: code,
            map: room.map.id ?? "dust2",
            mode: room.state.mode,
          });
        } else if (!connection.room) return reject(socket, "Join a room first");
        else if (message.type === "team") {
          const player = connection.room.players.get(connection.id)!;
          const previousTeam = player.team;
          if (previousTeam !== message.team) seatFor(connection.room, message.team);
          const error = switchTeam(connection.room, player, message.team);
          fillBots(connection.room);
          if (!error && previousTeam !== player.team) stopInput(connection, player, now);
          send(socket, {
            type: "team-status",
            message:
              error ??
              `Joined ${player.team === "ct" ? "Counter-Terrorists" : "Terrorists"}.${player.waiting ? " You will spawn next round." : ""}`,
          });
        } else if (message.type === "configure")
          configurePlayer(
            connection.room,
            connection.room.players.get(connection.id)!,
            message.configuration,
          );
        else if (message.type === "chat") {
          if (connection.chatAt !== undefined && now - connection.chatAt < CHAT_INTERVAL_MS) {
            send(socket, {
              type: "chat-status",
              message: "Please wait before sending another message.",
            });
            return;
          }
          connection.chatAt = now;
          const room = connection.room;
          const player = room.players.get(connection.id)!;
          const chat: ServerMessage = {
            type: "chat",
            channel: message.channel,
            sender: player.id,
            name: player.name,
            team: player.team,
            text: message.text,
          };
          for (const peer of room.connections)
            if (message.channel === "all" || room.players.get(peer.data.id)?.team === player.team)
              send(peer, chat);
        } else if (message.type === "stop") {
          const player = connection.room.players.get(connection.id)!;
          stopInput(connection, player, now);
        } else if (message.type === "ping") send(socket, { type: "pong", time: message.time });
        else {
          if (connection.queue.length + message.inputs.length > MAX_PENDING_INPUTS)
            return reject(socket, "Input backlog exceeded");
          for (const input of message.inputs) {
            if (input.seq !== connection.lastSeq + 1)
              return reject(socket, "Input sequence out of order");
            connection.lastSeq = input.seq;
            connection.queue.push(input);
          }
          connection.lastInput = now;
        }
      },
      close(socket, code) {
        connections.delete(socket);
        log(
          `Client ${clientLabel(socket)} disconnected - code ${code} - ${connections.size} sockets`,
        );
        const room = socket.data.room;
        if (!room) return;
        room.connections.delete(socket);
        if (!stopping && socket.data.resume && [1006, 1012, 1013, 4000].includes(code)) {
          socket.data.queue = [];
          socket.data.last = neutralInput();
          detached.set(socket.data.resume, {
            connection: socket.data,
            expires: performance.now() + 20000,
          });
          log(`Client ${clientLabel(socket)} awaiting reconnect (20s)`);
          return;
        }
        leaveMatch(room, socket.data.id);
        releaseEmptyRoom(room);
      },
    },
  });
  let previous = performance.now(),
    accumulator = 0;
  let statusAt = previous,
    ticks = 0,
    peakCatchup = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    // Keep elapsed ticks through scheduler stalls; draining buffered inputs must
    // not discard time or advance faster than the authoritative wall clock.
    accumulator = Math.min(1, accumulator + (now - previous) / 1000);
    const previousNow = previous;
    previous = now;
    for (const socket of connections)
      if (!socket.data.room && now - socket.data.joinedAt > 10000) reject(socket, "Join timed out");
    for (const [token, saved] of detached) {
      if (saved.expires > now) continue;
      detached.delete(token);
      const room = saved.connection.room!;
      leaveMatch(room, saved.connection.id);
      releaseEmptyRoom(room);
    }
    for (const room of rooms.values())
      if (room.persistent && room.state.phase === "finished" && humans(room))
        if ((room.finishedFor += now - previousNow) / 1000 >= rotationDelay) rotateRoom(room);
    let catchup = 0;
    while (accumulator >= STEP && catchup++ < 32) {
      const started = options.onTick ? performance.now() : 0;
      accumulator -= STEP;
      ticks++;
      for (const room of rooms.values()) {
        const inputs = new Map<string, Input>();
        for (const socket of room.connections) {
          const connection = socket.data;
          const input = connection.queue.shift();
          if (input) {
            connection.last = input;
            room.players.get(connection.id)!.ack = input.seq;
          }
          const held =
            now - connection.lastInput < 250
              ? {
                  ...connection.last,
                  jump: !!input?.jump,
                  reload: !!input?.reload,
                  buy: input?.buy ?? -1,
                  buyDrop: !!input?.buyDrop,
                  select: input?.select ?? -1,
                  equipment: input?.equipment ?? "",
                  dropBomb: !!input?.dropBomb,
                  drop: !!input?.drop,
                  pickup: !!input?.pickup,
                  stab: !!input?.stab,
                  toggleSuppressor: !!input?.toggleSuppressor,
                  refund: input?.refund ?? -1,
                  refundEquipment: input?.refundEquipment ?? "",
                  grenadeBuy: input?.grenadeBuy ?? "",
                  grenadeRefund: input?.grenadeRefund ?? "",
                  throwKind: input?.throwKind ?? "",
                }
              : { ...neutralInput(), yaw: connection.last.yaw, pitch: connection.last.pitch };
          inputs.set(connection.id, held);
        }
        if (room.bots.size) {
          const navigation = navigationFor(room);
          for (const [id, brain] of room.bots) {
            const bot = room.players.get(id);
            if (bot) inputs.set(id, botInput(room, bot, brain, navigation, random));
          }
        }
        if (ticks % TICK_RATE === 0) fillBots(room);
        const phase = room.state.phase,
          round = room.state.round;
        room.events.push(...stepMatch(room, inputs));
        if (phase !== room.state.phase || round !== room.state.round)
          log(
            `Room #${roomLabels.get(room)} - round ${room.state.round} - ${room.state.phase} - CT ${room.state.scores.ct} : T ${room.state.scores.t}`,
          );
        if (room.tick % (TICK_RATE / SNAPSHOT_RATE) === 0) {
          const message: ServerMessage = {
            type: "snapshot",
            tick: room.tick,
            players: [...room.players.values()],
            events: room.events,
            round: room.state,
          };
          let encoder = encoders.get(room);
          if (!encoder) {
            encoder = new SnapshotEncoder();
            encoders.set(room, encoder);
          }
          const encoded = encoder.encode(message);
          const previousTick = room.tick - TICK_RATE / SNAPSHOT_RATE;
          let full: string | undefined;
          for (const socket of room.connections) {
            const frame =
              sentTicks.get(socket) === previousTick ? encoded : (full ??= JSON.stringify(message));
            if (send(socket, frame)) sentTicks.set(socket, room.tick);
          }
          room.events = [];
        }
      }
      options.onTick?.(performance.now() - started);
    }
    peakCatchup = Math.max(peakCatchup, Math.min(catchup, 32));
    if (options.log && now - statusAt >= 30000) {
      let players = 0;
      for (const room of rooms.values()) players += room.players.size;
      log(
        `Status - ${rooms.size} rooms - ${players} players - ${connections.size} sockets - ${Math.round((ticks * 1000) / (now - statusAt))} ticks/s - peak catch-up ${peakCatchup}`,
      );
      statusAt = now;
      ticks = peakCatchup = 0;
    }
  }, 1000 / TICK_RATE);
  return {
    server,
    rooms,
    async stop() {
      stopping = true;
      log(`Stopping ${rooms.size} rooms and closing ${connections.size} sockets`);
      clearInterval(timer);
      for (const socket of connections) socket.close(1012, "Server restarting; rejoin your room");
      await server.stop(true);
    },
  };
}
