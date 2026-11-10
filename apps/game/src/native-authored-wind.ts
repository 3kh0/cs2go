import * as T from "three";
import type { SourceFoliageWindState } from "./source-foliage-wind";
import { createEnvironmentWorldFrame } from "./native-environment-frame";

interface WindController {
  space: string;
  yaw: number;
  base: number;
  gust: number;
  delay: number;
  duration: number;
  turn: number;
}

/** Authored controller ranges drive this browser reconstruction. Controller
 * selection, midpoint timing and speed-to-shader scaling are explicit lowering
 * choices; private engine wind uploads/random seeds have not been observed. */
export function createAuthoredWind(
  records: readonly unknown[],
  options: {
    space: "main" | "sky";
    speedToStrength: number;
    worldToOwn?: T.Matrix4;
  },
) {
  if (!Number.isFinite(options.speedToStrength) || options.speedToStrength < 0)
    throw new Error("Invalid authored wind strength conversion");
  const controllers: WindController[] = records.map((record) => {
    const row = record as { space?: string; values?: Record<string, unknown> },
      v = row?.values;
    if (!v || v.classname !== "env_wind" || typeof row.space !== "string")
      throw new Error("Missing authored wind controller identity");
    const number = (key: string) => {
      const value = v[key];
      if (typeof value !== "number" || !Number.isFinite(value))
        throw new Error(`Missing authored wind field: ${key}`);
      return value;
    };
    const mean = (low: string, high: string) => {
      const a = number(low),
        b = number(high);
      if (a < 0 || b < a) throw new Error("Invalid authored wind range");
      return (a + b) / 2;
    };
    const angles = v.angles;
    if (
      !Array.isArray(angles) ||
      angles.length !== 3 ||
      !angles.every(Number.isFinite) ||
      angles[0] !== 0 ||
      angles[2] !== 0
    )
      throw new Error("Unsupported authored wind orientation");
    if (number("windradius") >= 0)
      throw new Error("Local wind controllers require per-position selection");
    const duration = number("gustduration"),
      turn = number("gustdirchange");
    if (duration < 0 || turn < 0) throw new Error("Invalid authored wind gust");
    return {
      space: row.space,
      yaw: angles[1],
      base: mean("minwind", "maxwind"),
      gust: mean("mingust", "maxgust"),
      delay: mean("mingustdelay", "maxgustdelay"),
      duration,
      turn,
    };
  });
  // Retain controller order; prefer the own sky's controller when it has one.
  // Last-global selection is a declared reconstruction, not native precedence.
  const scoped = controllers.filter((row) =>
      options.space === "sky" ? row.space.startsWith("sky") : row.space === "main",
    ),
    controller = (scoped.length ? scoped : controllers.filter((row) => row.space === "main")).at(
      -1,
    );
  const rotation = createEnvironmentWorldFrame(
      controller?.space.startsWith("sky") ? undefined : options.worldToOwn,
    ).worldToNativeNormal,
    vector = new T.Vector3(),
    direction: [number, number, number] = [0, 0, 0],
    state: SourceFoliageWindState = { direction, strength: 0, timeSeconds: 0 };
  const update = (seconds: number) => {
    if (!Number.isFinite(seconds)) throw new Error("Invalid authored wind time");
    state.timeSeconds = seconds;
    if (!controller) return state;
    const period = controller.delay + controller.duration,
      phase = period > 0 ? ((seconds % period) + period) % period : 0,
      gustPhase = controller.duration > 0 ? phase / controller.duration : 1,
      pulse = gustPhase < 1 ? Math.sin(Math.PI * gustPhase) ** 2 : 0,
      yaw =
        ((controller.yaw + controller.turn * Math.sin(2 * Math.PI * gustPhase) * pulse) * Math.PI) /
        180;
    // Sky-authored controllers are already in their own Source frame. Only
    // main-world fallback controllers need the world-to-own rotation.
    // Source XYZ -> browser XYZ -> own browser frame -> own Source XYZ.
    vector.set(Math.cos(yaw), 0, -Math.sin(yaw)).applyMatrix3(rotation).normalize();
    direction[0] = vector.x;
    direction[1] = -vector.z;
    direction[2] = vector.y;
    state.strength =
      (controller.base + (controller.gust - controller.base) * pulse) * options.speedToStrength;
    return state;
  };
  update(0);
  return { state, update };
}
