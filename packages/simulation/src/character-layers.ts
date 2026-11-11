import { AdditiveAnimationBlendMode, type AnimationAction, type AnimationMixer } from "three";

type LayerOrder = {
  ordered: AnimationAction[];
  setKeys?: { name: string; blendMode: number }[];
};
const layers = new WeakMap<AnimationMixer, LayerOrder>();
const rank = (action: AnimationAction) => {
  const clip = action.getClip();
  if (clip.blendMode !== AdditiveAnimationBlendMode) return 0;
  if (clip.name.startsWith("grip_stand")) return 1;
  if (clip.name.startsWith("grip_crouch")) return 2;
  return 3;
};

export function invalidateCharacterLayers(mixer: AnimationMixer) {
  layers.delete(mixer);
}

// Three swaps active actions when another action stops. Additive quaternion
// multiplication is order dependent: always compose locomotion, grip, then the
// native weapon action, regardless of previous weapon/locomotion transitions.
export function orderCharacterLayers(mixer: AnimationMixer, active: Iterable<AnimationAction>) {
  const previous = layers.get(mixer);
  // Soldier/evaluator actions are Sets. Reuse their canonical order while the
  // positive membership and clip ordering keys stay unchanged. Other iterables
  // retain their existing sorting behavior, including duplicate entries.
  if (active instanceof Set && previous?.setKeys) {
    let count = 0;
    for (const action of active) if (action.getEffectiveWeight() > 0) count++;
    if (count === previous.ordered.length) {
      let unchanged = true;
      for (let i = 0; i < previous.ordered.length; i++) {
        const action = previous.ordered[i];
        const clip = action.getClip();
        const key = previous.setKeys[i];
        if (
          !active.has(action) ||
          !(action.getEffectiveWeight() > 0) ||
          clip.name !== key.name ||
          clip.blendMode !== key.blendMode
        ) {
          unchanged = false;
          break;
        }
      }
      if (unchanged) return;
    }
  }
  const ordered = Array.from(active)
    .filter((action) => action.getEffectiveWeight() > 0)
    .sort((a, b) => rank(a) - rank(b) || a.getClip().name.localeCompare(b.getClip().name));
  if (
    previous?.ordered.length === ordered.length &&
    ordered.every((action, i) => action === previous.ordered[i])
  )
    return;
  const states = ordered.map((action) => ({
    action,
    time: action.time,
    weight: action.getEffectiveWeight(),
    paused: action.paused,
  }));
  mixer.stopAllAction();
  for (const { action, time, weight, paused } of states) {
    action.play().setEffectiveWeight(weight);
    action.time = time;
    action.paused = paused;
  }
  layers.set(mixer, {
    ordered,
    setKeys:
      active instanceof Set
        ? ordered.map((action) => {
            const clip = action.getClip();
            return { name: clip.name, blendMode: clip.blendMode };
          })
        : undefined,
  });
}
