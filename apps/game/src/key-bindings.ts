export const bindingActions = [
  ["KeyW", "Move forward"],
  ["KeyS", "Move backward"],
  ["KeyA", "Strafe left"],
  ["KeyD", "Strafe right"],
  ["Space", "Jump"],
  ["ControlLeft", "Crouch"],
  ["KeyC", "Crouch (alternate)"],
  ["ShiftLeft", "Walk quietly"],
  ["KeyR", "Reload"],
  ["KeyE", "Use / plant / defuse"],
  ["KeyF", "Inspect weapon"],
  ["KeyB", "Buy menu"],
  ["Tab", "Scoreboard"],
  ["KeyM", "Expand radar"],
  ["Digit1", "Primary weapon"],
  ["Digit2", "Sidearm"],
  ["Digit3", "Knife"],
  ["Digit4", "Cycle grenades"],
  ["KeyG", "Drop weapon"],
] as const;
export type KeyBindings = Record<string, string>;
export const defaultBindings = (): KeyBindings =>
  Object.fromEntries(bindingActions.map(([code]) => [code, code]));
export function validBinding(code: string) {
  return /^(Key[A-Z]|Digit[0-9]|Arrow(Up|Down|Left|Right)|Space|Tab|Shift(Left|Right)|Control(Left|Right)|Alt(Left|Right)|Backquote|Minus|Equal|Bracket(Left|Right)|Backslash|Semicolon|Quote|Comma|Period|Slash|CapsLock|Enter|Backspace|Insert|Delete|Home|End|PageUp|PageDown|Numpad[0-9])$/.test(
    code,
  );
}
export function readBindings(value: unknown): KeyBindings {
  const result = defaultBindings();
  if (!value || typeof value !== "object") return result;
  const candidate: KeyBindings = { ...(value as KeyBindings) };
  // Migrate older saves without resetting established bindings when a new
  // action's default key is already used by the player.
  for (const action of ["Digit4", "KeyG"]) {
    if (Object.hasOwn(candidate, action)) continue;
    const used = new Set(Object.values(candidate));
    candidate[action] = [action, "KeyH", "KeyJ", "KeyV", "Digit5", "Digit6"].find(
      (key) => !used.has(key),
    )!;
  }
  const codes = bindingActions.map(([action]) => candidate[action]);
  if (
    codes.every((code) => typeof code === "string" && validBinding(code)) &&
    new Set(codes).size === codes.length
  )
    for (const [action] of bindingActions) result[action] = candidate[action];
  return result;
}
export function canonicalKey(code: string, bindings: KeyBindings) {
  const exact = bindingActions.find(([action]) => bindings[action] === code);
  if (exact) return exact[0];
  // Keep both-side modifier convenience only while the default is selected.
  if (code === "ControlRight" && bindings.ControlLeft === "ControlLeft") return "ControlLeft";
  if (code === "ShiftRight" && bindings.ShiftLeft === "ShiftLeft") return "ShiftLeft";
  return "";
}
export function keyLabel(code: string) {
  return code
    .replace(/^Key|^Digit/, "")
    .replace(/Left$/, " L")
    .replace(/Right$/, " R")
    .replace(/^Arrow/, "Arrow ");
}
