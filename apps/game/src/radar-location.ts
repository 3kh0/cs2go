import type { MapId } from "@cs2go/protocol";
import type { Navigation } from "./navigation";
import { mapCalloutAt } from "./map-callouts";

const samples = new WeakMap<Navigation, { at: number; name: string }>();
export function updateRadarLocation(
  navigation: Navigation,
  position: { x: number; y: number; z: number },
  mapId: MapId,
) {
  const now = performance.now();
  let sample = samples.get(navigation);
  if (sample && now - sample.at < 62.5) return;
  const location = mapCalloutAt(navigation.data.locations ?? [], position);
  const name = location?.name ?? sample?.name ?? (mapId === "dust2" ? "Dust II" : "Mirage");
  if (!sample) {
    sample = { at: now, name };
    samples.set(navigation, sample);
  }
  sample.at = now;
  sample.name = name;
  const label = document.getElementById("location");
  if (label && label.textContent !== name) label.textContent = name;
}
