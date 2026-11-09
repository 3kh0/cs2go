import { assetUrl } from "./asset-url";
import type { Team } from "@cs2go/protocol";

type Portrait = Team | "phoenix";
// Installed Source 2 square econ portraits, not cropped inventory thumbnails.
// These aliases match recovered SAS, Ground Rebel and Phoenix portrait assets.
// Other selected agents use the native faction portrait as an explicit fallback.
const knownAgents: Record<string, Portrait> = {
  "default-ct": "ct",
  "default-t": "t",
  "agent-5036-t": "phoenix",
  "agent-5037-ct": "ct",
  "agent-5038-t": "phoenix",
  "agent-5039-t": "phoenix",
  "agent-5040-t": "phoenix",
  "agent-5041-t": "phoenix",
  "agent-5042-t": "phoenix",
  "agent-5043-t": "phoenix",
  "agent-5044-t": "phoenix",
  "agent-5045-t": "phoenix",
  "agent-5046-t": "phoenix",
  "agent-5047-t": "phoenix",
  "agent-5048-t": "phoenix",
  "agent-5049-t": "phoenix",
  "agent-5050-t": "phoenix",
  "agent-5051-t": "phoenix",
  "agent-5052-t": "phoenix",
  "agent-5053-t": "phoenix",
  "agent-5054-t": "phoenix",
  "agent-5055-t": "phoenix",
  "agent-5056-t": "phoenix",
  "agent-5057-t": "phoenix",
  "agent-5058-ct": "ct",
  "agent-5059-ct": "ct",
  "agent-5060-ct": "ct",
  "agent-5061-ct": "ct",
  "agent-5062-ct": "ct",
  "agent-5063-ct": "ct",
  "agent-5064-ct": "ct",
  "agent-5065-ct": "ct",
  "agent-5066-ct": "ct",
  "agent-5067-ct": "ct",
  "agent-5068-ct": "ct",
  "agent-5069-ct": "ct",
  "agent-5070-ct": "ct",
  "agent-5071-ct": "ct",
  "agent-5072-ct": "ct",
  "agent-5073-ct": "ct",
  "agent-5074-ct": "ct",
  "agent-5075-ct": "ct",
  "agent-5076-ct": "ct",
  "agent-5077-ct": "ct",
  "agent-5078-ct": "ct",
  "agent-5079-ct": "ct",
  "agent-5080-ct": "ct",
  "agent-5081-ct": "ct",
  "agent-5082-ct": "ct",
  "agent-5083-ct": "ct",
  "agent-5084-ct": "ct",
  "agent-5085-ct": "ct",
  "agent-5086-ct": "ct",
  "agent-5087-ct": "ct",
  "agent-5088-t": "phoenix",
  "agent-5089-t": "phoenix",
  "agent-5090-t": "phoenix",
  "agent-5091-t": "phoenix",
  "agent-5092-t": "phoenix",
  "agent-5093-t": "phoenix",
  "agent-5094-t": "phoenix",
  "agent-5095-t": "phoenix",
  "agent-5096-t": "phoenix",
  "agent-5097-ct": "ct",
  "agent-5105-t": "t",
  "agent-5200-t": "phoenix",
  "agent-5600-ct": "ct",
};

export function botPortrait(team: Team, agentId?: string) {
  const portrait = agentId ? (knownAgents[agentId] ?? team) : team;
  return assetUrl(`/icons/avatars/bot-${portrait}.png`);
}

export function hasNativeAgentPortrait(agentId: string) {
  return Object.hasOwn(knownAgents, agentId);
}
