import type { ServerMessage } from "./index";

type Snapshot = Extract<ServerMessage, { type: "snapshot" }>;
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Patch = [0, Json] | [1, Record<string, Patch>] | [2];
const utf8 = new TextEncoder();

type Delta = { type: "snapshot-delta"; base: number; tick: number; patch: Patch };

function difference(previous: Json, current: Json): { next: Json; patch?: Patch } {
  if (previous === current) return { next: previous };
  if (
    previous === null ||
    current === null ||
    typeof previous !== "object" ||
    typeof current !== "object" ||
    Array.isArray(previous) !== Array.isArray(current) ||
    (Array.isArray(current) && current.length !== (previous as Json[]).length)
  )
    return { next: structuredClone(current), patch: [0, current] };
  const changes: Record<string, Patch> = {};
  const before = previous as Record<string, Json>,
    after = current as Record<string, Json>;
  let next: Record<string, Json> | undefined;
  for (const key of Object.keys(after)) {
    if (after[key] === undefined) continue;
    const update = Object.hasOwn(before, key)
      ? difference(before[key], after[key])
      : { next: structuredClone(after[key]), patch: [0, after[key]] as Patch };
    if (update.patch) {
      next ??= (Array.isArray(previous) ? [...previous] : { ...before }) as Record<string, Json>;
      next[key] = update.next;
      changes[key] = update.patch;
    }
  }
  for (const key of Object.keys(before)) {
    if (!Object.hasOwn(after, key) || after[key] === undefined) {
      next ??= { ...before };
      delete next[key];
      changes[key] = [2];
    }
  }
  return next ? { next, patch: [1, changes] } : { next: previous };
}

function apply(previous: Json, patch: Patch): Json {
  if (patch[0] === 0) return patch[1];
  if (patch[0] === 2) throw new Error("Invalid root deletion");
  if (!previous || typeof previous !== "object") throw new Error("Invalid delta baseline");
  const result = (Array.isArray(previous) ? [...previous] : { ...previous }) as Record<
    string,
    Json
  >;
  for (const [key, change] of Object.entries(patch[1])) {
    if (["__proto__", "constructor", "prototype"].includes(key))
      throw new Error("Invalid delta key");
    if (change[0] === 2) delete result[key];
    else result[key] = apply(result[key], change);
  }
  return result;
}

/** Ordered reliable WebSocket only. Share one encoder per room; send a full
 * snapshot to peers without its preceding baseline before sending deltas. */
export class SnapshotEncoder {
  private baseline?: Json;
  private tick = -1;
  encode(snapshot: Snapshot): string {
    const current = snapshot as unknown as Json;
    if (!this.baseline) {
      const encoded = JSON.stringify(snapshot);
      this.baseline = JSON.parse(encoded) as Json;
      this.tick = snapshot.tick;
      return encoded;
    }
    const { next, patch } = difference(this.baseline, current);
    const message: Delta = {
      type: "snapshot-delta",
      base: this.tick,
      tick: snapshot.tick,
      patch: patch ?? [1, {}],
    };
    const delta = JSON.stringify(message);
    const full = JSON.stringify(snapshot);
    // Spawns and major round transitions can make a patch larger than a keyframe.
    const encoded = utf8.encode(delta).byteLength < utf8.encode(full).byteLength ? delta : full;
    this.baseline = next;
    this.tick = snapshot.tick;
    return encoded;
  }
}

export class SnapshotDecoder {
  private baseline?: Snapshot;
  reset() {
    this.baseline = undefined;
  }
  decode(message: ServerMessage | Delta): ServerMessage | null {
    if (message.type === "snapshot") {
      this.baseline = message;
      return message;
    }
    if (message.type !== "snapshot-delta") return message;
    if (!this.baseline || message.base !== this.baseline.tick || message.tick <= message.base)
      return null;
    try {
      const snapshot = apply(
        this.baseline as unknown as Json,
        message.patch,
      ) as unknown as Snapshot;
      if (snapshot.tick !== message.tick || snapshot.type !== "snapshot") return null;
      this.baseline = snapshot;
      return snapshot;
    } catch {
      return null;
    }
  }
}
