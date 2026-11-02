import { midTier } from "./loadouts";
import { grenadeData, grenadeIcons } from "./utility";
import { weapons, weaponIcons, isKnife, weaponSlot } from "./physics";
import { assetUrl } from "./asset-url";

const equipment = [
  ["kevlar", "Kevlar", "kevlar"],
  ["helmet", "Kevlar + Helmet", "assaultsuit"],
  ["kit", "Defuse Kit", "defuser"],
] as const;
const nativeWeaponIcons: Record<string, string> = {
  "ak-47": "ak47",
  "m4a1-s": "m4a1_silencer",
  "usp-s": "usp_silencer",
  m4a4: "m4a1",
};
export function weaponBuyIcon(index: number) {
  return assetUrl(`/icons/buy/${nativeWeaponIcons[weaponIcons[index]] ?? weaponIcons[index]}.svg`);
}
function weaponCard(index: number) {
  const weapon = weapons[index];
  return `<div class="buy-weapon-entry"><button class="buy-card" data-weapon="${index}" title="Click to buy and equip. Cmd/Ctrl-click to buy and drop."><b>${weapon.name}</b><img src="${weaponBuyIcon(index)}" decoding="async" alt=""><span>${isKnife(index) ? "Knife" : weapon.label}</span><small class="buy-state"></small></button><button class="buy-refund" data-refund="${index}" aria-label="Refund ${weapon.name}" title="Refund ${weapon.name}" hidden>↶</button></div>`;
}
function category(title: string, key: string, content: string) {
  return `<section class="buy-category" data-category="${key}" aria-label="${title}"><h3><span>${["equipment", "pistols", "mid-tier", "rifles", "grenades"].indexOf(key) + 1}</span>${title}</h3><div class="buy-category-items weapon-options">${content}</div></section>`;
}
export function buyMenuMarkup() {
  const indices = weapons.map((_, index) => index);
  const gear = equipment
    .map(
      ([kind, name, icon], slot) =>
        `<div class="buy-weapon-entry"><button class="buy-card buy-equipment" data-equipment="${kind}" data-slot="${slot + 1}"><b>${name}</b><img src="/icons/buy/${icon}.svg" alt=""><span>Equipment</span><small></small></button></div>`,
    )
    .join("");
  return `<div id="loadout" class="overlay hidden" data-layout="columns"><section class="dialog buy-dialog" aria-label="Buy menu"><header class="buy-header"><strong id="buy-money"></strong><span id="buy-rules"></span></header><div class="buy-body"><div class="buy-columns">${category("Equipment", "equipment", gear)}${category(
    "Pistols",
    "pistols",
    indices
      .filter((i) => weaponSlot(i) === 2)
      .map(weaponCard)
      .join(""),
  )}${category(
    "Mid-Tier",
    "mid-tier",
    indices
      .filter((i) => midTier.has(i))
      .map(weaponCard)
      .join(""),
  )}${category(
    "Rifles",
    "rifles",
    indices
      .filter((i) => weaponSlot(i) === 1 && !midTier.has(i))
      .map(weaponCard)
      .join(""),
  )}${category("Grenades", "grenades", (["flash", "smoke", "he", "molotov", "incendiary", "decoy"] as const).map((kind) => `<div class="buy-weapon-entry"><button class="buy-card buy-equipment" data-grenade="${kind}" data-slot="${kind === "flash" ? 1 : kind === "smoke" ? 2 : kind === "he" ? 3 : kind === "decoy" ? 5 : 4}"><b>${grenadeData[kind].name}</b><img src="/icons/buy/${grenadeIcons[kind]}.svg" alt=""><span>Utility - 4 to equip</span><small></small></button></div>`).join(""))}</div><section class="buy-dropped" aria-label="Nearby dropped weapons"><div id="buy-dropped-items"></div><span>Dropped Weapons</span></section><aside class="buy-preview" aria-label="Player holding previewed item"><div id="buy-preview-stage"></div><div class="buy-preview-caption"><div class="eyebrow" id="buy-preview-team"></div><h3 id="buy-preview-name">Your loadout</h3><p id="buy-preview-detail">Hover an item to inspect it.</p></div></aside></div><footer class="buy-footer"><strong id="buy-wallet"></strong><button id="close-loadout" aria-label="Close buy menu">[ESCAPE] BACK</button></footer></section></div>`;
}
