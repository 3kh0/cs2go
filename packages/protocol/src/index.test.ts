import { expect, test } from "vitest";
import { MAX_BATCH, PROTOCOL_VERSION, neutralInput, parseClientMessage } from "./index";
test("rejects incompatible versions, malformed payloads and impossible inputs", () => {
  const join = {
    type: "join",
    version: PROTOCOL_VERSION,
    room: "abcd1234abcd",
    name: "PLAYER",
    password: "",
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
