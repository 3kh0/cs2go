import { expect, test, type WebSocketRoute } from "@playwright/test";
import { joinLobby } from "./multiplayer-helpers";

test("prediction and reconnect survive a capped ordered link with latency and jitter", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const timers = new Set<ReturnType<typeof setTimeout>>();
  let peakQueueMs = 0;
  let receivedBytes = 0;
  await page.routeWebSocket("ws://127.0.0.1:3002/ws", (client) => {
    const server = client.connectToServer();
    let closed = false;
    const relay = (target: WebSocketRoute, bytesPerSecond: number, down: boolean) => {
      let available = performance.now();
      let delivered = available;
      let index = 0;
      return (message: string | Buffer) => {
        const now = performance.now();
        const bytes = Buffer.byteLength(message);
        if (down) receivedBytes += bytes;
        if (down && index === 30) available = Math.max(available, now) + 250;
        available = Math.max(now, available) + (bytes * 1000) / bytesPerSecond;
        // Model 60 ms propagation per direction plus 0..30 ms deterministic
        // jitter. Preserve ordering, like the production WebSocket transport.
        delivered = Math.max(delivered, available + 60 + ((index++ * 17) % 31));
        peakQueueMs = Math.max(peakQueueMs, delivered - now);
        const timer = setTimeout(() => {
          timers.delete(timer);
          if (!closed) target.send(message);
        }, delivered - now);
        timers.add(timer);
      };
    };
    client.onMessage(relay(server, 8_000, false));
    server.onMessage(relay(client, 32_000, true));
    client.onClose((code, reason) => {
      closed = true;
      void server.close({ code, reason });
    });
    server.onClose((code, reason) => {
      closed = true;
      void client.close({ code, reason });
    });
  });
  try {
    await joinLobby(page, `capped-${Date.now()}`, "ct");
    const initial = await page.evaluate(() => {
      const connection = window.__game.network!.connection;
      return { id: connection.id, z: connection.local!.z };
    });
    await page.locator("#game").click();
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(900);
    await page.keyboard.up("KeyW");
    await page.waitForFunction(() => window.__game.network!.connection.local!.ack > 16);
    const moved = await page.evaluate(() => {
      const connection = window.__game.network!.connection;
      return { z: connection.local!.z, pending: connection.pending.length };
    });
    expect(Math.abs(moved.z - initial.z)).toBeGreaterThan(0.1);
    expect(moved.pending).toBeLessThanOrEqual(128);
    await page.evaluate(() =>
      window.__game.network!.connection.socket.close(4000, "Test recovery"),
    );
    await page.waitForFunction(() => window.__game.network!.connection.reconnecting);
    await page.waitForFunction((id) => {
      const connection = window.__game.network?.connection;
      return connection?.id === id && !connection.reconnecting && (connection.local?.ack ?? 0) > 0;
    }, initial.id);
    expect(errors).toEqual([]);
    await test.info().attach("capped-link", {
      body: JSON.stringify(
        {
          uploadBytesPerSecond: 8_000,
          downloadBytesPerSecond: 32_000,
          oneWayLatencyMs: 60,
          jitterMs: 30,
          headOfLineStallMs: 250,
          peakQueueMs,
          receivedBytes,
          moved,
        },
        null,
        2,
      ),
      contentType: "application/json",
    });
  } finally {
    for (const timer of timers) clearTimeout(timer);
  }
});
