/** A source-validated new runtime material name may reuse an existing native
 * definition/texture set. The descriptor records the whole original definition;
 * no filename patterns, feature substitutions or tint overrides are inferred. */
export interface NativeMaterialAlias {
  sourceName: string;
  shader: string;
  nativeResource: string;
  definition: unknown;
  names: string[];
}
export type NativePieceMaterialAliases = {
  environment?: NativeMaterialAlias[];
  complex?: NativeMaterialAlias[];
  legacy?: NativeMaterialAlias[];
  glass?: NativeMaterialAlias[];
};
function signature(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(signature).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${signature(child)}`)
      .join(",")}}`;
  if (
    (typeof value === "number" && !Number.isFinite(value)) ||
    value === undefined ||
    typeof value === "function"
  )
    throw new Error("Native material alias has non-JSON source data");
  return JSON.stringify(value);
}
export function bindNativeMaterialAliases<
  Material extends { shader: string; nativeResource: string },
>(materials: Record<string, Material> | undefined, aliases: readonly NativeMaterialAlias[] = []) {
  if (!aliases.length) return 0;
  if (!materials) throw new Error("Native piece alias requires its original material bundle");
  const pending = new Map<string, Material>();
  for (const alias of aliases) {
    const source = materials[alias.sourceName];
    if (
      !source ||
      source.shader !== alias.shader ||
      source.nativeResource !== alias.nativeResource ||
      signature(source) !== signature(alias.definition)
    )
      throw new Error(`Native piece material alias source changed: ${alias.sourceName}`);
    if (
      !alias.names.length ||
      alias.names.some(
        (name) => !name || name === "__proto__" || name === "constructor" || name === "prototype",
      )
    )
      throw new Error("Invalid native piece material alias name");
    for (const name of alias.names) {
      const existing =
        pending.get(name) ?? (Object.hasOwn(materials, name) ? materials[name] : undefined);
      if (existing && signature(existing) !== signature(source))
        throw new Error(`Conflicting native piece material alias: ${name}`);
      pending.set(name, source);
    }
  }
  // Validate the entire transaction before mutating the loaded bundle.
  for (const [name, source] of pending) materials[name] = source;
  return pending.size;
}
