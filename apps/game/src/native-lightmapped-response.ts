/** Installed build26445667 parking PS8070/d0+d4 material prefix. Framebuffer
 * state and private FLOAT→instance packing are separate from these operations. */
export const LIGHTMAPPED_ALPHA_EPSILON = 0.0010000000474974513;
export function lightmappedOpacity(
  sampledAlpha: number,
  interpolatedVertexAlpha: number,
  opacityScale: number,
  alphaReference: number,
) {
  const alpha =
    interpolatedVertexAlpha * (sampledAlpha * interpolatedVertexAlpha * opacityScale) -
    alphaReference;
  return { alpha, discarded: alpha - LIGHTMAPPED_ALPHA_EPSILON < 0 };
}
export const nativeLightmappedResponseGLSL = `
vec3 nativeLightmappedNormal(vec2 rg){
 vec2 h=vec2(rg.x+rg.y-1.00392162799835205078125,rg.x-rg.y);
 return normalize(vec3(h,1.0-abs(h.x)-abs(h.y)));
}
float nativeLightmappedOpacity(float sampledAlpha,float vertexAlpha,float scale,float reference){
 return vertexAlpha*((sampledAlpha*vertexAlpha)*scale)-reference;
}
`;
