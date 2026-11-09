import native from "./data/home-animation-weights.json";

export const homeAnimationWeight = (name: string) =>
  (native.weights as Record<string, number>)[name] ?? 0;

/** Native graph option weights; the engine's random seed stream is separate. */
export function chooseHomeAnimation<T extends { getClip(): { name: string } }>(
  actions: readonly T[],
  random: number,
) {
  const total = actions.reduce(
    (sum, action) => sum + homeAnimationWeight(action.getClip().name),
    0,
  );
  if (!total) return;
  let choice = Math.min(0.999999, Math.max(0, random)) * total;
  return actions.find((action) => (choice -= homeAnimationWeight(action.getClip().name)) < 0);
}
