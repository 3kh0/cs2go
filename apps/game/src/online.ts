import * as T from "three";
import { validRoom, neutralInput, type Input, type ServerMessage } from "@cs2go/protocol";
import { STEP } from "@cs2go/simulation/match";
import { movement, weapons } from "./physics";
import { createWorld } from "./world";
import { enableTextureTranscoding } from "./gltf";
import { animateGun, createGun, loadWeaponModels, VIEWMODEL_FOV } from "./weapons";
import {
  animateSoldier,
  createSoldier,
  disposeSoldier,
  loadSoldierModels,
  setSoldierWeapon,
  type Soldier,
} from "./soldier";
import { bindWeaponInstance } from "./skins";
import { createWeaponInstance } from "./weapon-instance";
import { WeaponAudio } from "./audio";
import { OnlineConnection } from "./online-connection";
import "./fonts.css";
import "./online.css";

const el = (id: string) => document.getElementById(id)!;
document.getElementById("online-app")!.innerHTML = `
<canvas id="online-canvas" aria-label="Multiplayer Dust Yard"></canvas>
<section id="online-lobby" class="online-overlay"><form id="online-form" class="online-panel">
<a href="/" class="online-back">‹ BACK TO MAIN MENU</a><small>PRIVATE MULTIPLAYER · PREVIEW</small><h1>DUST YARD</h1>
<p>Join friends for a private free-for-all. AK-47 · 10 players · Automatic respawns.</p>
<label>GAME SERVER<input id="online-server" type="url" placeholder="wss://your-game-server.example/ws" required></label>
<label>ROOM CODE<div class="online-room"><input id="online-room" pattern="[a-zA-Z0-9_-]{12,32}" minlength="12" maxlength="32" required><button id="online-new-room" type="button">NEW</button></div></label>
<label>YOUR NAME<input id="online-name" maxlength="24" value="PLAYER" required></label>
<label>SERVER PASSWORD <span>(if required)</span><input id="online-password" type="password" maxlength="128" autocomplete="off"></label>
<button id="online-join" class="online-primary" disabled>LOADING EQUIPMENT…</button>
<p id="online-status" role="status">Loading models and sounds…</p>
<small>Guest names · No Steam identity verification in this preview</small>
</form></section>
<div id="online-hud" hidden><header><strong>DUST YARD</strong><span id="online-telemetry"></span><button id="online-share">COPY INVITE</button><button id="online-disconnect">DISCONNECT</button></header>
<div id="online-feed" aria-live="polite"></div><div id="online-crosshair">+</div>
<div id="online-hint"></div><footer><strong id="online-health">100</strong><span>AK-47</span><strong id="online-ammo">30</strong></footer>
<div id="online-scoreboard" hidden><h2>PRIVATE FREE-FOR-ALL</h2><div id="online-scores"></div></div>
</div><button id="online-resume" hidden>CLICK TO RESUME</button>`;

const serverInput = el("online-server") as HTMLInputElement;
const roomInput = el("online-room") as HTMLInputElement;
const nameInput = el("online-name") as HTMLInputElement;
const passwordInput = el("online-password") as HTMLInputElement;
const params = new URLSearchParams(location.search);
serverInput.value =
  params.get("server") ||
  import.meta.env.VITE_MULTIPLAYER_URL ||
  (import.meta.env.DEV ? "ws://127.0.0.1:3001/ws" : "");
roomInput.value = validRoom(params.get("room")) ? params.get("room")! : newRoom();
function newRoom() {
  return [...crypto.getRandomValues(new Uint8Array(9))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
el("online-new-room").onclick = () => {
  roomInput.value = newRoom();
};
const canvas = el("online-canvas") as HTMLCanvasElement;
const renderer = new T.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.autoClear = false;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const scene = new T.Scene();
scene.background = new T.Color(0xbad6e5);
scene.fog = new T.Fog(0xbad6e5, 42, 100);
createWorld(scene);
const camera = new T.PerspectiveCamera(90, 1, 0.05, 120);
camera.rotation.order = "YXZ";
camera.position.set(17, 9, 20);
camera.lookAt(0, 1, 0);
const view = new T.Scene();
view.add(new T.HemisphereLight(0xe3f1ff, 0x80684a, 2));
const sun = new T.DirectionalLight(0xffefd5, 3);
sun.position.set(-10, 20, 8);
view.add(sun);
const viewCamera = new T.PerspectiveCamera(VIEWMODEL_FOV, 1, 0.01, 10);
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = viewCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  viewCamera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);
enableTextureTranscoding(renderer);
const audio = new WeaponAudio();
let audioContext: AudioContext | undefined;
let gun: T.Group | undefined;
let connection: OnlineConnection | undefined;
const actors = new Map<string, Soldier>();
const keys = new Set<string>();
let jump = false,
  reload = false,
  firing = false,
  yaw = 0,
  pitch = 0;
let accumulator = 0,
  last = performance.now(),
  lastShot = -Infinity,
  lastSpawn = 0;
let reloadStart = 0;
let ready = false;
const traces: { line: T.Line; until: number }[] = [];
const traceMaterial = new T.LineBasicMaterial({ color: 0xffd889, transparent: true, opacity: 0.6 });
function clearActors() {
  for (const actor of actors.values()) {
    scene.remove(actor.group);
    disposeSoldier(actor);
  }
  actors.clear();
  for (const trace of traces) {
    scene.remove(trace.line);
    trace.line.geometry.dispose();
  }
  traces.length = 0;
}
function clearInputs() {
  keys.clear();
  jump = reload = firing = false;
  connection?.stopInput();
}
function disconnected(reason: string) {
  connection = undefined;
  clearActors();
  clearInputs();
  el("online-lobby").hidden = false;
  el("online-hud").hidden = true;
  el("online-resume").hidden = true;
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  el("online-status").textContent = reason;
  (el("online-join") as HTMLButtonElement).disabled = !ready;
}
async function lock() {
  try {
    await canvas.requestPointerLock();
  } catch {
    /* Resume button remains visible. */
  }
  if (audioContext?.state === "suspended") await audioContext.resume();
}
function onMessage(message: ServerMessage) {
  if (message.type === "error") el("online-status").textContent = message.message;
  if (message.type !== "snapshot" || !connection) return;
  const local = connection.local;
  if (!local) return;
  const first = el("online-hud").hidden;
  el("online-lobby").hidden = true;
  el("online-hud").hidden = false;
  el("online-resume").hidden = document.pointerLockElement === canvas;
  if (local.spawn !== lastSpawn) {
    lastSpawn = local.spawn;
    yaw = local.yaw;
    pitch = local.pitch;
  }
  if (first) void lock();
  const ids = new Set(message.players.map((player) => player.id));
  for (const [id, actor] of actors)
    if (!ids.has(id)) {
      scene.remove(actor.group);
      disposeSoldier(actor);
      actors.delete(id);
    }
  for (const player of message.players)
    if (player.id !== connection.id && !actors.has(player.id)) {
      const actor = createSoldier(actors.size, player.team);
      setSoldierWeapon(actor, 0, false, createWeaponInstance(0, player.id));
      scene.add(actor.group);
      actors.set(player.id, actor);
    }
  for (const event of message.events) {
    if (event.kind === "shot") {
      if (event.shooter === connection.id) lastShot = performance.now();
      const actor = actors.get(event.shooter);
      if (actor) actor.shotTime = 0.25;
      if (audioContext) {
        const from = new T.Vector3(event.from.x, event.from.y, event.from.z);
        const distance = from.distanceTo(camera.position);
        audio.play(
          audioContext,
          "shot",
          0,
          35,
          T.MathUtils.clamp((from.x - camera.position.x) / 15, -1, 1),
          distance,
        );
      }
      const geometry = new T.BufferGeometry().setFromPoints([
        new T.Vector3(event.from.x, event.from.y, event.from.z),
        new T.Vector3(event.to.x, event.to.y, event.to.z),
      ]);
      const line = new T.Line(geometry, traceMaterial);
      scene.add(line);
      traces.push({ line, until: performance.now() + 75 });
    } else {
      const names = new Map(message.players.map((player) => [player.id, player.name]));
      const row = document.createElement("div");
      row.textContent = `${names.get(event.killer) ?? "PLAYER"}  AK-47 ${event.headshot ? "⌖" : ""}  ${names.get(event.victim) ?? "PLAYER"}`;
      el("online-feed").append(row);
      while (el("online-feed").childElementCount > 5) el("online-feed").firstElementChild!.remove();
      setTimeout(() => row.remove(), 6000);
    }
  }
  el("online-health").textContent = String(Math.ceil(local.health));
  el("online-ammo").textContent = `${local.ammo} / ${local.reserve}`;
  el("online-telemetry").textContent =
    `${message.players.length}/10 PLAYERS · ${connection.ping} MS · 128 TICK`;
  el("online-hint").textContent =
    local.health <= 0
      ? `Respawning in ${Math.ceil(local.respawnTime)}…`
      : local.reloadTime > 0
        ? "Reloading…"
        : "";
  if (local.reloadTime > 0 && !reloadStart) reloadStart = performance.now();
  if (local.reloadTime === 0) reloadStart = 0;
  const scores = message.players
    .toSorted((a, b) => b.kills - a.kills)
    .map((player) => {
      const row = document.createElement("div");
      row.className = player.id === connection?.id ? "you" : "";
      for (const text of [player.name, `${player.kills} K`, `${player.deaths} D`]) {
        const span = document.createElement("span");
        span.textContent = text;
        row.append(span);
      }
      return row;
    });
  el("online-scores").replaceChildren(...scores);
}
(el("online-form") as HTMLFormElement).onsubmit = (event) => {
  event.preventDefault();
  if (!ready || connection) return;
  try {
    const url = new URL(serverInput.value);
    if (
      !["ws:", "wss:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.hash ||
      url.search ||
      url.pathname !== "/ws"
    )
      throw new Error("Use the game's ws:// or wss:// server address ending in /ws.");
    if (location.protocol === "https:" && url.protocol !== "wss:")
      throw new Error("An HTTPS page requires a secure wss:// game server.");
    if (!validRoom(roomInput.value))
      throw new Error("Room codes must be 12–32 letters, numbers, - or _.");
    audioContext ??= new AudioContext();
    void audioContext.resume();
    el("online-status").textContent = "Connecting…";
    (el("online-join") as HTMLButtonElement).disabled = true;
    lastSpawn = 0;
    accumulator = 0;
    reloadStart = 0;
    connection = new OnlineConnection(
      url.href,
      roomInput.value,
      nameInput.value.trim(),
      passwordInput.value,
      onMessage,
      disconnected,
    );
    const invite = new URL(location.href);
    invite.search = "";
    invite.searchParams.set("server", url.href);
    invite.searchParams.set("room", roomInput.value);
    history.replaceState(null, "", invite);
  } catch (error) {
    el("online-status").textContent = (error as Error).message;
  }
};
el("online-disconnect").onclick = () => connection?.close();
el("online-share").onclick = async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    el("online-share").textContent = "INVITE COPIED";
  } catch {
    el("online-hint").textContent = "Copy this page's address to invite a friend.";
  }
};
el("online-resume").onclick = () => void lock();
canvas.onclick = () => {
  if (connection) void lock();
};
window.addEventListener("keydown", (event) => {
  if (!connection?.local || document.pointerLockElement !== canvas) return;
  if (["Tab", "Space", "KeyW", "KeyA", "KeyS", "KeyD"].includes(event.code)) event.preventDefault();
  if (event.code === "Space" && !keys.has(event.code)) jump = true;
  if (event.code === "KeyR" && !keys.has(event.code)) reload = true;
  if (event.code === "Tab") el("online-scoreboard").hidden = false;
  keys.add(event.code);
});
window.addEventListener("keyup", (event) => {
  keys.delete(event.code);
  if (event.code === "Tab") el("online-scoreboard").hidden = true;
});
window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement !== canvas) return;
  yaw = Math.atan2(
    Math.sin(yaw - event.movementX * 0.002),
    Math.cos(yaw - event.movementX * 0.002),
  );
  pitch = T.MathUtils.clamp(pitch + event.movementY * 0.002, -1.5, 1.5);
});
window.addEventListener("mousedown", (event) => {
  if (document.pointerLockElement === canvas && event.button === 0) firing = true;
});
window.addEventListener("mouseup", () => {
  firing = false;
});
window.addEventListener("blur", clearInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) clearInputs();
});
document.addEventListener("pointerlockchange", () => {
  clearInputs();
  el("online-scoreboard").hidden = true;
  el("online-resume").hidden = !connection?.local || document.pointerLockElement === canvas;
});
window.addEventListener("pagehide", () => connection?.close());

function sampleRemote(id: string, now: number) {
  const history = connection!.history;
  const target = now - 100;
  let before = history[0],
    after = history.at(-1)!;
  for (let index = 1; index < history.length; index++)
    if (history[index].at >= target) {
      before = history[index - 1];
      after = history[index];
      break;
    }
  const a = before.players.find((player) => player.id === id);
  const b = after.players.find((player) => player.id === id);
  if (!a || !b || a.spawn !== b.spawn) return b ?? a;
  const alpha = T.MathUtils.clamp((target - before.at) / Math.max(1, after.at - before.at), 0, 1);
  return {
    ...b,
    x: T.MathUtils.lerp(a.x, b.x, alpha),
    y: T.MathUtils.lerp(a.y, b.y, alpha),
    z: T.MathUtils.lerp(a.z, b.z, alpha),
    yaw: a.yaw + Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw)) * alpha,
  };
}
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (document.hidden) {
    accumulator = 0;
    return;
  }
  if (connection?.local) {
    accumulator += dt;
    while (accumulator >= STEP) {
      accumulator -= STEP;
      const input: Omit<Input, "seq"> =
        document.pointerLockElement === canvas
          ? {
              forward: Number(keys.has("KeyW")) - Number(keys.has("KeyS")),
              right: Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
              yaw,
              pitch,
              jump,
              duck: keys.has("ControlLeft") || keys.has("KeyC"),
              walk: keys.has("ShiftLeft"),
              fire: firing,
              reload,
            }
          : { ...neutralInput(), yaw, pitch };
      connection.step(input);
      jump = reload = false;
    }
    const local = connection.local;
    camera.position.set(local.x, local.y + local.eye, local.z);
    camera.rotation.set(pitch, yaw, 0, "YXZ");
    for (const [id, actor] of actors) {
      const state = sampleRemote(id, now);
      if (!state) continue;
      actor.group.position.set(state.x, state.y, state.z);
      actor.group.rotation.y = state.yaw + Math.PI;
      actor.group.visible = state.health > 0;
      actor.moveX =
        state.vx * Math.cos(actor.group.rotation.y) - state.vz * Math.sin(actor.group.rotation.y);
      actor.moveZ =
        state.vx * Math.sin(actor.group.rotation.y) + state.vz * Math.cos(actor.group.rotation.y);
      actor.crouch = (movement.standingEye - state.eye) / (movement.standingEye - movement.duckEye);
      actor.airborne = !state.grounded;
      animateSoldier(actor, Math.hypot(state.vx, state.vz), dt, true);
    }
    if (gun) {
      gun.visible = local.health > 0;
      const shot = (now - lastShot) / 1000;
      animateGun(gun, {
        reload: reloadStart ? Math.min(1, (now - reloadStart) / 1000 / weapons[0].reload) : 0,
        reloadActive: local.reloadTime > 0,
        draw: 0,
        bolt: 0,
        recoil: Math.max(0, 0.1 - shot),
        bob: Math.sin(now / 100) * Math.hypot(local.vx, local.vz) * 0.0017,
        sway: 0,
        shot: Math.min(1, shot / 0.15),
        shotActive: shot < 0.15,
        clock: now / 1000,
        time: now / 1000,
      });
    }
  }
  for (let index = traces.length - 1; index >= 0; index--)
    if (now >= traces[index].until) {
      const [{ line }] = traces.splice(index, 1);
      scene.remove(line);
      line.geometry.dispose();
    }
  renderer.clear();
  renderer.render(scene, camera);
  if (connection?.local) {
    renderer.clearDepth();
    renderer.render(view, viewCamera);
  }
}
requestAnimationFrame(frame);
try {
  await Promise.all([loadWeaponModels(renderer), loadSoldierModels(), audio.load()]);
  gun = createGun(0);
  bindWeaponInstance(gun, createWeaponInstance(0, "online-default"));
  view.add(gun);
  ready = true;
  (el("online-join") as HTMLButtonElement).disabled = false;
  el("online-join").textContent = "JOIN ROOM";
  el("online-status").textContent = "Create a room code, then share your invite with friends.";
} catch (error) {
  el("online-status").textContent =
    `Could not load equipment: ${(error as Error).message}. Reload to retry.`;
}
