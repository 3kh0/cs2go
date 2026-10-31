import { expect, test } from "vitest";
import { MAX_BATCH, PROTOCOL_VERSION, neutralInput, parseClientMessage } from "./index";
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
