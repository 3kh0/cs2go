import { reportLoadingAsset } from "./loading";
import { assetUrl } from "./asset-url";
// Landmarks measured on a 1600px reference grid (the PNG itself is 2048px).
// Keep the image's
// aspect ratio and use this same projection for every live marker. This is
// an illustrated overview, not a survey of the reworked map's small details.
export const radarCrop = { x: 145, y: 200, width: 1315, height: 1385, referenceSize: 1600 };
export function dustRadarProjection(w: number, h: number) {
  const scale = Math.min(w / radarCrop.width, h / radarCrop.height);
  const left = (w - radarCrop.width * scale) / 2;
  const top = (h - radarCrop.height * scale) / 2;
  return {
    scale,
    left,
    top,
    px: (x: number) => left + (176 + ((x + 56.515) / 102.235) * 1270 - radarCrop.x) * scale,
    pz: (z: number) => top + (220 + ((z + 79.375) / 109.22) * 1352 - radarCrop.y) * scale,
  };
}
export async function loadCalloutRadar() {
  const image = new Image();
  reportLoadingAsset("/maps/dust2-callouts.png");
  image.src = assetUrl("/maps/dust2-callouts.png");
  await image.decode();
  return image;
}
