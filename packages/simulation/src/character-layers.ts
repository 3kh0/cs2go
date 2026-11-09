import { AdditiveAnimationBlendMode, type AnimationAction, type AnimationMixer } from "three";

const layers = new WeakMap<AnimationMixer, AnimationAction[]>();
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
  const ordered = Array.from(active)
    .filter((action) => action.getEffectiveWeight() > 0)
    .sort((a, b) => rank(a) - rank(b) || a.getClip().name.localeCompare(b.getClip().name));
  const previous = layers.get(mixer);
  if (previous?.length === ordered.length && ordered.every((action, i) => action === previous[i]))
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
  layers.set(mixer, ordered);
}
