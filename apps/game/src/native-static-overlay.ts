import * as T from "three";

const glslFloat = (value: number) => (Number.isInteger(value) ? `${value}.0` : `${value}`);

export interface NativeStaticOverlay {
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
}

export function isNativeMod2x(material: T.Material) {
  return material.userData.nativeStaticOverlayBlendMode === 3;
}

/** Native static-overlay modes use framebuffer blending; the exported opaque
 * glTF fallback cannot represent Mod2x or the authored texture animation. */
export function applyNativeStaticOverlays(
  root: T.Object3D,
  definitions: readonly { name: string; staticOverlay?: NativeStaticOverlay }[],
) {
  const definitionsByName = new Map(
    definitions.filter((d) => d.staticOverlay).map((d) => [d.name, d.staticOverlay!]),
  );
  const replacements = new Map<T.Material, T.Material>();
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    const replace = (original: T.Material) => {
      const source = definitionsByName.get(original.name);
      if (!source || !(original instanceof T.MeshStandardMaterial)) return original;
      const existing = replacements.get(original);
      if (existing) return existing;
      const ints = source.IntParams,
        floats = source.FloatParams,
        vectors = source.VectorParams;
      const mode = ints.F_BLEND_MODE ?? 0;
      if (![0, 1, 2, 3, 4].includes(mode))
        throw new Error(`Unsupported native overlay blend ${mode}`);
      const unlit = !(ints.F_LIT ?? 0);
      const material = unlit
        ? new T.MeshBasicMaterial({
            map: original.map,
            color: original.color,
            vertexColors: original.vertexColors,
          })
        : original.clone();
      material.name = original.name;
      material.side = original.side;
      material.fog = ints.g_bFogEnabled !== 0;
      material.transparent = [1, 3, 4].includes(mode);
      material.depthWrite = !material.transparent;
      material.polygonOffset = true;
      material.polygonOffsetFactor = -1;
      material.polygonOffsetUnits = -1;
      material.opacity = original.opacity * (floats.g_flOpacityScale ?? 1);
      if (mode === 2) material.alphaTest = floats.g_flAlphaTestReference ?? 0.5;
      if (mode === 3) {
        // Selected native PS6 binds g_tColor with SrgbRead=false. Undoing an
        // sRGB read after filtering would interpolate in the wrong domain.
        if (material.map && material.map.colorSpace !== T.NoColorSpace) {
          material.map = material.map.clone();
          material.map.colorSpace = T.NoColorSpace;
          material.map.needsUpdate = true;
        }
        material.userData.nativeStaticOverlayBlendMode = mode;
        material.blending = T.CustomBlending;
        material.blendEquation = T.AddEquation;
        material.blendSrc = T.DstColorFactor;
        material.blendDst = T.SrcColorFactor;
        material.blendSrcAlpha = T.SrcAlphaFactor;
        material.blendDstAlpha = T.OneMinusSrcAlphaFactor;
        material.toneMapped = false;
      } else if (mode === 4) material.blending = T.AdditiveBlending;
      const animation = !!ints.F_TEXTURE_ANIMATION;
      const grid = vectors.g_vAnimationGrid ?? [1, 1];
      const cells = ints.g_nNumAnimationCells ?? grid[0] * grid[1];
      const seconds = floats.g_flAnimationTimePerFrame ?? 0.1;
      if (
        animation &&
        (!grid.slice(0, 2).every((n) => Number.isInteger(n) && n > 0) ||
          cells <= 0 ||
          cells > grid[0] * grid[1] ||
          seconds <= 0)
      )
        throw new Error("Invalid native overlay animation");
      const clock = { value: 0 };
      let frame = -1;
      material.onBeforeRender = (renderer) => {
        if (frame === renderer.info.render.frame) return;
        frame = renderer.info.render.frame;
        clock.value = performance.now() / 1000;
      };
      const previous = material.onBeforeCompile.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        shader.uniforms.nativeOverlayTime = clock;
        shader.fragmentShader = "uniform float nativeOverlayTime;\n" + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <map_fragment>",
          `
          vec2 overlayUv=vMapUv;
          ${
            animation
              ? `float cell=mod(floor((nativeOverlayTime+${glslFloat(floats.g_flAnimationTimeOffset ?? 0)})/${seconds})+${glslFloat(floats.g_flAnimationFrame ?? 0)},${cells}.0);
          overlayUv=(overlayUv+vec2(mod(cell,${grid[0]}.0),floor(cell/${grid[0]}.0)))/vec2(${grid[0]}.0,${grid[1]}.0);`
              : ""
          }
          vec4 overlaySample=texture2D(map,overlayUv);
          diffuseColor*=overlaySample;
        `,
        );
        // Mod2x's neutral midpoint is 0.5 in the framebuffer blend domain.
        if (mode === 3)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <colorspace_fragment>",
            "gl_FragColor.rgb=mix(vec3(0.5),gl_FragColor.rgb,gl_FragColor.a);",
          );
      };
      material.customProgramCacheKey = () =>
        `native-static-overlay:${unlit}:${JSON.stringify(source)}`;
      material.needsUpdate = true;
      replacements.set(original, material);
      return material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(replace)
      : replace(object.material);
    if (
      (Array.isArray(object.material) ? object.material : [object.material]).some(
        (m) => m.transparent,
      )
    )
      object.castShadow = false;
  });
}
