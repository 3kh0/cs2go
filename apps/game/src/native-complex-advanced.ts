/** Native build26445667 selected rare14 COLOR/DEPTH contracts. Compiler bytecode
 * arithmetic is source-backed; browser MSAA/prepass scheduling is qualified. */
import * as T from "three";
import { nativeOpaqueAlphaMaterials } from "./native-complex-alpha-fence";
import type { NativeComplexMaterial } from "./native-map-complex";
import { registerSourceDepth, installSourceShadowDepth } from "./source-depth";
export const rareComplexSelections = {
  mountains: {
    resource: "materials/de_vertigo/vertigo_mountains_001.vmat",
    sha256: "ad8a9db4a4692dcf5d32489b34c15d900703e71c62dfcbdd145196b1ccf5050a",
    flags: {
      F_ALPHA_TEST: 1,
    },
  },
  skyline: {
    resource: "materials/de_vertigo/vertigo_buildingskyline_ft.vmat",
    sha256: "d7010f82f9f387a4678f2450cfdbf9179116366415c9bce8d313d0c84d048bc5",
    flags: {
      F_ALPHA_TEST: 1,
      F_SELF_ILLUM: 1,
    },
  },
  inferno_mountain: {
    resource: "materials/de_inferno/skybox/inferno_skybox_mountain_01.vmat",
    sha256: "9cde30d2b6a290fc82cdc0d306a3497e3776dc821abf6f8513961db7c3adb15c",
    flags: {
      F_ALPHA_TEST: 1,
      F_DO_NOT_CAST_SHADOWS: 1,
      F_SELF_ILLUM: 1,
    },
  },
  plant_panel: {
    resource: "materials/de_cache/backdrop/plant_panel_001.vmat",
    sha256: "2a81e978a0ac0d9ec855e0a601579a7d063135f3e856e57e46807cb25d16307d",
    flags: {
      F_DETAIL_TEXTURE: 1,
      F_PAINT_VERTEX_COLORS: 1,
      F_TINT_MASK: 1,
    },
  },
  poplar_billboard: {
    resource: "models/foliage/trees/poplar/tree_poplar_billboard.vmat",
    sha256: "32eab5030c7430d507477d6972755de1c4c465b58f5a5de11f34f9b1444264c6",
    flags: {
      F_ALPHA_TEST: 1,
      F_TRANSMISSIVE_BACKFACE_NDOTL: 1,
    },
  },
  railing: {
    resource: "materials/de_cache/backdrop/cache_backdrop_buildings_railing_001.vmat",
    sha256: "69a870f60f3b4354c7a38c20f3231cd5e875d1295d9b1d45fb0f57770db3010b",
    flags: {
      F_ALPHA_TEST: 1,
      F_RENDER_BACKFACES: 1,
    },
  },
  dogwood: {
    resource: "models/foliage/bushes/dogwood/dogwood_billboard.vmat",
    sha256: "9572f3c46f15aa70c965a9805426ceb80d5d93fd5b9809090de06755d94aa41f",
    flags: {
      F_ALPHA_TEST: 1,
      F_RENDER_BACKFACES: 1,
      F_TRANSMISSIVE_BACKFACE_NDOTL: 1,
      F_USE_ALBEDO_FOR_TRANSMISSIVE: 1,
    },
  },
  truck: {
    resource: "models/vehicles/truck_large_01/truck_large_01_glow_off.vmat",
    sha256: "0aaea4f7e2cc21fff8954e3dc81d3692119f8fb111eb53db5dba4fbe66e26640",
    flags: {
      F_SELF_ILLUM: 1,
      F_TINT_MASK: 1,
      F_TRANSLUCENT: 1,
    },
  },
  streetlamp: {
    resource: "models/generic/streetlamps_01/streetlamp_01_card.vmat",
    sha256: "6bc5ef36bcc1ae9ac5cdc23ec96fdb10fc364925eecc721b60e6b7918f2af1aa",
    flags: {
      F_ALPHA_TEST: 1,
      F_METALNESS_TEXTURE: 1,
      F_RENDER_BACKFACES: 1,
    },
  },
  plastic_crate: {
    resource: "models/generic/plastic_crate_kit_01/plastic_crate_kit_01.vmat",
    sha256: "90f98191dd3d3bee0321ea038f1cffba1d502330548d7ef74d5718c39fd2a905",
    flags: {
      F_ALPHA_TEST: 1,
      F_RENDER_BACKFACES: 1,
      F_TINT_MASK: 1,
    },
  },
  parasol: {
    resource: "models/generic/terrace_set_01/terrace_parasol_01.vmat",
    sha256: "93bc680cf32715c9fe44f9acbb95b5ccc1852c0523f9a762f623f6acdf091219",
    flags: {
      F_ALPHA_TEST: 1,
      F_METALNESS_TEXTURE: 1,
      F_RENDER_BACKFACES: 1,
      F_TINT_MASK: 1,
      F_TRANSMISSIVE_BACKFACE_NDOTL: 1,
      F_USE_ALBEDO_FOR_TRANSMISSIVE: 1,
    },
  },
  chandelier: {
    resource: "models/generic/chandelier_01/chandelier_01.vmat",
    sha256: "9afbacbfefa6801d529e7f2e232f91b7a5e05eb685ced9987eec157bdad01868",
    flags: {
      F_ALPHA_TEST: 1,
      F_METALNESS_TEXTURE: 1,
      F_SELF_ILLUM: 1,
    },
  },
  palm: {
    resource:
      "models/de_inferno/imported/imported_interior_plant_palm_large_healthy_ragdoll_a_001.vmat",
    sha256: "5196f0cb5bfd83fcb7361d9bc46a91230c8e53e240f8cef8d11e3f0e8b0380c1",
    flags: {
      F_ALPHA_TEST: 1,
      F_RENDER_BACKFACES: 1,
      F_SPECULAR: 1,
    },
  },
  fluorescent: {
    resource: "models/generic/fluorescent_lights_01/fluorescent_lights_01_bulbs_glow_off.vmat",
    sha256: "317b0080d1e924158a5d093db325580910d704b7e51ca62288af8085be02e32b",
    flags: {
      F_SELF_ILLUM: 1,
      F_TINT_MASK: 1,
    },
  },
} as const;
export interface NativeComplexAdvancedSelection {
  contract: "rare14-build26445667" | "opaque-alpha-build26445667";
  group: keyof typeof rareComplexSelections | "opaque-alpha";
  sourceSha256: string;
}
export function advancedScalar(source: NativeComplexMaterial, name: string) {
  const value = source.resolvedMaterialInputs[name] ?? source.FloatParams[name];
  const scalar = Array.isArray(value) ? value[0] : value;
  if (!Number.isFinite(scalar)) throw new Error(`Native advanced complex input missing: ${name}`);
  return scalar;
}
export function validateAdvancedComplex(source: NativeComplexMaterial) {
  const selection = source.advancedSelection;
  if (!selection) return;
  const resource = source.nativeResource.replace(/_c$/, "");
  let expected: Readonly<Record<string, number>>;
  if (selection.contract === "opaque-alpha-build26445667") {
    const actual = nativeOpaqueAlphaMaterials[resource as keyof typeof nativeOpaqueAlphaMaterials];
    if (selection.group !== "opaque-alpha" || !actual || selection.sourceSha256 !== actual.sha256)
      throw new Error("Native opaque alpha selection identity changed");
    for (const [name, value] of Object.entries(actual.scalars))
      if (advancedScalar(source, name) !== value)
        throw new Error(`Native opaque alpha source scalar changed: ${name}`);
    expected = { F_ALPHA_TEST: 1 };
  } else {
    const actual = rareComplexSelections[selection.group as keyof typeof rareComplexSelections];
    if (
      selection.contract !== "rare14-build26445667" ||
      !actual ||
      selection.sourceSha256 !== actual.sha256 ||
      resource !== actual.resource
    )
      throw new Error("Native advanced complex selection identity changed");
    expected = actual.flags;
  }
  for (const [name, value] of Object.entries(source.IntParams))
    if (name.startsWith("F_") && value !== (expected[name] ?? 0))
      throw new Error(`Native advanced complex feature selection changed: ${name}`);
  for (const [name, value] of Object.entries(expected))
    if (source.IntParams[name] !== value)
      throw new Error(`Native advanced complex feature missing: ${name}`);
  if (source.IntParams.F_SELF_ILLUM) {
    for (const key of ["g_vSelfIllumTintScaled", "g_vSelfIllumScrollSpeed"]) {
      const value = source.resolvedMaterialInputs[key];
      if (!Array.isArray(value) || value.length !== 4 || value.some((x) => !Number.isFinite(x)))
        throw new Error(`Native advanced complex vector missing: ${key}`);
    }
    advancedScalar(source, "g_flSelfIllumAlbedoFactor");
  }
  if (
    source.IntParams.F_TRANSMISSIVE_BACKFACE_NDOTL &&
    advancedScalar(source, "g_bTransmissiveShadows") !== 1
  )
    throw new Error("Native complex unshadowed transmission not selected by rare14");
}
export function advancedComplexSamplers(source: NativeComplexMaterial) {
  if (!source.advancedSelection) return [];
  return [
    ...(source.IntParams.F_METALNESS_TEXTURE ? ["g_tMetalness"] : []),
    ...(source.IntParams.F_SELF_ILLUM ? ["g_tSelfIllumMask"] : []),
    ...(source.IntParams.F_TRANSMISSIVE_BACKFACE_NDOTL &&
    !source.IntParams.F_USE_ALBEDO_FOR_TRANSMISSIVE
      ? ["g_tTransmissiveColor"]
      : []),
  ];
}

export function createAdvancedComplexView() {
  const depthScene = new T.Scene(),
    pairs: { source: T.Mesh; depth: T.Mesh }[] = [],
    owned = new Set<T.Material>(),
    time = { value: 0 },
    aa = { value: false };
  const depths = new WeakMap<T.Material, T.MeshDepthMaterial>(),
    noShadow = new Set<T.Mesh>();
  function bind(
    object: T.Mesh,
    material: T.MeshStandardMaterial,
    source: NativeComplexMaterial,
    textures: ReadonlyMap<string, T.Texture>,
  ) {
    if (!source.advancedSelection) return;
    validateAdvancedComplex(source);
    const flags = source.IntParams,
      alpha = !!flags.F_ALPHA_TEST,
      translucent = !!flags.F_TRANSLUCENT,
      paint = !!flags.F_PAINT_VERTEX_COLORS,
      transmission = !!flags.F_TRANSMISSIVE_BACKFACE_NDOTL;
    if (
      paint &&
      !object.geometry.hasAttribute("nativeComplexPaint") &&
      material.userData.nativeComplexRawControl === true
    ) {
      const raw = object.geometry.getAttribute("color");
      if (!raw || raw.itemSize !== 4) throw new Error("Native complex sidecar raw RGBA missing");
      object.geometry.setAttribute("nativeComplexPaint", raw);
    }
    if (paint) {
      const control = object.geometry.getAttribute("nativeComplexPaint");
      if (
        !control ||
        control.itemSize !== 4 ||
        control.count !== object.geometry.getAttribute("position").count
      )
        throw new Error("Native complex paint requires original raw RGBA sidecar attribute");
    }
    const required = (name: string) => {
      const t = textures.get(source.textures[name]);
      if (!t) throw new Error(`Native advanced complex texture missing: ${name}`);
      return t;
    };
    const factorAlpha = material.opacity;
    material.side = flags.F_RENDER_BACKFACES ? T.DoubleSide : T.FrontSide;
    material.emissiveMap = null;
    material.emissive.setRGB(0, 0, 0);
    material.alphaTest = 0;
    material.transparent = translucent;
    material.depthFunc = alpha ? T.EqualDepth : T.LessEqualDepth;
    material.depthWrite = !alpha;
    // Native ordinary translucent state writes depth and uses SrcAlpha/InvSrcAlpha.
    material.blending = translucent ? T.NormalBlending : T.NoBlending;
    material.opacity = 1;
    material.userData.nativeComplexDoNotCastShadows = !!flags.F_DO_NOT_CAST_SHADOWS;
    if (flags.F_DO_NOT_CAST_SHADOWS) {
      object.castShadow = false;
      noShadow.add(object);
    }
    const cutoff = alpha ? advancedScalar(source, "g_flAlphaTestReference") : 0.5;
    const edge = alpha ? advancedScalar(source, "g_flAntiAliasedEdgeStrength") : 1;
    const depthHook = {
      cacheKey: `native-complex-rare-depth:${alpha}:${translucent}:${cutoff}:${edge}`,
      apply(
        shader: T.WebGLProgramParametersWithUniforms,
        _renderer?: T.WebGLRenderer,
        _source?: T.Material,
        prepass = false,
      ) {
        shader.uniforms.nativeComplexDepthColor = { value: required("g_tColor") };
        shader.uniforms.nativeComplexDepthAA = prepass ? aa : { value: false };
        shader.uniforms.nativeComplexDepthControl = {
          value: new T.Vector3(
            cutoff,
            edge,
            translucent ? advancedScalar(source, "g_flOpacityScale") : 1,
          ),
        };
        shader.vertexShader = `varying vec2 vNativeComplexDepthUV;\n${shader.vertexShader}`.replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\nvNativeComplexDepthUV=uv;",
        );
        shader.fragmentShader =
          `varying vec2 vNativeComplexDepthUV;uniform sampler2D nativeComplexDepthColor;uniform bool nativeComplexDepthAA;uniform vec3 nativeComplexDepthControl;\n${shader.fragmentShader}`.replace(
            "#include <alphatest_fragment>",
            translucent
              ? "if(texture2D(nativeComplexDepthColor,vNativeComplexDepthUV).a*nativeComplexDepthControl.z<.7)discard;"
              : alpha
                ? `float nativeComplexCoverage=1.;float nativeComplexA=texture2D(nativeComplexDepthColor,vNativeComplexDepthUV).a;if(nativeComplexDepthAA){float q=mix(clamp(.5+(nativeComplexA-nativeComplexDepthControl.x)/max(fwidth(nativeComplexA),1e-6),0.,1.),nativeComplexA,mix(1.,clamp(4.*length(fwidth(vNativeComplexDepthUV)),0.,1.),nativeComplexDepthControl.y));if(q<.001)discard;nativeComplexCoverage=q;diffuseColor.a=q;}else if(nativeComplexA<nativeComplexDepthControl.x)discard;`
                : "",
          );
        if (prepass && alpha)
          shader.fragmentShader = shader.fragmentShader.replace(
            /}\s*$/,
            "gl_FragColor.a=nativeComplexCoverage;\n}",
          );
      },
    };
    // Paint-only plant has no valid fallback key1. Its ordinary COLOR writes depth;
    // never manufacture the missing native depth selection.
    if (alpha || translucent) {
      registerSourceDepth(material, depthHook);
      if (alpha) {
        const d = new T.MeshDepthMaterial({ depthPacking: T.BasicDepthPacking });
        d.side = material.side;
        d.colorWrite = false;
        d.depthWrite = true;
        d.onBeforeCompile = (shader) => depthHook.apply(shader, undefined, undefined, true);
        d.customProgramCacheKey = () => depthHook.cacheKey;
        depths.set(material, d);
        owned.add(d);
      }
    }
    const previous = material.onBeforeCompile.bind(material),
      key = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      previous(shader, renderer);
      shader.uniforms.nativeComplexAdvancedTime = time;
      shader.uniforms.nativeComplexFactorAlpha = { value: factorAlpha };
      for (const sampler of advancedComplexSamplers(source))
        shader.uniforms[`nativeAdvanced${sampler.slice(3)}`] = { value: required(sampler) };
      const vector = (name: string) => {
        const x = source.resolvedMaterialInputs[name];
        if (!Array.isArray(x)) throw new Error(`Missing advanced vector ${name}`);
        return x;
      };
      if (flags.F_SELF_ILLUM) {
        shader.uniforms.nativeAdvancedEmissionTint = {
          value: new T.Vector3(...vector("g_vSelfIllumTintScaled").slice(0, 3)),
        };
        shader.uniforms.nativeAdvancedEmissionScroll = {
          value: new T.Vector2(...vector("g_vSelfIllumScrollSpeed").slice(0, 2)),
        };
        shader.uniforms.nativeAdvancedEmissionAlbedo = {
          value: advancedScalar(source, "g_flSelfIllumAlbedoFactor"),
        };
      }
      const flip =
        advancedScalar(source, "g_bRenderBackfaceNormals") !== 0 &&
        advancedScalar(source, "g_bDontFlipBackfaceNormals") === 0;
      const useAlbedo = !!flags.F_USE_ALBEDO_FOR_TRANSMISSIVE;
      shader.vertexShader = `${paint ? "attribute vec4 nativeComplexPaint;centroid varying vec4 vNativeComplexPaint;" : ""}\n${shader.vertexShader}`;
      shader.vertexShader =
        `centroid varying vec2 vNativeComplexUv;\n${shader.vertexShader}`.replace(
          "#include <uv_vertex>",
          "#include <uv_vertex>\nvNativeComplexUv=uv;",
        );
      shader.fragmentShader = `centroid varying vec2 vNativeComplexUv;\n${shader.fragmentShader}`;
      shader.vertexShader = shader.vertexShader.replace(
        "varying vec2 vNativeComplexDetailUv;",
        "centroid varying vec2 vNativeComplexDetailUv;",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "varying vec2 vNativeComplexDetailUv;",
        "centroid varying vec2 vNativeComplexDetailUv;",
      );
      if (paint)
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvNativeComplexPaint=all(equal(nativeComplexPaint,vec4(0)))?vec4(1):nativeComplexPaint;",
        );
      shader.fragmentShader = `uniform float nativeComplexAdvancedTime,nativeComplexFactorAlpha;${paint ? "centroid varying vec4 vNativeComplexPaint;" : ""}${advancedComplexSamplers(
        source,
      )
        .map((s) => `uniform sampler2D nativeAdvanced${s.slice(3)};`)
        .join(
          "",
        )} ${flags.F_SELF_ILLUM ? "uniform vec3 nativeAdvancedEmissionTint;uniform vec2 nativeAdvancedEmissionScroll;uniform float nativeAdvancedEmissionAlbedo;" : ""}vec3 nativeAdvancedTransmitted=vec3(0);vec3 nativeAdvancedGeometric;\n${shader.fragmentShader}`;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "totalEmissiveRadiance=vec3(0.0);",
      );
      if (paint)
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec4 nativeComplexSample=",
          `vec4 nativeAdvancedPaint=vNativeComplexPaint;diffuseColor.rgb*=nativeAdvancedPaint.rgb;\nvec4 nativeComplexSample=`,
        );
      if (flags.F_METALNESS_TEXTURE)
        shader.fragmentShader = shader.fragmentShader.replace(
          "float metalnessFactor=nativeComplexSample.a;",
          "float metalnessFactor=texture2D(nativeAdvancedMetalness,vMapUv).g;",
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_begin>",
        T.ShaderChunk.normal_fragment_begin
          .replace("normal *= faceDirection;", flip ? "normal *= faceDirection;" : "")
          .replace("tbn[0] *= faceDirection;", "")
          .replace("tbn[1] *= faceDirection;", flip ? "tbn[1] *= faceDirection;" : ""),
      );
      shader.fragmentShader = shader.fragmentShader
        .replace("mapN.y=-mapN.y;", `if(${flip ? "gl_FrontFacing" : "true"})mapN.y=-mapN.y;`)
        .replace(
          "normal=normalize(tbn*mapN);",
          "normal=normalize(tbn*mapN);nativeAdvancedGeometric=nonPerturbedNormal;",
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        "float roughnessFactor=nativeComplexPackedNormal.b;",
        `vec3 nativeAdvancedGeom=normalize(vNormal);float roughnessFactor=max(nativeComplexPackedNormal.b,pow(clamp(max(dot(dFdx(nativeAdvancedGeom),dFdx(nativeAdvancedGeom)),dot(dFdy(nativeAdvancedGeom),dFdy(nativeAdvancedGeom))),0.,1.),.3330000042915344));`,
      );
      if (transmission)
        shader.fragmentShader = shader.fragmentShader.replace(
          "// Source ResolveDiffuseSpecular supplies albedo*(1-metalness), without",
          `nativeAdvancedTransmitted+=max(0.,-dot(nativeAdvancedGeometric,directLight.direction))*directLight.color;\n// Source ResolveDiffuseSpecular supplies albedo*(1-metalness), without`,
        );
      const transmitted = useAlbedo
        ? "diffuseColor.rgb"
        : `texture2D(nativeAdvancedTransmissiveColor,vNativeComplexUv).rgb*${flags.F_TINT_MASK ? "mix(vec3(1),diffuse,texture2D(nativeComplexTint,vNativeComplexUv).r)" : "diffuse"}`;
      if (flags.F_SELF_ILLUM)
        shader.fragmentShader = shader.fragmentShader.replace(
          "vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
          "vec3 nativeAdvancedE=texture2D(nativeAdvancedSelfIllumMask,vMapUv+fract(nativeAdvancedEmissionScroll*nativeComplexAdvancedTime)).rgb*nativeAdvancedEmissionTint;totalDiffuse+=mix(nativeAdvancedE,nativeAdvancedE*diffuseColor.rgb,nativeAdvancedEmissionAlbedo);\nvec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;",
        );
      shader.fragmentShader = shader.fragmentShader.replace(
        /\bvMapUv\b|\bvNormalMapUv\b|\bvAoMapUv\b/g,
        "vNativeComplexUv",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `${transmission ? `outgoingLight+=nativeAdvancedTransmitted*${transmitted};` : ""}\n#include <opaque_fragment>\ngl_FragColor.a=${translucent ? "nativeComplexFactorAlpha*nativeComplexSample.a*" + advancedScalar(source, "g_flOpacityScale").toFixed(12) : alpha ? "1." : "nativeComplexFactorAlpha" + (paint ? "*nativeAdvancedPaint.a" : "")};`,
      );
    };
    material.customProgramCacheKey = () =>
      `${key}:rare14:${alpha}:${translucent}:${paint}:${transmission}:${!!flags.F_USE_ALBEDO_FOR_TRANSMISSIVE}:${!!flags.F_SELF_ILLUM}:${advancedScalar(source, "g_bRenderBackfaceNormals") !== 0 && advancedScalar(source, "g_bDontFlipBackfaceNormals") === 0}`;
    material.needsUpdate = true;
  }
  function finish(object: T.Mesh) {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    const shadowFlags = materials.map((m) => m.userData.nativeComplexDoNotCastShadows === true);
    if (shadowFlags.some(Boolean)) {
      if (!shadowFlags.every(Boolean))
        throw new Error("Mixed native complex shadow policy requires primitive split");
      noShadow.add(object);
      object.castShadow = false;
    }
    if (materials.some((m) => depths.has(m))) {
      const hidden = new T.MeshDepthMaterial();
      hidden.visible = false;
      owned.add(hidden);
      const mapped = materials.map((m) => depths.get(m) ?? hidden),
        depth = new T.Mesh(object.geometry, Array.isArray(object.material) ? mapped : mapped[0]);
      depth.matrixAutoUpdate = false;
      depth.frustumCulled = false;
      depthScene.add(depth);
      pairs.push({ source: object, depth });
    }
    if (materials.some((m) => depths.has(m))) installSourceShadowDepth(object);
  }
  return {
    bind,
    finish,
    depthScene,
    applyShadowPolicy() {
      for (const object of noShadow) object.castShadow = false;
    },
    syncDepth(renderer?: T.WebGLRenderer) {
      this.applyShadowPolicy();
      const target = renderer?.getRenderTarget();
      aa.value =
        !!renderer &&
        (target ? target.samples > 0 : !!renderer.getContext().getContextAttributes()?.antialias);
      for (const material of owned)
        if (material.alphaToCoverage !== aa.value) {
          material.alphaToCoverage = aa.value;
          material.needsUpdate = true;
        }
      for (const pair of pairs) {
        pair.source.updateWorldMatrix(true, false);
        pair.depth.matrix.copy(pair.source.matrixWorld);
        let visible = true;
        for (let p: T.Object3D | null = pair.source; p; p = p.parent) visible &&= p.visible;
        pair.depth.visible = visible;
      }
    },
    update(seconds: number) {
      if (!Number.isFinite(seconds)) throw new Error("Invalid native complex time");
      time.value = seconds;
    },
    dispose() {
      owned.forEach((m) => m.dispose());
      owned.clear();
      pairs.length = 0;
      noShadow.clear();
      depthScene.clear();
    },
  };
}
