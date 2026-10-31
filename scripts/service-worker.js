/* Build prepends ASSET_REVISIONS, ASSET_SIZES, BUILD_ID and SHELL_URLS.
 * HTML is network-first; immutable code/assets remain available across updates.
 */
const SHELL_CACHE = `cs2go-shell-${BUILD_ID}`;
const ASSET_CACHE = "cs2go-assets-v1";
const CODE_CACHE = "cs2go-code-v1";
const REVISION = "__cs2go_revision";
const origin = self.location.origin;
const assetBase = typeof ASSET_BASE === "undefined" ? "" : ASSET_BASE;
const assetPath = (url) => {
  if (assetBase && url.href.startsWith(`${assetBase}/`))
    return url.href.slice(assetBase.length).split("?")[0];
  return url.origin === origin ? url.pathname : null;
};
const networkUrl = (path) =>
  assetBase && !path.startsWith("/assets/") && path !== "/" ? `${assetBase}${path}` : path;
const pending = new Map();
let writes = Promise.resolve();
let inventory;
const keyFor = (path) => `${origin}${path}?${REVISION}=${ASSET_REVISIONS[path]}`;
const isSkin = (path) => path.startsWith("/skins/") || path.startsWith("/models/agents/roster/");
const sizeFor = (path) => ASSET_SIZES[path] || 0;
async function verified(response, path) {
  const bytes = await response.clone().arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
  return {
    valid:
      hash === ASSET_REVISIONS[path] ||
      (typeof ASSET_DECODED_REVISIONS !== "undefined" && hash === ASSET_DECODED_REVISIONS[path]),
    size: bytes.byteLength,
  };
}
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const paths = [...SHELL_URLS];
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          for (let path = paths.shift(); path; path = paths.shift()) {
            let response;
            try {
              response = await fetch(networkUrl(path), {
                cache:
                  path === "/" || networkUrl(path).startsWith("https://")
                    ? "reload"
                    : "force-cache",
              });
            } catch {
              // A previous no-CORS favicon/image request can leave an unreadable
              // HTTP-cache entry. Retry with Origin rather than aborting install.
            }
            if (!response?.ok || !(await verified(response, path)).valid) {
              response = await fetch(networkUrl(path), { cache: "reload" });
              if (!response.ok || !(await verified(response, path)).valid)
                throw new Error("Shell revision unavailable");
            }
            if (path.startsWith("/assets/"))
              await (await caches.open(CODE_CACHE)).put(path, response.clone());
            await cache.put(path, response);
          }
        }),
      );
      await self.skipWaiting();
    })(),
  );
});
self.addEventListener("message", (event) => {
  if (event.data?.type === "CHECK_SHELL")
    event.ports[0]?.postMessage({
      current:
        Array.isArray(event.data.paths) &&
        event.data.paths.length > 0 &&
        event.data.paths.every((path) => SHELL_URLS.includes(path)),
    });
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const names = await caches.keys();
        // Retain verified, hashed chunks needed by a match running an older app.
        const code = await caches.open(CODE_CACHE);
        for (const name of names.filter(
          (name) => name.startsWith("cs2go-shell-") && name !== SHELL_CACHE,
        )) {
          const old = await caches.open(name);
          for (const request of await old.keys()) {
            if (!new URL(request.url).pathname.startsWith("/assets/")) continue;
            const hit = await old.match(request);
            if (hit) await code.put(request, hit);
          }
          await caches.delete(name);
        }
        const codeKeys = await code.keys();
        for (const key of codeKeys.slice(0, Math.max(0, codeKeys.length - 64)))
          await code.delete(key);
        const cache = await caches.open(ASSET_CACHE);
        for (const request of await cache.keys()) {
          const url = new URL(request.url);
          if (
            !ASSET_REVISIONS[assetPath(url)] ||
            url.searchParams.get(REVISION) !== ASSET_REVISIONS[assetPath(url)]
          )
            await cache.delete(request);
        }
      } catch {
        /* Storage denial must not prevent the network game. */
      }
      await self.clients.claim();
    })(),
  );
});
async function storeAsset(cache, path, response) {
  if (!response.ok) return;
  const verification = await verified(response, path);
  if (!verification.valid) return;
  if (!inventory) {
    inventory = new Map();
    for (const request of await cache.keys()) {
      const url = new URL(request.url);
      const stored = await cache.match(request);
      const size = Number(stored?.headers.get("x-cs2go-cache-size")) || sizeFor(url.pathname);
      inventory.set(url.pathname, { key: request.url, size });
    }
  }
  const skin = isSkin(path),
    budget = (skin ? 64 : 384) * 1024 * 1024;
  const size = verification.size;
  if (!size || size > budget) return;
  let used = 0;
  for (const [storedPath, item] of inventory) if (isSkin(storedPath) === skin) used += item.size;
  if (!inventory.has(path)) {
    for (const [storedPath, item] of inventory) {
      if (used + size <= budget) break;
      if (isSkin(storedPath) !== skin) continue;
      await cache.delete(item.key);
      inventory.delete(storedPath);
      used -= item.size;
    }
  }
  const headers = new Headers(response.headers);
  headers.set("x-cs2go-cache-size", String(size));
  await cache.put(
    keyFor(path),
    new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    }),
  );
  inventory.set(path, { key: keyFor(path), size });
}
self.addEventListener("fetch", (event) => {
  const request = event.request,
    url = new URL(request.url);
  if (request.method !== "GET" || !assetPath(url) || request.headers.has("range")) return;
  // Login redirects and authenticated API responses must always reach the server.
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const live = await fetch(request, { cache: "no-store" });
          if (live.ok || live.status < 500) return live;
          return (await (await caches.open(SHELL_CACHE)).match("/")) || live;
        } catch {
          const offline = await (await caches.open(SHELL_CACHE)).match("/");
          if (offline) return offline;
          throw new Error("App is unavailable offline");
        }
      })(),
    );
    return;
  }
  const path = assetPath(url);
  if (url.search) return;
  if (path.startsWith("/assets/") && !Object.hasOwn(ASSET_REVISIONS, path)) {
    event.respondWith(
      (async () => (await (await caches.open(CODE_CACHE)).match(path)) || fetch(request))(),
    );
    return;
  }
  if (!Object.hasOwn(ASSET_REVISIONS, path)) return;
  let cacheHit = false;
  const response = (async () => {
    try {
      if (SHELL_URLS.includes(path)) {
        const shell = await caches.open(SHELL_CACHE);
        const hit = await shell.match(path);
        if (hit) {
          cacheHit = true;
          return hit;
        }
      }
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(keyFor(path));
      if (hit) {
        cacheHit = true;
        return hit;
      }
    } catch {
      /* Cache API can be unavailable even when workers are enabled. */
    }
    let network = pending.get(path);
    if (!network) {
      // Public CDN responses must be readable, including CSS/background images,
      // so the same byte verification and offline cache work for every asset.
      const readable =
        assetBase && url.href.startsWith(`${assetBase}/`)
          ? new Request(request, { mode: "cors", credentials: "omit" })
          : request;
      network = fetch(readable).catch((error) => {
        if (readable === request) throw error;
        return fetch(readable, { cache: "reload" });
      });
      pending.set(path, network);
      void network.finally(() => pending.delete(path)).catch(() => {});
    }
    return (await network).clone();
  })();
  let cacheWork;
  const delivered = response.then((result) => {
    // Cached bodies can be hundreds of MiB per boot. Don't tee them or perform
    // a second disk lookup when there is nothing to populate.
    if (cacheHit) return result;
    // Clone before resolving respondWith; the browser may consume its body immediately.
    const copy = result.clone();
    cacheWork = (async () => {
      const cache = await caches.open(ASSET_CACHE);
      if (SHELL_URLS.includes(path) || (await cache.match(keyFor(path)))) return;
      writes = writes
        .then(() => storeAsset(cache, path, copy))
        .catch(() => {
          inventory = undefined;
        });
      await writes;
    })().catch(() => {});
    return result;
  });
  event.respondWith(delivered);
  event.waitUntil(delivered.then(() => cacheWork).catch(() => {}));
});
