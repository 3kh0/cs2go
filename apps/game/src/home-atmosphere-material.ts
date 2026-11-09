import * as T from "three";

export interface HazeMaterial {
  masks: string[];
  pan: number[][];
  scale: number[][];
  tint: number[];
  opacity: number;
  feather: number;
  fresnel: number;
  falloff: number;
}

/** Mask/pan/fresnel/feather equations: VRF 9e2e6c7 Renderer/Shaders/csgo_effects.frag.slang. */
export function homeHazeMaterial(
  definition: HazeMaterial,
  textures: Map<string, T.Texture>,
  clock: { value: number },
  depth: { value: T.DepthTexture },
  viewport: { value: T.Vector2 },
  range: { value: T.Vector2 },
  particles = false,
) {
  return new T.ShaderMaterial({
    name: particles ? "home-ground-dust" : "home-native-backdrop",
    transparent: true,
    depthWrite: false,
    side: T.DoubleSide,
    uniforms: {
      clock,
      sceneDepth: depth,
      viewport,
      cameraRange: range,
      mask0: { value: textures.get(definition.masks[0]) },
      mask1: { value: textures.get(definition.masks[1]) },
      mask2: { value: textures.get(definition.masks[2]) },
      pan: { value: definition.pan.map((v) => new T.Vector2(...(v as [number, number]))) },
      uvScale: { value: definition.scale.map((v) => new T.Vector2(...(v as [number, number]))) },
      tint: { value: new T.Color().fromArray(definition.tint) },
      opacity: { value: definition.opacity },
      feather: { value: definition.feather * 0.0254 },
      fresnel: { value: definition.fresnel },
      falloff: { value: definition.falloff },
      frameRects: { value: null },
      frameCount: { value: 1 },
    },
    defines: particles ? { HOME_DUST_PARTICLES: 1 } : {},
    vertexShader: `
      attribute vec4 color;
      varying vec2 vUv;
      varying vec4 vDustColor;
      varying vec3 vDustNormal;
      varying vec3 vDustView;
      #ifdef HOME_DUST_PARTICLES
      attribute float dustOpacity;
      attribute float dustFrame;
      attribute vec3 dustTint;
      varying float vFrame;
      uniform sampler2D frameRects;
      uniform float frameCount;
      #endif
      void main() {
        vUv = uv;
        vDustColor = color;
        vec4 local = vec4(position, 1.0);
        vec3 localNormal = normal;
        #ifdef HOME_DUST_PARTICLES
        vDustColor.a *= dustOpacity;
        vDustColor.rgb *= dustTint;
        vFrame = dustFrame;
        vec4 crop0 = texture2D(frameRects, vec2((floor(dustFrame) + 0.5) / frameCount, 0.75));
        vec4 crop1 = texture2D(frameRects, vec2((min(floor(dustFrame) + 1.0, frameCount - 1.0) + 0.5) / frameCount, 0.75));
        vec4 crop = mix(crop0, crop1, fract(dustFrame));
        local.xy = vec2(mix(crop.x, crop.z, uv.x) * 2.0 - 1.0,
          1.0 - 2.0 * mix(crop.w, crop.y, uv.y));
        #endif
        #ifdef USE_INSTANCING
        local = instanceMatrix * local;
        localNormal = mat3(instanceMatrix) * localNormal;
        #endif
        vec4 view = modelViewMatrix * local;
        vDustView = -view.xyz;
        vDustNormal = normalMatrix * localNormal;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: `
      uniform float clock, opacity, feather, fresnel, falloff;
      uniform vec3 tint;
      uniform sampler2D mask0, mask1, mask2, sceneDepth;
      uniform vec2 viewport, cameraRange;
      uniform vec2 pan[3], uvScale[3];
      varying vec2 vUv;
      varying vec4 vDustColor;
      varying vec3 vDustNormal, vDustView;
      #ifdef HOME_DUST_PARTICLES
      varying float vFrame;
      uniform sampler2D frameRects;
      uniform float frameCount;
      #endif
      #include <common>
      #include <packing>
      void main() {
        vec2 uv0 = vUv * uvScale[0] + clock * pan[0];
        vec2 uv1 = vUv * uvScale[1] + clock * pan[1];
        vec2 uv2 = vUv * uvScale[2] + clock * pan[2];
        #ifdef HOME_DUST_PARTICLES
        vec4 rect0 = texture2D(frameRects, vec2((floor(vFrame) + 0.5) / frameCount, 0.25));
        vec4 rect1 = texture2D(frameRects, vec2((min(floor(vFrame) + 1.0, frameCount - 1.0) + 0.5) / frameCount, 0.25));
        uv0 = mix(rect0.xy, rect0.zw, vec2(vUv.x, 1.0 - vUv.y));
        uv1 = mix(rect1.xy, rect1.zw, vec2(vUv.x, 1.0 - vUv.y));
        #endif
        #ifdef HOME_DUST_PARTICLES
        vec4 sprite = mix(texture2D(mask0, uv0), texture2D(mask0, uv1), fract(vFrame));
        float mask = sprite.a;
        #else
        float mask = texture2D(mask0, uv0).r * texture2D(mask1, uv1).r * texture2D(mask2, uv2).r;
        #endif
        float facing = abs(dot(normalize(vDustNormal), normalize(vDustView)));
        float edge = clamp(pow(facing, fresnel) * falloff, 0.0, 1.0);
        float depth = texture2D(sceneDepth, gl_FragCoord.xy / viewport).x;
        float distanceToOpaque = -perspectiveDepthToViewZ(depth, cameraRange.x, cameraRange.y);
        float rayDistance = max(0.0, distanceToOpaque - vDustView.z) * length(vDustView) / vDustView.z;
        float intersection = clamp(rayDistance / max(feather, 0.0001), 0.0, 1.0);
        float alpha = mask * opacity * vDustColor.a * edge * intersection;
        if (alpha < 0.001) discard;
        vec3 color = tint * vDustColor.rgb;
        #ifdef HOME_DUST_PARTICLES
        color *= sprite.rgb;
        #endif
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
