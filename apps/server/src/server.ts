import type { ServerWebSocket } from "bun";
import {
  MAX_PLAYERS,
  PROTOCOL_VERSION,
  SNAPSHOT_RATE,
  TICK_RATE,
  neutralInput,
  parseClientMessage,
  type Input,
  type MatchEvent,
  type PlayerState,
  type ServerMessage,
} from "@cs2go/protocol";
import { createPlayer, respawn, stepMatch, STEP } from "@cs2go/simulation/match";

type Room = {
  players: Map<string, PlayerState>;
  connections: Set<ServerWebSocket<Connection>>;
  events: MatchEvent[];
  tick: number;
};
type Connection = {
  id: string;
  room?: Room;
  queue: Input[];
  last: Input;
  lastSeq: number;
  lastInput: number;
  joinedAt: number;
  messages: number;
  window: number;
};
export type ServerOptions = {
  port: number;
  hostname?: string;
  origins: string[];
  password?: string;
  maxRooms?: number;
  maxConnections?: number;
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
  const rooms = new Map<string, Room>();
  const connections = new Set<ServerWebSocket<Connection>>();
  let stopping = false;
  function send(socket: ServerWebSocket<Connection>, message: ServerMessage) {
    if (socket.readyState !== 1) return;
    if (socket.getBufferedAmount() > 512 * 1024) {
      socket.close(1013, "Connection too slow");
      return;
    }
    socket.send(JSON.stringify(message));
  }
  function reject(socket: ServerWebSocket<Connection>, message: string) {
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
          { ok: !stopping, version: PROTOCOL_VERSION },
          { status: stopping ? 503 : 200 },
        );
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
          if (options.password && message.password !== options.password)
            return reject(socket, "Incorrect server password");
          let room = rooms.get(message.room);
          if (!room) {
            if (rooms.size >= (options.maxRooms ?? 16)) return reject(socket, "Server full");
            room = { players: new Map(), connections: new Set(), events: [], tick: 0 };
            rooms.set(message.room, room);
          }
          if (room.players.size >= MAX_PLAYERS) return reject(socket, "Room full");
          const team =
            [...room.players.values()].filter((player) => player.team === "ct").length <=
            room.players.size / 2
              ? "ct"
              : "t";
          const player = createPlayer(connection.id, message.name.trim(), team);
          respawn(player, room.players.values());
          room.players.set(player.id, player);
          room.connections.add(socket);
          connection.room = room;
          connection.last = { ...neutralInput(), yaw: player.yaw, pitch: player.pitch };
          send(socket, {
            type: "welcome",
            version: PROTOCOL_VERSION,
            id: player.id,
            room: message.room,
            map: "yard",
          });
        } else if (!connection.room) return reject(socket, "Join a room first");
        else if (message.type === "ping") send(socket, { type: "pong", time: message.time });
        else {
          if (connection.queue.length + message.inputs.length > 32)
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
      close(socket) {
        connections.delete(socket);
        const room = socket.data.room;
        if (!room) return;
        room.connections.delete(socket);
        room.players.delete(socket.data.id);
        if (!room.players.size)
          for (const [key, value] of rooms) if (value === room) rooms.delete(key);
      },
    },
  });
  let previous = performance.now(),
    accumulator = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    accumulator += Math.min((now - previous) / 1000, STEP * 16);
    previous = now;
    for (const socket of connections)
      if (!socket.data.room && now - socket.data.joinedAt > 10000) reject(socket, "Join timed out");
    while (accumulator >= STEP) {
      accumulator -= STEP;
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
              ? { ...connection.last, jump: !!input?.jump, reload: !!input?.reload }
              : { ...neutralInput(), yaw: connection.last.yaw, pitch: connection.last.pitch };
          inputs.set(connection.id, held);
        }
        room.events.push(...stepMatch(room.players, inputs));
        room.tick++;
        if (room.tick % (TICK_RATE / SNAPSHOT_RATE) === 0) {
          const message: ServerMessage = {
            type: "snapshot",
            tick: room.tick,
            players: [...room.players.values()],
            events: room.events,
          };
          for (const socket of room.connections) send(socket, message);
          room.events = [];
        }
      }
    }
  }, 1000 / TICK_RATE);
  return {
    server,
    rooms,
    async stop() {
      stopping = true;
      clearInterval(timer);
      for (const socket of connections) socket.close(1012, "Server restarting; rejoin your room");
      await server.stop(true);
    },
  };
}
