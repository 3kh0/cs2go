import { writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { joinLobby, lobbyPin } from "./multiplayer-helpers";

test("native selected-agent capsules agree with rendered bones and authoritative head and leg shots", async ({
  browser,
  request,
}) => {
  test.setTimeout(240_000);
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  for (const context of contexts)
    await context.addInitScript(() =>
      localStorage.setItem("cs2go-agents", JSON.stringify({ ct: "default-ct", t: "agent-5036-t" })),
    );
  const [a, b] = await Promise.all(contexts.map((context) => context.newPage()));
  const label = `native-hitboxes-${Date.now()}`,
    errors: string[] = [];
  for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
  const command = async (op: string, viewTick?: number) => {
    const response = await request.post("http://127.0.0.1:3004", {
      data: { room: lobbyPin(label), op, viewTick },
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  async function focus(page: Page) {
    await page.bringToFront();
    if (!(await page.evaluate(() => window.__game.locked))) {
      const resume = page.locator("#resume");
      if (await resume.isVisible()) await resume.click();
      else await page.locator("#game").click();
    }
    await page.waitForFunction(() => window.__game.locked);
  }
  try {
    await joinLobby(a, label, "ct");
    await joinLobby(b, label, "t");
    const duel = await command("duel");
    for (const [page, team] of [
      [a, "ct"],
      [b, "t"],
    ] as const)
      await page.evaluate(
        (yaw) => {
          window.__game.yaw = yaw;
          window.__game.pitch = 0;
        },
        duel.players.find((p: { team: string }) => p.team === team).yaw,
      );
    await focus(a);
    await a.waitForFunction(
      () =>
        !!window.__game.bots[0]?.rig.nativeActions &&
        window.__game.bots[0].rig.agentId === "agent-5036-t",
    );
    await a.waitForTimeout(500);
    const capture = () =>
      a.evaluate(async (room) => {
        const path = "/src/soldier-hitboxes.ts";
        const { soldierHitboxes } = (await import(
          path
        )) as typeof import("../src/soldier-hitboxes");
        const g = window.__game,
          peer = g.bots[0];
        peer.group.updateMatrixWorld(true);
        const visual = {
          tick: g.network!.connection.renderTick,
          agent: peer.rig.agentId,
          crouch: peer.rig.crouch,
          phase: peer.rig.phase,
          clock: peer.rig.networkPose,
          speed: peer.speed,
          move: [peer.rig.moveX, peer.rig.moveZ],
          position: peer.group.position.toArray(),
          yaw: peer.group.rotation.y,
          history: g.network!.connection.history.slice(-8).map((frame) => ({
            tick: frame.tick,
            at: frame.at,
            target: frame.players.find((p) => p.team === "t"),
          })),
          capsules: soldierHitboxes(peer.rig).map((box) => ({
            group: box.group,
            start: box.start.clone().applyMatrix4(box.bone.matrixWorld).toArray(),
            end: box.end.clone().applyMatrix4(box.bone.matrixWorld).toArray(),
          })),
        };
        const response = await fetch("http://127.0.0.1:3004", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room, op: "native-hitboxes", viewTick: visual.tick }),
        });
        if (!response.ok) throw new Error("Native pose read-only fixture query failed");
        return { visual, snapshot: await response.json() };
      }, lobbyPin(label));
    let comparisons = 0;
    const compare = async (tolerance: number) => {
      // Background tabs may stop rendering longer than the rewind budget.
      // Compare a fresh actual model frame rather than a clamped stale image.
      await a.bringToFront();
      const previous = await a.evaluate(() => window.__game.network!.connection.renderTick);
      await a.waitForFunction(
        (tick) => window.__game.network!.connection.renderTick !== tick,
        previous,
      );
      const { visual, snapshot } = await capture();
      expect(visual.tick).toBeGreaterThan(0);
      expect(visual.agent).toBe("agent-5036-t");
      const target = snapshot.players.find((p: { team: string }) => p.team === "t");
      expect(target.agent).toBe("agent-5036-t");
      const capsules = snapshot.capsules[target.id] as {
        start: number[];
        end: number[];
        group: number;
      }[];
      expect(capsules).toHaveLength(19);
      const distances = visual.capsules.map((box, i) =>
        Math.max(
          Math.hypot(...box.start.map((x, k) => x - capsules[i].start[k])),
          Math.hypot(...box.end.map((x, k) => x - capsules[i].end[k])),
        ),
      );
      writeFileSync(
        `artifacts/server-hitboxes-agreement-${comparisons++}.json`,
        JSON.stringify(
          { visual, snapshot, tolerance, distances, lagTicks: snapshot.tick - visual.tick! },
          null,
          2,
        ),
      );
      expect(snapshot.tick - visual.tick!).toBeLessThan(32);
      expect(Math.max(...distances)).toBeLessThan(tolerance);
      return { visual, target };
    };
    await compare(0.012);
    // Aim at the actual animated leg, not its movement hull or a synthetic
    // target. Health/events still come only from the authoritative server.
    const aim = async (groups: number[]) =>
      a.evaluate(async (groups) => {
        const path = "/src/soldier-hitboxes.ts",
          three = "/tests/three-fixture.ts";
        const { soldierHitboxes, soldierHit } = (await import(
          path
        )) as typeof import("../src/soldier-hitboxes");
        const { Ray, Vector3 } = (await import(three)) as typeof import("three");
        const g = window.__game,
          peer = g.bots[0],
          from = g.position.clone();
        from.y += g.eye;
        peer.group.updateMatrixWorld(true);
        for (const box of soldierHitboxes(peer.rig)) {
          if (!groups.includes(box.group)) continue;
          const point = box.start
              .clone()
              .lerp(box.end, box.group === 1 ? 0.85 : 0.5)
              .applyMatrix4(box.bone.matrixWorld),
            direction = new Vector3().subVectors(point, from).normalize();
          const hit = soldierHit(peer.rig, new Ray(from, direction));
          if (!hit || !groups.includes(hit.group)) continue;
          g.yaw = Math.atan2(-direction.x, -direction.z);
          g.pitch = Math.asin(direction.y);
          return { group: hit.group, target: point.toArray() };
        }
        throw new Error("Native chosen limb is occluded by another capsule");
      }, groups);
    const health = () =>
      a.evaluate(
        () =>
          window.__game.network!.connection.history.at(-1)!.players.find((p) => p.team === "t")!
            .health,
      );
    await a.waitForFunction(() => window.__game.cooldown === 0 && window.__game.drawTime === 0);
    const leg = await aim([6, 7]);
    expect([6, 7]).toContain(leg.group);
    await a.waitForTimeout(100);
    const before = await health();
    await a.mouse.down();
    await a.mouse.up();
    await expect.poll(health).toBeLessThan(before);
    const legHealth = await health();
    expect(before - legHealth).toBeLessThan(30);
    await a.waitForFunction(() => window.__game.cooldown === 0);
    const head = await aim([1]);
    expect(head.group).toBe(1);
    await a.waitForTimeout(100);
    await a.screenshot({ path: "artifacts/server-native-head-aim.png" });
    await a.mouse.down();
    await a.mouse.up();
    await expect.poll(health).toBeLessThan(legHealth);
    expect(legHealth - (await health())).toBeGreaterThan(45);
    // Actual remote strafing/crouching/yaw changes must keep the delayed model
    // and server-owned history on the same native pose clock, not index-seeded
    // client animation. Return to a supported native duel before this phase.
    const moving = await command("duel");
    for (const [page, team] of [
      [a, "ct"],
      [b, "t"],
    ] as const)
      await page.evaluate(
        (yaw) => {
          window.__game.yaw = yaw;
          window.__game.pitch = 0;
        },
        moving.players.find((p: { team: string }) => p.team === team).yaw,
      );
    await focus(b);
    const start = await b.evaluate(() => ({
      x: window.__game.position.x,
      z: window.__game.position.z,
    }));
    await b.keyboard.down("d");
    await b.waitForTimeout(350);
    expect(
      await b.evaluate(
        (p) => Math.hypot(window.__game.position.x - p.x, window.__game.position.z - p.z),
        start,
      ),
    ).toBeGreaterThan(0.25);
    await compare(0.025);
    await b.keyboard.up("d");
    await focus(b);
    await b.keyboard.down("d");
    await b.keyboard.down("Control");
    await b.evaluate(() => {
      window.__game.yaw += 0.4;
    });
    await b.waitForTimeout(300);
    const crouch = await compare(0.025);
    expect(crouch.visual.crouch).toBeGreaterThan(0.8);
    // Refocusing stops the target's current input, while the displayed actor is
    // still100ms behind. Fire at that visible historical head through inputs.
    await focus(a);
    await aim([1]);
    const movingHealth = await health();
    await a.mouse.down();
    await a.mouse.up();
    await expect.poll(health).toBeLessThan(movingHealth - 45);
    await b.keyboard.up("d");
    await b.keyboard.up("Control");
    expect(errors).toEqual([]);
  } finally {
    for (const context of contexts) await context.close();
  }
});
