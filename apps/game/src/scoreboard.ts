import { assetUrl } from "./asset-url";
import { playerAvatar } from "./player-profile";
import { weapons, weaponIcons, isKnife } from "./physics";
import "./scoreboard.css";

export type ScorePlayer = {
  id: number | "player";
  name: string;
  avatar?: string | null;
  team: "ct" | "t";
  alive: boolean;
  kills: number;
  deaths: number;
  mvps: number;
  bot?: boolean;
  ping?: number;
  money?: number;
  weapon?: number;
  weaponHolstered?: boolean;
  kit?: boolean;
  armor?: number;
  helmet?: boolean;
};
type Board = {
  rows: ScorePlayer[];
  mode: string;
  teamMode: boolean;
  competitive: boolean;
  teamSize: number;
  winTarget: number;
  round: number;
  seconds: number;
  roundPause: boolean;
  scores: { ct: number; t: number };
  history: { winner: "ct" | "t"; reason: string }[];
  planted: boolean;
  carrier?: number | "player";
};
const make = (tag: string, className: string, text = "") => {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
};
function image(src: string, alt = "", className = "") {
  const node = document.createElement("img");
  node.src = assetUrl(src);
  node.alt = alt;
  node.className = className;
  return node;
}
function history(board: Board) {
  const node = make("div", "score-progress");
  node.setAttribute("aria-label", "Round history");
  const count = board.competitive ? 24 : 15;
  const rounds = make("div", "round-slots");
  rounds.style.setProperty("--rounds", String(count));
  for (let i = 0; i < count; i++) {
    const outcome = board.history[i];
    const slot = make(
      "span",
      `round-slot ${outcome?.winner ?? ""} ${!outcome && i === board.round - 1 ? "current" : ""}`,
    );
    if (board.competitive && i === 12) slot.classList.add("halftime");
    slot.title = `Round ${i + 1}: ${outcome ? `${outcome.winner.toUpperCase()} won - ${outcome.reason}` : i === board.round - 1 ? "In progress" : "Unplayed"}`;
    slot.setAttribute("aria-label", slot.title);
    if (outcome) {
      const icon =
        outcome.reason === "Bomb defused"
          ? "/icons/buy/defuser.svg"
          : outcome.reason === "Bomb detonated"
            ? "/icons/buy/c4.svg"
            : outcome.reason === "Time expired"
              ? "/ui/match/timer.svg"
              : "/ui/match/dead.svg";
      slot.append(image(icon));
    }
    slot.append(make("span", "round-number", String(i + 1)));
    rounds.append(slot);
  }
  node.append(rounds);
  return node;
}
export function renderScoreboard(board: Board) {
  const root = document.getElementById("scoreboard")!;
  root.dataset.mode = board.mode;
  root.querySelector("h2")!.textContent =
    `${board.mode.charAt(0).toUpperCase()}${board.mode.slice(1).toLowerCase()} | Dust II`;
  document.getElementById("scoreboard-clock")!.textContent =
    board.mode === "practice"
      ? "∞"
      : `${Math.floor(board.seconds / 60)}:${String(board.seconds % 60).padStart(2, "0")}`;
  const localTeam = board.rows.find((player) => player.id === "player")?.team;
  const fragment = document.createDocumentFragment();
  for (const team of ["ct", "t"] as const) {
    if (team === "t" && board.teamMode) fragment.append(history(board));
    const players = board.rows.filter((r) => r.team === team);
    const section = make("section", `score-team ${team}`);
    section.setAttribute("aria-label", team === "ct" ? "Counter-Terrorists" : "Terrorists");
    const aside = make("div", "score-team-summary");
    aside.append(
      make(
        "strong",
        "team-score",
        String(
          board.teamMode ? board.scores[team] : players.reduce((sum, row) => sum + row.kills, 0),
        ),
      ),
      make("h3", "team-name", team === "ct" ? "COUNTER-TERRORISTS" : "TERRORISTS"),
      make(
        "span",
        "team-alive",
        `Alive: ${players.filter((r) => r.alive).length}/${players.length}`,
      ),
    );
    const table = make("div", "score-team-table");
    const header = make("div", "scoreboard-head");
    for (const label of ["", "", "", "", "Equipment", "Money", "Kills", "Deaths", "K/D", "MVPs"])
      header.append(make("span", "", label));
    table.append(header);
    for (const player of players) {
      const row = make(
        "div",
        `score-row ${player.id === "player" ? "you" : "bot"} ${player.alive ? "alive" : "dead"}`,
      );
      row.setAttribute(
        "aria-label",
        `${player.name}, ${player.alive ? "alive" : "dead"}, ${player.kills} kills, ${player.deaths} deaths`,
      );
      const kit = make("span", "score-life");
      if (!player.alive) kit.append(image("/ui/match/dead.svg", "Dead"));
      else if (player.kit) kit.append(image("/icons/buy/defuser.svg", "Defuse kit", "score-gear"));
      const status = make("span", "score-connection");
      if (player.bot ?? player.id !== "player")
        status.append(image("/ui/match/bot.svg", "Bot", "score-bot"));
      else {
        status.textContent = player.ping === undefined ? "—" : String(player.ping);
        status.title = player.ping === undefined ? "Ping unavailable" : `${player.ping} ms ping`;
        status.setAttribute("aria-label", status.title);
      }
      const avatar = make("span", "score-avatar");
      const fallback = assetUrl(`/icons/team-${team}.png`);
      const portrait = image(
        player.avatar || (player.id === "player" && playerAvatar()) || fallback,
      );
      portrait.referrerPolicy = "no-referrer";
      portrait.onerror = () => {
        portrait.onerror = null;
        portrait.src = fallback;
      };
      avatar.append(portrait);
      const name = make("span", "score-player", player.name);
      if (
        board.teamMode &&
        player.team === localTeam &&
        !board.planted &&
        board.carrier === player.id &&
        player.alive
      ) {
        const bomb = image("/icons/buy/c4.svg", "Bomb carrier", "score-bomb");
        bomb.title = "Bomb carrier";
        name.append(bomb);
      }
      const equipment = make("span", "score-equipment");
      if (player.alive && player.weapon !== undefined && !isKnife(player.weapon)) {
        const icons: Record<string, string> = {
          "ak-47": "ak47",
          "m4a1-s": "m4a1_silencer",
          "usp-s": "usp_silencer",
          m4a4: "m4a1",
        };
        equipment.append(
          image(
            `/icons/buy/${icons[weaponIcons[player.weapon]] ?? weaponIcons[player.weapon]}.svg`,
            weapons[player.weapon].name,
            `score-weapon${player.weaponHolstered ? " holstered" : ""}`,
          ),
        );
      }
      if (player.alive && player.armor)
        equipment.append(
          image(
            `/icons/buy/${player.helmet ? "assaultsuit" : "kevlar"}.svg`,
            player.helmet ? "Armor and helmet" : "Armor",
            "score-gear",
          ),
        );
      const cash = make(
        "span",
        "score-cash",
        player.money === undefined ? "" : `$${player.money.toLocaleString()}`,
      );
      const mvps = make("span", "score-mvps");
      if (player.mvps) {
        mvps.append(image("/ui/match/star.svg", "MVP"), make("span", "", String(player.mvps)));
        mvps.title = `${player.mvps} round MVP${player.mvps === 1 ? "" : "s"}`;
      }
      row.append(
        kit,
        status,
        avatar,
        name,
        equipment,
        cash,
        make("span", "score-number", String(player.kills)),
        make("span", "score-number", String(player.deaths)),
        make("span", "score-ratio", (player.kills / Math.max(1, player.deaths)).toFixed(1)),
        mvps,
      );
      table.append(row);
    }
    section.append(aside, table);
    fragment.append(section);
  }
  document.getElementById("scoreboard-rows")!.replaceChildren(fragment);
}
