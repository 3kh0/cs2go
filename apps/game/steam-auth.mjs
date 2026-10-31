import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { steamInventoryPage } from "./steam-inventory-data.mjs";

const provider = "https://steamcommunity.com/openid/login";
const ns = "http://specs.openid.net/auth/2.0";
const identifier = "http://specs.openid.net/auth/2.0/identifier_select";
const idPattern = /^7656119\d{10}$/;
const avatarPattern =
  /^https:\/\/avatars\.(?:fastly\.|akamai\.|cloudflare\.)?steamstatic\.com\/[a-f0-9]{40}(?:_full|_medium)?\.jpg$/;

/** Isolated per server instance; no Steam credentials or API keys reach the client. */
export function createSteamHandler({ secret, origin, fetcher = fetch, now = Date.now } = {}) {
  const key = secret || randomBytes(32).toString("hex");
  const profiles = new Map();
  const inventories = new Map();
  const attempts = new Map();
  const cooldowns = new Map();
  const sign = (body) => createHmac("sha256", key).update(body).digest("base64url");
  const token = (claims, seconds) => {
    const body = Buffer.from(JSON.stringify({ ...claims, exp: now() + seconds * 1000 })).toString(
      "base64url",
    );
    return `${body}.${sign(body)}`;
  };
  function verify(value, type) {
    try {
      const [body, mac, extra] = (value || "").split(".");
      const expected = sign(body);
      if (
        extra ||
        !mac ||
        mac.length !== expected.length ||
        !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
      )
        return null;
      const claims = JSON.parse(Buffer.from(body, "base64url").toString());
      return claims.type === type && claims.exp > now() ? claims : null;
    } catch {
      return null;
    }
  }
  function limited(seconds, operation = "inventory") {
    const error = new Error(
      operation === "inventory"
        ? "Steam is rate limiting inventory requests. Try again after the cooldown, or import your inventory locally."
        : "Steam is rate limiting requests. Please try again later.",
    );
    error.status = 429;
    error.retryAfter = seconds;
    error.retryAt = now() + seconds * 1000;
    return error;
  }
  async function upstream(url, options = {}) {
    const operation = String(url).includes("/inventory/")
      ? "inventory"
      : String(url).includes("?xml=1")
        ? "profile"
        : String(url) === provider
          ? "openid"
          : "avatar";
    const remaining = Math.ceil(((cooldowns.get(operation) || 0) - now()) / 1000);
    if (remaining > 0) throw limited(remaining, operation);
    const response = await fetcher(url, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      let retryAfter;
      if (response.status === 429) {
        const header = response.headers.get("retry-after");
        const seconds = /^\d+$/.test(header || "")
          ? Number(header)
          : header
            ? Math.ceil((Date.parse(header) - now()) / 1000)
            : 120;
        retryAfter = Number.isFinite(seconds) ? Math.max(5, Math.min(86400, seconds)) : 120;
        cooldowns.set(operation, now() + retryAfter * 1000);
      }
      // Deliberately omit URLs, SteamIDs, query strings and cookies from logs.
      console.warn(
        JSON.stringify({
          event: "steam_upstream_error",
          operation,
          status: response.status,
          ...(retryAfter ? { retryAfterSeconds: retryAfter } : {}),
        }),
      );
      if (response.status === 429) throw limited(retryAfter, operation);
      throw new Error(
        response.status === 403 && operation === "inventory"
          ? "Steam inventory is private. Make your Inventory public, then sync again."
          : "Steam could not be reached. Please try again later.",
      );
    }
    return response;
  }
  async function cached(map, id, load, ttl) {
    const prior = map.get(id);
    if (prior && prior.until > now()) return prior.value;
    if (map.size >= 256) map.delete(map.keys().next().value);
    // Cache in-flight work and failures briefly too, so repeated clicks do not hammer Steam.
    const value = Promise.resolve().then(load);
    map.set(id, { until: now() + ttl, value });
    try {
      return await value;
    } catch (error) {
      map.set(id, { until: now() + Math.max(30000, (error.retryAfter || 0) * 1000), value });
      throw error;
    }
  }
  async function profile(id) {
    return cached(
      profiles,
      id,
      async () => {
        const xml = await (
          await upstream(`https://steamcommunity.com/profiles/${id}/?xml=1`)
        ).text();
        const field = (name) => {
          const value = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1] || "";
          if (value.startsWith("<![CDATA[") && value.endsWith("]]>")) return value.slice(9, -3);
          return value.replace(/&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, code, entity) =>
            code
              ? String.fromCodePoint(Number(code.startsWith("x") ? `0${code}` : code))
              : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[entity],
          );
        };
        if (field("steamID64") !== id)
          throw new Error("Steam profile could not load. Try again later.");
        const avatar = field("avatarFull");
        return {
          steamId: id,
          name: field("steamID").slice(0, 128) || "Steam player",
          avatar: avatarPattern.test(avatar) ? avatar : null,
          profileUrl: `https://steamcommunity.com/profiles/${id}/`,
        };
      },
      300000,
    );
  }
  async function inventory(id) {
    return cached(
      inventories,
      id,
      async () => {
        const items = new Map();
        const cursors = new Set();
        let cursor = "";
        for (let page = 0; page < 50; page++) {
          const url = new URL(`https://steamcommunity.com/inventory/${id}/730/2`);
          url.search = new URLSearchParams({
            l: "english",
            count: "2000",
            ...(cursor ? { start_assetid: cursor } : {}),
          }).toString();
          const data = await (await upstream(url)).json();
          if (data.success !== 1)
            throw new Error(
              "Steam inventory is unavailable or private. Make your Inventory public, then sync again.",
            );
          const normalized = steamInventoryPage(data);
          for (const item of normalized.items) items.set(item.assetId, item);
          if (!data.more_items) {
            return {
              items: [...items.values()],
              reportedTotal: Number.isFinite(data.total_inventory_count)
                ? data.total_inventory_count
                : items.size,
              syncedAt: now(),
            };
          }
          cursor = data.last_assetid;
          if (!/^\d+$/.test(cursor || "") || cursors.has(cursor)) break;
          cursors.add(cursor);
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
        throw new Error("Steam returned an incomplete inventory. No partial inventory was synced.");
      },
      300000,
    );
  }
  return async function handle(request) {
    const url = new URL(request.url);
    const local =
      url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    const base = origin ? new URL(origin).origin : local ? url.origin : null;
    const headers = new Headers({
      "Cache-Control": "no-store, private",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
    });
    const json = (body, status = 200) => {
      const output = new Headers(headers);
      output.set("Content-Type", "application/json");
      return new Response(JSON.stringify(body), { status, headers: output });
    };
    if (!base || (!local && (!secret || secret.length < 32)))
      return json({ error: "Steam login is not configured on this host." }, 503);
    if (url.origin !== base) return json({ error: "Invalid Steam login origin." }, 400);
    const cookieName = (type) => `${base.startsWith("https:") ? "__Host-" : ""}cs2go-steam-${type}`;
    const cookies = new Map(
      (request.headers.get("cookie") || "").split(";").map((c) => {
        const at = c.indexOf("=");
        return [c.slice(0, at).trim(), c.slice(at + 1)];
      }),
    );
    const cookie = (type, value, seconds) =>
      headers.append(
        "Set-Cookie",
        `${cookieName(type)}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${base.startsWith("https:") ? "; Secure" : ""}`,
      );
    const redirect = (location) =>
      new Response(null, {
        status: 303,
        headers: new Headers([...headers, ["Location", location]]),
      });
    const action = url.searchParams.get("action") || "session";
    const isPost = ["logout", "sync"].includes(action);
    if (request.method !== (isPost ? "POST" : "GET"))
      return json({ error: "Method not allowed." }, 405);
    if (isPost && request.headers.get("origin") !== base)
      return json({ error: "Invalid request origin." }, 403);
    try {
      if (action === "login") {
        const state = token({ type: "state", nonce: randomBytes(32).toString("hex") }, 600);
        cookie("state", state, 600);
        const destination = new URL(provider);
        destination.search = new URLSearchParams({
          "openid.ns": ns,
          "openid.mode": "checkid_setup",
          "openid.return_to": `${base}/api/steam?action=callback&state=${state}`,
          "openid.realm": `${base}/`,
          "openid.identity": identifier,
          "openid.claimed_id": identifier,
        }).toString();
        return redirect(destination.href);
      }
      if (action === "callback") {
        const state = url.searchParams.get("state");
        const claims = verify(state, "state");
        cookie("state", "", 0);
        const fail = () => redirect(`${base}/?steam=failed`);
        if (!claims || state !== cookies.get(cookieName("state"))) return fail();
        const p = url.searchParams;
        for (const name of new Set(p.keys())) if (p.getAll(name).length !== 1) return fail();
        const identity = p.get("openid.claimed_id") || "";
        const id = identity.replace("https://steamcommunity.com/openid/id/", "");
        const signed = new Set((p.get("openid.signed") || "").split(","));
        const nonce = p.get("openid.response_nonce") || "";
        const age = now() - Date.parse(nonce.slice(0, 20));
        if (
          p.get("openid.ns") !== ns ||
          p.get("openid.mode") !== "id_res" ||
          p.get("openid.op_endpoint") !== provider ||
          !idPattern.test(id) ||
          identity !== `https://steamcommunity.com/openid/id/${id}` ||
          p.get("openid.identity") !== identity ||
          p.get("openid.return_to") !== `${base}/api/steam?action=callback&state=${state}` ||
          !Number.isFinite(age) ||
          age < -60000 ||
          age > 600000 ||
          ![
            "op_endpoint",
            "claimed_id",
            "identity",
            "return_to",
            "response_nonce",
            "assoc_handle",
          ].every((name) => signed.has(name))
        )
          return fail();
        const body = new URLSearchParams([...p].filter(([name]) => name.startsWith("openid.")));
        body.set("openid.mode", "check_authentication");
        const checked = await (await upstream(provider, { method: "POST", body })).text();
        if (!checked.split(/\r?\n/).includes("is_valid:true")) return fail();
        cookie("session", token({ type: "session", steamId: id }, 86400), 86400);
        return redirect(`${base}/?steam=connected`);
      }
      if (action === "logout") {
        cookie("session", "", 0);
        cookie("state", "", 0);
        return json({ profile: null });
      }
      const session = verify(cookies.get(cookieName("session")), "session");
      if (!session || !idPattern.test(session.steamId))
        return json(
          action === "session" ? { profile: null } : { error: "Sign in with Steam first." },
          action === "session" ? 200 : 401,
        );
      if (action === "session") {
        const p = await profile(session.steamId);
        return json({
          profile: {
            ...p,
            publicAvatar: p.avatar,
            avatar: p.avatar ? "/api/steam?action=avatar" : null,
          },
        });
      }
      if (action === "sync") {
        const last = attempts.get(session.steamId) || 0;
        if (now() - last < 5000) {
          const retryAfter = Math.ceil((5000 - (now() - last)) / 1000);
          headers.set("Retry-After", String(retryAfter));
          return json(
            { error: "Please wait a few seconds before syncing again.", retryAfter },
            429,
          );
        }
        if (attempts.size >= 256) attempts.delete(attempts.keys().next().value);
        attempts.set(session.steamId, now());
        return json(await inventory(session.steamId));
      }
      if (action === "avatar") {
        const p = await profile(session.steamId);
        if (!p.avatar) return new Response(null, { status: 404, headers });
        const response = await upstream(p.avatar);
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength > 2097152) throw new Error("Steam avatar is too large.");
        headers.set("Content-Type", "image/jpeg");
        return new Response(bytes, { headers });
      }
      return json({ error: "Unknown Steam action." }, 404);
    } catch (error) {
      if (action === "callback") return redirect(`${base}/?steam=failed`);
      const retryAfter = error.retryAt
        ? Math.max(1, Math.ceil((error.retryAt - now()) / 1000))
        : undefined;
      if (retryAfter) headers.set("Retry-After", String(retryAfter));
      return json(
        {
          error: error instanceof Error ? error.message : "Steam sync failed.",
          ...(retryAfter ? { retryAfter } : {}),
        },
        error.status || 502,
      );
    }
  };
}

export function steamNodeHandler(options) {
  const handler = createSteamHandler(options);
  return async (req, res) => {
    const host = options.origin || `http://${req.headers.host}`;
    const request = new Request(new URL(req.url, host), {
      method: req.method,
      headers: req.headers,
    });
    const response = await handler(request);
    res.statusCode = response.status;
    for (const [name, value] of response.headers)
      if (name !== "set-cookie") res.setHeader(name, value);
    const cookies = response.headers.getSetCookie();
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    res.end(Buffer.from(await response.arrayBuffer()));
  };
}

export function steamAuthPlugin() {
  return {
    name: "cs2go-steam-auth",
    configureServer(server) {
      server.middlewares.use(
        "/api/steam",
        steamNodeHandler({
          secret: process.env.STEAM_SESSION_SECRET,
          origin: process.env.STEAM_ORIGIN,
        }),
      );
    },
    configurePreviewServer(server) {
      server.middlewares.use(
        "/api/steam",
        steamNodeHandler({
          secret: process.env.STEAM_SESSION_SECRET,
          origin: process.env.STEAM_ORIGIN,
        }),
      );
    },
  };
}
