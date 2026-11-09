import { expect, test } from "vitest";
import { chooseHomeAnimation, homeAnimationWeight } from "./home-animation";

test("native CT rifle options preserve the authored five-to-one idle preference", () => {
  const actions = [
    "ct_main_menu_rifle_idle_handrepo_m4",
    "ct_main_menu_rifle_lookat_handrepo_m4",
    "ct_main_menu_rifle_shouldershrug_handrepo_m4",
    "ct_main_menu_rifle_weightshift_handrepo_m4",
  ].map((name) => ({ getClip: () => ({ name }) }));
  expect(actions.map((action) => homeAnimationWeight(action.getClip().name))).toEqual([5, 1, 1, 1]);
  expect(Array.from({ length: 8 }, (_, i) => chooseHomeAnimation(actions, (i + 0.5) / 8))).toEqual([
    actions[0],
    actions[0],
    actions[0],
    actions[0],
    actions[0],
    actions[1],
    actions[2],
    actions[3],
  ]);
  // Repeated idle choices are valid; no previous-action exclusion is invented.
  expect(chooseHomeAnimation(actions, 0.1)).toBe(chooseHomeAnimation(actions, 0.1));
});

test("native zero-weight options and clips absent from the installed graph are not scheduled", () => {
  const actions = ["ct_main_menu_knife_backflip", "ct_main_menu_knife_idle", "missing_clip"].map(
    (name) => ({ getClip: () => ({ name }) }),
  );
  expect(homeAnimationWeight(actions[0].getClip().name)).toBe(6);
  expect(homeAnimationWeight(actions[1].getClip().name)).toBe(0);
  for (const seed of [0, 0.5, 0.999999])
    expect(chooseHomeAnimation(actions, seed)).toBe(actions[0]);
  expect(chooseHomeAnimation(actions.slice(1), 0.5)).toBeUndefined();
});
