import type { ServerWebSocket } from "bun";
import {
  MAX_PLAYERS,
  CHAT_INTERVAL_MS,
  MAX_PENDING_INPUTS,
  PROTOCOL_VERSION,
  SNAPSHOT_RATE,
  TICK_RATE,
  neutralInput,
  SnapshotEncoder,
  parseClientMessage,
  type MapId,
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
            !room.connections.size ||
            room.state.phase === "finished"
          )
            continue;
          const players = [...room.players.values()];
          lobbies.push({
            room: code,
            name: room.name,
            mode: room.state.mode,
            map: room.map.id ?? "dust2",
            players: players.length,
            capacity: rulesFor(room.state.mode).teamSize * 2,
            teams: {
              ct: players.filter((player) => player.team === "ct").length,
              t: players.filter((player) => player.team === "t").length,
            },
            phase: room.state.phase,
          });
        }
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
            if (rooms.size >= (options.maxRooms ?? 16)) return reject(socket, "Server full");
            const start = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
            let offset = 0;
            do {
              code = String((start + offset++) % 1000000).padStart(6, "0");
            } while (rooms.has(code) && offset < 1000000);
            if (rooms.has(code)) return reject(socket, "Server full");
          }
          let room = rooms.get(code);
          if (!room && message.resume) return reject(socket, "Session expired; rejoin from Play");
          if (!room && !message.create)
            return reject(socket, "Lobby not found. Check the PIN and server.");
          if (!room) {
            if (rooms.size >= (options.maxRooms ?? 16)) return reject(socket, "Server full");
            room = {
              ...createMatch(message.mode, selectedMap),
              visibility: message.visibility ?? "private",
              name: `${message.name.trim()}'s lobby`,
              connections: new Set(),
              events: [],
              tick: 0,
            };
            rooms.set(code, room);
            roomLabels.set(room, nextRoomLabel++);
            log(
              `Room #${roomLabels.get(room)} created - ${requestedMap === "mirage" ? "Mirage" : "Dust II"} - ${message.mode} - ${rulesFor(message.mode).teamSize}v${rulesFor(message.mode).teamSize}`,
            );
          }
          if ((room.map.id ?? "dust2") !== requestedMap)
            return reject(socket, "Lobby uses a different map. Return to Play and rejoin.");
          if (message.resume && room.state.mode !== message.mode)
            return reject(socket, "Room uses a different game mode");
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
          } else joinMatch(room, player);
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
          const error = switchTeam(connection.room, player, message.team);
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
        if (!room.players.size)
          for (const [key, value] of rooms)
            if (value === room) {
              rooms.delete(key);
              log(`Room #${roomLabels.get(room)} removed - empty`);
            }
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
    previous = now;
    for (const socket of connections)
      if (!socket.data.room && now - socket.data.joinedAt > 10000) reject(socket, "Join timed out");
    for (const [token, saved] of detached) {
      if (saved.expires > now) continue;
      detached.delete(token);
      const room = saved.connection.room!;
      leaveMatch(room, saved.connection.id);
      if (!room.players.size)
        for (const [key, value] of rooms) if (value === room) rooms.delete(key);
    }
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
