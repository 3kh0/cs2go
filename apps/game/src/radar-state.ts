import type { Team, Vec3 } from "@cs2go/protocol";

export type RadarId = string | number;
export type RadarMarker = {
  id: RadarId;
  kind: "self" | "ally" | "enemy" | "death";
  team: Team;
  position: Vec3;
  yaw: number;
  number?: number;
  age: number;
  opacity: number;
  uncertain: boolean;
  altitude: -1 | 0 | 1;
  carryingBomb: boolean;
  hostile: boolean;
};
export type RadarBombObservation = {
  state: "carried" | "dropped" | "planted";
  position: Vec3;
  carrier?: RadarId;
  defusing?: boolean;
};
export type RadarBomb = RadarBombObservation & {
  age: number;
  opacity: number;
  uncertain: boolean;
  altitude: -1 | 0 | 1;
};
export type RadarPlayer = {
  id: RadarId;
  team: Team;
  alive: boolean;
  position: Vec3;
  yaw: number;
  number?: number;
};
export type RadarSighting = {
  id: RadarId;
  position: Vec3;
  yaw?: number;
  kind?: "sight" | "shot";
  at?: number;
};
export type RadarSnapshot = {
  now: number;
  round: string | number;
  observer: { id: RadarId; team: Team; position: Vec3; yaw: number; alive?: boolean };
  players: readonly RadarPlayer[];
  sightings: readonly RadarSighting[];
  /** Observed deaths only. Hidden enemy health changes do not reveal a death location. */
  deaths?: readonly { id: RadarId; position?: Vec3 }[];
  /** Supply only independently known bomb information; absence reveals nothing. */
  bomb?: RadarBombObservation;
  mode?: "team" | "ffa";
  /** Explicit spectator/training policy, never enabled merely because the observer died. */
  revealAll?: boolean;
};
export type RadarFrame = { markers: RadarMarker[]; bomb?: RadarBomb };
export type RadarMemorySettings = {
  enemySeconds: number;
  deathSeconds: number;
  fadeSeconds: number;
  altitudeMeters: number;
  maxContacts: number;
};
// Bounded browser presentation policy. These defaults do not claim extracted
// native spotting/altitude timings; native evidence may override them at integration.
const defaults: RadarMemorySettings = {
  enemySeconds: 3,
  deathSeconds: 5,
  fadeSeconds: 1,
  altitudeMeters: 2,
  maxContacts: 64,
};
type Contact = {
  position: Vec3;
  yaw: number;
  at: number;
  dead: boolean;
  uncertain: boolean;
};
const copy = (p: Vec3): Vec3 => ({ x: p.x, y: p.y, z: p.z });
const finite = (p: Vec3) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);

/** Information model only: the caller samples actual cone/LOS/team reports at 16 Hz. */
export class RadarContacts {
  private contacts = new Map<RadarId, Contact>();
  private deadAllies = new Map<RadarId, Contact>();
  private observedDeaths = new Set<RadarId>();
  private round?: string | number;
  private previousTime = -Infinity;
  private observer?: RadarId;
  private team?: Team;
  private mode?: "team" | "ffa";
  readonly settings: RadarMemorySettings;
  constructor(settings: Partial<RadarMemorySettings> = {}) {
    this.settings = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof RadarMemorySettings)[]) {
      const value = settings[key];
      if (value !== undefined && Number.isFinite(value) && value > 0) this.settings[key] = value;
    }
    this.settings.maxContacts = Math.max(1, Math.floor(this.settings.maxContacts));
  }
  reset() {
    this.contacts.clear();
    this.deadAllies.clear();
    this.observedDeaths.clear();
    this.round = undefined;
    this.previousTime = -Infinity;
    this.observer = undefined;
    this.team = undefined;
    this.mode = undefined;
  }
  private altitude(y: number, observerY: number): -1 | 0 | 1 {
    const delta = y - observerY;
    return delta > this.settings.altitudeMeters
      ? 1
      : delta < -this.settings.altitudeMeters
        ? -1
        : 0;
  }
  private opacity(age: number, duration: number) {
    return Math.max(0, Math.min(1, (duration - age) / Math.max(0.001, this.settings.fadeSeconds)));
  }
  update(snapshot: RadarSnapshot): RadarFrame {
    const { now, observer, players, sightings } = snapshot;
    if (!Number.isFinite(now) || !finite(observer.position)) return { markers: [] };
    const mode = snapshot.mode ?? "team";
    if (
      snapshot.round !== this.round ||
      now < this.previousTime ||
      observer.id !== this.observer ||
      observer.team !== this.team ||
      mode !== this.mode
    )
      this.reset();
    this.round = snapshot.round;
    this.previousTime = now;
    this.observer = observer.id;
    this.team = observer.team;
    this.mode = mode;
    const roster = new Map(players.map((player) => [player.id, player]));
    if (!roster.has(observer.id))
      roster.set(observer.id, { ...observer, alive: observer.alive !== false });
    const ally = (player: RadarPlayer) =>
      player.id === observer.id || (mode === "team" && player.team === observer.team);
    for (const [id, contact] of this.contacts) {
      const player = roster.get(id);
      if (
        !player ||
        ally(player) ||
        now - contact.at >= (contact.dead ? this.settings.deathSeconds : this.settings.enemySeconds)
      )
        this.contacts.delete(id);
    }
    for (const id of this.observedDeaths) if (!roster.has(id)) this.observedDeaths.delete(id);
    for (const id of this.deadAllies.keys()) if (!roster.has(id)) this.deadAllies.delete(id);
    for (const sighting of sightings) {
      const player = roster.get(sighting.id),
        at = sighting.at ?? now;
      if (
        !player ||
        !player.alive ||
        ally(player) ||
        !finite(sighting.position) ||
        !Number.isFinite(at) ||
        at > now ||
        now - at >= this.settings.enemySeconds
      )
        continue;
      const previous = this.contacts.get(player.id);
      if (previous && previous.at > at) continue;
      this.observedDeaths.delete(player.id);
      this.contacts.set(player.id, {
        position: copy(sighting.position),
        yaw: sighting.yaw ?? previous?.yaw ?? 0,
        at,
        dead: false,
        uncertain: sighting.kind === "shot",
      });
    }
    for (const death of snapshot.deaths ?? []) {
      const player = roster.get(death.id),
        previous = this.contacts.get(death.id);
      if (!player || ally(player) || this.observedDeaths.has(player.id)) continue;
      const position = death.position ?? previous?.position;
      if (position && finite(position)) {
        this.observedDeaths.add(player.id);
        this.contacts.set(player.id, {
          position: copy(position),
          yaw: previous?.yaw ?? 0,
          at: now,
          dead: true,
          uncertain: false,
        });
      }
    }
    // The roster normally caps this at20, but stale/untrusted caller reports
    // cannot grow retained enemy memory without bound.
    while (this.contacts.size > this.settings.maxContacts)
      this.contacts.delete(this.contacts.keys().next().value!);
    const markers: RadarMarker[] = [];
    for (const player of roster.values()) {
      const friendly = ally(player);
      let contact: Contact | undefined;
      let kind: RadarMarker["kind"];
      if (friendly) {
        if (player.alive) {
          this.deadAllies.delete(player.id);
          contact = {
            position: copy(player.position),
            yaw: player.yaw,
            at: now,
            dead: false,
            uncertain: false,
          };
        } else {
          contact = this.deadAllies.get(player.id);
          if (!contact && finite(player.position)) {
            contact = {
              position: copy(player.position),
              yaw: player.yaw,
              at: now,
              dead: true,
              uncertain: false,
            };
            this.deadAllies.set(player.id, contact);
          }
          if (contact && now - contact.at >= this.settings.deathSeconds) continue;
        }
        kind = player.alive ? (player.id === observer.id ? "self" : "ally") : "death";
      } else if (snapshot.revealAll && player.alive) {
        contact = {
          position: copy(player.position),
          yaw: player.yaw,
          at: now,
          dead: false,
          uncertain: false,
        };
        kind = "enemy";
      } else {
        contact = this.contacts.get(player.id);
        kind = contact?.dead ? "death" : "enemy";
      }
      if (!contact || !finite(contact.position)) continue;
      const age = Math.max(0, now - contact.at);
      const duration = contact.dead ? this.settings.deathSeconds : this.settings.enemySeconds;
      markers.push({
        id: player.id,
        kind,
        team: player.team,
        position: copy(contact.position),
        yaw: contact.yaw,
        number: player.number,
        age,
        opacity: friendly && !contact.dead ? 1 : this.opacity(age, duration),
        uncertain: contact.uncertain || (!friendly && age > 0 && !contact.dead),
        altitude: this.altitude(contact.position.y, observer.position.y),
        carryingBomb: snapshot.bomb?.state === "carried" && snapshot.bomb.carrier === player.id,
        hostile: !friendly,
      });
    }
    const knownBomb = snapshot.bomb;
    const bomb =
      knownBomb && finite(knownBomb.position)
        ? {
            ...knownBomb,
            position: copy(knownBomb.position),
            age: 0,
            opacity: 1,
            uncertain: false,
            altitude: this.altitude(knownBomb.position.y, observer.position.y),
          }
        : undefined;
    return { markers, bomb };
  }
}
