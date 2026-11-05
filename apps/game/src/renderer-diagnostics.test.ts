import { expect, it } from "vitest";
import { isSoftwareRenderer, rendererDiagnostics } from "./renderer-diagnostics";

it("identifies known software renderers without calling integrated GPUs software", () => {
  for (const name of [
    "ANGLE (Google, Vulkan SwiftShader)",
    "llvmpipe (LLVM 15)",
    "Microsoft Basic Render Driver",
  ])
    expect(isSoftwareRenderer(name)).toBe(true);
  for (const name of [
    "ANGLE (Intel UHD Graphics)",
    "Apple M4",
    "NVIDIA GeForce RTX 4060",
    "WebKit WebGL",
  ])
    expect(isSoftwareRenderer(name)).toBe(false);
});

it("tolerates a browser withholding the adapter's identity", () => {
  const gl = {
    getExtension: () => {
      throw new Error("Withheld");
    },
    getContextAttributes: () => ({ powerPreference: "high-performance" }),
  };
  expect(rendererDiagnostics(gl as unknown as WebGL2RenderingContext)).toEqual({
    name: "Renderer information unavailable",
    software: false,
    preference: "high-performance",
  });
});
