# Multiplayer gameplay parity

Work in progress: preserve the existing single-player gameplay and presentation in the normal multiplayer match. This checklist records implementation and verification, not a claim of native CS2 engine parity.

- [x] Dust II movement, collision, jump, walk, crouch and prediction
- [x] Casual/competitive economy, freeze/post-round/halftime, C4, score and MVP
- [x] HUD, buy/pause/scoreboard, firing/draw animations, ragdolls
- [x] Authoritative gun dropping/pickup and ammunition
- [x] Knife slash/stab without gun tracers
- [ ] Bullet holes, hit markers and headshot/hit sounds on both clients
- [ ] Shared spread, recoil, pellets, penetration and hit-region damage
- [ ] Reload insertion, interrupted reloads, shell reloads and draw/bolt lockouts
- [ ] Scopes, burst fire, revolver and removable suppressors
- [ ] Weapon appearance identity through purchase, carry, drop, pickup and death
- [ ] Loadout slots, buy refunds and equipment receipts
- [ ] Utility buying, carry limits, throw handling and replicated trajectories
- [ ] HE/flash/smoke/fire/decoy effects, damage, audio and smoke interaction
- [ ] Spectator camera and teammate weapon/ammo presentation
- [ ] Movement/landing/damage/objective audio and round reset cleanup
- [ ] Two-client end-to-end regression and built DHI container verification

Server combat must remain authoritative. Client presentation must use shared rules and server-confirmed events; visual-only physics do not change damage or inventory. Single-player behavior must stay intact. Changes remain local until review.
