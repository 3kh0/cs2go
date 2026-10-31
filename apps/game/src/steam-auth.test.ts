import { expect, test } from "vitest";
import { createSteamHandler } from "../steam-auth.mjs";

const origin = "http://127.0.0.1:5173";
const steamId = "76561199528285628";
const secret = "unit-tests-only-secret-at-least-32-characters";
const ns = "http://specs.openid.net/auth/2.0";
const provider = "https://steamcommunity.com/openid/login";
const signed = "op_endpoint,claimed_id,identity,return_to,response_nonce,assoc_handle";
const request = (action: string, cookie = "", method = "GET", source = origin) =>
  new Request(`${origin}/api/steam?action=${action}`, {
    method,
    headers: { cookie, origin: source },
  });
function harness() {
  let inventoryPages = 0;
  let valid = true;
  const fetcher = async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === provider) {
      expect((init!.body as URLSearchParams).toString()).toContain(
        "openid.mode=check_authentication",
      );
      return new Response(`ns:${ns}\nis_valid:${valid}\n`);
    }
    if (url.includes("?xml=1"))
      return new Response(
        `<profile><steamID64>${steamId}</steamID64><steamID><![CDATA[<Test Player>]]></steamID><avatarFull><![CDATA[https://avatars.fastly.steamstatic.com/${"a".repeat(40)}_full.jpg]]></avatarFull></profile>`,
      );
    if (url.includes("/inventory/")) {
      inventoryPages++;
      const page = new URL(url).searchParams.has("start_assetid") ? 2 : 1;
      return Response.json({
        success: 1,
        total_inventory_count: 2,
        more_items: page === 1 ? 1 : 0,
        last_assetid: "1",
        assets: [{ assetid: String(page), classid: "4", instanceid: "0" }],
        descriptions: [
          {
            classid: "4",
            instanceid: "0",
            market_hash_name: "AK-47 | Case Hardened (Field-Tested)",
            tags: [{ category: "Weapon", localized_tag_name: "AK-47" }],
          },
        ],
        asset_properties: [
          {
            assetid: String(page),
            asset_properties: [
              { propertyid: 1, int_value: "661" },
              { propertyid: 2, float_value: "0.231234565" },
            ],
          },
        ],
      });
    }
    throw new Error("Unexpected upstream");
  };
  const handle = createSteamHandler({ origin, secret, fetcher });
  async function begin() {
    const response = await handle(request("login"));
    const login = new URL(response.headers.get("location")!);
    expect(login.origin).toBe("https://steamcommunity.com");
    const callback = new URL(login.searchParams.get("openid.return_to")!);
    const cookie = response.headers.getSetCookie()[0].split(";")[0];
    const params = {
      ns,
      mode: "id_res",
      op_endpoint: provider,
      claimed_id: `https://steamcommunity.com/openid/id/${steamId}`,
      identity: `https://steamcommunity.com/openid/id/${steamId}`,
      return_to: callback.href,
      response_nonce: `${new Date().toISOString().slice(0, 19)}Znonce`,
      assoc_handle: "association",
      signed,
      sig: "provider-signature",
    };
    for (const [name, value] of Object.entries(params))
      callback.searchParams.set(`openid.${name}`, value);
    return { callback, cookie };
  }
  async function login() {
    const { callback, cookie } = await begin();
    const response = await handle(new Request(callback, { headers: { cookie } }));
    expect(response.headers.get("location")).toBe(`${origin}/?steam=connected`);
    return response.headers
      .getSetCookie()
      .find((c: string) => c.startsWith("cs2go-steam-session="))!
      .split(";")[0];
  }
  return {
    handle,
    begin,
    login,
    calls: () => inventoryPages,
    invalidate: () => {
      valid = false;
    },
  };
}
test("verifies OpenID server-side, syncs all pages with exact properties, and signs out", async () => {
  const { handle, login, calls } = harness();
  const cookie = await login();
  const session = await (await handle(request("session", cookie))).json();
  expect(session.profile.name).toBe("<Test Player>");
  expect(session.profile.avatar).toBe("/api/steam?action=avatar");
  const response = await handle(request("sync", cookie, "POST"));
  const data = await response.json();
  expect(data.items).toHaveLength(2);
  expect(data.items[0]).toMatchObject({ finish: "Case Hardened", wear: 0.231234565, seed: 661 });
  expect(calls()).toBe(2);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect((await handle(request("sync", cookie, "POST"))).status).toBe(429);
  const logout = await handle(request("logout", cookie, "POST"));
  expect(logout.headers.getSetCookie().join(";")).toContain("Max-Age=0");
});
test("rejects forged sessions, cross-origin mutations and unconfigured production", async () => {
  const { handle } = harness();
  expect((await handle(request("sync", "cs2go-steam-session=forged", "POST"))).status).toBe(401);
  expect((await handle(request("logout", "", "POST", "https://evil.example"))).status).toBe(403);
  expect((await createSteamHandler()(new Request("https://game.example/api/steam"))).status).toBe(
    503,
  );
});
test("rejects OpenID callback state, identity, signed fields, nonce and provider tampering", async () => {
  for (const [name, value] of [
    ["state", "forged"],
    ["openid.claimed_id", "https://evil.example/76561199528285628"],
    ["openid.signed", "identity"],
    ["openid.response_nonce", "2000-01-01T00:00:00Zold"],
    ["openid.return_to", "https://evil.example/"],
    ["openid.op_endpoint", "https://evil.example/"],
  ]) {
    const { handle, begin } = harness();
    const { callback, cookie } = await begin();
    callback.searchParams.set(name, value);
    const response = await handle(new Request(callback, { headers: { cookie } }));
    expect(response.headers.get("location")).toBe(`${origin}/?steam=failed`);
    expect(response.headers.getSetCookie().join(";")).not.toContain("cs2go-steam-session=");
  }
  const { handle, begin, invalidate } = harness();
  const { callback, cookie } = await begin();
  invalidate();
  expect(
    (await handle(new Request(callback, { headers: { cookie } }))).headers.get("location"),
  ).toContain("steam=failed");
});
test("fails closed on private or incomplete inventories", async () => {
  // Use a signed session from the same signing key, while replacing only upstream inventory data.
  const cookie = await harness().login();
  for (const data of [
    { success: 0 },
    { success: 1, assets: [{ assetid: "1", classid: "missing", instanceid: "0" }] },
    { success: 1, assets: [], more_items: 1, last_assetid: "1" },
  ]) {
    const handle = createSteamHandler({ origin, secret, fetcher: async () => Response.json(data) });
    const response = await handle(request("sync", cookie, "POST"));
    expect(response.status).toBe(502);
    expect((await response.json()).items).toBeUndefined();
  }
});

test("Steam 429s expose a real cooldown, suppress repeat upstream work and recover", async () => {
  const cookie = await harness().login();
  let time = Date.now(),
    calls = 0;
  const handle = createSteamHandler({
    origin,
    secret,
    now: () => time,
    fetcher: async () => {
      calls++;
      return calls === 1
        ? new Response(null, { status: 429, headers: { "Retry-After": "90" } })
        : Response.json({ success: 1, total_inventory_count: 0 });
    },
  });
  const first = await handle(request("sync", cookie, "POST"));
  expect(first.status).toBe(429);
  expect(first.headers.get("retry-after")).toBe("90");
  time += 10000;
  const repeated = await handle(request("sync", cookie, "POST"));
  expect(repeated.status).toBe(429);
  expect(repeated.headers.get("retry-after")).toBe("80");
  expect(calls).toBe(1);
  time += 81000;
  const recovered = await handle(request("sync", cookie, "POST"));
  expect(recovered.status).toBe(200);
  expect((await recovered.json()).items).toEqual([]);
  expect(calls).toBe(2);
});
