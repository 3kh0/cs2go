import { reportLoadingAsset } from "./loading";
/** Only bundled asset paths move to the CDN; authenticated APIs remain same-origin. */
const base: string = import.meta.env.VITE_ASSET_BASE ?? "";
const assetPath = /^\/(?:audio|effects|fonts|icons|licenses|maps|models|skins|ui)\//;
export function assetUrl(path: string): string {
  return base && (assetPath.test(path) || path === "/icon.svg") ? base + path : path;
}
export function assetFetch(path: string, init?: RequestInit) {
  reportLoadingAsset(path);
  return fetch(assetUrl(path), init);
}
