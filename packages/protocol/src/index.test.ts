import { expect, test } from "vitest";
import {
  MAX_BATCH,
  PROTOCOL_VERSION,
  WEAPON_COUNT,
  knifeDefinitions,
  neutralInput,
  parseClientMessage,
} from "./index";

test("every knife can be configured and selected without accepting invalid weapon IDs", () => {
  const configuration = {
    skins: Object.fromEntries(
      Array.from({ length: WEAPON_COUNT }, (_, id) => [id, { id: "", wear: 0.01, seed: 1 }]),
    ),
    agents: { ct: "default-ct", t: "default-t" },
    loadouts: { ct: [], t: [] },
  };
  for (const { id } of knifeDefinitions) {
    expect(
      parseClientMessage(
        JSON.stringify({ type: "configure", configuration: { ...configuration, knife: id } }),
      ),
    ).not.toBeNull();
    expect(
      parseClientMessage(
        JSON.stringify({ type: "inputs", inputs: [{ ...neutralInput(1), select: id, buy: id }] }),
      ),
    ).not.toBeNull();
  }
  for (const id of [-1, 0, 36, WEAPON_COUNT, 37.5, "55"]) {
    expect(
      parseClientMessage(
        JSON.stringify({ type: "configure", configuration: { ...configuration, knife: id } }),
      ),
    ).toBeNull();
  }
  for (const id of [WEAPON_COUNT, -2, 37.5, "55"])
    expect(
      parseClientMessage(
        JSON.stringify({ type: "inputs", inputs: [{ ...neutralInput(1), select: id }] }),
      ),
    ).toBeNull();
});
test("rejects incompatible versions, malformed payloads and impossible inputs", () => {
  const join = {
    type: "join",
    version: PROTOCOL_VERSION,
    room: "abcd1234abcd",
    name: "PLAYER",
    password: "",
    mode: "casual",
    team: "ct",
  };
  expect(parseClientMessage(JSON.stringify(join))).toEqual(join);
  for (const value of [
    { ...join, version: -1 },
    { ...join, room: "x" },
    { ...join, name: "\n" },
    null,
    [],
    { type: "inputs", inputs: [] },
  ])
    expect(parseClientMessage(JSON.stringify(value))).toBeNull();
  for (const input of [
    { ...neutralInput(1), forward: 10 },
    { ...neutralInput(1), seq: -1 },
    { ...neutralInput(1), pitch: 10 },
    { ...neutralInput(1), fire: "yes" },
  ])
    expect(parseClientMessage(JSON.stringify({ type: "inputs", inputs: [input] }))).toBeNull();
  expect(
    parseClientMessage(
      JSON.stringify({ type: "inputs", inputs: Array(MAX_BATCH + 1).fill(neutralInput(1)) }),
    ),
  ).toBeNull();
  expect(parseClientMessage("{invalid")).toBeNull();
});

test("shared profile pictures accept only public Steam avatar resources", () => {
  const configuration = {
    skins: {},
    agents: { ct: "default-ct", t: "default-t" },
    loadouts: { ct: [], t: [] },
    profile: {
      name: "Steam Player",
      avatar: `https://avatars.fastly.steamstatic.com/${"a".repeat(40)}_full.jpg`,
    },
  };
  const parse = (avatar: unknown) =>
    parseClientMessage(
      JSON.stringify({
        type: "configure",
        configuration: { ...configuration, profile: { ...configuration.profile, avatar } },
      }),
    );
  expect(parse(configuration.profile.avatar)).not.toBeNull();
  expect(parse(null)).not.toBeNull();
  for (const avatar of [
    "/api/steam?action=avatar",
    "javascript:alert(1)",
    "https://evil.test/pfp.jpg",
    configuration.profile.avatar + "?track=1",
    "https://avatars.fastly.steamstatic.com.evil.test/abc.jpg",
  ])
    expect(parse(avatar)).toBeNull();
});

test("glove selections retain per-team wear and seed while rejecting malformed cosmetic inputs", () => {
  const choice = { id: "5030_10018", wear: 0.123456, seed: 749 };
  const configuration = {
    skins: {},
    agents: { ct: "default-ct", t: "default-t" },
    loadouts: { ct: [], t: [] },
  };
  const parse = (gloves: unknown) =>
    parseClientMessage(
      JSON.stringify({ type: "configure", configuration: { ...configuration, gloves } }),
    );
  expect(parse({ ct: choice, t: { id: "", wear: 0.01, seed: 1 } })?.type).toBe("configure");
  for (const invalid of [
    null,
    [],
    {},
    { ct: choice },
    { ct: choice, t: choice, extra: choice },
    ...[
      { id: "../../etc" },
      { wear: -1 },
      { wear: 1.01 },
      { seed: 1001 },
      { seed: 0.5 },
      { id: "x".repeat(129) },
    ].map((value) => ({ ct: { ...choice, ...value }, t: choice })),
  ])
    expect(parse(invalid)).toBeNull();
});
