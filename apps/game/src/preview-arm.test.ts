import { expect, test } from "vitest";
import * as T from "three";
import { movePreviewHands } from "./preview-arm";

for (const distance of [0.14, 1])
  test(`preview clearance preserves both grips and wrist orientation at ${distance}m`, () => {
    const root = new T.Group();
    root.rotation.y = 0.6;
    const hands = [-1, 1].map((side) => {
      const upper = new T.Bone(),
        lower = new T.Bone(),
        hand = new T.Bone();
      upper.name = "arm_upper";
      lower.name = "arm_lower";
      hand.name = "hand";
      upper.position.set(side * 0.2, 1.4, 0);
      lower.position.set(0, -0.2, 0.15);
      hand.position.set(0, -0.2, -0.1);
      root.add(upper);
      upper.add(lower);
      lower.add(hand);
      return hand;
    });
    root.updateMatrixWorld(true);
    const before = hands.map((h) => ({
      position: h.getWorldPosition(new T.Vector3()),
      rotation: h.getWorldQuaternion(new T.Quaternion()),
      length: h
        .parent!.getWorldPosition(new T.Vector3())
        .distanceTo(h.getWorldPosition(new T.Vector3())),
    }));
    const offset = movePreviewHands(root, hands, distance);
    expect(offset.length()).toBeGreaterThan(0);
    expect(offset.length()).toBeLessThanOrEqual(distance + 1e-9);
    hands.forEach((h, i) => {
      expect(
        h.getWorldPosition(new T.Vector3()).distanceTo(before[i].position.add(offset)),
      ).toBeLessThan(1e-6);
      expect(h.getWorldQuaternion(new T.Quaternion()).angleTo(before[i].rotation)).toBeLessThan(
        1e-6,
      );
      expect(
        h.parent!.getWorldPosition(new T.Vector3()).distanceTo(h.getWorldPosition(new T.Vector3())),
      ).toBeCloseTo(before[i].length, 9);
    });
  });
