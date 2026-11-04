import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("resolves pinned object URLs while leaving APIs and remote images alone", async () => {
  vi.stubEnv(
    "VITE_ASSET_URLS",
    JSON.stringify({
      "/icons/awp.png": "https://cdn.test/objects/weapon.png",
      "/icon.svg": "https://cdn.test/objects/favicon.svg.br",
    }),
  );
  const { assetUrl } = await import("./asset-url");
  expect(assetUrl("/icons/awp.png")).toBe("https://cdn.test/objects/weapon.png");
  expect(assetUrl("/icon.svg")).toBe("https://cdn.test/objects/favicon.svg.br");
  expect(assetUrl("/api/steam?action=login")).toBe("/api/steam?action=login");
  expect(assetUrl("https://avatars.test/player.png")).toBe("https://avatars.test/player.png");
  expect(() => assetUrl("/icons/missing.png")).toThrow("Asset missing from manifest");
});

it("keeps local asset paths without a CDN mapping", async () => {
  vi.stubEnv("VITE_ASSET_URLS", "{}");
  const { assetUrl } = await import("./asset-url");
  expect(assetUrl("/icons/awp.png")).toBe("/icons/awp.png");
});
