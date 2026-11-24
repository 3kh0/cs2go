import {
  MAX_BATCH,
  SnapshotDecoder,
  encodeInputs,
  TICK_RATE,
  MAX_PENDING_INPUTS,
  PROTOCOL_VERSION,
  SNAPSHOT_RATE,
  type Input,
  type DoorState,
  type PlayerState,
  type PlayerConfiguration,
  type ServerMessage,
  type RoundState,
  type MatchMode,
  type Team,
  type ChatChannel,
  type LobbyVisibility,
} from "@cs2go/protocol";
import { movePlayer } from "@cs2go/simulation/movement";
import type { DustMap } from "@cs2go/simulation/dust-map";
import { MAX_REWIND_TICKS } from "@cs2go/simulation/hitbox-history";
const STEP = 1 / TICK_RATE;
/** Minimum remote-player buffer; it grows when snapshots arrive unevenly. */
export const INTERPOLATION_DELAY_MS = 100;
const MAX_INTERPOLATION_DELAY_MS = 200;
const SNAPSHOT_MS = 1000 / SNAPSHOT_RATE;
const REWIND_MS = (MAX_REWIND_TICKS * 1000) / TICK_RATE;

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
  /** Peak snapshot lateness behind the best-case arrival, decaying 10 ms/s. */
  private jitter = 0;
  private jitterAt = 0;
  private presentedAt?: number;
  interpolationDelay = INTERPOLATION_DELAY_MS;
  renderTick?: number;
  private lastTick = -1;
  private decoder = new SnapshotDecoder();
  round?: RoundState;
  map: DustMap;
  id = "";
  local?: PlayerState;
  players: PlayerState[] = [];
  history: {
    at: number;
    tick: number;
    players: PlayerState[];
    readonly playersById: ReadonlyMap<string, PlayerState>;
    round?: number;
    doors?: DoorState[];
  }[] = [];
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
    visibility: LobbyVisibility = "private",
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
            visibility: !this.resume && create ? visibility : undefined,
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
          this.jitter = 0;
          this.presentedAt = undefined;
          this.interpolationDelay = INTERPOLATION_DELAY_MS;
          this.renderTick = undefined;
          this.lastTick = -1;
          console.log("[network] Joined", { recovered: this.reconnecting });
        } else if (message.type === "snapshot") {
          if (message.tick <= this.lastTick) return;
          this.lastTick = message.tick;
          // Collision must match the authoritative panel state before pending
          // movement is replayed through a newly opened or restored passage.
          this.map.breakables?.restore(message.round.breakables ?? []);
          this.map.doors?.restore(message.round.doors ?? []);
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
          this.jitter = Math.max(
            origin - this.timeline,
            this.jitter - (this.lastSnapshot - this.jitterAt) * 0.01,
          );
          this.jitterAt = this.lastSnapshot;
          this.history.push({
            tick: message.tick,
            at: this.timeline + (message.tick * 1000) / TICK_RATE,
            players: message.players,
            playersById: new Map(message.players.map((player) => [player.id, player])),
            round: message.round.round,
            doors: message.round.doors,
          });
          while (this.history.length > 16) this.history.shift();
          const state = message.players.find((player) => player.id === this.id);
          if (state) {
            const changedSpawn = this.local?.spawn !== state.spawn;
            if (changedSpawn) this.pending.length = 0;
            else if (this.pending.length) {
              // Compact in place without allocating a new replay queue on every
              // snapshot. Preserve input order and the exact ack comparison.
              let retained = 0;
              for (const input of this.pending)
                if (input.seq > state.ack) this.pending[retained++] = input;
              this.pending.length = retained;
            }
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
  /** Remote-player render time. The buffer covers recent snapshot gaps (Wi-Fi
   * scans, proxy bursts, long frames) instead of freezing peers between late
   * packets. It changes playback speed by at most +5%/-20% rather than jumping,
   * and stays inside the server's hitbox rewind window so lag-compensated
   * shots at the rendered pose still register. */
  interpolationTarget(now: number) {
    const ceiling = Math.max(
      INTERPOLATION_DELAY_MS,
      Math.min(MAX_INTERPOLATION_DELAY_MS, REWIND_MS - 10 - this.ping),
    );
    const wanted = Math.min(
      ceiling,
      Math.max(INTERPOLATION_DELAY_MS, SNAPSHOT_MS + this.jitter + 8),
    );
    const elapsed = Math.min(100, Math.max(0, now - (this.presentedAt ?? now)));
    this.presentedAt = now;
    this.interpolationDelay += Math.max(
      -0.05 * elapsed,
      Math.min(0.2 * elapsed, wanted - this.interpolationDelay),
    );
    return now - this.interpolationDelay;
  }
  step(input: Omit<Input, "seq">) {
    if (this.reconnecting || !this.local || this.socket.readyState !== WebSocket.OPEN) return false;
    // Bound prediction without disconnecting a client during a temporary load stall.
    if (this.pending.length >= MAX_PENDING_INPUTS || this.socket.bufferedAmount > 64 * 1024)
      return false;
    const viewTick = this.renderTick;
    const frame: Input = {
      ...input,
      seq: ++this.seq,
      ...(viewTick === undefined ? {} : { viewTick }),
    };
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
      this.batch.length = 0;
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
