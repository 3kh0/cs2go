import * as T from "three";
import { createSoldier, disposeSoldier, type Soldier } from "./soldier";
import type { AgentTeam } from "./soldier";
import type { Game } from "./game";
import { prepareTeamAgent, type TeamAgentPose } from "./team-pose";
import { registerActorLighting, updateActorLighting } from "./actor-lighting";
import {
  sampleSourceProbe,
  sampleSourceProbeSun,
  sampleSourceProbeLocalShadows,
} from "./source-lighting";
import { acquireAgentAppearance, selectedAgentId } from "./agent-roster";

export function prepareTeamSelector(onSelect: (team: AgentTeam) => void, size: number, game: Game) {
  const teams = ["t", "ct"] as const;
  const menu = document.getElementById("menu")!;
  const overlay = document.createElement("section");
  overlay.id = "team-select";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Choose your team");
  overlay.innerHTML = `<div class="team-options">${teams.map((team) => `<button class="team-choice team-${team}" data-team="${team}"><div class="team-label"><img class="team-emblem" src="/icons/team-${team}.png" alt="" width="90" height="90"><h2>${team === "t" ? "TERRORISTS" : "COUNTER-TERRORISTS"}</h2><p class="team-count">0 players - 0 bots</p></div><div class="agent-preview"></div></button>`).join("")}</div><div class="team-controls"><button id="team-back">ESC · BACK</button><button id="team-auto">↻ AUTO SELECT</button></div>`;
  let shown = false;
  const menuVisibility = menu.style.visibility;
  const { renderer } = game;
  const previewRoot = new T.Group();
  previewRoot.name = "Team selection agents";
  previewRoot.visible = false;
  game.scene.add(previewRoot);
  const camera = new T.PerspectiveCamera(75, 1, 0.05, 254);
  camera.position.set(-31.5, 4.65, 16);
  camera.lookAt(-28.5, 4.1, 7);
  let closed = false,
    ready = false;
  const controller = new AbortController();
  const soldiers: Soldier[] = [];
  const poses: TeamAgentPose[] = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const groundOffsets: number[] = [];
  const raycaster = new T.Raycaster();
  const anchor = new T.Vector3(),
    probe = new T.Vector3();
  const up = new T.Vector3(0, 1, 0);
  let layoutWidth = 0,
    layoutHeight = 0;
  const layout = () => {
    camera.aspect = game.renderSize.x / game.renderSize.y;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    for (let i = 0; i < soldiers.length; i++) {
      raycaster.setFromCamera(new T.Vector2(i === 0 ? -0.48 : 0.48, -0.86), camera);
      const ground = game
        .dust!.collision.intersections(raycaster.ray, 12)
        .find((hit) => (hit.face?.normal.y ?? 0) > 0.7);
      if (!ground) throw new Error("Team preview courtyard floor unavailable");
      const soldier = soldiers[i]!;
      const yaw = Math.atan2(
        camera.position.x - ground.point.x,
        camera.position.z - ground.point.z,
      );
      poses[i]!.bounds.getCenter(anchor);
      anchor.z = poses[i]!.bounds.max.z;
      anchor.y = 0;
      anchor.applyAxisAngle(up, yaw);
      soldier.group.position.copy(ground.point).sub(anchor);
      soldier.group.position.y += groundOffsets[i]!;
      soldier.group.rotation.y = yaw;
      poses[i]!.update(0);
    }
    layoutWidth = game.renderSize.x;
    layoutHeight = game.renderSize.y;
  };
  const render = (dt = 0) => {
    const width = game.renderSize.x,
      height = game.renderSize.y;
    renderer.setViewport(0, 0, width, height);
    renderer.setScissorTest(false);
    if (ready) {
      if (layoutWidth !== width || layoutHeight !== height) layout();
      for (let i = 0; i < soldiers.length; i++) {
        poses[i]!.update(reduced.matches ? 0 : dt);
        probe.copy(soldiers[i]!.group.position);
        probe.y += (poses[i]!.bounds.max.y - poses[i]!.bounds.min.y) * 0.55;
        updateActorLighting(
          soldiers[i]!.group,
          probe,
          sampleSourceProbe,
          dt,
          undefined,
          sampleSourceProbeSun,
          sampleSourceProbeLocalShadows,
        );
      }
    } else {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    renderer.toneMapping = T.CustomToneMapping;
    renderer.clear();
    const ball = game.dust?.ball.mesh;
    const ballVisible = ball?.visible;
    try {
      if (ball) ball.visible = false;
      renderer.render(game.scene, camera);
    } finally {
      if (ball) ball.visible = ballVisible!;
    }
  };
  const preparation = (async () => {
    const results = await Promise.allSettled(
      teams.map(async (team, i) => {
        const appearance = await acquireAgentAppearance(selectedAgentId(team));
        if (closed) {
          appearance?.release();
          return;
        }
        const soldier = createSoldier(-1, team, appearance);
        soldiers[i] = soldier;
        const pose = await prepareTeamAgent(soldier, game.knife, controller.signal);
        if (closed) {
          pose.release();
          return;
        }
        poses[i] = pose;
        groundOffsets[i] = soldier.group.position.y;
        registerActorLighting(soldier.group, true);
        soldier.group.visible = true;
        previewRoot.add(soldier.group);
      }),
    );
    if (closed) return;
    for (const result of results) if (result.status === "rejected") throw result.reason;
    layout();
    for (let i = 0; i < soldiers.length; i++) {
      probe.copy(soldiers[i]!.group.position);
      probe.y += 1;
      updateActorLighting(
        soldiers[i]!.group,
        probe,
        sampleSourceProbe,
        0,
        undefined,
        sampleSourceProbeSun,
        sampleSourceProbeLocalShadows,
      );
    }
    const previousToneMapping = renderer.toneMapping;
    let compilation: Promise<void>;
    try {
      renderer.toneMapping = T.CustomToneMapping;
      previewRoot.visible = true;
      compilation = renderer.compileAsync(game.scene, camera).then(() => {});
    } finally {
      previewRoot.visible = false;
      renderer.toneMapping = previousToneMapping;
    }
    await compilation;
    await game.finishPrograms(controller.signal);
    if (closed) return;
    ready = true;
  })();
  const close = () => {
    if (closed) return;
    closed = true;
    controller.abort();
    if (game.teamPreview === render) game.teamPreview = undefined;
    poses.forEach((pose) => pose.release());
    soldiers.forEach(disposeSoldier);
    previewRoot.removeFromParent();
    previewRoot.clear();
    overlay.remove();
    if (shown) {
      menu.inert = false;
      menu.style.visibility = menuVisibility;
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, game.renderSize.x, game.renderSize.y);
    document.removeEventListener("keydown", keydown, true);
  };
  const back = () => {
    close();
    document.getElementById("play")!.focus();
  };
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      back();
    }
    if (event.key === "Tab") {
      const buttons = [...overlay.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]!.focus();
    }
    event.stopPropagation();
  };
  overlay.querySelector<HTMLButtonElement>("#team-back")!.onclick = back;
  const select = (team: AgentTeam) => {
    close();
    onSelect(team);
  };
  overlay.querySelectorAll<HTMLButtonElement>("[data-team]").forEach((button) => {
    button.onclick = () => select(button.dataset.team as AgentTeam);
  });
  overlay.querySelector<HTMLButtonElement>("#team-auto")!.onclick = () =>
    select(Math.random() < 0.5 ? "t" : "ct");
  overlay.setAttribute("aria-description", `${size} versus ${size} bomb-defusal match`);
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener("abort", () => reject(controller.signal.reason), {
      once: true,
    });
  });
  const readyPromise = Promise.race([preparation, aborted]).catch((error: unknown) => {
    close();
    throw error;
  });
  return {
    ready: readyPromise,
    close,
    show() {
      if (closed || !ready || shown) return;
      shown = true;
      document.getElementById("app")!.append(overlay);
      menu.inert = true;
      menu.style.visibility = "hidden";
      previewRoot.visible = true;
      game.teamPreview = render;
      document.addEventListener("keydown", keydown, true);
      render();
      overlay.querySelector<HTMLButtonElement>(`[data-team="${game.team}"]`)!.focus();
    },
  };
}
