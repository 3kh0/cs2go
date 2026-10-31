import { expect, it } from "vitest";
// @ts-expect-error Node is provided by the test runner.
import { readFileSync } from "node:fs";
// @ts-expect-error Node is provided by the test runner.
import { runInNewContext } from "node:vm";

it.each(["", "https://cdn.test/releases/abc"])(
  "keeps verified cache and API isolation with CDN base %s",
  async (base) => {
    const origin = "https://game.test";
    const digest = async (text: string) =>
      Array.from(
        new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))),
        (n) => n.toString(16).padStart(2, "0"),
      ).join("");
    const revisions = {
      "/": await digest("shell"),
      "/model.bin": await digest("model"),
      "/changed.bin": await digest("old"),
      "/models/agents/roster/a.glb.gz": await digest("new"),
      "/models/agents/roster/b.glb.gz": await digest("new"),
    };
    const stores = new Map<string, Map<string, Response>>();
    const key = (value: string | Request) =>
      typeof value === "string" ? new URL(value, origin).href : value.url;
    const cachesMock = {
      async keys() {
        return [...stores.keys()];
      },
      async delete(name: string) {
        return stores.delete(name);
      },
      async open(name: string) {
        if (!stores.has(name)) stores.set(name, new Map());
        const store = stores.get(name)!;
        return {
          async keys() {
            return [...store.keys()].map((url) => new Request(url));
          },
          async match(request: string | Request) {
            return store.get(key(request))?.clone();
          },
          async put(request: string | Request, response: Response) {
            store.set(key(request), response.clone());
          },
          async delete(request: string | Request) {
            return store.delete(key(request));
          },
        };
      },
    };
    const handlers = new Map<string, (event: unknown) => void>();
    let fetches = 0,
      claimed = false;
    let skipped = false,
      online = true,
      html = "shell",
      htmlStatus = 200;
    const selfMock = {
      location: { origin },
      async skipWaiting() {
        skipped = true;
      },
      clients: {
        async claim() {
          claimed = true;
        },
      },
      addEventListener(name: string, handler: (event: unknown) => void) {
        handlers.set(name, handler);
      },
    };
    runInNewContext(
      readFileSync("../../scripts/service-worker.js", "utf8").replace(
        "(skin ? 64 : 384) * 1024 * 1024",
        "(skin ? 3 : 20)",
      ),
      {
        ASSET_BASE: base,
        ASSET_REVISIONS: revisions,
        ASSET_SIZES: { "/model.bin": 5, "/changed.bin": 3 },
        BUILD_ID: "test",
        SHELL_URLS: ["/"],
        self: selfMock,
        caches: cachesMock,
        crypto,
        URL,
        Uint8Array,
        Headers,
        Request,
        Response,
        fetch: async (request: string | Request) => {
          fetches++;
          if (!online) throw new Error("offline");
          const path = new URL(key(request)).pathname.replace("/releases/abc", "");
          if (base && typeof request !== "string" && request.url.startsWith(base)) {
            expect(request.mode).toBe("cors");
          }
          return new Response(path === "/" ? html : path === "/model.bin" ? "model" : "new", {
            status: path === "/" ? htmlStatus : 200,
          });
        },
      },
    );
    async function lifecycle(name: string) {
      let done: Promise<unknown> | undefined;
      handlers.get(name)!({
        waitUntil(promise: Promise<unknown>) {
          done = promise;
        },
      });
      await done;
    }
    await lifecycle("install");
    expect(skipped).toBe(true);
    stores.set(
      "cs2go-shell-old",
      new Map([[`${origin}/assets/old-hash.js`, new Response("old code")]]),
    );
    await lifecycle("activate");
    expect(claimed).toBe(true);
    expect(stores.has("cs2go-shell-old")).toBe(false);
    async function request(path: string, range = false, navigate = false) {
      let response: Promise<Response> | undefined, done: Promise<unknown> | undefined;
      handlers.get("fetch")!({
        request: navigate
          ? { url: `${origin}${path}`, method: "GET", mode: "navigate", headers: new Headers() }
          : new Request(
              `${base && !path.startsWith("/api/") ? base : origin}${path}`,
              range ? { headers: { Range: "bytes=0-1" } } : {},
            ),
        respondWith(value: Promise<Response>) {
          response = value.then(async (result) => new Response(await result.text()));
        },
        waitUntil(value: Promise<unknown>) {
          done = value;
        },
      });
      const result = response ? await (await response).text() : undefined;
      await done;
      return result;
    }
    expect(await request("/model.bin")).toBe("model");
    const count = fetches;
    expect(await request("/model.bin")).toBe("model");
    expect(fetches).toBe(count);
    await request("/models/agents/roster/a.glb.gz");
    await request("/models/agents/roster/b.glb.gz");
    const stored = [...stores.get("cs2go-assets-v1")!.keys()];
    expect(stored.some((url) => url.includes("/model.bin?"))).toBe(true);
    expect(stored.some((url) => url.includes("/roster/a.glb.gz?"))).toBe(false);
    expect(stored.some((url) => url.includes("/roster/b.glb.gz?"))).toBe(true);
    expect(await request("/changed.bin")).toBe("new");
    expect(
      [...stores.get("cs2go-assets-v1")!.keys()].some((url) => url.includes("changed.bin")),
    ).toBe(false);
    expect(await request("/assets/old-hash.js")).toBe("old code");
    html = "latest shell";
    expect(await request("/", false, true)).toBe("latest shell");
    htmlStatus = 403;
    html = "Authorization required";
    expect(await request("/", false, true)).toBe("Authorization required");
    htmlStatus = 500;
    expect(await request("/", false, true)).toBe("shell");
    htmlStatus = 200;
    online = false;
    expect(await request("/", false, true)).toBe("shell");
    online = true;
    expect(await request("/model.bin", true)).toBeUndefined();
    expect(await request("/api/status")).toBeUndefined();
    expect(await request("/api/steam?action=login", false, true)).toBeUndefined();
  },
);
