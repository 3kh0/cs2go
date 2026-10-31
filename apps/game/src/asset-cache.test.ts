import { afterEach, expect, test, vi } from "vitest";
import { startAssetCache } from "./asset-cache";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
test("a stalled service-worker registration cannot hold application startup", () => {
  vi.stubEnv("PROD", true);
  const register = vi.fn(() => new Promise(() => {}));
  vi.stubGlobal("navigator", {
    serviceWorker: { controller: null, addEventListener: vi.fn(), register },
  });
  expect(startAssetCache()).toBeUndefined();
  expect(register).toHaveBeenCalledWith("/sw.js", { updateViaCache: "none" });
});
