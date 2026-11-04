import { reportLoadingAsset } from "./loading";
/** Only bundled asset paths move to the CDN; authenticated APIs remain same-origin. */
const urls: Record<string, string> = JSON.parse(import.meta.env.VITE_ASSET_URLS ?? "{}");
const cdn = Object.keys(urls).length > 0;
const assetPath = /^\/(?:audio|effects|fonts|icons|licenses|maps|models|skins|ui)\//;
export function assetUrl(path: string): string {
  if (!cdn || (!assetPath.test(path) && path !== "/icon.svg")) return path;
  const url = urls[path];
  if (!url) throw new Error(`Asset missing from manifest: ${path}`);
  return url;
}
export function assetFetch(path: string, init?: RequestInit) {
  reportLoadingAsset(path);
  return fetch(assetUrl(path), init);
}
