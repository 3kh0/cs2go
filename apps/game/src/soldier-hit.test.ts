import { expect, it } from "vitest";
import * as T from "three";
import { soldierHeadHit, soldierHitHeight, type Soldier } from "./soldier";
it("keeps hit regions attached when the skeleton crouches", () => {
  const root = new T.Group();
  const head = new T.Object3D(),
    spine = new T.Object3D(),
    left = new T.Object3D(),
    right = new T.Object3D();
  head.position.y = 1.65;
  spine.position.y = 1.35;
  left.position.set(-0.1, 0.9, 0);
  right.position.set(0.1, 0.9, 0);
  root.add(head, spine, left, right);
  const soldier = { head, spine, hips: [left, right] } as Soldier;
  expect(soldierHeadHit(soldier, new T.Vector3(0, 2.5, 0))).toBe(false);
  expect(soldierHeadHit(soldier, new T.Vector3(0, 1.65, 0))).toBe(true);
  const chest = new T.Vector3(0, 1.3, 0);
  expect(soldierHitHeight(soldier, chest)).toBe(1.2);
  root.position.y = -0.5;
  chest.y -= 0.5;
  expect(soldierHitHeight(soldier, chest)).toBe(1.2);
  expect(soldierHeadHit(soldier, new T.Vector3(0, 1.15, 0))).toBe(true);
});
