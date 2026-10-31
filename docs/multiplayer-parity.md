# Multiplayer gameplay parity

The normal multiplayer match now shares the existing single-player gameplay modules and presentation. This checklist records the browser feature port, not native CS2 engine parity.

- [x] Dust II movement, collision, jump, walk, crouch and prediction
- [x] Casual/competitive economy, freeze/post-round/halftime, C4, score and MVP
- [x] HUD, buy/pause/scoreboard, firing/draw animations, ragdolls
- [x] Authoritative gun dropping/pickup and ammunition
- [x] Knife slash/stab without gun tracers
- [x] Bullet holes, hit markers and headshot/hit sounds on both clients
- [x] Shared spread, recoil, pellets, penetration and hit-region damage
- [x] Reload insertion, interrupted reloads, shell reloads and draw/bolt lockouts
- [x] Scopes, burst fire, revolver and removable suppressors
- [x] Weapon appearance identity through purchase, carry, drop, pickup and death
- [x] Loadout slots, buy refunds and equipment receipts
- [x] Utility buying, carry limits, throw handling and replicated trajectories
- [x] HE/flash/smoke/fire/decoy effects, damage, audio and smoke interaction
- [x] Spectator camera and teammate weapon/ammo presentation
- [x] Movement/landing/damage/objective audio and round reset cleanup
- [x] Two-client end-to-end regression and built DHI container verification

Server combat must remain authoritative. Client presentation must use shared rules and server-confirmed events; visual-only physics do not change damage or inventory. Single-player behavior must stay intact. Changes remain local until review.

Validation covers unit tests, the native Bun WebSocket integration, real Chromium clients, and the production frontend connected to the DHI container. Browser coverage includes confirmed headshots/impact decals, skin identity through pickup, grenade refunds/flash/smoke, waiting/live/post-round combat, planting/defusing, death/ragdolls, and teammate first-person spectating. Existing local movement, interrupted reload, utility and corpse tests also pass.

Remaining engine boundaries: hit regions use simplified server hulls, without rewind/lag compensation. Grenade and recoil reconstruction limits remain those documented for single-player. Guest cosmetic assertions are not proof of Steam ownership. Twenty-player bandwidth/capacity and adverse-network testing remain deployment work; two-peer tests are not capacity certification. See [multiplayer.md](multiplayer.md) for deployment and protocol requirements.
