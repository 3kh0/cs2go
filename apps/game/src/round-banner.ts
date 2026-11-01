import { assetUrl } from "./asset-url";
import "./round-banner.css";

function banner() {
  let node = document.getElementById("round-banner");
  if (!node) {
    node = document.createElement("div");
    node.id = "round-banner";
    node.className = "hidden";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.innerHTML =
      '<div class="round-result"><span class="round-chevron" aria-hidden="true"></span><div><strong id="round-banner-title"></strong><span id="round-banner-reason"></span></div><span class="round-chevron round-chevron-right" aria-hidden="true"></span></div><div id="round-mvp" hidden><img id="round-mvp-avatar" alt=""><div><span id="round-mvp-reason"></span><strong id="round-mvp-name"></strong></div></div>';
    document.getElementById("hud")!.append(node);
  }
  return node;
}
export function showRoundBanner(
  winner: "ct" | "t",
  playerTeam: "ct" | "t",
  reason: string,
  mvp?: { name: string; reason: string },
  fact?: string,
) {
  const node = banner();
  node.dataset.winner = winner;
  node.dataset.result = winner === playerTeam ? "won" : "lost";
  document.getElementById("round-banner-title")!.textContent =
    winner === playerTeam ? "ROUND WON" : "ROUND LOST";
  document.getElementById("round-banner-reason")!.textContent =
    fact || `${winner === "ct" ? "Counter-Terrorists" : "Terrorists"} win - ${reason}`;
  node.title = `${winner === "ct" ? "Counter-Terrorists" : "Terrorists"} win - ${reason}`;
  document.getElementById("round-mvp")!.hidden = !mvp;
  if (mvp) {
    (document.getElementById("round-mvp-avatar") as HTMLImageElement).src = assetUrl(
      `/icons/team-${winner}.png`,
    );
    document.getElementById("round-mvp-reason")!.textContent = mvp.reason;
    document.getElementById("round-mvp-name")!.textContent = mvp.name;
  }
  node.classList.remove("hidden");
}
export function hideRoundBanner() {
  document.getElementById("round-banner")?.classList.add("hidden");
}
