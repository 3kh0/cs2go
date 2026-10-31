import { expect, it } from "vitest";
// @ts-expect-error Node is provided by the test runner.
import { readFileSync } from "node:fs";
// @ts-expect-error Node is provided by the test runner.
import { createHash } from "node:crypto";
import bindings from "../../../scripts/cs2-weapon-audio.json";

it("covers every firearm marker with a native CS2 event and verifies bundled clip hashes", () => {
  const provenance = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-weapons-source.json", "utf8"),
  );
  expect(provenance.manifest).toBe("4758919807587010422");
  expect(provenance.vpkDirectorySha256).toBe(
    "48018be3f8da306ce9b48bf746bce08ceff19fe4dff15c9d5e2e53b3c3e9bbad",
  );
  const ids = new Set(bindings.selection.coverage.map((marker) => marker.weaponId));
  expect([...ids].sort((a, b) => a - b)).toEqual(
    Array.from({ length: 37 }, (_, i) => i).filter((i) => ![4, 5, 6].includes(i)),
  );
  const clips = new Map(
    provenance.clips.map((clip: { name: string; resource: string; outputSha256: string }) => [
      clip.name,
      clip,
    ]),
  );
  for (const marker of bindings.selection.coverage) expect(clips.has(marker.name)).toBe(true);
  for (const clip of bindings.clips) {
    expect(clip.nativeVariants).toContain(clip.resource.replace(/_c$/, ""));
    const imported = clips.get(clip.name) as { resource: string; outputSha256: string };
    expect(imported.resource).toBe(clip.resource);
    const bytes = readFileSync(`../../packages/assets/public/audio/${clip.name}.ogg`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(imported.outputSha256);
  }
  expect(clips.get("ak47-1")).toMatchObject({ resource: "sounds/weapons/ak47/ak47_02.vsnd_c" });
  expect(clips.get("cz75_clipin")).toMatchObject({
    resource: "sounds/weapons/cz75a/cz75_clipin_01.vsnd_c",
  });
  expect(clips.get("galil_clipin")).toMatchObject({
    resource: "sounds/weapons/magazine_slide_01.vsnd_c",
    resourceSha256: "d593f8b111e9e1bbe81416e3b4e6be2b05f57b7fe65affd8dc8f176943739a7a",
  });
  expect(clips.get("elite_leftclipin")).toMatchObject({
    event: "Weapon_ELITE.Clipin",
    resource: "sounds/weapons/elite/elites_clipin_07.vsnd_c",
    resourceSha256: "e0339d33d75046e24e2fdadc510930386125d74925f4609d8facebe8a931128b",
  });
});

it("ships the CS2 soundtrack with verified local bytes and no former CS:GO music references", () => {
  const provenance = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-music-source.json", "utf8"),
  );
  const manifest = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/manifest.json", "utf8"),
  );
  expect(provenance.manifest).toBe("4758919807587010422");
  for (const clip of provenance.clips) {
    expect(clip.resource).toContain("sounds/music/valve_cs2_01/");
    expect(
      createHash("sha256")
        .update(readFileSync(`../../packages/assets/public/audio/source/${clip.name}.ogg`))
        .digest("hex"),
    ).toBe(clip.outputSha256);
    expect(manifest.clips.find((c: { name: string }) => c.name === clip.name)?.source).toBe(
      clip.resource,
    );
  }
  expect(manifest.clips.filter((c: { name: string }) => c.name.startsWith("music-"))).toHaveLength(
    11,
  );
});

it("every packed effect has native CS2 provenance and matching local bytes", () => {
  const effects = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-effects-source.json", "utf8"),
  );
  const weapons = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-weapons-source.json", "utf8"),
  );
  const elite = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-elite-source.json", "utf8"),
  );
  expect(elite.manifest).toBe("67499503218971311");
  expect(elite.clips).toMatchObject([
    {
      name: "elite_lclipin",
      event: "Weapon_ELITE.Lclipin",
      resource: "sounds/weapons/elite/elite_leftclipin.vsnd_c",
      resourceSha256: "b89ee98c057a7c5431e48febc4ff3d13f01eea10011f37bbc1f96a60929bc5af",
    },
    {
      name: "elite_rclipin",
      event: "Weapon_ELITE.Rclipin",
      resource: "sounds/weapons/elite/elite_rightclipin.vsnd_c",
      resourceSha256: "2c6f735bfc906c5d9eb2bdaf2dc5366977e930f981ce3c05b4ef134095f71185",
    },
  ]);
  const bank = JSON.parse(
    readFileSync("../../packages/assets/public/audio/startup-source.json", "utf8"),
  );
  const manifest = JSON.parse(
    readFileSync("../../packages/assets/public/audio/source/manifest.json", "utf8"),
  );
  const sources = new Map<string, string>();
  const ui = JSON.parse(
    readFileSync("../../packages/assets/public/audio/cs2-ui-source.json", "utf8"),
  );
  expect(ui.depotManifest).toBe("67499503218971311");
  for (const clip of ui.clips) sources.set(`/audio/source/${clip.name}.ogg`, clip.outputSha256);
  expect(effects.manifest).toBe("67499503218971311");
  for (const [report, prefix] of [
    [effects, "/audio/source/"],
    [weapons, "/audio/"],
    [elite, "/audio/"],
  ] as const) {
    expect(report.source).toBe("Valve CS2 Steam depot");
    for (const clip of report.clips) sources.set(`${prefix}${clip.name}.ogg`, clip.outputSha256);
  }
  for (const clip of effects.clips) {
    expect(clip.variants).toContain(clip.resource.replace(/_c$/, ""));
    expect(effects.soundEventsSha256[clip.eventFile]).toMatch(/^[a-f0-9]{64}$/);
    expect(
      manifest.clips.find((entry: { name: string }) => entry.name === clip.name),
    ).toMatchObject({
      resource: clip.resource,
      outputSha256: clip.outputSha256,
      manifest: effects.manifest,
    });
  }
  expect(bank.clips).toHaveLength(sources.size);
  for (const clip of bank.clips) {
    expect(sources.get(clip.url), clip.url).toBe(clip.sha256);
    expect(
      createHash("sha256")
        .update(readFileSync(`../../packages/assets/public${clip.url}`))
        .digest("hex"),
    ).toBe(clip.sha256);
  }
});
