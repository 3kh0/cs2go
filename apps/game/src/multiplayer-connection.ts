import {
  MAX_BATCH,
  SnapshotDecoder,
  encodeInputs,
  TICK_RATE,
  MAX_PENDING_INPUTS,
  PROTOCOL_VERSION,
  type Input,
  type PlayerState,
  type PlayerConfiguration,
  type ServerMessage,
  type RoundState,
  type MatchMode,
  type Team,
  type ChatChannel,
} from "@cs2go/protocol";
import { movePlayer } from "@cs2go/simulation/movement";
import type { DustMap } from "@cs2go/simulation/dust-map";
import { STEP } from "@cs2go/simulation/match";

export class MatchConnection {
  socket!: WebSocket;
  reconnecting = false;
  private disposed = false;
  private resume?: string;
  private retry?: ReturnType<typeof setTimeout>;
  private retryStarted = 0;
  private attempts = 0;
  private interrupt?: () => void;
  private timeline?: number;
  private lastTick = -1;
  private decoder = new SnapshotDecoder();
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
    create: boolean,
    onMessage: (message: ServerMessage) => void,
    onClose: (reason: string) => void,
    configuration?: PlayerConfiguration,
  ) {
    this.map = map;
    this.onMessage = onMessage;
    let notified = false;
    this.onClose = (reason) => {
      if (notified) return;
      notified = true;
      onClose(reason);
    };
    const connect = () => {
      if (this.disposed) return;
      this.lastSnapshot = performance.now();
      this.decoder.reset();
      this.socket = new WebSocket(url);
      const socket = this.socket;
      console.log("[network] Connecting", { attempt: this.attempts + 1 });
      this.socket.onopen = () => {
        this.socket.send(
          JSON.stringify({
            type: "join",
            resume: this.resume,
            version: PROTOCOL_VERSION,
            room: this.resume ? room : create ? "" : room,
            name,
            create: !this.resume && create,
            mode,
            map: this.map.id ?? "dust2",
            team,
          }),
        );
        if (configuration) this.socket.send(JSON.stringify({ type: "configure", configuration }));
      };
      this.socket.onmessage = (event) => {
        if (socket !== this.socket || this.disposed) return;
        const message = this.decoder.decode(JSON.parse(event.data));
        if (!message) {
          this.interrupt?.();
          return;
        }
        if (message.type === "welcome") {
          if (message.version !== PROTOCOL_VERSION) {
            this.close("Game version mismatch; refresh the page");
            return;
          }
          if (message.map !== (this.map.id ?? "dust2")) {
            this.close("Server map changed; return to Play and rejoin");
            return;
          }
          room = message.room;
          mode = message.mode;
          this.id = message.id;
          this.resume = message.resume;
          this.seq = 0;
          this.pending = [];
          this.batch = [];
          this.history = [];
          this.local = undefined;
          this.timeline = undefined;
          this.lastTick = -1;
          console.log("[network] Joined", { recovered: this.reconnecting });
        } else if (message.type === "snapshot") {
          if (message.tick <= this.lastTick) return;
          this.lastTick = message.tick;
          if (this.reconnecting) console.log("[network] Connection restored");
          this.reconnecting = false;
          this.retryStarted = 0;
          this.attempts = 0;
          this.round = message.round;
          this.lastSnapshot = performance.now();
          this.players = message.players;
          // Stable server-tick spacing removes arrival jitter from peer motion.
          const origin = this.lastSnapshot - (message.tick * 1000) / TICK_RATE;
          this.timeline =
            this.timeline === undefined ? origin : Math.min(origin, this.timeline + 0.25);
          this.history.push({
            at: this.timeline + (message.tick * 1000) / TICK_RATE,
            players: message.players,
          });
          while (this.history.length > 16) this.history.shift();
          const state = message.players.find((player) => player.id === this.id);
          if (state) {
            const changedSpawn = this.local?.spawn !== state.spawn;
            this.pending = changedSpawn
              ? []
              : this.pending.filter((input) => input.seq > state.ack);
            // Prediction mutates attachment/cooldown state; preserve the decoded
            // authoritative snapshot and delta baseline for later reconciliation.
            this.local = { ...state, ladder: state.ladder ? { ...state.ladder } : undefined };
            // Never replay movement across death or a respawn boundary.
            if (
              !changedSpawn &&
              state.health > 0 &&
              ["waiting", "live", "post"].includes(message.round.phase)
            )
              for (const input of this.pending)
                movePlayer(this.local, input, STEP, this.map, this.players);
          }
        } else if (message.type === "error") {
          this.close(message.message);
          return;
        } else if (message.type === "pong")
          this.ping = Math.round(performance.now() - message.time);
        this.onMessage(message);
      };
      const handleClose = (event: { code: number; reason: string }) => {
        if (socket !== this.socket) return;
        if (this.disposed || !this.resume || ![1006, 1012, 1013, 4000].includes(event.code)) {
          clearInterval(this.monitor);
          this.onClose(event.reason || "Connection lost. Return to Play to rejoin.");
          return;
        }
        this.reconnecting = true;
        this.pending = [];
        this.batch = [];
        this.retryStarted ||= performance.now();
        if (performance.now() - this.retryStarted >= 15000) {
          this.close("Could not reconnect. Rejoin from Play.");
          this.onClose("Could not reconnect. Rejoin from Play.");
          return;
        }
        const delay = Math.min(2000, 250 * 2 ** this.attempts++) + Math.random() * 150;
        console.log("[network] Connection interrupted; retrying", { delay: Math.round(delay) });
        this.retry = setTimeout(connect, delay);
      };
      this.socket.onclose = handleClose;
      this.interrupt = () => {
        // A blackholed TCP connection can take much longer than our recovery
        // window to finish its close handshake. Retire its callbacks now.
        socket.onclose = null;
        socket.onmessage = null;
        socket.close(4000, "Snapshot timeout");
        handleClose({ code: 4000, reason: "Snapshot timeout" });
      };
      this.socket.onerror = () => {
        /* Close supplies the actionable error once. */
      };
    };
    connect();
    this.monitor = setInterval(() => {
      if (
        performance.now() - this.lastSnapshot > 5000 &&
        this.socket.readyState < WebSocket.CLOSING
      )
        this.interrupt?.();
      if (this.socket.readyState === WebSocket.OPEN && this.id)
        this.socket.send(JSON.stringify({ type: "ping", time: performance.now() }));
    }, 1000);
  }
  step(input: Omit<Input, "seq">) {
    if (this.reconnecting || !this.local || this.socket.readyState !== WebSocket.OPEN) return false;
    // Bound prediction without disconnecting a client during a temporary load stall.
    if (this.pending.length >= MAX_PENDING_INPUTS || this.socket.bufferedAmount > 64 * 1024)
      return false;
    const frame: Input = { ...input, seq: ++this.seq };
    this.pending.push(frame);
    this.batch.push(frame);
    if (this.round && ["waiting", "live", "post"].includes(this.round.phase))
      movePlayer(this.local, frame, STEP, this.map, this.players);
    if (this.batch.length >= MAX_BATCH / 2) this.flush();
    return true;
  }
  private flush() {
    if (this.batch.length && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(encodeInputs(this.batch));
      this.batch = [];
    }
  }
  stopInput() {
    // A focus change must stop held combat even if a loading stall filled the queue.
    this.flush();
    if (this.socket.readyState === WebSocket.OPEN && this.id)
      this.socket.send(JSON.stringify({ type: "stop" }));
  }
  changeTeam(team: Team) {
    if (this.reconnecting || !this.local || this.socket.readyState !== WebSocket.OPEN) return false;
    this.stopInput();
    this.socket.send(JSON.stringify({ type: "team", team }));
    return true;
  }
  sendChat(channel: ChatChannel, text: string) {
    if (this.reconnecting || !this.local || this.socket.readyState !== WebSocket.OPEN) return false;
    this.socket.send(JSON.stringify({ type: "chat", channel, text }));
    return true;
  }
  close(reason = "Disconnected") {
    this.disposed = true;
    clearTimeout(this.retry);
    clearInterval(this.monitor);
    this.socket.close(1000, reason.slice(0, 120));
  }
}
