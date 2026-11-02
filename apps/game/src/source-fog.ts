import type * as T from "three";

// env_cubemap_fog 2:23513:20125, Source lightmap 8.2 (multiplicative height/distance).
// Shares the native sky's existing cube/mips: no extra texture, render target or pass.
const sky: { value: T.CubeTexture | T.CompressedCubeTexture | null } = { value: null };
const ready = { value: 0 };
export function setSourceFogSky(texture?: T.CubeTexture | T.CompressedCubeTexture) {
  sky.value = texture ?? null;
  ready.value = texture ? 1 : 0;
}

export function applySourceFog(shader: T.WebGLProgramParametersWithUniforms, enabled = "1.0") {
  if (shader.uniforms.sourceFogReady) return;
  shader.uniforms.sourceFogSky = sky;
  shader.uniforms.sourceFogReady = ready;
  shader.fragmentShader =
    "uniform samplerCube sourceFogSky; uniform float sourceFogReady;\n" + shader.fragmentShader;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <tonemapping_fragment>",
    `if (${enabled} > 0.5 && sourceFogReady > 0.5) {
      vec3 sourceFogRelative = inverseTransformDirection(-vViewPosition, viewMatrix) * length(vViewPosition);
      float sourceFogDistance = length(vViewPosition);
      float sourceFogHeight = cameraPosition.y + sourceFogRelative.y;
      const float sourceFogStart = 512.0 * 0.0254;
      const float sourceFogEnd = 9000.0 * 0.0254;
      const float sourceFogHeightEnd = 21054.800781 * 0.0254;
      if (sourceFogDistance > sourceFogStart && sourceFogHeight < sourceFogHeightEnd) {
        float sourceFogDistanceTerm = pow(max((sourceFogDistance-sourceFogStart)/(sourceFogEnd-sourceFogStart), 0.0001), 1.3);
        float sourceFogHeightTerm = max(1.0-sourceFogHeight/sourceFogHeightEnd, 0.0001);
        float sourceFogBlend = clamp(sourceFogDistanceTerm, 0.0, 1.0) * clamp(sourceFogHeightTerm, 0.0, 1.0);
        vec3 sourceFogDirection = normalize(sourceFogRelative);
        vec3 sourceFogColor = textureLod(sourceFogSky, vec3(sourceFogDirection.x, -sourceFogDirection.z, sourceFogDirection.y), (1.0-sourceFogBlend)*6.0).rgb * exp2(0.765);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, sourceFogColor, sourceFogBlend*0.5);
      }
    }
    #include <tonemapping_fragment>`,
  );
}
