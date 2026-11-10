import { expect, test } from "vitest";
import {
  prepareRadarOverview,
  radarSectionAt,
  radarLayerAt,
  validateRadarOverview,
  type RadarOverview,
} from "./radar-overview";

// Synthetic heights exercise range behavior; these are not native map thresholds.
const overview: RadarOverview = {
  pos_x: -200,
  pos_y: 300,
  scale: 5,
  sections: [
    { name: "lower", min: -12, max: -2, image: "/models/maps/example-lower.png" },
    { name: "upper", min: -2, max: 9, image: "/models/maps/example-upper.png" },
  ],
};
function image(width = 1024, height = 1024) {
  return { naturalWidth: width, naturalHeight: height } as HTMLImageElement;
}

test("overview sections keep touching boundaries deterministic and gaps use the base map", () => {
  const sections = overview.sections!;
  for (const altitude of [-12, -11, -2.001])
    expect(radarSectionAt(sections, altitude)?.name).toBe("lower");
  for (const altitude of [-2, 0, 8.999])
    expect(radarSectionAt(sections, altitude)?.name).toBe("upper");
  for (const altitude of [-12.001, 9, Infinity, NaN])
    expect(radarSectionAt(sections, altitude)).toBeUndefined();
  const gapped = [sections[0], { ...sections[1], min: 1 }];
  validateRadarOverview({ ...overview, sections: gapped });
  expect(radarSectionAt(gapped, 0)).toBeUndefined();
});

test("invalid, ambiguous and duplicate sections fail before requesting any images", async () => {
  let loads = 0;
  const load = async () => {
    loads++;
    return image();
  };
  const sections = overview.sections!;
  for (const invalid of [
    { ...overview, scale: 0 },
    { ...overview, pos_x: NaN },
    { ...overview, sections: [sections[0], { ...sections[1], min: -3 }] },
    { ...overview, sections: [sections[0], { ...sections[1], name: "lower" }] },
    { ...overview, sections: [{ ...sections[0], max: -12 }] },
    { ...overview, sections: [{ ...sections[0], max: Infinity }] },
    { ...overview, sections: [{ ...sections[0], image: "relative.png" }] },
  ])
    await expect(prepareRadarOverview("/base.png", invalid, load)).rejects.toThrow();
  expect(loads).toBe(0);
});

test("preparation waits for every declared section and preserves source section order", async () => {
  let release: (value: HTMLImageElement) => void = () => {};
  const delayed = new Promise<HTMLImageElement>((resolve) => {
    release = resolve;
  });
  const base = image(),
    upper = image(),
    lower = image();
  let committed = false;
  const pending = prepareRadarOverview("/base.png", overview, async (path) =>
    path.endsWith("lower.png") ? delayed : path.endsWith("upper.png") ? upper : base,
  ).then((result) => {
    committed = true;
    return result;
  });
  await Promise.resolve();
  expect(committed).toBe(false);
  release(lower);
  const result = await pending;
  expect(result.image).toBe(base);
  expect(result.sections.map((entry) => entry.section.name)).toEqual(["lower", "upper"]);
  expect(result.sections[0].image).toBe(lower);
  expect(result.sections[1].image).toBe(upper);
  expect(radarLayerAt(result, -12).image).toBe(lower);
  expect(radarLayerAt(result, -2).image).toBe(upper);
  expect(radarLayerAt(result, 9).image).toBe(base);
  expect(radarLayerAt(result, NaN).image).toBe(base);
  // Switching repeatedly reuses the decoded image rather than allocating or loading.
  expect(radarLayerAt(result, -5)).toBe(result.sections[0]);
  expect(radarLayerAt(result, 2)).toBe(result.sections[1]);
});

test("a failed or misaligned secondary image rejects the complete preparation", async () => {
  await expect(
    prepareRadarOverview("/base.png", overview, async (path) => {
      if (path.endsWith("upper.png")) throw new Error("Secondary radar decode failed");
      return image();
    }),
  ).rejects.toThrow("Secondary radar decode failed");
  await expect(
    prepareRadarOverview("/base.png", overview, async (path) =>
      image(path.endsWith("upper.png") ? 512 : 1024),
    ),
  ).rejects.toThrow("inconsistent dimensions");
  const base = image();
  expect(await prepareRadarOverview("/base.png", undefined, async () => base)).toEqual({
    image: base,
    sections: [],
  });
});
