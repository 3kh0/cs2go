export const displayAspects = { "16:9": 16 / 9, "16:10": 16 / 10, "4:3": 4 / 3, "5:4": 5 / 4 };
export type DisplayAspect = "native" | keyof typeof displayAspects;
export const displayDefaults = { aspectRatio: "native" as DisplayAspect };
export function readDisplaySettings(saved: Record<string, unknown>) {
  const value = saved.aspectRatio;
  return {
    aspectRatio:
      value === "native" || (typeof value === "string" && Object.hasOwn(displayAspects, value))
        ? (value as DisplayAspect)
        : displayDefaults.aspectRatio,
  };
}
export function displayViewport(aspect: DisplayAspect, width: number, height: number) {
  height = Math.max(1, height);
  const logicalWidth = aspect === "native" ? Math.max(1, width) : height * displayAspects[aspect];
  return { width: logicalWidth, height, stretch: Math.max(1, width) / logicalWidth };
}

export function applyDisplayViewport(aspect: DisplayAspect, width: number, height: number) {
  const viewport = displayViewport(aspect, width, height);
  const style = document.documentElement.style;
  style.setProperty("--game-width", `${viewport.width}px`);
  style.setProperty("--game-height", `${viewport.height}px`);
  style.setProperty("--game-stretch", String(viewport.stretch));
  style.setProperty("--game-vw", `${viewport.width / 100}px`);
  style.setProperty("--game-vmin", `${Math.min(viewport.width, viewport.height) / 100}px`);
  return viewport;
}
export function savedDisplayAspect(): DisplayAspect {
  try {
    return readDisplaySettings(JSON.parse(localStorage.getItem("cs2go-settings") || "{}"))
      .aspectRatio;
  } catch {
    return "native";
  }
}
