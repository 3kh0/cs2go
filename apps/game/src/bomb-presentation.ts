// Equip uses the full native draw; planting has its own 3.2-second clock.
export const BOMB_DRAW_DURATION = 1.2;
export const BOMB_DRAW_CLIP_END = 1.2;
export const PLANT_DURATION = 3.2;
export const PLANT_ANIMATION_END = 89 / 30;

export function plantClipTime(elapsed: number) {
  return Math.max(0, Math.min(1, elapsed / PLANT_DURATION)) * PLANT_ANIMATION_END;
}

export type BombPlantCue = "bomb-draw" | "bomb-initiate" | `bomb-key-${1 | 2 | 3 | 4 | 5 | 6 | 7}`;
// Current plant_c4 CNmSoundEvent normalized phases. The native clip lasts4s;
// mapping phases onto our3.2s interaction preserves the existing hand clock.
// This does not establish the native animation graph's playback timewarp.
export const bombPlantCues: { time: number; cue: BombPlantCue }[] = [
  { time: 0.025 * PLANT_DURATION, cue: "bomb-initiate" },
  ...[0.166667, 0.241667, 0.308333, 0.366667, 0.416667, 0.491667, 0.541667].map((phase, i) => ({
    time: phase * PLANT_DURATION,
    cue: `bomb-key-${i + 1}` as BombPlantCue,
  })),
];
