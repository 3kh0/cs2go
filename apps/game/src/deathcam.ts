import "./deathcam.css";

export type DamageTotal = { damage: number; hits: number };
export type DamageExchange = { taken: DamageTotal; given: DamageTotal };

/** Damage exchanged during this local life. Authoritative post-armor damage
 * includes the killing shot's overkill, as the native death card does. */
export class DeathDamage {
  private opponents = new Map<string, DamageExchange>();
  record(opponent: string, direction: "taken" | "given", damage: number) {
    if (!opponent || !Number.isFinite(damage) || damage < 1) return;
    let exchange = this.opponents.get(opponent);
    if (!exchange) {
      exchange = { taken: { damage: 0, hits: 0 }, given: { damage: 0, hits: 0 } };
      this.opponents.set(opponent, exchange);
    }
    exchange[direction].damage += Math.floor(damage);
    exchange[direction].hits++;
  }
  exchange(opponent: string): DamageExchange {
    const value = this.opponents.get(opponent);
    return value
      ? { taken: { ...value.taken }, given: { ...value.given } }
      : { taken: { damage: 0, hits: 0 }, given: { damage: 0, hits: 0 } };
  }
  reset() {
    this.opponents.clear();
  }
}

export function deathcamMarkup() {
  return `<div id="death-fade" class="hidden" aria-hidden="true"></div>
  <div id="death-banner" class="hidden" role="status">
    <div class="death-card-content"><div class="death-card-main"><div class="death-avatar-frame"><img id="death-avatar" src="/icons/team-t.png" alt=""></div>
      <div class="death-details"><strong id="death-killer"></strong><div><span class="death-message">killed you with the </span><span id="death-weapon"></span></div></div>
    </div>
    <div id="death-damage-taken" class="death-damage taken" hidden><span>Damage taken: <strong></strong></span><i></i></div>
    <div id="death-damage-given" class="death-damage given" hidden><span>Damage given: <strong></strong></span><i></i></div>
    </div><div class="death-weapon-frame"><img id="death-weapon-icon" alt=""></div>
  </div>`;
}

export function showDeathcam(exchange: DamageExchange, avatar: string) {
  const hud = document.getElementById("hud");
  hud?.classList.add("deathcam-active");
  document.getElementById("death-fade")?.classList.remove("hidden");
  const image = document.getElementById("death-avatar") as HTMLImageElement | null;
  if (image) image.src = avatar;
  for (const direction of ["taken", "given"] as const) {
    const row = document.getElementById(`death-damage-${direction}`);
    if (!row) continue;
    const total = exchange[direction];
    row.hidden = !total.hits;
    row.querySelector("strong")!.textContent =
      `${total.damage} in ${total.hits} ${total.hits === 1 ? "hit" : "hits"}`;
    row.style.setProperty("--damage-fraction", String(Math.min(1, total.damage / 100)));
  }
}

export function hideDeathcam() {
  document.getElementById("hud")?.classList.remove("deathcam-active");
  document.getElementById("death-fade")?.classList.add("hidden");
  document.getElementById("death-banner")?.classList.add("hidden");
}
