import { describe, expect, test } from "vitest";
import { botPortrait, hasNativeAgentPortrait } from "./bot-portrait";

describe("native bot portraits", () => {
  test("uses recovered SAS and Phoenix square art for matching roster aliases", () => {
    expect(botPortrait("ct", "default-ct")).toBe("/icons/avatars/bot-ct.png");
    expect(botPortrait("t", "agent-5036-t")).toBe("/icons/avatars/bot-phoenix.png");
    expect(botPortrait("t", "default-t")).toBe("/icons/avatars/bot-t.png");
    expect(hasNativeAgentPortrait("default-ct")).toBe(true);
    expect(hasNativeAgentPortrait("agent-5036-t")).toBe(true);
  });
  test("unknown agent faces fall back by faction without claiming face coverage", () => {
    expect(botPortrait("ct", "unrecovered-agent")).toBe("/icons/avatars/bot-ct.png");
    expect(botPortrait("t", "default-t")).toBe("/icons/avatars/bot-t.png");
    expect(hasNativeAgentPortrait("default-t")).toBe(true);
    expect(hasNativeAgentPortrait("unrecovered-agent")).toBe(false);
    expect(hasNativeAgentPortrait("agent-4711-ct")).toBe(false);
    expect(hasNativeAgentPortrait("agent-4756-ct")).toBe(false);
  });
});
