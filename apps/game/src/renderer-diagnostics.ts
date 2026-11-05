export function isSoftwareRenderer(name: string) {
  return /swiftshader|llvmpipe|softpipe|software rasterizer|software renderer|microsoft basic render/i.test(
    name,
  );
}

/** Report the adapter backing the game's actual context, never a second probe. */
export function rendererDiagnostics(gl: WebGLRenderingContext | WebGL2RenderingContext) {
  let name = "Renderer information unavailable";
  try {
    const extension = gl.getExtension("WEBGL_debug_renderer_info");
    name = String(
      gl.getParameter(extension ? extension.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || name,
    );
  } catch {
    // Privacy settings can withhold the adapter description.
  }
  return {
    name,
    software: isSoftwareRenderer(name),
    preference: gl.getContextAttributes()?.powerPreference ?? "default",
  };
}
