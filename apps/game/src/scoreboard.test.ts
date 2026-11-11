import { afterEach, expect, test, vi } from "vitest";
import { renderScoreboard, updateScoreboardClock } from "./scoreboard";

afterEach(() => vi.unstubAllGlobals());

function scoreboardDocument() {
  const makeNode = () => ({
    textContent: "",
    dataset: {},
    hidden: false,
    append: vi.fn(),
    setAttribute: vi.fn(),
    replaceChildren: vi.fn(),
  });
  const clock = makeNode();
  const heading = makeNode();
  const rows = makeNode();
  const root = { ...makeNode(), hidden: true, querySelector: () => heading };
  const nodes: Record<string, unknown> = {
    scoreboard: root,
    "scoreboard-clock": clock,
    "scoreboard-rows": rows,
  };
  vi.stubGlobal("document", {
    getElementById: (id: string) => nodes[id],
    createElement: makeNode,
    createDocumentFragment: makeNode,
  });
  return { clock, root, rows };
}

test("clock refresh crosses minute boundaries without replacing the scoreboard or revealing it", () => {
  const { clock, root, rows } = scoreboardDocument();
  updateScoreboardClock({ mode: "casual", seconds: 60 });
  expect(clock.textContent).toBe("1:00");
  updateScoreboardClock({ mode: "casual", seconds: 59 });
  expect(clock.textContent).toBe("0:59");
  updateScoreboardClock({ mode: "casual", seconds: 0 });
  expect(clock.textContent).toBe("0:00");
  expect(rows.replaceChildren).not.toHaveBeenCalled();
  expect(root.hidden).toBe(true);
});

test("unchanged clock refreshes preserve the text node and practice changes refresh immediately", () => {
  const { clock } = scoreboardDocument();
  let text = "1:00";
  const write = vi.fn((value: string) => {
    text = value;
  });
  Object.defineProperty(clock, "textContent", { get: () => text, set: write });
  updateScoreboardClock({ mode: "competitive", seconds: 60 });
  expect(write).not.toHaveBeenCalled();
  updateScoreboardClock({ mode: "practice", seconds: 60 });
  expect(text).toBe("∞");
  updateScoreboardClock({ mode: "practice", seconds: 59 });
  expect(write).toHaveBeenCalledTimes(1);
  updateScoreboardClock({ mode: "deathmatch", seconds: 59 });
  expect(text).toBe("0:59");
  expect(write).toHaveBeenCalledTimes(2);
});

test("full scoreboard renders still initialize the clock for callers without a separate refresh", () => {
  const { clock, rows } = scoreboardDocument();
  renderScoreboard({
    rows: [],
    mode: "deathmatch",
    teamMode: false,
    competitive: false,
    teamSize: 10,
    winTarget: 8,
    round: 1,
    seconds: 125,
    roundPause: false,
    scores: { ct: 0, t: 0 },
    history: [],
    planted: false,
  });
  expect(clock.textContent).toBe("2:05");
  expect(rows.replaceChildren).toHaveBeenCalledOnce();
});
