import {
  MAX_BATCH,
  MAX_PENDING_INPUTS,
  PROTOCOL_VERSION,
  neutralInput,
  type Input,
  type PlayerState,
  type ServerMessage,
  type RoundState,
  type MatchMode,
  type Team,
} from "@cs2go/protocol";
import { movePlayer } from "@cs2go/simulation/movement";
import type { DustMap } from "@cs2go/simulation/dust-map";
import { STEP } from "@cs2go/simulation/match";

export class MatchConnection {
  socket: WebSocket;
  round?: RoundState;
  map: DustMap;
  id = "";
  local?: PlayerState;
  players: PlayerState[] = [];
  history: { at: number; players: PlayerState[] }[] = [];
  pending: Input[] = [];
  batch: Input[] = [];
  seq = 0;
  ping = 0;
  lastSnapshot = performance.now();
  private onMessage: (message: ServerMessage) => void;
  private onClose: (reason: string) => void;
  private monitor: ReturnType<typeof setInterval>;
  constructor(
    url: string,
    room: string,
    name: string,
    mode: MatchMode,
    team: Team,
    map: DustMap,
    password: string,
    onMessage: (message: ServerMessage) => void,
    onClose: (reason: string) => void,
  ) {
    this.map = map;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.socket = new WebSocket(url);
    this.socket.onopen = () =>
      this.socket.send(
        JSON.stringify({
          type: "join",
          version: PROTOCOL_VERSION,
          room,
          name,
          password,
          mode,
          team,
        }),
      );
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      if (message.type === "welcome") {
        if (message.version !== PROTOCOL_VERSION) {
          this.close("Game version mismatch; refresh the page");
          return;
        }
        this.id = message.id;
      } else if (message.type === "snapshot") {
        this.round = message.round;
        this.lastSnapshot = performance.now();
        this.players = message.players;
        this.history.push({ at: this.lastSnapshot, players: message.players });
        while (this.history.length > 16) this.history.shift();
        const state = message.players.find((player) => player.id === this.id);
        if (state) {
          const changedSpawn = this.local?.spawn !== state.spawn;
          this.pending = changedSpawn ? [] : this.pending.filter((input) => input.seq > state.ack);
          this.local = { ...state };
          // Never replay movement across death or a respawn boundary.
          if (!changedSpawn && state.health > 0 && ["live", "post"].includes(message.round.phase))
            for (const input of this.pending) movePlayer(this.local, input, STEP, this.map);
        }
      } else if (message.type === "pong") this.ping = Math.round(performance.now() - message.time);
      this.onMessage(message);
    };
    this.socket.onclose = (event) => {
      clearInterval(this.monitor);
      this.onClose(event.reason || "Connection lost. Return to Play to rejoin.");
    };
    this.socket.onerror = () => {
      /* Close supplies the actionable error once. */
    };
    this.monitor = setInterval(() => {
      if (performance.now() - this.lastSnapshot > 10000)
        this.close("Server stopped responding. Rejoin the room to reconnect.");
      if (this.socket.readyState === WebSocket.OPEN && this.id)
        this.socket.send(JSON.stringify({ type: "ping", time: performance.now() }));
    }, 1000);
  }
  step(input: Omit<Input, "seq">) {
    if (!this.local || this.socket.readyState !== WebSocket.OPEN) return;
    const frame: Input = { ...input, seq: ++this.seq };
    this.pending.push(frame);
    this.batch.push(frame);
    if (this.round && ["live", "post"].includes(this.round.phase))
      movePlayer(this.local, frame, STEP, this.map);
    if (this.pending.length > MAX_PENDING_INPUTS || this.socket.bufferedAmount > 64 * 1024) {
      this.close("Connection is too far behind. Rejoin to resynchronize.");
      return;
    }
    if (this.batch.length >= MAX_BATCH / 2) this.flush();
  }
  private flush() {
    if (this.batch.length && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "inputs", inputs: this.batch }));
      this.batch = [];
    }
  }
  stopInput() {
    if (this.local) this.step({ ...neutralInput(), yaw: this.local.yaw, pitch: this.local.pitch });
    this.flush();
  }
  close(reason = "Disconnected") {
    clearInterval(this.monitor);
    this.socket.close(1000, reason.slice(0, 120));
  }
}
