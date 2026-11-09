import { assetUrl } from "./asset-url";
import { reportLoadingAsset } from "./loading";

const files = {
  player: "player.png",
  enemy: "enemy.png",
  ctGhost: "ct-ghost.png",
  tGhost: "t-ghost.png",
  enemyGhost: "enemy-ghost.png",
  above: "player-above.png",
  below: "player-below.png",
  direction: "direction.svg",
  rim: "rim-direction.png",
  offmap: "offmap.svg",
  death: "death.svg",
  view: "view.svg",
  selected: "selected.svg",
  bomb: "bomb.svg",
  bombAbove: "bomb-above.svg",
  bombBelow: "bomb-below.svg",
  carriedBomb: "carried-bomb.png",
  siteA: "site-a.png",
  siteB: "site-b.png",
} as const;
export type RadarIcon = keyof typeof files;
const images = new Map<RadarIcon, HTMLImageElement>();
const tinted = new Map<string, HTMLCanvasElement>();
let pending: Promise<void> | undefined;
export function loadRadarIcons() {
  return (pending ??= Promise.all(
    Object.entries(files).map(async ([name, file]) => {
      const path = `/ui/radar/${file}`;
      reportLoadingAsset(path);
      const image = new Image();
      image.src = assetUrl(path);
      await image.decode();
      images.set(name as RadarIcon, image);
    }),
  )
    .then(() => {})
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    }));
}

/** Panorama wash-color multiplies RGB while retaining native texture alpha,
 * shadows and black outlines. Cache the finite icon/palette combinations. */
export function radarIcon(name: RadarIcon, color?: string): CanvasImageSource | undefined {
  const image = images.get(name);
  if (!image || !color) return image;
  const key = `${name}:${color}`;
  let canvas = tinted.get(key);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(image, 0, 0);
    tinted.set(key, canvas);
  }
  return canvas;
}
