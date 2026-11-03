import * as T from "three";
import type { Soldier } from "./soldier";
import {
  acquireAgentAnimation,
  agentClipForModel,
  ensureAgentAnimationBones,
} from "./agent-animations";
import { knifeDefinitions } from "./physics";
import { createWorldGun, disposeWorldGun } from "./weapons";
import { createWeaponInstance } from "./weapon-instance";
import { bayonetWorldGrip } from "./knife-motion";
import { metricAttachment } from "./buy-poses";
import { previewBounds } from "./preview-framing";

export type TeamAgentPose = Awaited<ReturnType<typeof prepareTeamAgent>>;

export async function prepareTeamAgent(soldier: Soldier, knife: number, signal: AbortSignal) {
  const daggers =
    knifeDefinitions.find((definition) => definition.id === knife)?.token === "knife_push";
  const name =
    daggers && soldier.team === "ct"
      ? "ct_team_sel_pushknife"
      : `${soldier.team}_sel_generic_${daggers ? "pushknife" : "knife"}`;
  const animation = await acquireAgentAnimation(
    `weapon/${daggers ? "pushknife" : "knife"}::${name}`,
  );
  try {
    signal.throwIfAborted();
    soldier.mixer.stopAllAction();
    ensureAgentAnimationBones(soldier.model, animation.pack.scene);
    const action = soldier.mixer
      .clipAction(agentClipForModel(animation.clip, soldier.model))
      .reset();
    action.setLoop(
      animation.definition.loop ? T.LoopRepeat : T.LoopOnce,
      animation.definition.loop ? Infinity : 1,
    );
    action.clampWhenFinished = true;
    action.play();
    soldier.mixer.update(0);
    disposeWorldGun(soldier.weapon);
    soldier.weapon = createWorldGun(knife, true, createWeaponInstance(knife, "player", true));
    soldier.weaponIndex = knife;
    soldier.group.add(soldier.weapon);
    if (knife === 4) soldier.weapon.userData.buyGrip = bayonetWorldGrip(soldier.weapon).toArray();
    const gripInverse = new T.Matrix4().fromArray(soldier.weapon.userData.buyGrip).invert();
    const anchor = soldier.model.getObjectByName("wpn");
    if (!anchor) throw new Error(`Missing native selection weapon anchor: ${name}`);
    const placement = new T.Matrix4(),
      parentInverse = new T.Matrix4(),
      weaponFrame = new T.Matrix4();
    const attach = () => {
      soldier.group.updateMatrixWorld(true);
      weaponFrame.copy(metricAttachment(anchor));
      placement
        .copy(weaponFrame)
        .premultiply(parentInverse.copy(soldier.group.matrixWorld).invert())
        .multiply(gripInverse)
        .decompose(soldier.weapon.position, soldier.weapon.quaternion, soldier.weapon.scale);
      if (daggers) {
        soldier.weapon.updateWorldMatrix(true, true);
        for (const hand of [soldier.leftHand, soldier.rightHand]) {
          const helper = soldier.weapon.getObjectByName(
            `weapon_hand_${hand === soldier.leftHand ? "l" : "r"}`,
          )!;
          placement
            .copy(helper.parent!.matrixWorld)
            .invert()
            .multiply(metricAttachment(hand))
            .decompose(helper.position, helper.quaternion, helper.scale);
          helper.updateWorldMatrix(false, true);
        }
      }
    };
    attach();
    const first = previewBounds([soldier.model]);
    soldier.group.position.y -= first.min.y;
    const bounds = new T.Box3(),
      sample = new T.Box3();
    for (let frame = 0; frame <= 4; frame++) {
      soldier.mixer.setTime((frame * animation.clip.duration) / 4);
      attach();
      bounds.union(previewBounds([soldier.model, soldier.weapon], sample));
    }
    action.reset().play();
    soldier.mixer.setTime(0);
    attach();
    return {
      name,
      bounds,
      update(dt: number) {
        soldier.mixer.update(dt);
        attach();
      },
      release: animation.release,
    };
  } catch (error) {
    animation.release();
    throw error;
  }
}
