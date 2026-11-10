import { loadCalloutRadar } from "./radar";

export type RadarSection = {
  name: string;
  /** Explicit browser Y coordinates in metres, converted from native overview data. */
  min: number;
  max: number;
  image: string;
};
export type RadarOverview = {
  pos_x: number;
  pos_y: number;
  scale: number;
  sections?: readonly RadarSection[];
};
export type PreparedRadarOverview = {
  image: HTMLImageElement;
  sections: readonly { section: RadarSection; image: HTMLImageElement }[];
};

export function validateRadarOverview(overview: RadarOverview) {
  if (
    !Number.isFinite(overview.pos_x) ||
    !Number.isFinite(overview.pos_y) ||
    !Number.isFinite(overview.scale) ||
    overview.scale <= 0 ||
    (overview.sections !== undefined && !Array.isArray(overview.sections))
  )
    throw new Error("Invalid native radar overview projection");
  const names = new Set<string>();
  const ordered = [...(overview.sections ?? [])].sort((a, b) => a.min - b.min);
  let previous: RadarSection | undefined;
  for (const section of ordered) {
    if (
      typeof section.name !== "string" ||
      !section.name.trim() ||
      names.has(section.name) ||
      !Number.isFinite(section.min) ||
      !Number.isFinite(section.max) ||
      section.min >= section.max ||
      typeof section.image !== "string" ||
      !section.image.startsWith("/")
    )
      throw new Error("Invalid native radar overview section");
    if (previous && section.min < previous.max)
      throw new Error("Native radar overview sections overlap");
    names.add(section.name);
    previous = section;
  }
}

/** Ranges use [min, max); gaps and non-finite altitudes use the base overview.
 * The caller supplies its chosen altitude; this does not assume a native
 * feet-versus-eye selection rule or invent map-specific floor thresholds. */
export function radarSectionAt(sections: readonly RadarSection[], altitude: number) {
  if (!Number.isFinite(altitude)) return undefined;
  return sections.find((section) => altitude >= section.min && altitude < section.max);
}

/** Prepared layers share one projection and need no image decoding or copying
 * while the observer moves between their authored altitude ranges. */
export function radarLayerAt(
  overview: PreparedRadarOverview,
  altitude: number,
): { image: HTMLImageElement; section?: RadarSection } {
  if (!Number.isFinite(altitude)) return overview;
  return (
    overview.sections.find(({ section }) => altitude >= section.min && altitude < section.max) ??
    overview
  );
}

/** A caller commits this complete result after checking cancellation. Failed
 * secondary images must not leave a new world paired with an incomplete radar. */
export async function prepareRadarOverview(
  path: string,
  overview?: RadarOverview,
  load: (path: string) => Promise<HTMLImageElement> = loadCalloutRadar,
): Promise<PreparedRadarOverview> {
  if (overview) validateRadarOverview(overview);
  const sections = overview?.sections ?? [];
  const [image, ...images] = await Promise.all([
    load(path),
    ...sections.map((section) => load(section.image)),
  ]);
  if (
    !image.naturalWidth ||
    !image.naturalHeight ||
    images.some(
      (layer) =>
        layer.naturalWidth !== image.naturalWidth || layer.naturalHeight !== image.naturalHeight,
    )
  )
    throw new Error("Native radar overview layers have inconsistent dimensions");
  return { image, sections: sections.map((section, index) => ({ section, image: images[index] })) };
}
