import { describe, expect, it } from "vitest";
import { normalizeServer } from "./custom-servers";

describe("normalizeServer", () => {
  it("turns hosts and HTTP addresses into WebSocket endpoints", () => {
    expect(normalizeServer("cs.example.com", true)).toEqual({ url: "wss://cs.example.com/ws" });
    expect(normalizeServer("https://cs.example.com:8443", true)).toEqual({
      url: "wss://cs.example.com:8443/ws",
    });
    expect(normalizeServer("localhost:3001", true)).toEqual({ url: "ws://localhost:3001/ws" });
    expect(normalizeServer("wss://cs.example.com/game?x=1#y", true)).toEqual({
      url: "wss://cs.example.com/game",
    });
  });
  it("rejects addresses the browser cannot use", () => {
    expect(normalizeServer("", true)).toHaveProperty("error");
    expect(normalizeServer("ftp://cs.example.com", true)).toHaveProperty("error");
    expect(normalizeServer("ws://cs.example.com", true)).toHaveProperty("error");
    expect(normalizeServer("ws://cs.example.com", false)).toEqual({
      url: "ws://cs.example.com/ws",
    });
    expect(normalizeServer("wss://user:pass@cs.example.com", true)).toHaveProperty("error");
  });
});
