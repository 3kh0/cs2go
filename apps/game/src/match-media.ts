import { assetUrl } from "./asset-url";
import { beginLoadingWork, reportLoadingAsset } from "./loading";

export async function prepareMatchMedia() {
  await Promise.all([
    ...[
      "/ui/home/dust2.webp",
      "/ui/home/dust2-emblem.svg",
      "/icons/team-t.png",
      "/icons/team-ct.png",
    ].map(async (path) => {
      const finish = beginLoadingWork();
      try {
        reportLoadingAsset(path);
        const image = new Image();
        image.src = assetUrl(path);
        await image.decode();
      } finally {
        finish();
      }
    }),
    document.fonts.load('700 24px "Stratum2 Condensed"'),
    document.fonts.load('700 14px "Stratum2"'),
  ]);
}
