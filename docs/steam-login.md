# Steam login and inventory

Use **SIGN IN → SIGN IN THROUGH STEAM** on the homepage. Steam OpenID verifies the SteamID; CS2GO separately reads its public profile and public CS2 inventory. Inventory must be Public. No Steam API key, password, session cookie or trade token is collected.

Sync imports cosmetics read-only. It never changes Steam items or CS2's equipped loadout. Equip applies exact public wear/seed only when the bundled catalog supports the item; unsupported items remain listed, and missing values are not invented. Duplicate skins require a choice. Stickers, charms, name tags and StatTrak counters are not rendered. Local cosmetic selection remains available to guests.

Every inventory page must succeed before replacing a snapshot. Failures retain the previous view; successful snapshots are bounded to 4 MB and scoped to SteamID. Fresh local snapshots are reused for ten minutes. Sign-out clears account cookies, profile and cached inventory, but retains already applied local finishes.

## Server configuration

Vite development/preview and the Vercel endpoint share `apps/game/steam-auth.mjs`; `apps/game/api/steam.mjs` is the production entry point. Static `dist/` hosting alone cannot verify login.

| Server-only variable   | Value                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| `STEAM_ORIGIN`         | Exact canonical public HTTPS origin, without a path                                                  |
| `STEAM_SESSION_SECRET` | Stable cryptographically random secret, at least 32 characters; generate with `openssl rand -hex 32` |

Never expose these through `VITE_`. Local development uses a random process key unless configured; restarting signs local users out. Keep localhost/127.0.0.1 consistent during the sign-in round trip. Unconfigured production hosts keep guest play available.

Callbacks validate provider, identity, signed fields, state and nonce age, then verify directly with Steam over HTTPS. State lasts ten minutes; sessions last 24 hours. Cookies are HttpOnly/SameSite=Lax, with Secure/`__Host-` on HTTPS. Mutating calls require the exact Origin. Account/avatar endpoints are private/no-store and bypass the asset worker. Peer avatar URLs are restricted to fixed Steam hosts/hashed paths; room identities remain guest assertions.

## Rate limits and local import

Hosted requests respect Steam's Retry-After, default to a two-minute cooldown, cache successful inventories for five minutes per instance and space pagination. Server caches are per-instance, not a global quota. A failed refresh preserves the prior inventory.

If Steam blocks the hosting network, use **IMPORT FROM THIS DEVICE → OPEN STEAM INVENTORY**, save the public JSON, then choose **IMPORT JSON**. For pagination, save every page in order using `last_assetid` as the next `start_assetid`. Normalization stays in the browser; no inventory JSON is uploaded. Incomplete, repeated, malformed or oversized sets are rejected. This cosmetic import does not prove ownership or replace OpenID verification.

Sources: [Steam OpenID](https://steamcommunity.com/dev), [OpenID 2.0 verification](https://openid.net/specs/openid-authentication-2_0.html). The account owner completes Steam's sign-in flow.
