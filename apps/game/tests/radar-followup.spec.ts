import { expect, test } from "@playwright/test";

test("spotted enemy carriers show C4 and render-rate movement keeps the local marker centered", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [],
    missing: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() === 404) missing.push(r.url());
  });
  await page.goto("/");
  await expect(page.locator("#play")).toBeEnabled({ timeout: 120_000 });
  await expect(page.locator("#startup")).toHaveCount(0);
  const result = await page.evaluate(async () => {
    const modulePath = "/src/radar.ts";
    const { drawRadar } = (await import(modulePath)) as typeof import("../src/radar");
    const g = window.__game;
    g.start("competitive");
    g.active = false;
    const origin = g.position.clone();
    g.bots.forEach((bot) => {
      bot.health = 0;
    });
    const enemy = g.bots.find((bot) => bot.team !== g.team)!;
    const id = g.bots.indexOf(enemy);
    const eye = origin.clone();
    eye.y += g.eye;
    const nodes = g.world.navigation.areas.map((area) => origin.clone().fromArray(area.center));
    const open = nodes.find(
      (p) =>
        p.distanceTo(origin) > 3 &&
        p.distanceTo(origin) < 15 &&
        g.visible(eye, p.clone().add({ x: 0, y: 1.3, z: 0 })),
    )!;
    const hidden = nodes.find(
      (p) =>
        p.distanceTo(origin) > 3 &&
        p.distanceTo(origin) < 30 &&
        !g.visible(eye, p.clone().add({ x: 0, y: 1.3, z: 0 })),
    )!;
    if (!open || !hidden) throw new Error("Need real open and wall-obstructed map positions");
    enemy.health = 100;
    enemy.group.position.copy(open);
    g.bomb!.carrier = id;
    g.bomb!.planted = false;
    g.yaw = Math.atan2(origin.x - open.x, origin.z - open.z);
    g.settings.radarDynamic = false;
    g.settings.radarCentered = g.settings.radarRotate = true;
    const canvas = document.querySelector<HTMLCanvasElement>("#radar")!;
    g.drawMap(canvas, true);
    const layer = g.radarLayers.get(`${g.mapId}:true:${canvas.width}x${canvas.height}`)!;
    g.radar.reset();
    let checks = 0;
    const visible = g.visible.bind(g);
    g.visible = (from, to) => {
      checks++;
      return visible(from, to);
    };
    const at = performance.now() / 1000;
    const centroids: { x: number; y: number }[] = [];
    const render = (frame: ReturnType<typeof g.radar.sample>, now: number) =>
      drawRadar(canvas.getContext("2d")!, {
        layer,
        projection: g.mapProjection(canvas.width, canvas.height),
        position: g.position,
        yaw: g.yaw,
        ...frame,
        settings: g.settings,
        fullMap: false,
        scoreboard: false,
        teamColors: true,
        now,
      });
    let firstChecks = 0;
    for (let i = 0; i < 12; i++) {
      g.position.x = origin.x + i * 0.025;
      const frame = g.radar.sample(g, at + i / 240);
      if (!i) firstChecks = checks;
      render(frame, at + i / 240);
      const pixels = canvas
        .getContext("2d")!
        .getImageData(canvas.width / 2 - 20, canvas.height / 2 - 20, 40, 40).data;
      let x = 0,
        y = 0,
        count = 0;
      for (let n = 0; n < pixels.length; n += 4) {
        if (pixels[n] < 80 && pixels[n + 1] > 140 && pixels[n + 2] > 180 && pixels[n + 3] > 180) {
          x += (n / 4) % 40;
          y += Math.floor(n / 160);
          count++;
        }
      }
      if (!count) throw new Error("Local radar dot was not rendered");
      centroids.push({ x: x / count, y: y / count });
    }
    const extraChecks = checks - firstChecks;
    g.visible = visible;
    g.position.copy(origin);
    g.radar.reset();
    const spotted = g.radar.sample(g, at + 1);
    render(spotted, at + 1);
    (
      window as unknown as {
        radarFollowup: { id: number; open: number[]; hidden: number[]; at: number };
      }
    ).radarFollowup = { id, open: open.toArray(), hidden: hidden.toArray(), at };
    return {
      centroids,
      extraChecks,
      carrier: spotted.bomb?.carrier,
      carrying: spotted.markers.find((marker) => marker.id === id)?.carryingBomb,
      id,
    };
  });
  expect(result.carrier).toBe(result.id);
  expect(result.carrying).toBe(true);
  expect(result.extraChecks).toBe(0);
  for (const axis of ["x", "y"] as const) {
    const values = result.centroids.map((p) => p[axis]);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.1);
  }
  await page.locator(".radar-wrap").screenshot({ path: "artifacts/radar-carrier-spotted.png" });
  const lost = await page.evaluate(async () => {
    const modulePath = "/src/radar.ts";
    const { drawRadar } = (await import(modulePath)) as typeof import("../src/radar");
    const g = window.__game;
    const data = (
      window as unknown as {
        radarFollowup: { id: number; open: number[]; hidden: number[]; at: number };
      }
    ).radarFollowup;
    g.bots[data.id].group.position.fromArray(data.hidden);
    g.yaw = Math.atan2(g.position.x - data.hidden[0], g.position.z - data.hidden[2]);
    const frame = g.radar.sample(g, data.at + 2);
    const canvas = document.querySelector<HTMLCanvasElement>("#radar")!;
    drawRadar(canvas.getContext("2d")!, {
      layer: g.radarLayers.get(`${g.mapId}:true:${canvas.width}x${canvas.height}`)!,
      projection: g.mapProjection(canvas.width, canvas.height),
      position: g.position,
      yaw: g.yaw,
      ...frame,
      settings: g.settings,
      fullMap: false,
      scoreboard: false,
      now: data.at + 2,
    });
    return { bomb: frame.bomb, open: { x: data.open[0], y: data.open[1], z: data.open[2] } };
  });
  expect(lost.bomb?.position).toEqual(lost.open);
  expect(lost.bomb?.uncertain).toBe(true);
  await page.locator(".radar-wrap").screenshot({ path: "artifacts/radar-carrier-last-known.png" });
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});
