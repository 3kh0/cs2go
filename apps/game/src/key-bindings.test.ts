import { describe, expect, it } from "vitest";
import { canonicalKey, defaultBindings, readBindings } from "./key-bindings";
describe("saved controls", () => {
  it("moves a binding without leaving its old key active", () => {
    const bindings = defaultBindings();
    bindings.KeyW = "KeyI";
    expect(canonicalKey("KeyI", bindings)).toBe("KeyW");
    expect(canonicalKey("KeyW", bindings)).toBe("");
    expect(readBindings(bindings)).toEqual(bindings);
  });
  it("rejects corrupted, reserved or conflicting saved bindings", () => {
    for (const invalid of [
      null,
      { KeyW: "KeyI" },
      { ...defaultBindings(), KeyW: "Escape" },
      { ...defaultBindings(), KeyW: "KeyS" },
    ])
      expect(readBindings(invalid)).toEqual(defaultBindings());
  });
  it("allows explicit right-modifier assignments before default aliases", () => {
    const bindings = defaultBindings();
    expect(canonicalKey("ControlRight", bindings)).toBe("ControlLeft");
    bindings.KeyR = "ControlRight";
    expect(canonicalKey("ControlRight", bindings)).toBe("KeyR");
  });
});

it("migrates existing controls without stealing keys for new actions", () => {
  const old = defaultBindings();
  delete old.Digit4;
  delete old.KeyG;
  old.KeyR = "KeyG";
  old.KeyB = "Digit4";
  const next = readBindings(old);
  expect(next.KeyR).toBe("KeyG");
  expect(next.KeyB).toBe("Digit4");
  expect(next.KeyG).not.toBe("KeyG");
  expect(next.Digit4).not.toBe("Digit4");
  expect(new Set(Object.values(next)).size).toBe(Object.keys(next).length);
});
