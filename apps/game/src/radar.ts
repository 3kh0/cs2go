import { reportLoadingAsset } from "./loading";
import { assetUrl } from "./asset-url";
import type { RadarSettings } from "./radar-settings";
import type { RadarBomb, RadarMarker } from "./radar-state";
import { loadRadarIcons, radarIcon, type RadarIcon } from "./radar-icons";

export type RadarPosition = { x: number; y: number; z: number };
export type RadarProjection = { px(x: number): number; pz(z: number): number };
export type RadarOptions = {
  layer: CanvasImageSource;
  projection: RadarProjection;
  position: RadarPosition;
  yaw: number;
  markers: readonly RadarMarker[];
  bomb?: RadarBomb;
  sites?: readonly RadarPosition[];
  settings: RadarSettings;
  fullMap: boolean;
  scoreboard: boolean;
  spectating?: boolean;
  teamColors?: boolean;
  alternate?: boolean;
  now: number;
};

/** One transform for the overview and every world-space contact. Marker sizes
 * stay in HUD pixels, including at the alternate zoom and on the full map. */
export function radarView(
  width: number,
  height: number,
  projection: RadarProjection,
  position: RadarPosition,
  yaw: number,
  zoom: number,
  centered: boolean,
  rotate: boolean,
) {
  const x = projection.px(position.x),
    y = projection.pz(position.z),
    angle = rotate ? yaw : 0,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const bounded = (point: number, extent: number) => {
    const half = extent / (2 * zoom);
    return half >= extent / 2 ? extent / 2 : Math.max(half, Math.min(extent - half, point));
  };
  const originX = centered ? x : bounded(x, width),
    originY = centered ? y : bounded(y, height);
  return {
    angle,
    zoom,
    originX,
    originY,
    point(point: RadarPosition) {
      const dx = (projection.px(point.x) - originX) * zoom,
        dy = (projection.pz(point.z) - originY) * zoom;
      return { x: width / 2 + dx * cos - dy * sin, y: height / 2 + dx * sin + dy * cos };
    },
    heading(heading: number) {
      return angle - heading;
    },
  };
}

/** Clamp contacts, rather than their canvas clips, to the visible HUD edge. */
export function radarEdge(
  point: { x: number; y: number },
  width: number,
  height: number,
  square: boolean,
  inset: number,
) {
  const dx = point.x - width / 2,
    dy = point.y - height / 2,
    rx = Math.max(1, width / 2 - inset),
    ry = Math.max(1, height / 2 - inset),
    extent = square ? Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry) : Math.hypot(dx / rx, dy / ry),
    scale = Math.max(1, extent);
  return {
    x: width / 2 + dx / scale,
    y: height / 2 + dy / scale,
    clamped: extent > 1,
    angle: Math.atan2(dy, dx) + Math.PI / 2,
  };
}

const playerColors = ["#f8f62d", "#c03699", "#1da284", "#88cef5", "#ff9b25"];
const playerLetters = ["Y", "P", "G", "B", "O"];
const layers = new WeakMap<
  HTMLCanvasElement,
  { map: HTMLCanvasElement; backdrop: HTMLDivElement; compass: HTMLDivElement }
>();
const zooms = new WeakMap<HTMLCanvasElement, { value: number; at: number }>();
const mapViews = new WeakMap<
  HTMLCanvasElement,
  {
    layer: CanvasImageSource;
    width: number;
    height: number;
    full: boolean;
    x: number;
    y: number;
    angle: number;
    zoom: number;
  }
>();

function mapContext(
  ctx: CanvasRenderingContext2D,
  settings: RadarSettings,
  angle: number,
  full: boolean,
) {
  const parent = ctx.canvas.parentElement;
  if (!parent?.classList.contains("radar-wrap")) return ctx;
  let layer = layers.get(ctx.canvas);
  if (!layer) {
    const map = document.createElement("canvas"),
      backdrop = document.createElement("div"),
      compass = document.createElement("div"),
      direction = new Image();
    map.className = "radar-map-layer";
    backdrop.className = "radar-backdrop";
    compass.className = "radar-compass";
    direction.src = assetUrl("/ui/radar/rim-direction.png");
    direction.alt = "";
    compass.append(direction);
    map.setAttribute("aria-hidden", "true");
    backdrop.setAttribute("aria-hidden", "true");
    compass.setAttribute("aria-hidden", "true");
    parent.prepend(backdrop, map, compass);
    layers.set(ctx.canvas, (layer = { map, backdrop, compass }));
  }
  if (layer.map.width !== ctx.canvas.width) layer.map.width = ctx.canvas.width;
  if (layer.map.height !== ctx.canvas.height) layer.map.height = ctx.canvas.height;
  layer.backdrop.style.backgroundColor = `rgba(0,0,0,${settings.radarBackgroundAlpha})`;
  layer.map.style.mixBlendMode = settings.radarMapBlend ? "plus-lighter" : "normal";
  layer.compass.hidden = full;
  layer.compass.style.transform = `rotate(${angle}rad)`;
  return layer.map.getContext("2d")!;
}

function icon(
  ctx: CanvasRenderingContext2D,
  name: RadarIcon,
  width: number,
  height: number,
  color?: string,
  x = -width / 2,
  y = -height / 2,
) {
  const image = radarIcon(name, color);
  if (image) ctx.drawImage(image, x, y, width, height);
}
function altitude(ctx: CanvasRenderingContext2D, value: -1 | 0 | 1, unit: number) {
  if (!value) return;
  ctx.save();
  ctx.globalAlpha *= 0.65;
  icon(
    ctx,
    value > 0 ? "above" : "below",
    13 * unit,
    7 * unit,
    "#cccccc",
    -7.5 * unit,
    (value > 0 ? 4.5 : -11.5) * unit,
  );
  ctx.restore();
}
function clip(ctx: CanvasRenderingContext2D, w: number, h: number, square: boolean) {
  ctx.beginPath();
  if (square) ctx.rect(0, 0, w, h);
  else ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.clip();
}

export function drawRadar(ctx: CanvasRenderingContext2D, options: RadarOptions) {
  const { layer, projection, position, yaw, markers, bomb, settings } = options,
    w = ctx.canvas.width,
    h = ctx.canvas.height,
    full =
      options.fullMap ||
      settings.radarSquare ||
      (options.spectating && settings.radarSquareSpectator) ||
      (options.scoreboard && settings.radarSquareScoreboard),
    unit = Math.min(w, h) / (full ? 290 : 250),
    baseZoom = full
      ? 1
      : (options.alternate ? settings.radarAlternateScale : settings.radarScale) * 4;
  let desired = baseZoom;
  if (!full && settings.radarDynamic) {
    let farthest = 0;
    for (const marker of markers)
      if (marker.kind !== "self" && marker.kind !== "death")
        farthest = Math.max(
          farthest,
          Math.hypot(
            projection.px(marker.position.x) - projection.px(position.x),
            projection.pz(marker.position.z) - projection.pz(position.z),
          ),
        );
    if (bomb)
      farthest = Math.max(
        farthest,
        Math.hypot(
          projection.px(bomb.position.x) - projection.px(position.x),
          projection.pz(bomb.position.z) - projection.pz(position.z),
        ),
      );
    if (farthest)
      desired = Math.max(1, Math.min(baseZoom, (Math.min(w, h) / 2 - unit * 18) / farthest));
  }
  const previous = zooms.get(ctx.canvas),
    dt = previous ? Math.max(0, Math.min(0.1, options.now - previous.at)) : 0;
  const zoom =
    settings.radarDynamic && !full && previous
      ? previous.value + (desired - previous.value) * (1 - Math.exp(-dt * 6))
      : desired;
  zooms.set(ctx.canvas, { value: zoom, at: options.now });
  const view = radarView(
    w,
    h,
    projection,
    position,
    yaw,
    zoom,
    !full && settings.radarCentered,
    !full && settings.radarRotate,
  );
  const map = mapContext(ctx, settings, view.angle, !!full);
  const cached = mapViews.get(map.canvas);
  if (
    map === ctx ||
    !cached ||
    cached.layer !== layer ||
    cached.width !== w ||
    cached.height !== h ||
    cached.full !== full ||
    cached.x !== view.originX ||
    cached.y !== view.originY ||
    cached.angle !== view.angle ||
    cached.zoom !== zoom
  ) {
    map.clearRect(0, 0, w, h);
    map.save();
    clip(map, w, h, full);
    if (map === ctx) {
      map.fillStyle = `rgba(0,0,0,${settings.radarBackgroundAlpha})`;
      map.fillRect(0, 0, w, h);
    }
    map.translate(w / 2, h / 2);
    map.rotate(view.angle);
    map.scale(zoom, zoom);
    map.translate(-view.originX, -view.originY);
    map.drawImage(layer, 0, 0);
    map.restore();
    if (map !== ctx)
      mapViews.set(map.canvas, {
        layer,
        width: w,
        height: h,
        full,
        x: view.originX,
        y: view.originY,
        angle: view.angle,
        zoom,
      });
  }
  if (map !== ctx) ctx.clearRect(0, 0, w, h);
  ctx.save();
  clip(ctx, w, h, full);
  for (const [index, site] of (options.sites ?? []).entries()) {
    const point = radarEdge(view.point(site), w, h, full, unit * 12),
      size = (point.clamped ? 15 : 10) * unit;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.globalAlpha = point.clamped ? 0.7 : 0.4;
    icon(ctx, index ? "siteB" : "siteA", size, size, "#ffcc00");
    ctx.restore();
  }
  const iconScale = Math.max(settings.radarIconScale, Math.min(1, zoom / 2.8)),
    u = unit * iconScale;
  // Draw the local arrow last so overlapping teammates cannot cover it.
  for (let pass = 0; pass < 2; pass++)
    for (const marker of markers) {
      if ((marker.kind === "self") !== (pass === 1)) continue;
      const point = radarEdge(view.point(marker.position), w, h, full, unit * 14),
        slot = Math.max(0, (marker.number ?? 1) - 1) % playerColors.length,
        color = marker.hostile
          ? "#ff1919"
          : marker.kind !== "self" &&
              options.teamColors &&
              settings.radarTeammateColors &&
              marker.number !== undefined
            ? playerColors[slot]
            : marker.team === "ct"
              ? "#1ed2ff"
              : "#ffdd23";
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.globalAlpha = marker.opacity;
      if (marker.kind === "death") icon(ctx, "death", 19 * u, 19 * u, color);
      else if (marker.uncertain) {
        ctx.globalAlpha *= 0.8;
        icon(
          ctx,
          marker.kind === "enemy" ? "enemyGhost" : marker.team === "ct" ? "ctGhost" : "tGhost",
          9 * u,
          15 * u,
        );
      } else if (point.clamped) {
        ctx.save();
        ctx.rotate(point.angle);
        ctx.globalAlpha *= 0.8;
        icon(ctx, "offmap", 22 * u, 22 * u, color, -11 * u, -12 * u);
        ctx.restore();
      } else if (marker.kind === "self") {
        ctx.save();
        ctx.rotate(view.heading(marker.yaw));
        ctx.globalAlpha *= 0.08;
        icon(ctx, "view", 128 * u, 64 * u, undefined, -64 * u, -62 * u);
        ctx.globalAlpha = marker.opacity;
        icon(ctx, "player", 11 * u, 11 * u, color);
        if (options.spectating) {
          icon(ctx, "selected", 42 * u, 36 * u, undefined, -21 * u, -28 * u);
        } else icon(ctx, "direction", 11 * u, 11 * u, undefined, -5.5 * u, -13.5 * u);
        ctx.restore();
      } else {
        icon(
          ctx,
          marker.kind === "enemy" ? "enemy" : "player",
          (marker.kind === "enemy" ? 13 : 11) * u,
          (marker.kind === "enemy" ? 13 : 11) * u,
          color,
        );
        if (
          marker.kind === "ally" &&
          options.teamColors &&
          settings.radarTeammateColors === 2 &&
          marker.number !== undefined
        ) {
          ctx.fillStyle = "#000";
          ctx.font = `500 ${10 * u}px Stratum2,sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(playerLetters[slot], -0.5 * u, 0.5 * u);
        }
      }
      altitude(ctx, marker.altitude, u);
      ctx.restore();
    }
  if (bomb) drawRadarBomb(ctx, bomb, view, w, h, full, unit, options.now);
  ctx.restore();
}

function drawRadarBomb(
  ctx: CanvasRenderingContext2D,
  bomb: RadarBomb,
  view: ReturnType<typeof radarView>,
  w: number,
  h: number,
  square: boolean,
  unit: number,
  now: number,
) {
  const point = radarEdge(view.point(bomb.position), w, h, square, unit * 16),
    color = bomb.defusing ? "#3eff24" : bomb.state === "carried" ? "#ffdd23" : "#ff2924";
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.globalAlpha = bomb.opacity;
  if (bomb.state !== "carried") {
    const phase = (now % 0.75) / 0.75,
      scale =
        phase < 0.2
          ? 0.01 + phase * 0.45
          : phase < 0.5
            ? 0.1 + (phase - 0.2) * 0.5
            : phase < 0.75
              ? 0.25 + (phase - 0.5) * 0.6
              : 0.4 + (phase - 0.75) * 0.8;
    ctx.strokeStyle = bomb.defusing ? color : bomb.state === "planted" ? "#d10000" : "#880000";
    ctx.lineWidth = 2 * unit;
    ctx.globalAlpha *= 0.2 * (phase < 0.5 ? 1 : 2 - phase * 2);
    ctx.beginPath();
    ctx.arc(0, 0, (bomb.state === "planted" ? 35 : 55) * unit * scale, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = bomb.opacity;
  }
  if (bomb.state === "carried")
    icon(ctx, "carriedBomb", 16 * unit, 12 * unit, undefined, 5 * unit, 5 * unit);
  else icon(ctx, "bomb", 24 * unit, 24 * unit, color);
  if (bomb.altitude) {
    ctx.globalAlpha *= 0.65;
    icon(ctx, bomb.altitude > 0 ? "bombAbove" : "bombBelow", 16 * unit, 19 * unit, "#cccccc");
  }
  ctx.restore();
}
export async function loadCalloutRadar(path = "/models/maps/dust2-radar.png") {
  const image = new Image();
  reportLoadingAsset(path);
  image.src = assetUrl(path);
  await Promise.all([image.decode(), loadRadarIcons()]);
  return image;
}
