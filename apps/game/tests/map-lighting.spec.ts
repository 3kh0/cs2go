import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

test("native lighting keeps its existing reflection fallback when uniform headroom is limited", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [],
    requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    return (await import(path)).renderMapLighting(false, false, false, undefined, 224);
  });
  expect(requests.some((url) => url.includes("/lighting/native/irradiance-4096.bin.gz"))).toBe(
    true,
  );
  expect(requests.some((url) => url.includes("/lighting/reflections/"))).toBe(false);
  expect(result.calls).toBeLessThan(400);
  expect(result.sun[0]).toBeGreaterThan(result.shade[0]);
  expect(errors).toEqual([]);
});

test("native reflection arrays preserve cube seams, blur mips, volume priority, box projection and normalization", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const r = await page.evaluate(async () => {
    const path = "/tests/source-reflections-fixture.ts";
    return (await import(path)).renderSourceReflections();
  });
  await test.info().attach("native-reflection-regression.json", {
    body: JSON.stringify(r, null, 2),
    contentType: "application/json",
  });
  expect(r.glError).toBe(0);
  expect(r.gpuBytes).toBe(22543008);
  expect(r.samples).toBe(165888);
  expect(r.nonCornerSamples).toBeGreaterThan(150000);
  expect(r.nonCornerMaxError).toBeLessThan(0.02);
  expect(r.nonCornerRmsError).toBeLessThan(0.001);
  expect(r.unorderedInputChannels).toBe(3);
  expect(r.unorderedSamples).toHaveLength(6);
  for (const sample of r.unorderedSamples) {
    expect(sample.hardware.every(Number.isFinite)).toBe(true);
    expect(sample.manual.every(Number.isFinite)).toBe(true);
    expect(sample.manual).toEqual(sample.hardware);
  }
  for (let channel = 0; channel < 3; channel++) {
    expect(Math.abs(r.manualCorner[channel] - r.cornerAverage[channel])).toBeLessThan(0.00001);
    expect(Math.abs(r.priorityA[channel] - r.a[channel] * 0.99)).toBeLessThan(0.00001);
    expect(Math.abs(r.priorityB[channel] - r.b[channel] * 0.99)).toBeLessThan(0.00001);
    expect(Math.abs(r.sharedPriorityB[channel] - r.b[channel] * 0.99)).toBeLessThan(0.00001);
    expect(Math.abs(r.restoredPriorityA[channel] - r.a[channel] * 0.99)).toBeLessThan(0.00001);
    expect(Math.abs(r.halfBlend[channel] - (r.a[channel] + r.b[channel]) * 0.495)).toBeLessThan(
      0.00001,
    );
    expect(Math.abs(r.normalized[channel] - r.a[channel] * 0.25)).toBeLessThan(0.00001);
    expect(Math.abs(r.coloredNormalized[channel] - r.a[channel] * 0.10625)).toBeLessThan(0.00001);
    expect(Math.abs(r.noBrightening[channel] - r.a[channel] * 0.99)).toBeLessThan(0.00001);
    expect(Math.abs(r.parallax[channel] - r.parallaxExpected[channel] * 0.99)).toBeLessThan(
      0.00001,
    );
    expect(
      Math.abs(r.roughParallax[channel] - r.roughParallaxExpected[channel] * 0.99),
    ).toBeLessThan(0.00001);
    expect(
      Math.abs(r.obliqueParallax[channel] - r.obliqueParallaxExpected[channel] * 0.99),
    ).toBeLessThan(0.001);
  }
  expect(r.outside).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});

test("native surfaces preserve diffuse energy and independently gate highlights and reflections", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-surface-fixture.ts";
    return (await import(path)).renderSourceSurfaces();
  });
  for (const value of [
    result.diffuseDirect,
    result.diffuseDirectRough,
    result.diffuseIndirect,
    result.diffuseIndirectRough,
  ])
    for (const channel of value) expect(Math.abs(channel - result.expected)).toBeLessThanOrEqual(1);
  expect(result.metalDirectOff).toEqual([0, 0, 0]);
  expect(result.metalIndirectOff).toEqual([0, 0, 0]);
  expect(result.metalDirectOn[0]).toBeGreaterThan(200);
  expect(result.metalIndirectOn[2]).toBeGreaterThan(50);
  expect(result.metalIndirectOn[0]).toBeLessThan(5);
  expect(result.reflectiveDiffuse[0]).toBeLessThan(result.expected - 5);
  for (const channel of result.reflectiveDiffuse)
    expect(Math.abs(channel - result.reflectiveDiffuseExpected)).toBeLessThanOrEqual(2);
  for (const sample of result.directSamples)
    for (const channel of sample.actual)
      expect(Math.abs(channel - sample.expected)).toBeLessThanOrEqual(2);
  expect(result.counts).toEqual({ matte: 206, reflective: 25, glossy: 37 });
  for (const channel of result.nativeDirectAO)
    expect(Math.abs(channel - result.expected)).toBeLessThanOrEqual(1);
  expect(result.nativeDirectClear[0]).toBeGreaterThan(result.nativeDirectAO[0]);
  expect(result.nativeMetalAO).toEqual([0, 0, 0]);
  expect(result.nativeIndirectAO).toEqual([0, 0, 0]);
  expect(result.rawAOCount).toBe(267);
  for (const sample of result.aoSamples)
    for (let channel = 0; channel < 3; channel++)
      expect(Math.abs(sample.occluded[channel] - sample.expected[channel])).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("native tunnel masonry keeps columns in front of the arches without dark wedges", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    // Actual console eye/angles from the Windows native capture, not feet+64.
    return (await import(path)).renderMapLighting(false, false, false, {
      eye: [-1040, 1625.578125, -0.243553],
      angles: [-5.000153, -90, 0],
      rayPixels: [
        [1215, 562],
        [1216, 550],
        [1212, 575],
        [803, 331],
      ],
    });
  });
  expect(result.raySamples).toHaveLength(4);
  for (const sample of result.raySamples?.slice(0, 3) ?? []) {
    expect(sample.material).toBe("hr_dust_kasbah_column001_color");
    expect(sample.rgba[0]).toBeGreaterThan(50);
  }
  expect(result.raySamples![3].material).toBe("dust_hanging_light_02_on");
  expect(Math.min(...result.raySamples![3].rgba.slice(0, 3))).toBeGreaterThan(220);
  // Independent ray intersection against the full native, unsimplified export.
  const expected = [-1196.352058, 1326.57137, 40.288217];
  result.raySamples![0].sourcePoint.forEach((value: number, index: number) =>
    expect(Math.abs(value - expected[index])).toBeLessThan(0.1),
  );
  const directory = new URL("../../../artifacts/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("dust2-native-tunnel-masonry.png", directory),
    Buffer.from(result.image.split(",")[1], "base64"),
  );
  expect(result.vertices).toBeLessThan(2500000);
  expect(errors).toEqual([]);
});

test("native bulb emission decodes mask and tint once and retains albedo modulation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-self-illum-fixture.ts";
    return (await import(path)).renderSourceSelfIllumination();
  });
  for (let channel = 0; channel < 3; channel++) {
    expect(
      Math.abs(result.shadedAlbedo[channel] - result.expectedShaded[channel]),
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs(result.withoutAlbedo[channel] - result.expectedUnmodulated[channel]),
    ).toBeLessThanOrEqual(2);
    expect(result.withoutAlbedo[channel]).toBeGreaterThan(result.shadedAlbedo[channel]);
  }
  expect(result.darkMask).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});

test("native barn lights retain frustum, falloff and independent baked masks in world and viewmodel space", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-barn-fixture.ts";
    return (await import(path)).renderSourceBarns();
  });
  expect(result.front[0]).toBeGreaterThan(50);
  expect(result.front[0]).toBeGreaterThan(result.front[1]);
  expect(result.front[1]).toBeGreaterThan(result.front[2]);
  expect(result.blockedG.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.blockedB).toEqual(result.front);
  expect(result.front[0]).toBeGreaterThan(result.farther[0] * 1.3);
  expect(result.behind.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.outside.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.corner.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.worldActor).toEqual(result.viewActor);
  expect(result.worldActor[0]).toBeGreaterThan(50);
  expect(result.noProbeActor).toEqual(result.worldActor);
  expect(result.disabledPreview.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.viewBlocked.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.probeG[0]).toBeLessThan(0.01);
  expect(result.probeG[1]).toBeCloseTo(0.472972507412372, 6);
  expect(result.probeB[0]).toBeCloseTo(0.24592417763612825, 6);
  expect(result.probeB[1]).toBeLessThan(0.01);
  expect(result.probeGBlocked.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.probeBOpen[0]).toBeGreaterThan(50);
  expect(result.lightmapGBlocked.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.lightmapOpen[0]).toBeGreaterThan(50);
  expect(errors).toEqual([]);
});

test("native layer GPU uploads follow Low texture settings and restore High exactly", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    return (await import(path)).renderMapLighting(false, false, true);
  });
  expect(result.surfaceQuality?.high).toEqual([512, 512, 512, 512]);
  expect(result.surfaceQuality?.low).toEqual([128, 128, 128, 128]);
  expect(result.surfaceQuality?.restored).toEqual(result.surfaceQuality?.high);
  expect(result.surfaceQuality?.restoredImage).toBe(true);
  expect(result.genericQuality?.high).toEqual([2048, 1024]);
  expect(result.genericQuality?.low).toEqual([512, 256]);
  expect(result.genericQuality?.restored).toEqual(result.genericQuality?.high);
  expect(errors).toEqual([]);
});

test("native layers retain vertex weights, mask softness, border tint and encoded-normal mixing", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-layers-fixture.ts";
    return (await import(path)).renderSourceLayers();
  });
  expect(result.left[0]).toBeGreaterThan(240);
  expect(result.left[2]).toBeLessThan(10);
  expect(result.right[2]).toBeGreaterThan(240);
  expect(result.right[0]).toBeLessThan(10);
  expect(result.border[0]).toBeLessThan(result.plain[0] * 0.8);
  expect(result.maskTransition).toBeGreaterThan(result.narrowTransition * 3);
  expect(result.normalCenter[0]).toBeGreaterThan(240);
  expect(result.normalEdge[0]).toBeLessThan(100);
  expect(result.specularOn[2]).toBeGreaterThan(20);
  expect(result.specularOff).toEqual([0, 0, 0]);
  expect(result.specularOccluded).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});

test("foliage transmits backlighting and opposite-side probes while retaining sun occlusion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-foliage-fixture.ts";
    return (await import(path)).renderSourceTransmission();
  });
  expect(result.throughLeaf[1]).toBeGreaterThan(240);
  expect(result.throughLeaf[0]).toBeLessThan(10);
  expect(result.throughAlbedo[0]).toBeGreaterThan(240);
  expect(result.throughAlbedo[1]).toBeLessThan(10);
  expect(result.frontLit[0]).toBeGreaterThan(240);
  expect(result.frontLit[1]).toBeLessThan(100);
  expect(result.blocked.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.oppositeProbe[1]).toBeGreaterThan(240);
  expect(result.oppositeProbe[0]).toBeLessThan(10);
  expect(result.oppositeProbeWithAO).toEqual(result.oppositeProbe);
  expect(result.backFace.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.noFlipFront[0]).toBeGreaterThan(240);
  expect(result.noFlipFront[1]).toBeLessThan(10);
  expect(result.noFlipBack[0]).toBeGreaterThan(240);
  expect(result.noFlipBack[1]).toBeLessThan(10);
  expect(errors).toEqual([]);
});

test("native foliage preserves distant alpha coverage and masks grazing edges", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-foliage-fixture.ts";
    return (await import(path)).renderSourceFoliage();
  });
  expect(result.near).toBeGreaterThan(25);
  expect(result.far).toBeGreaterThan(result.near * 1.4);
  expect(result.grazing).toBeLessThan(result.near / 2);
  expect(errors).toEqual([]);
});

test("Dust II retains native light and shadow contrast with bounded static rendering", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const external: string[] = [];
  const requests: string[] = [];
  const origin = new URL(baseURL!).origin;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => {
    const url = request.url();
    requests.push(url);
    if (!url.startsWith(`${origin}/`) && !/^(blob:|data:)/.test(url)) external.push(url);
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    const { renderMapLighting } = await import(path);
    return renderMapLighting();
  });
  const directory = new URL("../../../artifacts/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("dust2-native-long-doors.png", directory),
    Buffer.from(result.image.split(",")[1], "base64"),
  );
  const luma = (rgb: number[]) => rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  expect(luma(result.sun)).toBeGreaterThan(luma(result.shade) * 1.25);
  expect(result.sun[0]).toBeGreaterThan(result.sun[2]);
  expect(result.shade[2]).toBeGreaterThan(result.shade[0]);
  expect(result.vertices).toBeLessThan(2500000);
  expect(result.normalScales).toEqual({
    dust_shipping_crate_02_painted_decals: -1,
    dust_arch_01_color: -1,
    hr_dust_brick_ground_02: -1,
  });
  expect(result.invalid).toBe(0);
  // The native sky/cables baseline measured 359 calls before Mirage breakables
  // (mirage-full-regression.log). Retain a small bound around that authored scene.
  expect(result.calls).toBeLessThanOrEqual(375);
  expect(result.triangles).toBeLessThan(1400000);
  expect(result.backProbeBytes).toBeGreaterThan(600000);
  expect(result.backProbeBytes).toBeLessThanOrEqual(650000);
  // The pinned native scene already allocates 529 textures on baseline e45c2c6.
  // Retain a small bound around that scene when changing shader transport.
  expect(result.textures).toBeLessThanOrEqual(535);
  expect(result.layerWeightBytes).toBeGreaterThan(300000);
  expect(result.layerWeightBytes).toBeLessThanOrEqual(350000);
  expect(
    requests.some((url) => /corner-uv|triangle-valid|fallback\.bin|confidence\.bin/.test(url)),
  ).toBe(false);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("Dust II loads bounded fallback lighting without native compression support", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  const requests: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("request", (request) => requests.push(request.url()));
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    return (await import(path)).renderMapLighting(true, false, true);
  });
  expect(requests.some((url) => url.includes("/lighting/irradiance.webp"))).toBe(true);
  expect(requests.some((url) => url.includes("/lighting/shadows.webp"))).toBe(true);
  expect(result.genericQuality?.high).toEqual([512, 512]);
  expect(result.genericQuality?.low).toEqual([128, 128]);
  expect(result.genericQuality?.restored).toEqual(result.genericQuality?.high);
  expect(result.surfaceQuality?.restoredImage).toBe(true);
  expect(requests.filter((url) => /\/lighting\/generic\/.*-rgba\.bin\.gz/.test(url))).toHaveLength(
    2,
  );
  expect(requests.some((url) => url.includes("/lighting/native/"))).toBe(false);
  expect(requests.some((url) => /\/lighting\/layers\/.*\.bin\.gz/.test(url))).toBe(false);
  expect(requests.some((url) => /\/lighting\/layers\/.*\.webp/.test(url))).toBe(true);
  expect(result.normalScales).toEqual({
    dust_shipping_crate_02_painted_decals: -1,
    dust_arch_01_color: -1,
    hr_dust_brick_ground_02: -1,
  });
  expect(result.invalid).toBe(0);
  expect(result.sun[0] + result.sun[1] + result.sun[2]).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test("native cubemap fog preserves near surfaces, caps opacity and clears above its height range", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-fog-fixture.ts";
    return (await import(path)).renderSourceFog();
  });
  expect(result.near.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.far[0]).toBeGreaterThanOrEqual(120);
  expect(result.far[0]).toBeLessThanOrEqual(135);
  expect(result.far.slice(1, 3)).toEqual([0, 0]);
  expect(result.high.slice(0, 3)).toEqual([0, 0, 0]);
  expect(result.disabled.slice(0, 3)).toEqual([0, 0, 0]);
  expect(errors).toEqual([]);
});

test("baked native cables follow the supplied reference curves without exceeding map budgets", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/map-lighting-fixture.ts";
    return (await import(path)).renderMapLighting(false, true);
  });
  expect(result.referenceCables).toHaveLength(20);
  for (const sample of result.referenceCables)
    expect(sample.darkness, `Native cable at ${sample.expected.join(",")}`).toBeGreaterThan(15);
  expect(result.vertices).toBeLessThan(2500000);
  expect(result.normalScales).toEqual({
    dust_shipping_crate_02_painted_decals: -1,
    dust_arch_01_color: -1,
    hr_dust_brick_ground_02: -1,
  });
  expect(result.invalid).toBe(0);
  const directory = new URL("../../../artifacts/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(
    new URL("dust2-native-reference-cables.png", directory),
    Buffer.from(result.image.split(",")[1], "base64"),
  );
  expect(errors).toEqual([]);
});

test("foliage preserves native backface normals with explicit and derivative tangents", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const samples = await page.evaluate(async () => {
    const path = "/tests/source-foliage-fixture.ts";
    return (await import(path)).renderSourceFoliageNormals();
  });
  for (const sample of samples) {
    // Native normal flips only its geometric Z; tangent X stays positive.
    const normal = [0.6, 1 / 255, (sample.back && !sample.dontFlip ? -1 : 1) * (205 / 255)];
    const length = Math.hypot(...normal);
    for (let axis = 0; axis < 3; axis++)
      expect(
        Math.abs(sample.pixel[axis] - Math.round(((normal[axis] / length) * 0.5 + 0.5) * 255)),
      ).toBeLessThanOrEqual(2);
  }
  expect(errors).toEqual([]);
});

test("foliage control colors brighten diffuse by native height without tinting specular or opacity", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/favicon.ico", (route) => route.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const samples = await page.evaluate(async () => {
    const path = "/tests/source-foliage-fixture.ts";
    return (await import(path)).renderSourceFoliageGradient();
  });
  for (const sample of samples) {
    if (sample.metalness === 0) {
      const expected = Math.round(255 * 0.25 * (1 + 0.33 * Math.max(0.001, sample.height) ** 1.5));
      for (const channel of sample.pixel.slice(0, 3))
        expect(Math.abs(channel - expected)).toBeLessThanOrEqual(1);
    } else
      expect(sample.pixel).toEqual(
        samples.find((s: { metalness: number }) => s.metalness === 1)!.pixel,
      );
    expect(sample.pixel[3]).toBe(255);
  }
  expect(errors).toEqual([]);
});

test("native environment separates AO from opacity and metalness, preserves packed normals and masks tint once", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-environment-fixture.ts";
    return (await import(path)).renderSourceEnvironment();
  });
  expect(result.source.modelTint).toEqual([0.17788833, 0.19806919, 0.14412838]);
  const tint = result.source.modelTint as number[],
    weights = [0.2125, 0.7154, 0.0721];
  const tintLength = Math.hypot(...tint),
    norm = tint.map((v) => v / tintLength);
  const base = [128, 96, 64].map((v) => v / 255);
  const luma = base.reduce((sum, v, i) => sum + v * weights[i], 0);
  const q = Math.min(
    luma / norm.reduce((sum, v, i) => sum + v * weights[i], 0),
    3 * luma * Math.max(...tint),
  );
  for (const sample of result.masks) {
    const mask = Math.max(0, Math.min(1, (16 * sample.mask) / 255 - 6));
    const amount = (1 - Math.min(...tint)) * mask;
    for (let axis = 0; axis < 3; axis++)
      expect(
        Math.abs(
          sample.pixel[axis] -
            Math.round(255 * (base[axis] * (1 - amount) + norm[axis] * q * amount)),
        ),
      ).toBeLessThanOrEqual(1);
    expect(sample.pixel[3]).toBe(255);
  }
  for (let axis = 0; axis < 3; axis++)
    expect(Math.abs(result.channels[axis] - [204, 177, 91][axis])).toBeLessThanOrEqual(1);
  const encoded = [180 / 255 + 100 / 255 - 1.003922, -(180 / 255 - 100 / 255)];
  const normal = [...encoded, 1 - Math.abs(encoded[0]) - Math.abs(encoded[1])],
    length = Math.hypot(...normal);
  for (let axis = 0; axis < 3; axis++)
    expect(
      Math.abs(result.normal[axis] - Math.round(255 * (0.5 + (normal[axis] / length) * 0.5))),
    ).toBeLessThanOrEqual(1);
  expect(result.occluded).toEqual([0, 0, 0, 255]);
  expect(result.metalOccluded).toEqual([0, 0, 0, 255]);
  for (let axis = 0; axis < 3; axis++)
    expect(Math.abs(result.partial[axis] - (result.clear[axis] * 128) / 255)).toBeLessThanOrEqual(
      1,
    );
  expect(errors).toEqual([]);
});

test("native environment textures retain channel color spaces, compression fallback and reversible quality", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const results = await page.evaluate(async () => {
    const path = "/tests/source-environment-fixture.ts";
    return (await import(path)).inspectEnvironmentBundles();
  });
  expect(results[0].original).toEqual([
    [512, 512],
    [512, 512],
    [512, 512],
  ]);
  expect(results[0].low).toEqual([
    [128, 128],
    [128, 128],
    [128, 128],
  ]);
  expect(results[0].compressed).toEqual([true, true, true]);
  expect(results[1].original).toEqual([
    [256, 256],
    [256, 256],
    [256, 256],
  ]);
  expect(results[1].low).toEqual([
    [64, 64],
    [64, 64],
    [64, 64],
  ]);
  expect(results[1].compressed).toEqual([false, false, false]);
  for (const result of results) {
    expect(result.restored).toEqual(result.original);
    expect(result.colorSpaces).toEqual({ color: "srgb", height: "", normal: "" });
  }
  expect(errors).toEqual([]);
});

test("native generic AO retains six authored mips in BC4 and RGBA fallback with reversible quality", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.route("**/favicon.ico", (r) => r.fulfill({ status: 204 }));
  await page.goto("/audio/source/manifest.json");
  const result = await page.evaluate(async () => {
    const path = "/tests/source-occlusion-fixture.ts";
    return (await import(path)).renderSourceOcclusion();
  });
  expect(result.compressed).toBe(result.nativeSupported);
  expect(result.levels).toHaveLength(6);
  for (const level of result.levels) {
    expect(level.maxDifference).toBeLessThanOrEqual(2);
    expect(level.min).toBeLessThan(250);
    expect(level.max).toBeGreaterThan(240);
  }
  for (const quality of result.quality) {
    expect(quality.original).toEqual([256, 128, 6]);
    expect(quality.low).toEqual([64, 32, 4]);
    expect(quality.restored).toEqual(quality.original);
  }
  expect(errors).toEqual([]);
});
