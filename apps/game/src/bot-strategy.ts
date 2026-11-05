export type StrategyPoint = readonly [number, number, number];
export type StrategyLane = "longA" | "shortA" | "tunnelsB" | "midB";
export type StrategySite = "a" | "b";
export type StrategyRole = "entry" | "support" | "lurk" | "anchor" | "rotate";
export type StrategyWaypoint = { position: StrategyPoint; radius: number; timeout: number };
export type BotStrategyRoutes = {
  lanes: Record<StrategyLane, readonly StrategyWaypoint[]>;
  sites: Record<StrategySite, StrategyPoint>;
  anchors: Record<StrategySite, readonly StrategyPoint[]>;
  retakeAnchors?: Record<StrategySite, readonly StrategyPoint[]>;
  ctRotate?: readonly StrategyWaypoint[];
};
export type StrategyOrder = {
  goal: StrategyPoint;
  role: StrategyRole;
  site: StrategySite;
  plan: string;
  lane: StrategyLane;
  stage: number;
  urgent: boolean;
  utility: "smoke" | "flash" | null;
  utilityTarget?: StrategyPoint;
  watch?: StrategyPoint;
};
export type StrategyUpdate = {
  dt: number;
  remaining: number;
  allies: readonly { index: number; position: StrategyPoint; alive: boolean }[];
  reports: readonly { position: StrategyPoint; age: number }[];
  bomb: {
    planted: boolean;
    position: StrategyPoint | null;
    carrier: number | "player";
    site?: StrategySite;
  };
};
const tPlans = ["rushB", "longA", "shortA", "splitA", "midB", "defaultRotate"] as const;
const ctPlans = ["balanced", "heavyA", "heavyB", "retake"] as const;
const distance = (a: StrategyPoint, b: StrategyPoint) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
type Assignment = {
  role: StrategyRole;
  lane: StrategyLane;
  site: StrategySite;
  stage: number;
  age: number;
};

// Inputs deliberately exclude hidden enemy positions.
export class BotRoundStrategy {
  readonly plan: string;
  site: StrategySite;
  elapsed = 0;
  rotations = 0;
  rotationReason: "resistance" | "default" | "clock" | "contact" | "plant" | "carrier" | null =
    null;
  private carrierFollowed = false;
  private resistance = 0;
  private contactTime = 0;
  private contactSite: StrategySite | null = null;
  private lastRotation = -Infinity;
  private readonly assignments = new Map<number, Assignment>();
  private readonly orders = new Map<number, StrategyOrder>();
  private readonly team: "t" | "ct";
  private readonly routes: BotStrategyRoutes;
  constructor({
    team,
    round,
    seed,
    members,
    routes,
  }: {
    team: "t" | "ct";
    round: number;
    seed: number;
    members: readonly number[];
    routes: BotStrategyRoutes;
    roundTime: number;
  }) {
    this.team = team;
    this.routes = routes;
    const offset = (Math.imul(seed | 0, 1664525) + 1013904223) >>> 0;
    const choices = team === "t" ? tPlans : ctPlans;
    this.plan =
      choices[(((round - 1 + offset) % choices.length) + choices.length) % choices.length];
    this.site = this.plan === "rushB" || this.plan === "midB" || this.plan === "heavyB" ? "b" : "a";
    [...members]
      .sort((a, b) => a - b)
      .forEach((index, ordinal) => {
        const site: StrategySite =
          team === "t"
            ? this.site
            : this.plan === "heavyA"
              ? ordinal % 4 === 3
                ? "b"
                : "a"
              : this.plan === "heavyB"
                ? ordinal % 4 === 3
                  ? "a"
                  : "b"
                : ordinal % 2 === 0
                  ? "a"
                  : "b";
        const lane: StrategyLane =
          team === "ct"
            ? site === "a"
              ? "shortA"
              : "midB"
            : this.plan === "rushB"
              ? "tunnelsB"
              : this.plan === "midB"
                ? ordinal % 3 === 0
                  ? "tunnelsB"
                  : "midB"
                : this.plan === "shortA"
                  ? "shortA"
                  : this.plan === "splitA"
                    ? ordinal % 2 === 0
                      ? "longA"
                      : "shortA"
                    : this.plan === "defaultRotate"
                      ? ordinal % 2 === 0
                        ? "longA"
                        : "midB"
                      : "longA";
        const role: StrategyRole =
          team === "ct"
            ? ordinal % 3 === 2 || this.plan === "retake"
              ? "rotate"
              : "anchor"
            : ordinal % 5 === 4
              ? "lurk"
              : ordinal % 2 === 0
                ? "entry"
                : "support";
        const alternate: StrategyLane =
          site === "b"
            ? lane === "midB"
              ? "tunnelsB"
              : "midB"
            : lane === "longA"
              ? "shortA"
              : "longA";
        this.assignments.set(index, {
          role,
          lane: role === "lurk" ? alternate : lane,
          site,
          stage: 0,
          age: 0,
        });
      });
  }
  order(index: number) {
    return this.orders.get(index) ?? null;
  }
  private rotate(site: StrategySite, reason: NonNullable<BotRoundStrategy["rotationReason"]>) {
    this.site = site;
    this.rotations++;
    this.rotationReason = reason;
    this.resistance = 0;
    for (const assignment of this.assignments.values()) {
      assignment.site = site;
      assignment.lane =
        site === "a"
          ? assignment.role === "lurk"
            ? "longA"
            : "shortA"
          : assignment.role === "lurk"
            ? "tunnelsB"
            : "midB";
      assignment.stage = 0;
      assignment.age = 0;
    }
  }
  update(state: StrategyUpdate) {
    const dt = Math.max(0, state.dt);
    this.elapsed += dt;
    const counts = { a: 0, b: 0 };
    const unique: StrategyPoint[] = [];
    for (const report of state.reports) {
      if (
        report.age < 0 ||
        report.age > 3 ||
        unique.some((point) => distance(point, report.position) < 2)
      )
        continue;
      unique.push(report.position);
      const a = distance(report.position, this.routes.sites.a),
        b = distance(report.position, this.routes.sites.b);
      if (Math.min(a, b) < 24) counts[a < b ? "a" : "b"]++;
    }
    const contactSite = counts.a || counts.b ? (counts.a >= counts.b ? "a" : "b") : null;
    this.contactTime =
      contactSite !== null && contactSite === this.contactSite ? this.contactTime + dt : 0;
    this.contactSite = contactSite;
    if (state.bomb.planted && state.bomb.position) {
      const site =
        state.bomb.site ??
        (distance(state.bomb.position, this.routes.sites.a) <
        distance(state.bomb.position, this.routes.sites.b)
          ? "a"
          : "b");
      if (this.rotationReason !== "plant" || this.site !== site) this.rotate(site, "plant");
    } else if (this.team === "t") {
      // A teammate carrying C4 can commit the attack to another site. This is
      // strategic convergence on a known friendly position, never a spawn leash.
      if (
        !this.carrierFollowed &&
        state.bomb.carrier === "player" &&
        state.bomb.position &&
        this.elapsed >= 10
      ) {
        const other = this.site === "a" ? "b" : "a";
        const currentDistance = distance(state.bomb.position, this.routes.sites[this.site]);
        const otherDistance = distance(state.bomb.position, this.routes.sites[other]);
        if (otherDistance <= 18 && otherDistance + 12 <= currentDistance) {
          this.rotate(other, "carrier");
          this.carrierFollowed = true;
        }
      }
      this.resistance =
        counts[this.site] >= 2 ? this.resistance + dt : Math.max(0, this.resistance - dt);
      if (this.rotations === 0 && state.bomb.carrier !== -1) {
        if (this.resistance >= 8 && this.elapsed >= 12 && state.remaining > 35)
          this.rotate(this.site === "a" ? "b" : "a", "resistance");
        else if (this.plan === "defaultRotate" && this.elapsed >= 22 && state.remaining > 35)
          this.rotate("b", "default");
        else if (state.remaining <= 30 && this.elapsed > 10) {
          const allies = state.allies.filter((ally) => ally.alive);
          const a = allies.reduce(
            (sum, ally) => sum + distance(ally.position, this.routes.sites.a),
            0,
          );
          const b = allies.reduce(
            (sum, ally) => sum + distance(ally.position, this.routes.sites.b),
            0,
          );
          if (allies.length && (a < b ? "a" : "b") !== this.site)
            this.rotate(a < b ? "a" : "b", "clock");
        }
      }
    } else if (
      contactSite &&
      this.contactTime >= 2 &&
      this.elapsed >= 4 &&
      this.elapsed - this.lastRotation >= 8 &&
      (this.rotationReason !== "contact" || this.site !== contactSite)
    ) {
      this.site = contactSite;
      this.lastRotation = this.elapsed;
      this.rotationReason = "contact";
      for (const assignment of this.assignments.values())
        if (assignment.role === "rotate") assignment.site = contactSite;
    }
    this.orders.clear();
    const retriever =
      this.team === "t" && !state.bomb.planted && state.bomb.carrier === -1 && state.bomb.position
        ? state.allies
            .filter((ally) => ally.alive && this.assignments.has(ally.index))
            .sort(
              (a, b) =>
                distance(a.position, state.bomb.position!) -
                distance(b.position, state.bomb.position!),
            )[0]?.index
        : undefined;
    for (const ally of state.allies) {
      const assignment = this.assignments.get(ally.index);
      if (!assignment || !ally.alive) continue;
      let goal: StrategyPoint;
      let urgent = false;
      let utility: StrategyOrder["utility"] = null;
      let utilityTarget: StrategyPoint | undefined;
      let watch: StrategyPoint | undefined;
      const ordinal = [...this.assignments.keys()].indexOf(ally.index);
      const siteOrdinal = [...this.assignments.values()]
        .slice(0, ordinal)
        .filter((other) => other.site === assignment.site).length;
      const anchors = this.routes.anchors[assignment.site];
      const anchor =
        anchors[siteOrdinal % Math.max(1, anchors.length)] ?? this.routes.sites[assignment.site];
      const watchLane: StrategyLane =
        assignment.site === "a"
          ? siteOrdinal % 2 === 0
            ? "longA"
            : "shortA"
          : siteOrdinal % 2 === 0
            ? "tunnelsB"
            : "midB";
      const approach = this.routes.lanes[watchLane].at(-1)?.position;
      if (state.bomb.planted && state.bomb.position) {
        goal = anchor;
        watch = approach;
        urgent = this.team === "ct";
        const rotate = this.team === "ct" ? this.routes.ctRotate?.[assignment.stage] : undefined;
        if (rotate && distance(ally.position, state.bomb.position) > 18) {
          assignment.age += dt;
          if (
            distance(ally.position, rotate.position) <= Math.max(1.5, rotate.radius) ||
            assignment.age >= rotate.timeout
          ) {
            assignment.stage++;
            assignment.age = 0;
          }
          goal = this.routes.ctRotate?.[assignment.stage]?.position ?? anchor;
          if (this.routes.ctRotate?.[assignment.stage]) watch = undefined;
        }
      } else if (ally.index === retriever && state.bomb.position) {
        goal = state.bomb.position;
        urgent = true;
      } else if (this.team === "ct") {
        const holds = this.routes.retakeAnchors?.[assignment.site] ?? anchors;
        goal =
          this.plan === "retake" && this.rotationReason === null
            ? (holds[siteOrdinal % Math.max(1, holds.length)] ?? anchor)
            : anchor;
        urgent = assignment.role === "rotate" && this.rotationReason === "contact";
        watch = approach;
      } else {
        const stages = this.routes.lanes[assignment.lane];
        assignment.age += dt;
        const waypoint = stages[assignment.stage];
        // Every route stage has a timeout; one lagging teammate cannot block it.
        if (
          waypoint &&
          (distance(ally.position, waypoint.position) <= Math.max(1.5, waypoint.radius) ||
            assignment.age >= Math.max(1, waypoint.timeout))
        ) {
          assignment.stage++;
          assignment.age = 0;
        }
        if (state.remaining <= 20 && this.elapsed > 10) {
          assignment.stage = stages.length;
        }
        const finalGoal = ally.index === state.bomb.carrier ? this.routes.sites[this.site] : anchor;
        goal = stages[assignment.stage]?.position ?? finalGoal;
        if (assignment.stage >= stages.length) watch = approach;
        urgent =
          assignment.role !== "lurk" || state.remaining <= 30 || ally.index === state.bomb.carrier;
        if (assignment.role === "support") {
          const range = distance(ally.position, this.routes.sites[assignment.site]);
          if (
            range >= 6 &&
            range <= 23 &&
            assignment.stage >= stages.length - 1 &&
            assignment.stage < stages.length
          ) {
            utility = ordinal % 4 === 1 ? "smoke" : "flash";
            utilityTarget = this.routes.sites[assignment.site];
          }
        }
      }
      this.orders.set(ally.index, {
        goal,
        role: assignment.role,
        site: assignment.site,
        plan: this.plan,
        lane: assignment.lane,
        stage: assignment.stage,
        urgent,
        utility,
        ...(utilityTarget ? { utilityTarget } : {}),
        ...(watch ? { watch } : {}),
      });
    }
  }
}
