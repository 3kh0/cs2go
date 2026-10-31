import * as T from "three";
import { fetchGzipped } from "./gltf";
import type { AgentTeam } from "./soldier";
export type WorldGrip = {
  clip: string;
  bones: Record<string, { p: number[]; q: number[] }>;
  hand: string;
  attachment: number[];
  attachmentPose?: { position: T.Vector3; rotation: T.Quaternion; scale: T.Vector3 };
  weaponBones: Record<string, { p: number[]; q: number[]; s: number }>;
};
type Stances = { stand: WorldGrip; crouch: WorldGrip };
let grips: Record<AgentTeam, Record<string, Stances>>;
export async function loadWorldGrips() {
  grips = JSON.parse(
    new TextDecoder().decode(await fetchGzipped("/models/animations/grips/poses.json.gz")),
  );
  for (const team of Object.values(grips))
    for (const stances of Object.values(team))
      for (const grip of Object.values(stances)) {
        const position = new T.Vector3(),
          rotation = new T.Quaternion(),
          scale = new T.Vector3();
        new T.Matrix4().fromArray(grip.attachment).decompose(position, rotation, scale);
        grip.attachmentPose = { position, rotation, scale };
      }
}
export function worldGrip(team: AgentTeam, index: number) {
  return grips?.[team][index];
}
const upperBody =
  /^(spine_|clavicle_|arm_|hand_|finger_|ValveBipedBip01_(?:Spine|[LR]_(?:Clavicle|UpperArm|Forearm|Hand|Finger)))/;
export function worldGripClips(team: AgentTeam) {
  return Object.entries(grips[team]).flatMap(([index, stances]) =>
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
