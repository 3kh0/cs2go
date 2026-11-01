import * as T from "three";
import { fetchGzipped } from "./gltf";
import type { Soldier } from "./soldier";
import { isKnife, knifeDefinitions } from "./physics";

type Pose = {
  clip: string;
  weaponBones: Record<string, { p: number[]; q: number[]; s: number }>;
  bones: Record<string, { p: number[]; q: number[] }>;
  hand: string;
  attachment: number[];
};
let poses: Record<"t", Record<string, Pose>>;
const tokens = [
  "ak",
  "m4a1",
  "usp_silencer",
  "awp",
  "knife",
  "knife",
  "knife",
  "glock18",
  "deagle",
  "m4a4",
  "nova",
  "mp9",
  "hkp2000",
  "p250",
  "fiveseven",
  "tec9",
  "cz75",
  "revolver",
  "elite",
  "famas",
  "galilar",
  "aug",
  "sg556",
  "ssg08",
  "scar20",
  "g3sg1",
  "mac10",
  "mp7",
  "mp5sd",
  "ump45",
  "p90",
  "bizon",
  "xm1014",
  "mag7",
  "sawedoff",
  "m249",
  "negev",
];
export async function loadBuyPoses() {
  poses = JSON.parse(
    new TextDecoder().decode(await fetchGzipped("/models/animations/buy/poses.json.gz")),
  );
}
export function buyPoseToken(index: number) {
  if (knifeDefinitions.find((knife) => knife.id === index)?.token === "knife_push") return "push";
  return isKnife(index) ? "knife" : tokens[index];
}
/** Static native buy poses own their fingers and attachment; world AI poses stay separate. */
export function applyBuyPose(soldier: Soldier, token: string) {
  const pose = poses[soldier.animationTeam][token];
  if (!pose) throw new Error(`Missing native buy pose: ${soldier.team}/${token}`);
  soldier.mixer.stopAllAction();
  for (const [name, transform] of Object.entries(pose.bones)) {
    const bone = soldier.model.getObjectByName(name);
    if (!bone) continue;
    bone.position.fromArray(transform.p);
    bone.quaternion.fromArray(transform.q);
  }
  soldier.weapon.visible = false;
  soldier.group.updateMatrixWorld(true);
  return {
    hand: soldier.model.getObjectByName(pose.hand)!,
    matrix: new T.Matrix4().fromArray(pose.attachment),
    clip: pose.clip,
    weaponBones: pose.weaponBones,
  };
}
/** Ignore the Source-inch bone scale; item geometry is already baked in meters. */
export function metricAttachment(object: T.Object3D) {
  object.updateWorldMatrix(true, false);
  const p = new T.Vector3(),
    q = new T.Quaternion(),
    s = new T.Vector3();
  object.matrixWorld.decompose(p, q, s);
  return new T.Matrix4().compose(p, q, new T.Vector3(1, 1, 1));
}
/** Props are already baked in metres. Only their grip position and rotation
 * inherit the agent rig; legacy body scale must not enlarge the gun. */
export function metricBuyGrip(hand: T.Object3D, local: T.Matrix4, result: T.Matrix4) {
  hand.updateWorldMatrix(true, false);
  const position = new T.Vector3(),
    rotation = new T.Quaternion(),
    scale = new T.Vector3();
  result.multiplyMatrices(hand.matrixWorld, local).decompose(position, rotation, scale);
  return result.compose(position, rotation, scale.set(1, 1, 1));
}

/** Grenade exports have a meter-scaled glTF root; secondary tracks use Source inches. */
export function poseBuyProp(model: T.Object3D, samples: Pose["weaponBones"]) {
  const basis = metricAttachment(model.getObjectByName("weapon")!);
  const matrix = new T.Matrix4(),
    p = new T.Vector3(),
    q = new T.Quaternion();
  const one = new T.Vector3(1, 1, 1);
  model.traverse((bone) => {
    const sample = samples[bone.name];
    if (!sample || !bone.parent) return;
    matrix.compose(
      p.fromArray(sample.p).multiplyScalar(0.0254),
      q.fromArray(sample.q).normalize(),
      one.setScalar(sample.s),
    );
    matrix.premultiply(basis).premultiply(bone.parent.matrixWorld.clone().invert());
    matrix.decompose(bone.position, bone.quaternion, bone.scale);
    bone.updateWorldMatrix(false, false);
  });
  // Some grenade clips rotate their weapon root (flash/smoke/decoy),
  // while HE/Molotov keep it at identity. Cancel the posed root at the wpn
  // attachment, not the unposed bind root, or those canisters rotate twice.
  return metricAttachment(model.getObjectByName("weapon")!);
}
