import { expect, test, type Page } from "@playwright/test";
import { CHAT_INTERVAL_MS, PROTOCOL_VERSION } from "@cs2go/protocol";
import type { Game } from "../src/game";

declare global {
  interface Window {
    __game: Game;
  }
}
test.use({ actionTimeout: 15000 });

async function join(page: Page, room: string, team: "ct" | "t") {
  await page.goto(`/?server=ws://127.0.0.1:3002/ws&room=${room}`);
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  await page.locator("#home-play").click();
  await page.locator("#play").click();
  await page.locator(`#team-select [data-team="${team}"]`).click();
  await page.waitForFunction(() => !!window.__game.network?.connection.local);
}

test("team and all chat use server routing, suppress gameplay input, and support rebinding", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const contexts = [await browser.newContext(), await browser.newContext()];
  const [a, b] = await Promise.all(contexts.map((context) => context.newPage()));
  const room = `chat-${Date.now()}`;
  const errors: string[] = [];
  for (const page of [a, b]) page.on("pageerror", (error) => errors.push(error.message));
  const activate = async (page: Page) => {
    await page.bringToFront();
    if (!(await page.evaluate(() => window.__game.locked))) await page.locator("#game").click();
    await page.waitForFunction(() => window.__game.locked);
  };
  try {
    await join(a, room, "ct");
    await join(b, room, "t");
    await activate(a);
    await a.keyboard.press("KeyT");
    await expect(a.getByRole("textbox", { name: "Team chat message" })).toBeFocused();
    const before = await a.evaluate(() => ({
      ammo: window.__game.ammo,
      selected: window.__game.selected,
    }));
    await a.keyboard.type("wasd rgb 1234");
    expect(
      await a.evaluate(() => ({ ammo: window.__game.ammo, selected: window.__game.selected })),
    ).toEqual(before);
    expect(await a.evaluate(() => Array.from(window.__game.keys))).toEqual([]);
    await a.locator("#chat-input").fill("Team secret");
    await a.keyboard.press("Enter");
    await expect(a.locator("#chat-log")).toContainText("(TEAM) PLAYER: Team secret");
    await expect(a.locator("#chat-input")).toBeHidden();
    await activate(b);
    await b.keyboard.press("KeyY");
    await expect(b.getByRole("textbox", { name: "All chat message" })).toBeFocused();
    await b.locator("#chat-input").fill("<b>Hello everyone</b>");
    await b.keyboard.press("Enter");
    await expect(a.locator("#chat-log")).toContainText("(ALL) PLAYER: <b>Hello everyone</b>");
    await expect(b.locator("#chat-log")).toContainText("<b>Hello everyone</b>");
    await expect(b.locator("#chat-log")).not.toContainText("Team secret");
    await expect(a.locator("#chat-log b")).toHaveCount(0);
    // A late join receives no old team history, and receives new team messages.
    await b.evaluate(
      async ({ room, version }) => {
        const socket = new WebSocket("ws://127.0.0.1:3002/ws");
        const received: { type: string; text?: string }[] = [];
        (
          window as unknown as { chatPeer: { socket: WebSocket; received: typeof received } }
        ).chatPeer = { socket, received };
        socket.onmessage = (event) => received.push(JSON.parse(event.data));
        await new Promise<void>((resolve) => {
          socket.onopen = () => resolve();
        });
        socket.send(
          JSON.stringify({
            type: "join",
            version,
            room,
            name: "Ally",
            password: "",
            mode: "casual",
            team: "ct",
          }),
        );
      },
      { room, version: PROTOCOL_VERSION },
    );
    await b.waitForFunction(() =>
      (window as unknown as { chatPeer: { received: { type: string }[] } }).chatPeer.received.some(
        (message) => message.type === "welcome",
      ),
    );
    await activate(a);
    await a.waitForTimeout(CHAT_INTERVAL_MS);
    await a.keyboard.press("KeyT");
    await a.locator("#chat-input").fill("Hold the site");
    await a.keyboard.press("Enter");
    await b.waitForFunction(() =>
      (
        window as unknown as { chatPeer: { received: { type: string; text?: string }[] } }
      ).chatPeer.received.some(
        (message) => message.type === "chat" && message.text === "Hold the site",
      ),
    );
    await expect(b.locator("#chat-log")).not.toContainText("Hold the site");
    await a.keyboard.press("KeyY");
    await a.locator("#chat-input").fill("Cancelled draft");
    await a.keyboard.press("Escape");
    await expect(a.locator("#chat-input")).toBeHidden();
    await expect(a.locator("#chat-log")).not.toContainText("Cancelled draft");
    if (await a.evaluate(() => window.__game.locked))
      await a.evaluate(() => document.exitPointerLock());
    await a.locator("#pause-settings").click();
    await a.getByRole("tab", { name: "Controls", exact: true }).click();
    await expect(a.getByRole("button", { name: "Rebind Team chat", exact: true })).toHaveText("T");
    await expect(a.getByRole("button", { name: "Rebind All chat", exact: true })).toHaveText("Y");
    await a.getByRole("button", { name: "Rebind Team chat", exact: true }).click();
    await a.keyboard.press("KeyU");
    await a.locator("#close-settings").click();
    await a.locator("#resume").click();
    await a.waitForFunction(() => window.__game.locked);
    await a.keyboard.press("KeyT");
    await expect(a.locator("#chat-input")).toBeHidden();
    await a.keyboard.press("KeyU");
    await expect(a.getByRole("textbox", { name: "Team chat message" })).toBeFocused();
    await a.screenshot({ path: "artifacts/multiplayer-chat.png" });
    expect(errors).toEqual([]);
  } finally {
    await Promise.all(contexts.map((context) => context.close()));
  }
});
