import { isKnife, weapons } from "./physics";

// Installed CS2 build2000942 server.dll, CCSGameModeRules_Deathmatch virtual
// scorer RVA0x922080; price/type branches RVA0x92266d..0x9226c2. The observed
// mp_dm_kill_base_score is8. Price is m_nPrice, not the cash m_nKillAward.
// server.dll SHA-256: 70c66e850b2ce72c8c7ca026de6989ef4de7f12dad64ec503645fbd2a7f06d9f.
const priceAwards = [
  [200, 18],
  [500, 16],
  [700, 14],
  [1400, 13],
  [2500, 11],
  [3500, 10],
] as const;

/** Ordinary enemy-kill points; bonus weapon windows are a separate system. */
export function deathmatchKillPoints(index: number) {
  const weapon = weapons[index];
  if (!weapon) return 0;
  if (isKnife(index)) return 25;
  for (const [ceiling, points] of priceAwards) if (weapon.price <= ceiling) return points;
  return 8;
}
