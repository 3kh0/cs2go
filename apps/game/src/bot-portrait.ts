import { assetUrl } from "./asset-url";
import type { Team } from "@cs2go/protocol";

type Portrait = Team | "phoenix";
// Installed Source 2 square econ portraits, not cropped inventory thumbnails.
// These aliases match recovered SAS, Ground Rebel and Phoenix portrait assets.
// Other selected agents use the native faction portrait as an explicit fallback.
function aliases(from: number, to: number, team: Team, portrait: Portrait = team) {
  return Array.from({ length: to - from + 1 }, (_, i) => [`agent-${from + i}-${team}`, portrait]);
}
const knownAgents: Record<string, Portrait> = Object.fromEntries([
  ["default-ct", "ct"],
  ["default-t", "t"],
  ...aliases(5036, 5036, "t", "phoenix"),
  ...aliases(5037, 5037, "ct"),
  ...aliases(5038, 5057, "t", "phoenix"),
  ...aliases(5058, 5087, "ct"),
  ...aliases(5088, 5096, "t", "phoenix"),
  ...aliases(5097, 5097, "ct"),
  ["agent-5105-t", "t"],
  ["agent-5200-t", "phoenix"],
  ["agent-5600-ct", "ct"],
]);

export function botPortrait(team: Team, agentId?: string) {
  const portrait = agentId ? (knownAgents[agentId] ?? team) : team;
  return assetUrl(`/icons/avatars/bot-${portrait}.png`);
}

export function hasNativeAgentPortrait(agentId: string) {
  return Object.hasOwn(knownAgents, agentId);
}
