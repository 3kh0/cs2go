import * as T from "three";
import { fetchGzipped } from "./gltf";
export type WorldGrip = {
  clip: string;
  bones: Record<string, { p: number[]; q: number[] }>;
  hand: string;
  attachment: number[];
  attachmentPose?: { position: T.Vector3; rotation: T.Quaternion; scale: T.Vector3 };
  weaponBones: Record<string, { p: number[]; q: number[]; s: number }>;
};
type Stances = { stand: WorldGrip; crouch: WorldGrip };
let grips: Record<string, Stances>;
export async function loadWorldGrips() {
  grips = JSON.parse(
    new TextDecoder().decode(await fetchGzipped("/models/animations/grips/poses.json.gz")),
  ).t;
  for (const stances of Object.values(grips))
    for (const grip of Object.values(stances)) {
      const position = new T.Vector3(),
        rotation = new T.Quaternion(),
        scale = new T.Vector3();
      new T.Matrix4().fromArray(grip.attachment).decompose(position, rotation, scale);
      grip.attachmentPose = { position, rotation, scale };
    }
}
export function worldGrip(index: number) {
  return grips?.[index];
}
const upperBody = /^(spine_|clavicle_|arm_|hand_|finger_)/;
export function worldGripClips() {
  return Object.entries(grips).flatMap(([index, stances]) =>
    (["stand", "crouch"] as const).map(
      (stance) =>
        new T.AnimationClip(
          `grip_${stance}_${index}`,
          1,
          Object.entries(stances[stance].bones)
            .filter(([bone]) => upperBody.test(bone))
            .flatMap(([bone, pose]) => [
              new T.QuaternionKeyframeTrack(`${bone}.quaternion`, [0], pose.q),
              new T.VectorKeyframeTrack(`${bone}.position`, [0], pose.p),
            ]),
        ),
    ),
  );
}
