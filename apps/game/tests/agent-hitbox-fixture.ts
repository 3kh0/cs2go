import * as T from "three";
import { acquireAgentAppearance, loadAgentCatalog } from "../src/agent-roster";
import { animateSoldier, createSoldier, disposeSoldier, type Soldier } from "../src/soldier";
import { soldierHit, soldierHitboxes } from "../src/soldier-hitboxes";

// Browser-only audit: run against the real installed bodies and animation packs.
// Nothing here is imported by the application entry point.
export async function auditAgents(
  progress?: (model: string) => void,
  inspect?: (soldier: Soldier, name: string) => void,
) {
  const catalog = await loadAgentCatalog();
  const unique = [...new Map(catalog.map((agent) => [agent.model, agent])).values()];
  const results = [];
  for (const agent of unique) {
    const appearance = await acquireAgentAppearance(agent.id);
    const soldier = createSoldier(0, agent.team, appearance, false);
    soldier.group.visible = true;
    soldier.model.traverse((object) => {
      if (object instanceof T.SkinnedMesh)
        object.raycast = () => {
          throw new Error("Attack attempted skinned triangle picking");
        };
    });
    try {
      const boxes = soldierHitboxes(soldier);
      const poses = [];
      for (const pose of ["standing", "crouched", "walking", "running"] as const) {
        soldier.crouch = pose === "crouched" ? 1 : 0;
        soldier.moveZ = pose === "walking" || pose === "running" ? 1 : 0;
        const speed = pose === "running" ? 5 : pose === "walking" ? 2 : 0;
        for (let i = 0; i < 48; i++) animateSoldier(soldier, speed, 1 / 128, true);
        soldier.group.updateMatrixWorld(true);
        const head = boxes.find((box) => box.group === 1)!;
        const center = head.start
          .clone()
          .add(head.end)
          .multiplyScalar(0.5)
          .applyMatrix4(head.bone.matrixWorld);
        const headHits = [
          new T.Vector3(0, 0, 3),
          new T.Vector3(3, 0, 0),
          new T.Vector3(0, 3, 0),
        ].map((offset) => {
          const origin = center.clone().add(offset);
          return (
            soldierHit(soldier, new T.Ray(origin, center.clone().sub(origin).normalize()), 4)
              ?.head ?? false
          );
        });
        let contained = 0;
        for (const box of boxes) {
          const midpoint = box.start
            .clone()
            .add(box.end)
            .multiplyScalar(0.5)
            .applyMatrix4(box.bone.matrixWorld);
          const hit = soldierHit(soldier, new T.Ray(midpoint, new T.Vector3(0, 0, -1)), 0.00001);
          if (hit && hit.point.distanceTo(midpoint) < 0.00001) contained++;
        }
        poses.push({ pose, headY: center.y, headHits, contained });
        if (pose === "standing") inspect?.(soldier, agent.name);
      }
      results.push({
        id: agent.id,
        model: agent.model || "default-t",
        capsules: boxes.length,
        poses,
      });
      progress?.(agent.model || "default-t");
    } finally {
      disposeSoldier(soldier);
    }
  }
  return { aliases: catalog.length, models: results.length, results };
}
