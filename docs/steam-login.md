# Steam account and CS2 inventory

Click **SIGN IN** in the homepage's right sidebar, then **SIGN IN THROUGH STEAM**. Steam handles your credentials and returns to CS2GO. The signed-in Steam name and avatar appear on the homepage and scoreboard; the name also appears in kill feeds and MVP announcements. Inventory sync runs on sign-in/page load unless a successful local snapshot is less than ten minutes old, with a **SYNC INVENTORY** button for later refreshes. The finish browser also has **STEAM INVENTORY** to open the account page.

Steam OpenID proves the SteamID; it does not grant private inventory access or supply the CS2 equipped loadout. CS2GO separately reads the account's public profile and public CS2 inventory. Set Steam **Inventory** to Public to sync. There is no Steam API key requirement for these public Community endpoints. No Steam password, Steam session cookie, trade token or third-party inventory service is requested.

The inventory page lists the visible items and matches weapon/finish names to the bundled catalog. **EQUIP** applies an item's exact public wear float and pattern seed through the existing skin renderer, including the homepage showcase. If several owned skins belong to one weapon, choose which to equip. Sync never arbitrarily picks a duplicate or replaces an existing local choice. This is a read-only import: equipping a finish here never changes your Steam inventory or Steam CS2 loadout. The existing local finish catalog remains available.

Cases, stickers, unsupported knife models and finishes absent from the local catalog remain listed with an explanation. Items without exact public wear/seed cannot be equipped from this page; no floats or seeds are invented. Stickers, charms, name tags and StatTrak counters are not rendered. Steam may report a larger inventory total than the assets it exposes; the page shows both when they differ. Every available page is fetched before replacing a successful inventory snapshot; a failed page or repeated cursor fails the sync and preserves the prior view.

**SIGN OUT** clears the account cookies, the saved inventory snapshot and in-memory inventory/name/avatar. Finishes already applied are local saved choices and remain equipped. Guest play works without Steam or a network connection once game assets are cached. Steam account data and avatar responses are private/no-store and bypass the asset service worker, including navigation redirects.

## Development and production

`bun run dev` and `bun run preview` include the same `/api/steam?action=…` middleware on localhost. A random per-process session signing key is used locally unless configured, so restarting the server signs local users out. Use the same hostname throughout the sign-in round trip: `localhost` and `127.0.0.1` have different cookies.

Vercel deploys `apps/game/api/steam.mjs` as the server endpoint alongside the static game. Before deploying, configure these **server-only** environment variables (never `VITE_` variables):

- `STEAM_ORIGIN`: the exact public HTTPS origin, e.g. `https://cs2go.example.com`, without a path. Use the same canonical origin for visiting the game.
- `STEAM_SESSION_SECRET`: a cryptographically random secret of at least 32 characters. Generate one with `openssl rand -hex 32`. Keep it stable across instances/deploys; rotating it signs everyone out.

Unconfigured production hosts return a clear unavailable message and keep guest play working. A static-only host needs the same-origin Node handler from `apps/game/steam-auth.mjs`; uploading `dist/` alone cannot verify Steam login. The Vercel endpoint uses Node's native fetch/crypto and introduces no dependency, database or external service. `steamNodeHandler` is also used by the local Vite middleware.

The backend pins the Steam provider, validates exact callback/state/identity/signed fields/nonce age, and verifies the assertion directly with Steam over HTTPS. State cookies expire after 10 minutes; session cookies after 24 hours. Cookies are HttpOnly/SameSite=Lax and use Secure plus the `__Host-` prefix on HTTPS. Mutating sync/sign-out calls require the exact same Origin. Profile/avatars are served through the backend from allowlisted Steam avatar hosts. Requests have timeouts; inventory/profile results and short-lived errors are bounded and cached per instance to avoid repeated upstream requests. Steam can still rate limit or withhold private items; OpenID cannot bypass that.

Sources: [Steam OpenID documentation](https://steamcommunity.com/dev), [OpenID 2.0 verification specification](https://openid.net/specs/openid-authentication-2_0.html). Community profile XML and inventory/asset-properties behavior were also checked directly against the supplied public profile during implementation. Full authentication requires the account owner to complete Steam's sign-in/consent flow.

## Steam rate limiting and local import

Steam may reject the shared hosting network even when the same public inventory loads from a personal connection. Hosted sync respects upstream `Retry-After` (a two-minute cooldown when Steam provides none), returns HTTP 429 rather than 502, caches successful inventories for five minutes per server instance, and spaces pagination requests. The browser disables repeat sync until the cooldown ends and persists that deadline for the tab session. Sanitized `steam_upstream_error` runtime entries record the operation, HTTP status and retry delay, without SteamIDs, URLs or cookies.

A successful inventory is also saved locally, scoped to its SteamID, with a 4 MB storage bound. Reloads reuse fresh snapshots; a failed refresh retains the prior view. Storage failures keep the in-memory view usable. Server caches/cooldowns are per instance, not a claim of a globally coordinated Steam quota.

Direct browser fetches cannot read the public Community inventory endpoint because the tested response does not grant our origin CORS access. **IMPORT FROM THIS DEVICE** is the browser-only fallback: open **OPEN STEAM INVENTORY**, save the returned JSON, then choose **IMPORT JSON**. All normalization happens locally; no inventory JSON is uploaded. For paginated inventories, save every page using `last_assetid` as the next request's `start_assetid`, and select all pages in order. Incomplete, repeated, malformed or oversized imports are rejected without replacing the previous snapshot. This local cosmetic import is not a proof of Steam ownership and never substitutes for server-side OpenID verification. Profile/login remain server-verified.
