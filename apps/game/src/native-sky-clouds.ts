import * as T from "three";

export type NativeSkyEffectParameters = {
  IntParams: Record<string, number>;
  FloatParams: Record<string, number>;
  VectorParams: Record<string, number[]>;
  TextureParams: Record<string, string>;
};
export type NativeSkyEffectUniforms = {
  time: { value: number };
  depth: { value: T.DepthTexture };
  resolution: { value: T.Vector2 };
  inverseProjection: { value: T.Matrix4 };
  viewportOrigin?: { value: T.Vector2 };
  /** Native sky-camera scale when miniature coordinates are baked into world metres. */
  sourceScale?: number;
};

/** Authored csgo_effects.vfx equations: pinned VRF20.1 csgo_effects.{vert,frag}.slang.
 * Textures/geometry/tints remain native. This operates in the isolated linear HDR
 * sky pass; its owning map applies VPOST once after sky composition.
 */
export function createNativeSkyEffect(
  source: T.MeshStandardMaterial,
  parameters: NativeSkyEffectParameters,
  textures: ReadonlyMap<string, T.Texture>,
  uniforms: NativeSkyEffectUniforms,
): T.ShaderMaterial {
  const flags = parameters.IntParams,
    floats = parameters.FloatParams,
    vectors = parameters.VectorParams;
  const scalar = (name: string, fallback: number) => ({ value: floats[name] ?? fallback });
  const vector = (name: string, fallback: number[]) => ({
    value: new T.Vector2().fromArray(vectors[name] ?? fallback),
  });
  const owned = new Map<T.Texture, T.Texture>();
  const wrap = (mode: number | undefined) =>
    mode === 2 ? T.ClampToEdgeWrapping : mode === 1 ? T.MirroredRepeatWrapping : T.RepeatWrapping;
  const texture = (name: string) => {
    const path = parameters.TextureParams[name];
    const original = textures.get(path);
    if (!original) throw new Error(`Native sky effect texture missing: ${name} (${path})`);
    const wrapS = wrap(flags.g_nTextureAddressModeU),
      wrapT = wrap(flags.g_nTextureAddressModeV);
    if (original.wrapS === wrapS && original.wrapT === wrapT) return { value: original };
    let copy = owned.get(original);
    if (!copy) {
      copy = original.clone();
      copy.wrapS = wrapS;
      copy.wrapT = wrapT;
      copy.needsUpdate = true;
      owned.set(original, copy);
    }
    return { value: copy };
  };
  const additive = flags.F_ADDITIVE_BLEND === 1;
  const sourceUnit = 0.0254 * (uniforms.sourceScale ?? 1);
  const material = new T.ShaderMaterial({
    name: source.name,
    vertexColors: true,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    side: flags.F_RENDER_BACKFACES === 1 ? T.DoubleSide : T.FrontSide,
    blending: additive ? T.CustomBlending : T.NormalBlending,
    blendSrc: T.SrcAlphaFactor,
    blendDst: additive ? T.OneFactor : T.OneMinusSrcAlphaFactor,
    blendEquation: T.AddEquation,
    defines: {
      NATIVE_SKY_DEPTH_FEATHER: flags.F_DEPTH_FEATHER ?? 0,
      NATIVE_SKY_FLIP_BACKFACE:
        flags.F_RENDER_BACKFACES === 1 && !flags.F_DONT_FLIP_BACKFACE_NORMALS ? 1 : 0,
      NATIVE_SKY_TINT_MASK: flags.F_TINT_MASK ?? 0,
    },
    uniforms: {
      time: uniforms.time,
      sceneDepth: uniforms.depth,
      resolution: uniforms.resolution,
      viewportOrigin: uniforms.viewportOrigin ?? { value: new T.Vector2() },
      inverseProjection: uniforms.inverseProjection,
      colorMap: texture("g_tColor"),
      mask1: texture("g_tMask1"),
      mask2: texture("g_tMask2"),
      mask3: texture("g_tMask3"),
      ...(flags.F_TINT_MASK === 1 ? { tintMask: texture("g_tTintMask") } : {}),
      // S2V's linear glTF base factor already contains the native instance/material tint.
      materialTint: { value: source.color.clone() },
      materialOpacity: { value: source.opacity },
      scroll: vector("g_vTexCoordScrollSpeed", [0, 0]),
      scale1: vector("g_vMask1Scale", [1, 1]),
      scale2: vector("g_vMask2Scale", [1, 1]),
      scale3: vector("g_vMask3Scale", [1, 1]),
      pan1: vector("g_vMask1PanSpeed", [0, 0]),
      pan2: vector("g_vMask2PanSpeed", [0, 0]),
      pan3: vector("g_vMask3PanSpeed", [0, 0]),
      boost: scalar("g_flColorBoost", 1),
      opacityScale: scalar("g_flOpacityScale", 1),
      fadeDistance: { value: (floats.g_flFadeDistance ?? 1) * sourceUnit },
      fadeFalloff: scalar("g_flFadeFalloff", 1),
      fadeMin: scalar("g_flFadeMin", 0),
      fadeMax: scalar("g_flFadeMax", 1),
      fresnelExponent: scalar("g_flFresnelExponent", 0.001),
      fresnelFalloff: scalar("g_flFresnelFalloff", 1),
      fresnelMin: scalar("g_flFresnelMin", 0),
      fresnelMax: scalar("g_flFresnelMax", 1),
      featherDistance: { value: (floats.g_flFeatherDistance ?? 1) * sourceUnit },
      featherFalloff: scalar("g_flFeatherFalloff", 1),
    },
    vertexShader: `
      uniform vec2 scroll; uniform float time;
      uniform vec3 materialTint; uniform float materialOpacity;
      varying vec2 effectUv; varying vec4 effectTint;
      varying vec3 effectNormal, effectView;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        effectView = -mv.xyz;
        effectNormal = normalMatrix * normal;
        effectUv = uv + scroll*time;
        effectTint = vec4(materialTint, materialOpacity);
        #ifdef USE_COLOR_ALPHA
          effectTint *= color;
        #elif defined(USE_COLOR)
          effectTint.rgb *= color;
        #endif
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform sampler2D colorMap, mask1, mask2, mask3, sceneDepth;
      #if NATIVE_SKY_TINT_MASK == 1
        uniform sampler2D tintMask;
      #endif
      uniform float time, boost, opacityScale, fadeDistance, fadeFalloff, fadeMin, fadeMax;
      uniform float fresnelExponent, fresnelFalloff, fresnelMin, fresnelMax, featherDistance, featherFalloff;
      uniform vec2 scale1,scale2,scale3,pan1,pan2,pan3,resolution,viewportOrigin;
      uniform mat4 inverseProjection;
      varying vec2 effectUv; varying vec4 effectTint;
      varying vec3 effectNormal,effectView;
      void main() {
        vec4 color = texture2D(colorMap,effectUv);
        float masks = texture2D(mask1,effectUv*scale1+pan1*time).r
          * texture2D(mask2,effectUv*scale2+pan2*time).r
          * texture2D(mask3,effectUv*scale3+pan3*time).r;
        float tintFactor = 1.0;
        #if NATIVE_SKY_TINT_MASK == 1
          tintFactor = texture2D(tintMask,effectUv).r;
        #endif
        vec3 n = normalize(effectNormal);
        #if NATIVE_SKY_FLIP_BACKFACE == 1
          n *= gl_FrontFacing ? 1.0 : -1.0;
        #endif
        float fresnel = pow(clamp(dot(normalize(effectView),n),.0001,1.0),fresnelExponent)*fresnelFalloff;
        fresnel = mix(fresnelMin,fresnelMax,clamp(fresnel,0.0,1.0));
        float fade = mix(fadeMin,fadeMax,clamp(length(effectView)/max(fadeDistance,1e-8),0.0,1.0));
        fade = pow(max(fade,0.0),fadeFalloff);
        float feather = 1.0;
        #if NATIVE_SKY_DEPTH_FEATHER == 1
          vec2 screen = (gl_FragCoord.xy-viewportOrigin)/resolution;
          float depth = texture2D(sceneDepth,screen).r;
          vec4 scene = inverseProjection * vec4(screen*2.0-1.0,depth*2.0-1.0,1.0);
          feather = pow(clamp(length(scene.xyz/scene.w+effectView)/max(featherDistance,1e-8),.0001,1.0),featherFalloff);
        #endif
        gl_FragColor = vec4(mix(color.rgb,color.rgb*effectTint.rgb,tintFactor)*boost,
          color.a*effectTint.a*opacityScale*masks*fresnel*fade*feather);
      }
    `,
  });
  // Mirage-specific scene fog must be supplied separately; never bind Dust II globals.
  material.userData.nativeFogRequested = flags.g_bFogEnabled !== 0;
  material.addEventListener("dispose", () => {
    for (const copy of owned.values()) copy.dispose();
    owned.clear();
  });
  return material;
}
