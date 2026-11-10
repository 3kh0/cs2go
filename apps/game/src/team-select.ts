import { equippedKnives } from "./equipped-knives";
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
import { assetUrl } from "./asset-url";
import { teamPreviewGround } from "./team-preview-ground";
import type { SceneDepthConsumer, SmokeRenderer } from "./smoke-renderer";

export function prepareTeamSelector(onSelect: (team: AgentTeam) => void, size: number, game: Game) {
  const teams = ["t", "ct"] as const;
  const menu = document.getElementById("menu")!;
  const overlay = document.createElement("section");
  overlay.id = "team-select";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Choose your team");
  overlay.innerHTML = `<div class="team-options">${teams.map((team) => `<button class="team-choice team-${team}" data-team="${team}"><div class="team-label"><img class="team-emblem" src="${assetUrl(`/icons/team-${team}.png`)}" alt="" width="90" height="90"><h2>${team === "t" ? "TERRORISTS" : "COUNTER-TERRORISTS"}</h2><p class="team-count">0 players - 0 bots</p></div><div class="agent-preview"></div></button>`).join("")}</div><div class="team-controls"><button id="team-back">ESC · BACK</button><button id="team-auto">↻ AUTO SELECT</button></div>`;
  let shown = false;
  const activeMatch = game.active;
  const surfaces = ["hud", "pause"].map((id) => document.getElementById(id)!);
  let visibility: boolean[] = [];
  const menuVisibility = menu.style.visibility;
  const { renderer } = game;
  const previewRoot = new T.Group();
  previewRoot.name = "Team selection agents";
  previewRoot.visible = false;
  game.scene.add(previewRoot);
  const camera = new T.PerspectiveCamera(75, 1, 0.05, 254);
  let closed = false,
    ready = false;
  const controller = new AbortController();
  const soldiers: Soldier[] = [];
  const poses: TeamAgentPose[] = [];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const groundOffsets: number[] = [];
  const noSmoke: SmokeRenderer[] = [];
  const previewDepth: SceneDepthConsumer = {
    setDepth(texture, viewport, inverseProjection) {
      game.world.nativeWater?.setDepth(texture, viewport, inverseProjection);
      game.world.nativeEffects?.setDepth(texture, viewport, inverseProjection);
    },
  };
  const anchor = new T.Vector3(),
    probe = new T.Vector3();
  const up = new T.Vector3(0, 1, 0);
  let layoutWidth = 0,
    layoutHeight = 0;
  const layout = () => {
    const grounds = teamPreviewGround(camera, game.dust!, game.renderSize.x / game.renderSize.y);
    for (let i = 0; i < soldiers.length; i++) {
      const ground = grounds[i]!;
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
    if (shown && activeMatch && !game.active) {
      close();
      return;
    }
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
          game.dust?.sourceLighting ? sampleSourceProbe : undefined,
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
      // Selection retains native coverage, local lighting and linear-HDR
      // presentation, using its own camera throughout the world passes.
      game.renderMapFrame(() => {
        const world = game.world;
        const water = world.nativeWater;
        const now = performance.now() / 1000;
        world.nativeEnvironment?.update(now);
        world.nativeEffects?.update(now);
        world.nativeCoverage?.update(now);
        const waterVisible = water?.needsDepth(camera) ?? false;
        if (waterVisible) water!.prepareFrame(camera, now, world.sun);
        const effectsVisible = world.nativeEffects?.needsDepth(camera) ?? false;
        previewDepth.color = waterVisible ? water!.color : undefined;
        game.utility.smokeComposite.render(
          renderer,
          game.scene,
          camera,
          noSmoke,
          game.settings.effectsDetail === "low",
          waterVisible || effectsVisible ? previewDepth : undefined,
          world.nativeCoverage?.renderDepth,
        );
      }, camera);
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
        const pose = await prepareTeamAgent(soldier, equippedKnives[team], controller.signal);
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
        game.dust?.sourceLighting ? sampleSourceProbe : undefined,
        0,
        undefined,
        sampleSourceProbeSun,
        sampleSourceProbeLocalShadows,
      );
    }
    const previousToneMapping = renderer.toneMapping;
    let compilation: Promise<void>;
    let coveragePreparation: Promise<unknown> | undefined;
    try {
      renderer.toneMapping = T.CustomToneMapping;
      previewRoot.visible = true;
      game.prepareMapFrame(() => {
        compilation = renderer.compileAsync(game.scene, camera).then(() => {});
        coveragePreparation = game.world.nativeCoverage?.prepare(camera);
      }, camera);
    } finally {
      previewRoot.visible = false;
      renderer.toneMapping = previousToneMapping;
    }
    await Promise.all([compilation!, coveragePreparation]);
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
      if (activeMatch && game.active)
        surfaces.forEach((surface, index) =>
          surface.classList.toggle("hidden", visibility[index]!),
        );
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, game.renderSize.x, game.renderSize.y);
    document.removeEventListener("keydown", keydown, true);
  };
  const back = () => {
    close();
    if (!activeMatch) game.soundscape.playMusic("menu");
    document.getElementById(activeMatch ? "pause-teams" : "play")!.focus();
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
  overlay.querySelector<HTMLButtonElement>("#team-auto")!.onclick = () => {
    const available = teams.filter(
      (team) => !overlay.querySelector<HTMLButtonElement>(`[data-team="${team}"]`)!.disabled,
    );
    select(available[Math.floor(Math.random() * available.length)]!);
  };
  overlay.setAttribute(
    "aria-description",
    game.teamMode
      ? `${size} versus ${size} bomb-defusal match`
      : game.mode === "practice"
        ? "Offline practice with stationary targets"
        : "Offline deathmatch with respawns",
  );
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
      if (!activeMatch) game.soundscape.playMusic("selection");
      for (const team of teams) {
        const button = overlay.querySelector<HTMLButtonElement>(`[data-team="${team}"]`)!;
        const players = game.network
          ? game.network.connection.players.filter((player) => player.team === team).length
          : activeMatch && game.team === team
            ? 1
            : 0;
        const bots = game.network ? 0 : game.bots.filter((bot) => bot.team === team).length;
        button.querySelector(".team-count")!.textContent =
          `${players} player${players === 1 ? "" : "s"} - ${bots} bots`;
        button.disabled = !!game.network && team !== game.team && players >= size;
      }
      if (activeMatch) {
        visibility = surfaces.map((surface) => surface.classList.contains("hidden"));
        surfaces.forEach((surface) => surface.classList.add("hidden"));
      }
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
