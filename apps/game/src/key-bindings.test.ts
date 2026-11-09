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
  delete old.KeyT;
  delete old.KeyY;
  old.KeyR = "KeyG";
  old.KeyB = "Digit4";
  old.KeyF = "KeyT";
  old.KeyE = "KeyY";
  const next = readBindings(old);
  expect(next.KeyR).toBe("KeyG");
  expect(next.KeyB).toBe("Digit4");
  expect(next.KeyF).toBe("KeyT");
  expect(next.KeyE).toBe("KeyY");
  expect(next.KeyT).not.toBe("KeyT");
  expect(next.KeyY).not.toBe("KeyY");
  expect(next.KeyG).not.toBe("KeyG");
  expect(next.Digit4).not.toBe("Digit4");
  expect(new Set(Object.values(next)).size).toBe(Object.keys(next).length);
});

it("adds C4 selection to old saves while preserving a custom binding on 5", () => {
  const old = defaultBindings();
  delete old.Digit5;
  old.KeyR = "Digit5";
  const next = readBindings(old);
  expect(next.KeyR).toBe("Digit5");
  expect(next.Digit5).not.toBe("Digit5");
  expect(canonicalKey(next.Digit5, next)).toBe("Digit5");
});

it("adds Deathmatch controls without stealing a saved X binding", () => {
  const old = defaultBindings();
  delete old.F3;
  delete old.KeyX;
  old.KeyR = "KeyX";
  const migrated = readBindings(old);
  expect(migrated.KeyR).toBe("KeyX");
  expect(migrated.KeyX).not.toBe("KeyX");
  expect(migrated.F3).toBe("F3");
  expect(canonicalKey(migrated.KeyX, migrated)).toBe("KeyX");
  expect(canonicalKey("F3", migrated)).toBe("F3");
});

it("adds radar zoom without stealing an existing H binding", () => {
  const old = defaultBindings();
  delete old.KeyH;
  old.KeyR = "KeyH";
  const migrated = readBindings(old);
  expect(migrated.KeyR).toBe("KeyH");
  expect(migrated.KeyH).not.toBe("KeyH");
  expect(canonicalKey(migrated.KeyH, migrated)).toBe("KeyH");
});
