import * as T from "three";
import { assetUrl } from "./asset-url";
import { fetchGzipped } from "./gltf";
import { applySourceFog } from "./source-fog";

const directory = "/models/maps/lighting/sky/";
interface Draw {
  name: string;
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
  flags: Record<string, number>;
  floats: Record<string, number>;
  vectors: Record<string, number[]>;
  textures: Record<string, string>;
}
/** Native csgo_effects masks, distance/Fresnel/depth fades and linear HDR blending. */
export async function loadSourceSkyEffects(
  depth: T.DepthTexture,
  resolution: T.Vector2,
  inverseProjection: T.Matrix4,
  time: { value: number },
) {
  const bytes = await fetchGzipped(directory + "effects.json.gz");
  const data = JSON.parse(new TextDecoder().decode(bytes)) as {
    textures: Record<string, { file: string; srgb: boolean }>;
    draws: Draw[];
  };
  const textures = new Map<string, T.Texture>();
  await Promise.all(
    Object.entries(data.textures).map(async ([key, entry]) => {
      const texture = await new T.TextureLoader().loadAsync(assetUrl(directory + entry.file));
      texture.colorSpace = entry.srgb ? T.SRGBColorSpace : T.NoColorSpace;
      texture.wrapS = texture.wrapT = T.RepeatWrapping;
      texture.flipY = false;
      textures.set(key, texture);
    }),
  );
  const root = new T.Group();
  for (const draw of data.draws) {
    const floats = draw.floats,
      vectors = draw.vectors,
      flags = draw.flags;
    const scalar = (key: string, fallback: number) => ({ value: floats[key] ?? fallback });
    const vector = (key: string, fallback: number[]) => ({
      value: new T.Vector2().fromArray(vectors[key] ?? fallback),
    });
    const additive = flags.F_ADDITIVE_BLEND === 1;
    const material = new T.ShaderMaterial({
      uniforms: {
        time,
        sceneDepth: { value: depth },
        resolution: { value: resolution },
        inverseProjection: { value: inverseProjection },
        colorMap: { value: textures.get(draw.textures.g_tColor) },
        mask1: { value: textures.get(draw.textures.g_tMask1) },
        mask2: { value: textures.get(draw.textures.g_tMask2) },
        mask3: { value: textures.get(draw.textures.g_tMask3) },
        scroll: vector("g_vTexCoordScrollSpeed", [0, 0]),
        scale1: vector("g_vMask1Scale", [1, 1]),
        scale2: vector("g_vMask2Scale", [1, 1]),
        scale3: vector("g_vMask3Scale", [1, 1]),
        pan1: vector("g_vMask1PanSpeed", [0, 0]),
        pan2: vector("g_vMask2PanSpeed", [0, 0]),
        pan3: vector("g_vMask3PanSpeed", [0, 0]),
        boost: scalar("g_flColorBoost", 1),
        opacityScale: scalar("g_flOpacityScale", 1),
        fadeDistance: { value: (floats.g_flFadeDistance ?? 1) * 0.0254 },
        fadeFalloff: scalar("g_flFadeFalloff", 1),
        fadeMin: scalar("g_flFadeMin", 0),
        fadeMax: scalar("g_flFadeMax", 1),
        fresnelExponent: scalar("g_flFresnelExponent", 0.001),
        fresnelFalloff: scalar("g_flFresnelFalloff", 1),
        fresnelMin: scalar("g_flFresnelMin", 0),
        fresnelMax: scalar("g_flFresnelMax", 1),
        featherDistance: { value: (floats.g_flFeatherDistance ?? 20) * 0.0254 },
        featherFalloff: scalar("g_flFeatherFalloff", 1),
      },
      defines: {
        SOURCE_DEPTH_FEATHER: flags.F_DEPTH_FEATHER ?? 0,
        SOURCE_FLIP_BACKFACE:
          flags.F_RENDER_BACKFACES === 1 && !flags.F_DONT_FLIP_BACKFACE_NORMALS ? 1 : 0,
      },
      vertexShader: `uniform vec2 scroll;uniform float time;
        varying vec2 effectUv;varying vec4 effectTint;varying vec3 effectNormal;varying vec3 vViewPosition;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);vViewPosition=-mv.xyz;
        effectNormal=normalMatrix*normal;effectUv=uv+scroll*time;effectTint=color;gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `#include <common>
        uniform sampler2D colorMap,mask1,mask2,mask3,sceneDepth;
        uniform float time,boost,opacityScale,fadeDistance,fadeFalloff,fadeMin,fadeMax,fresnelExponent,fresnelFalloff,fresnelMin,fresnelMax,featherDistance,featherFalloff;
        uniform vec2 scale1,scale2,scale3,pan1,pan2,pan3,resolution;
        uniform mat4 inverseProjection;
        varying vec2 effectUv;varying vec4 effectTint;varying vec3 effectNormal;varying vec3 vViewPosition;
        void main(){
          vec4 color=texture2D(colorMap,effectUv);
          float masks=texture2D(mask1,effectUv*scale1+pan1*time).r*texture2D(mask2,effectUv*scale2+pan2*time).r*texture2D(mask3,effectUv*scale3+pan3*time).r;
          vec3 n=normalize(effectNormal);
          #if SOURCE_FLIP_BACKFACE == 1
            n*=gl_FrontFacing?1.0:-1.0;
          #endif
          float fresnel=mix(fresnelMin,fresnelMax,clamp(pow(clamp(dot(normalize(vViewPosition),n),0.0,1.0),fresnelExponent)*fresnelFalloff,0.0,1.0));
          float fade=pow(max(mix(fadeMin,fadeMax,clamp(length(vViewPosition)/fadeDistance,0.0,1.0)),0.0),fadeFalloff);
          float feather=1.0;
          #if SOURCE_DEPTH_FEATHER == 1
            vec2 screen=gl_FragCoord.xy/resolution;
            float depth=texture2D(sceneDepth,screen).r;
            vec4 scene=inverseProjection*vec4(screen*2.0-1.0,depth*2.0-1.0,1.0);
            feather=pow(clamp(length(scene.xyz/scene.w+vViewPosition)/featherDistance,0.0,1.0),featherFalloff);
          #endif
          gl_FragColor=vec4(color.rgb*effectTint.rgb*boost,color.a*effectTint.a*opacityScale*masks*fresnel*fade*feather);
          #include <tonemapping_fragment>
        }`,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: flags.F_RENDER_BACKFACES === 1 ? T.DoubleSide : T.FrontSide,
      blending: additive ? T.CustomBlending : T.NormalBlending,
      blendSrc: T.SrcAlphaFactor,
      blendDst: additive ? T.OneFactor : T.OneMinusSrcAlphaFactor,
      blendEquation: T.AddEquation,
    });
    if (flags.g_bFogEnabled !== 0)
      material.onBeforeCompile = (shader) => {
        applySourceFog(shader, "1.0", true);
        if (additive)
          shader.fragmentShader = shader.fragmentShader.replace(
            "gl_FragColor.rgb = mix(gl_FragColor.rgb, sourceFogColor, sourceFogBlend*0.5);",
            "gl_FragColor.a *= 1.0-sourceFogBlend*0.5;",
          );
      };
    material.customProgramCacheKey = () => `sky-effects:${additive}:${flags.g_bFogEnabled}`;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute("position", new T.Float32BufferAttribute(draw.positions, 3));
    geometry.setAttribute("normal", new T.Float32BufferAttribute(draw.normals, 3));
    geometry.setAttribute("uv", new T.Float32BufferAttribute(draw.uvs, 2));
    geometry.setAttribute("color", new T.Float32BufferAttribute(draw.colors, 4));
    geometry.setIndex(draw.indices);
    const mesh = new T.Mesh(geometry, material);
    mesh.name = draw.name;
    root.add(mesh);
  }
  return {
    root,
    dispose() {
      root.traverse((object) => {
        if (object instanceof T.Mesh) {
          object.geometry.dispose();
          object.material.dispose();
        }
      });
      textures.forEach((texture) => texture.dispose());
    },
  };
}
