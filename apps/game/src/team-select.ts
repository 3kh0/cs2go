import * as T from "three";
import { createSoldier, animateSoldier, disposeSoldier } from "./soldier";
import type { AgentTeam } from "./soldier";
import { acquireAgentAppearance, selectedAgentId } from "./agent-roster";

export function openTeamSelector(onSelect: (team: AgentTeam) => void, size = 10) {
  const menu = document.getElementById("menu")!;
  const overlay = document.createElement("section");
  overlay.id = "team-select";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Choose your team");
  overlay.innerHTML = `<div class="team-heading"><button id="team-back">← BACK</button><span>CHOOSE YOUR TEAM</span><span>DUST II - ${size} × ${size}</span></div><div class="team-options">${(["t", "ct"] as const).map((team) => `<button class="team-choice team-${team}" data-team="${team}"><img class="team-emblem" src="/icons/team-${team}.png" alt="" width="76" height="76"><h2>${team === "t" ? "TERRORISTS" : "COUNTER-TERRORISTS"}</h2><p>${team === "t" ? "Plant the bomb. Hold the site." : "Defend the sites. Defuse the bomb."}</p><div class="agent-preview"></div><span class="team-join">JOIN ${team === "t" ? "TERRORISTS" : "COUNTER-TERRORISTS"} ↗</span></button>`).join("")}</div>`;
  document.body.append(overlay);
  menu.inert = true;
  const renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.domElement.className = "team-models";
  overlay.append(renderer.domElement);
  const scene = new T.Scene();
  scene.add(new T.HemisphereLight(0xe8f3ff, 0x786650, 3));
  const key = new T.DirectionalLight(0xffefd8, 4);
  key.position.set(2, 4, 5);
  scene.add(key);
  const camera = new T.PerspectiveCamera(33, 1, 0.1, 20);
  camera.position.set(0, 1.05, 3.8);
  camera.lookAt(0, 0.95, 0);
  const soldiers = (["t", "ct"] as const).map((team, i) => {
    const soldier = createSoldier(-1, team);
    soldier.group.rotation.y = i === 0 ? -0.2 : 0.2;
    scene.add(soldier.group);
    return soldier;
  });
  let closed = false;
  const joins = [...overlay.querySelectorAll<HTMLButtonElement>("[data-team]")];
  joins.forEach((button) => {
    button.disabled = true;
  });
  overlay.setAttribute("aria-busy", "true");
  void Promise.allSettled(
    (["t", "ct"] as const).map(async (team, index) => {
      const appearance = await acquireAgentAppearance(selectedAgentId(team));
      if (!appearance) return;
      if (closed) {
        appearance.release();
        return;
      }
      const old = soldiers[index]!;
      if (old.model.userData.agentModel === appearance.scene.userData.agentModel) {
        appearance.release();
        return;
      }
      const soldier = createSoldier(-1, team, appearance);
      soldier.group.rotation.copy(old.group.rotation);
      scene.remove(old.group);
      disposeSoldier(old);
      scene.add(soldier.group);
      soldiers[index] = soldier;
    }),
  )
    .then((results) => {
      for (const result of results)
        if (result.status === "rejected")
          console.error("Selected agent unavailable; using the default appearance", result.reason);
    })
    .finally(() => {
      if (closed) return;
      overlay.removeAttribute("aria-busy");
      joins.forEach((button) => {
        button.disabled = false;
      });
    });
  const previews = [...overlay.querySelectorAll<HTMLElement>(".agent-preview")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let last = performance.now();
  renderer.setAnimationLoop((now) => {
    const dt = reduced.matches ? 0 : Math.min((now - last) / 1000, 0.05);
    last = now;
    if (
      renderer.domElement.clientWidth !== renderer.domElement.width / renderer.getPixelRatio() ||
      renderer.domElement.clientHeight !== renderer.domElement.height / renderer.getPixelRatio()
    ) {
      renderer.setSize(innerWidth, innerHeight, false);
    }
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissorTest(true);
    previews.forEach((preview, i) => {
      const rect = preview.getBoundingClientRect();
      soldiers.forEach((soldier, index) => {
        soldier.group.visible = index === i;
      });
      animateSoldier(soldiers[i]!, 0, dt, true);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      renderer.setViewport(rect.left, innerHeight - rect.bottom, rect.width, rect.height);
      renderer.setScissor(rect.left, innerHeight - rect.bottom, rect.width, rect.height);
      renderer.render(scene, camera);
    });
  });
  const close = () => {
    closed = true;
    renderer.setAnimationLoop(null);
    soldiers.forEach(disposeSoldier);
    renderer.dispose();
    renderer.forceContextLoss();
    overlay.remove();
    menu.inert = false;
    document.removeEventListener("keydown", keydown);
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
      const buttons = [...overlay.querySelectorAll<HTMLButtonElement>("button")];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      event.preventDefault();
      buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]!.focus();
    }
  };
  document.addEventListener("keydown", keydown);
  overlay.querySelector<HTMLButtonElement>("#team-back")!.onclick = back;
  overlay.querySelectorAll<HTMLButtonElement>("[data-team]").forEach((button) => {
    button.onclick = () => {
      const team = button.dataset.team as AgentTeam;
      close();
      onSelect(team);
    };
  });
  overlay.querySelector<HTMLButtonElement>("[data-team]")!.focus();
}
