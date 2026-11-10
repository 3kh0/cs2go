// Maintained acceptance for the four imported maps. Add to the package test
// command only after public assets and map readiness have been promoted. This
// test intentionally cannot admit candidate maps or consume staged artifacts.
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { Vector3 } from "three";
import {
  isMapId,
  neutralInput,
  PROTOCOL_VERSION,
  SnapshotDecoder,
  type Input,
  type MapId,
  type PlayerState,
  type ServerMessage,
  type Team,
} from "@cs2go/protocol";
import { loadServerMap } from "../src/map";
import { startServer } from "../src/server";
import { createMatch, createPlayer, joinMatch, stepMatch, STEP } from "@cs2go/simulation/match";
import { movePlayer } from "@cs2go/simulation/movement";
import { groundSpawn } from "@cs2go/simulation/spawn-position";
import { mapTriggers } from "@cs2go/simulation/buy-zones";
import { movement } from "@cs2go/simulation/physics";
import { Navigation, type MapNavigation } from "../../game/src/navigation";

const imported = ["vertigo", "nuke", "inferno", "cache"] as const;
const selected = process.argv.slice(2);
assert(
  selected.every((id) => imported.some((known) => known === id)),
  "Specify only vertigo, nuke, inferno or cache",
);
const ids: readonly MapId[] = selected.length ? (selected as MapId[]) : imported;
for (const id of ids)
  assert(
    isMapId(id),
    `${id}: native-map server regression requires accepted public readiness; candidate admission is forbidden`,
  );
const directory = resolve(import.meta.dir, "../../../packages/assets/public/models/maps");
const hull = { halfWidth: movement.hullRadius, height: movement.standingHeight };

function advance(
  match: ReturnType<typeof createMatch>,
  seconds: number,
  inputs = new Map<string, Input>(),
) {
  for (let tick = 0; tick < Math.ceil(seconds / STEP); tick++) stepMatch(match, inputs);
}
async function verify(id: MapId) {
  const started = performance.now();
  const map = await loadServerMap(directory, id);
  const nav = (await Bun.file(resolve(directory, `${id}-nav.json`)).json()) as MapNavigation;
  const triggers = mapTriggers(map);
  assert.equal(map.id, id);
  assert.equal(map.bombDamage?.siteCount, 2, `${id}: native C4 site fields`);
  assert((map.bombDamage?.positionCount ?? 0) > 0, `${id}: native baked blast samples`);
  assert.equal(triggers.bombSites.sites.length, 2);
  for (const team of ["ct", "t"] as const)
    for (const [index, raw] of map.spawns[team].entries()) {
      const label = `${id}:${team} spawn ${index}`;
      const position = new Vector3().fromArray(raw);
      assert(groundSpawn(position, map.collision), `${label}: source ground support`);
      assert(
        !map.collision.blocked(position.x, position.z, position.y, hull.halfWidth, hull.height),
        `${label}: standing hull clear`,
      );
      assert(
        triggers.buyZones.contains(position, team, hull),
        `${label}: own-team native buy brush`,
      );
      assert(
        !triggers.buyZones.contains(position, team === "ct" ? "t" : "ct", hull),
        `${label}: opposing team cannot buy`,
      );
      const actor = createPlayer("spawn", "Spawn probe", team);
      Object.assign(actor, { x: position.x, y: position.y, z: position.z });
      for (let tick = 0; tick < 128; tick++) movePlayer(actor, neutralInput(), STEP, map);
      assert(
        actor.grounded && Math.abs(actor.y - position.y) < 1e-5,
        `${label}: stable supported standing feet after 128 ticks`,
      );
      assert(
        Math.hypot(actor.x - position.x, actor.z - position.z) < 1e-5,
        `${label}: neutral input does not eject spawn`,
      );
    }
  function fixture(mode: "casual" | "competitive" = "casual") {
    const match = createMatch(mode, map),
      ct = createPlayer("ct", "CT", "ct"),
      t = createPlayer("t", "T", "t");
    joinMatch(match, ct);
    joinMatch(match, t);
    stepMatch(match, new Map());
    return { match, ct, t };
  }
  function place(player: PlayerState, point: readonly number[]) {
    const position = new Vector3().fromArray(point);
    assert(
      groundSpawn(position, map.collision),
      `${id}: supported player placement ${JSON.stringify(point)}`,
    );
    Object.assign(player, {
      x: position.x,
      y: position.y,
      z: position.z,
      vx: 0,
      vz: 0,
      vertical: 0,
      grounded: true,
      cooldown: 0,
    });
  }
  let exitYaw = 0;
  for (const mode of ["casual", "competitive"] as const) {
    const { match, ct, t } = fixture(mode);
    assert.equal(match.state.phase, "freeze");
    assert.equal(t.armor, mode === "casual" ? 100 : 0);
    t.money = 10000;
    stepMatch(match, new Map([[t.id, { ...neutralInput(), buy: 0 }]]));
    assert(t.magazines[0] && t.money < 10000, `${id}/${mode}: buy from actual native spawn`);
    match.state.phase = "live";
    match.state.remaining = 100;
    place(t, map.spawns.t[0]);
    let best: PlayerState | undefined,
      bestDistance = 0;
    // Deterministic bounded search finds a real supported, unobstructed native
    // spawn exit instead of hardcoding a point that only works on flat Dust II.
    for (let direction = 0; direction < 32; direction++) {
      const yaw = (direction * Math.PI) / 16,
        probe = structuredClone(t),
        input = { ...neutralInput(), forward: 1, yaw };
      for (let tick = 0; tick < 64; tick++) movePlayer(probe, input, STEP, map);
      const distance = Math.hypot(probe.x - t.x, probe.z - t.z);
      if (
        probe.grounded &&
        distance > bestDistance &&
        map.collision.visible(
          new Vector3(t.x, t.y + t.eye, t.z),
          new Vector3(probe.x, probe.y + 0.95, probe.z),
        )
      ) {
        best = probe;
        exitYaw = yaw;
        bestDistance = distance;
      }
    }
    assert(best && bestDistance > 0.5, `${id}: supported combat exit from T spawn`);
    const predicted = structuredClone(t),
      moving = { ...neutralInput(), forward: 1, yaw: exitYaw };
    for (let tick = 0; tick < 32; tick++) {
      movePlayer(predicted, moving, STEP, map);
      stepMatch(match, new Map([[t.id, moving]]));
    }
    assert.deepEqual(
      [t.x, t.y, t.z],
      [predicted.x, predicted.y, predicted.z],
      `${id}/${mode}: prediction and authoritative native hull movement`,
    );
    place(t, map.spawns.t[0]);
    place(ct, [best.x, best.y, best.z]);
    advance(match, 0.5);
    const dx = ct.x - t.x,
      dz = ct.z - t.z,
      ammo = t.ammo;
    const shots = stepMatch(
      match,
      new Map([
        [
          t.id,
          {
            ...neutralInput(),
            fire: true,
            yaw: Math.atan2(-dx, -dz),
            pitch: Math.atan2(t.y + t.eye - (ct.y + 0.95), Math.hypot(dx, dz)),
          },
        ],
      ]),
    );
    assert(
      t.ammo < ammo && ct.health < 100,
      `${id}/${mode}: authoritative hitscan across actual native exit`,
    );
    assert(
      shots.some(
        (event) => event.kind === "hurt" && event.victim === ct.id && event.attacker === t.id,
      ),
      `${id}/${mode}: damage event identifies actual target`,
    );
  }
  const navigation = new Navigation(nav, map.collision);
  for (const index of [0, 1]) {
    const site = navigation.site(index).toArray();
    const { match, ct, t } = fixture();
    match.state.phase = "live";
    match.state.remaining = 100;
    place(t, site);
    assert.equal(
      triggers.bombSites.site(t, hull),
      index,
      `${id}: floor-correct native site ${index}`,
    );
    match.state.bomb.carrier = t.id;
    advance(match, 3.3, new Map([[t.id, { ...neutralInput(), use: true }]]));
    assert(match.state.bomb.planted, `${id}: site ${index} plants`);
    const bomb = match.state.bomb;
    let defuser: Vector3 | undefined;
    for (const radius of [0.5, 0.8, 1.1])
      for (let direction = 0; direction < 16 && !defuser; direction++) {
        const point = new Vector3(
          bomb.x + Math.cos((direction * Math.PI) / 8) * radius,
          bomb.y,
          bomb.z + Math.sin((direction * Math.PI) / 8) * radius,
        );
        if (groundSpawn(point, map.collision)) defuser = point;
      }
    assert(defuser, `${id}: site ${index} supports a defuse approach`);
    place(ct, defuser.toArray());
    ct.kit = true;
    advance(match, 5.1, new Map([[ct.id, { ...neutralInput(), use: true }]]));
    assert.equal(match.state.result?.reason, "Bomb defused", `${id}: site ${index} defuses`);
    const blast = fixture();
    blast.match.state.phase = "live";
    blast.match.state.remaining = 100;
    place(blast.ct, site);
    Object.assign(blast.match.state.bomb, {
      x: site[0],
      y: blast.ct.y,
      z: site[2],
      planted: true,
      timer: STEP / 2,
      carrier: null,
      planter: blast.t.id,
    });
    stepMatch(blast.match, new Map());
    assert.equal(blast.match.state.result?.reason, "Bomb detonated");
    assert.equal(blast.ct.health, 0, `${id}: site ${index} native baked blast is lethal nearby`);
  }
  await verifyTransport(id, map, exitYaw);
  console.log(
    JSON.stringify({
      map: id,
      publicAssets: true,
      spawns: Object.values(map.spawns).flat().length,
      modes: ["casual", "competitive"],
      plantDefuseBlastSites: 2,
      twoClients: true,
      reconnect: true,
      seconds: (performance.now() - started) / 1000,
    }),
  );
}

async function verifyTransport(
  id: MapId,
  map: Awaited<ReturnType<typeof loadServerMap>>,
  exitYaw: number,
) {
  const app = startServer({
    map,
    port: 0,
    hostname: "127.0.0.1",
    origins: ["http://localhost:5173"],
  });
  const sockets: WebSocket[] = [];
  async function until(check: () => boolean, label: string, failure?: () => Error | undefined) {
    const deadline = performance.now() + 5000;
    while (!check()) {
      const error = failure?.();
      if (error) throw error;
      assert(performance.now() < deadline, `${id}: ${label} timed out`);
      await Bun.sleep(5);
    }
  }
  async function join(team: Team, room = "", resume?: string) {
    const messages: ServerMessage[] = [],
      decoder = new SnapshotDecoder();
    let failure: Error | undefined;
    const socket = new WebSocket(`ws://127.0.0.1:${app.server.port}/ws`, {
      headers: { Origin: "http://localhost:5173" },
    });
    sockets.push(socket);
    socket.onerror = () => {
      failure = new Error(`${id}: socket failed during handshake`);
    };
    socket.onclose = (event) => {
      failure = new Error(`${id}: socket closed ${event.code}: ${event.reason}`);
    };
    socket.onmessage = (event) => {
      try {
        const message = decoder.decode(JSON.parse(String(event.data)));
        if (!message) return;
        messages.push(message);
        if (message.type === "error")
          failure = new Error(`${id}: server rejected handshake: ${message.message}`);
      } catch (error) {
        failure = new Error(`${id}: invalid server snapshot`, { cause: error });
      }
    };
    await until(
      () => socket.readyState === WebSocket.OPEN,
      "socket open",
      () => failure,
    );
    socket.send(
      JSON.stringify({
        type: "join",
        version: PROTOCOL_VERSION,
        map: id,
        name: team,
        mode: "casual",
        team,
        create: !room,
        room,
        resume,
      }),
    );
    await until(
      () => messages.some((message) => message.type === "welcome"),
      "native map welcome",
      () => failure,
    );
    const welcome = messages.find((message) => message.type === "welcome")!;
    assert.equal(welcome.map, id);
    return { socket, messages, welcome, failure: () => failure };
  }
  try {
    const ct = await join("ct"),
      t = await join("t", ct.welcome.room);
    await until(
      () => ct.messages.some((message) => message.type === "snapshot"),
      "initial authoritative snapshot",
      ct.failure,
    );
    const room = app.rooms.get(ct.welcome.room)!;
    assert.equal(room.map.id, id);
    assert.equal(room.players.size, 2);
    room.state.phase = "live";
    room.state.remaining = 100;
    const actor = room.players.get(t.welcome.id)!;
    const start = [actor.x, actor.z];
    for (let batch = 0; batch < 8; batch++) {
      t.socket.send(
        JSON.stringify({
          type: "inputs",
          inputs: Array.from({ length: 8 }, (_, index) => ({
            ...neutralInput(batch * 8 + index + 1),
            forward: 1,
            yaw: exitYaw,
          })),
        }),
      );
      await Bun.sleep(64);
    }
    t.socket.send(JSON.stringify({ type: "inputs", inputs: [neutralInput(65)] }));
    await until(
      () => Math.hypot(actor.x - start[0], actor.z - start[1]) > 0.5,
      "real WebSocket input moves native hull",
      t.failure,
    );
    ct.socket.close(4000, "native map reconnect test");
    await until(() => ct.socket.readyState === WebSocket.CLOSED, "intentional reconnect close");
    const recovered = await join("ct", ct.welcome.room, ct.welcome.resume);
    assert.equal(recovered.welcome.id, ct.welcome.id);
    assert.equal(room.players.size, 2);
    await until(
      () => recovered.messages.some((message) => message.type === "snapshot"),
      "reconnected native snapshot",
      recovered.failure,
    );
  } finally {
    for (const socket of sockets) socket.close();
    await app.stop();
  }
}
for (const id of ids) {
  await verify(id);
  Bun.gc(true);
}
