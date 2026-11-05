// Equip uses the full native draw; planting has its own 3.2-second clock.
export const BOMB_DRAW_DURATION = 1.2;
export const BOMB_DRAW_CLIP_END = 1.2;
export const PLANT_DURATION = 3.2;
export const PLANT_ANIMATION_END = 89 / 30;

export function plantClipTime(elapsed: number) {
  return Math.max(0, Math.min(1, elapsed / PLANT_DURATION)) * PLANT_ANIMATION_END;
}

export type BombPlantCue = "bomb-draw" | `bomb-key-${1 | 2 | 3 | 4 | 5 | 6 | 7}`;
// Reconstructed contact frames in the supplied plant clip; these are not
// extracted native sound events. Use the same time mapping as the hands.
export const bombPlantCues: { time: number; cue: BombPlantCue }[] = [
  17, 22, 26, 36, 42, 48, 56,
].map((frame, i) => ({
  time: (frame / 30 / PLANT_ANIMATION_END) * PLANT_DURATION,
  cue: `bomb-key-${i + 1}` as BombPlantCue,
}));
