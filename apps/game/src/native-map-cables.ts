import * as T from "three";
import { installSourceShadowDepth, registerSourceDepth } from "./source-depth";
import { applySourceSurface, loadSourceSurfaceLookup } from "./source-surface";

/** Installed build26445667 client registration (9a99993f), not an observed live cvar.
 * The recovered writer divides INSIDE tan. Its A/D field identities remain a
 * qualified browser binding at update(): effective vertical FOV / pixel height. */
export const sourceCableClampDefault = 1.2000000476837158;
export function sourceCableViewScale(
  angleDegrees: number,
  pixelDimension: number,
  clamp = sourceCableClampDefault,
) {
  if (
    !Number.isFinite(angleDegrees) ||
    angleDegrees <= 0 ||
    angleDegrees >= 180 ||
    !Number.isFinite(pixelDimension) ||
    pixelDimension < 1 ||
    !Number.isFinite(clamp) ||
    clamp < 0
  )
    throw new Error("Invalid native cable view inputs");
  const radians = Math.fround(Math.fround(angleDegrees) * Math.fround(Math.PI / 180));
  const anglePerPixel = Math.fround(radians / Math.fround(Math.trunc(pixelDimension)));
  // JS tan is not claimed bit-identical to tier0!V_tanf.
  return Math.fround(Math.fround(clamp) * Math.fround(Math.tan(anglePerPixel)));
}
export function sourceCableWidth(radius: number, viewDepth: number, scale: number) {
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    !Number.isFinite(viewDepth) ||
    !Number.isFinite(scale) ||
    scale < 0
  )
    throw new Error("Invalid native cable radius inputs");
  const expanded = Math.max(Math.fround(radius), Math.fround(Math.abs(viewDepth) * scale));
  return {
    radius: expanded,
    coverage: Math.max(Math.fround(Math.fround(radius) / expanded), 0.25),
  };
}
const resources = new Set([
  "materials/cable/csgo_placeholder_cable.vmat",
  "materials/cable/csgo_placeholder_cable_translucent.vmat",
  "materials/cable/csgo_cable_tintable.vmat",
]);
const flags = new Set([
  "F_CLAMP_MIN_RADIUS",
  "F_TRANSLUCENT",
  "F_TINT_MASK",
  "g_bFogEnabled",
  "g_nTextureAddressModeU",
  "g_nTextureAddressModeV",
]);
const decode = `vec3 nativeCableDecode(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045001),c));}`;

/** Model geometry/ordinary materials/shadow variants are owned by MapResources;
 * lookup is shared. Knots/settling/section topology remain the explicit pinned
 * VRF bridge. Width/coverage/opaque blending use recovered native instructions.
 * No old Dust II material is selected by name or changed by this adapter. */
export function applyNativeMapCables(root: T.Object3D, lookup: T.DataTexture) {
  const meshes: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>[] = [];
  root.traverse((object) => {
    if (!(object instanceof T.Mesh) || Array.isArray(object.material)) return;
    const material = object.material;
    if (material.userData.nativeCableBridgeVersion !== 1) return;
    if (
      !(material instanceof T.MeshStandardMaterial) ||
      material.userData.nativeShader !== "cables.vfx" ||
      !resources.has(material.userData.nativeMaterialName)
    )
      throw new Error("Unbound native cable material");
    const params = material.userData.nativeIntParams as Record<string, number>;
    if (
      !params ||
      Object.entries(params).some(
        ([name, value]) => !flags.has(name) || !Number.isInteger(value) || value < 0 || value > 1,
      )
    )
      throw new Error("Unsupported native cable feature");
    const attributes = object.geometry.attributes;
    const count = attributes.position?.count;
    for (const [name, size] of [
      ["_cable_center", 3],
      ["_cable_radius", 1],
      ["_cable_raw_color", 3],
    ] as const) {
      const attribute = attributes[name];
      if (!attribute || attribute.itemSize !== size || attribute.count !== count)
        throw new Error(`Native cable stream missing: ${name}`);
      for (const value of attribute.array)
        if (!Number.isFinite(value) || (name === "_cable_radius" && value <= 0))
          throw new Error("Invalid native cable stream");
    }
    const normal = material.userData.sourceTextureConstantProof?.g_tNormal?.constantRGBA8;
    if (!normal || normal.join() !== "128,128,255,255")
      throw new Error("Unsupported native cable packed normal");
    const proof = material.userData.sourceTextureConstantProof;
    if (
      params.g_bFogEnabled !== 1 ||
      material.metalness !== 0 ||
      material.roughness !== 1 ||
      proof?.g_tAmbientOcclusion?.constantRGBA8?.slice(0, 3).join() !== "255,255,255" ||
      (params.F_TINT_MASK && proof?.g_tTintMask?.constantRGBA8?.[0] !== 255) ||
      (params.F_TRANSLUCENT
        ? proof?.g_tMetalness?.constantRGBA8?.[0] !== 0
        : proof?.g_tColor?.constantRGBA8?.[3] !== 0)
    )
      throw new Error("Unsupported native cable constant material");
    // Native RG hemi-oct = (0,0,1), B roughness=1: constant-folding avoids
    // treating this packed map as conventional XYZ RGB.
    meshes.push(object as T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>);
  });
  const scale = { value: 0 };
  const patched = new Set<T.Material>();
  let disposed = false;
  const vertex = (shader: T.WebGLProgramParametersWithUniforms, clamp: boolean, color: boolean) => {
    shader.uniforms.nativeCablePixelScale = scale;
    shader.vertexShader = `attribute vec3 _cable_center;attribute float _cable_radius;uniform float nativeCablePixelScale;varying float vNativeCableCoverage;${color ? `attribute vec3 _cable_raw_color;${decode}` : ""}\n${shader.vertexShader}`;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>\nvNativeCableCoverage=1.;${clamp ? "float nativeCableDepth=abs((modelViewMatrix*vec4(_cable_center,1.)).z);float nativeCableK=projectionMatrix[3][3]==0.?nativeCablePixelScale:0.;float nativeCableModelScale=length(modelViewMatrix[0].xyz);float nativeCablePhysical=_cable_radius*nativeCableModelScale;float nativeCableExpanded=max(nativeCableDepth*nativeCableK,nativeCablePhysical);transformed=_cable_center+(transformed-_cable_center)*(nativeCableExpanded/nativeCablePhysical);vNativeCableCoverage=max(nativeCablePhysical/nativeCableExpanded,.25);" : ""}`,
    );
    if (color)
      shader.vertexShader = shader.vertexShader.replace(
        "#include <color_vertex>",
        "#include <color_vertex>\n#ifdef USE_COLOR\nvColor.rgb=nativeCableDecode(nativeCableDecode(_cable_raw_color));\n#endif",
      );
  };
  for (const object of meshes) {
    const material = object.material;
    if (!patched.has(material)) {
      patched.add(material);
      const params = material.userData.nativeIntParams as Record<string, number>;
      const clamp = !!params.F_CLAMP_MIN_RADIUS;
      material.transparent = !!params.F_TRANSLUCENT;
      material.alphaToCoverage = false;
      material.premultipliedAlpha = false;
      material.depthWrite = !params.F_TRANSLUCENT;
      const previous = material.onBeforeCompile.bind(material);
      const key = material.customProgramCacheKey();
      material.onBeforeCompile = (shader, renderer) => {
        previous(shader, renderer);
        vertex(shader, clamp, true);
        applySourceSurface(
          shader,
          { directSpecular: true, indirectSpecular: true, nativeAO: true },
          lookup,
        );
        shader.fragmentShader = `varying float vNativeCableCoverage;\n${shader.fragmentShader}`;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          "#include <opaque_fragment>\ngl_FragColor.a=vNativeCableCoverage*opacity;",
        );
      };
      material.customProgramCacheKey = () => `${key}:native-cables:${clamp}`;
      if (clamp || params.F_TRANSLUCENT) {
        // Native PSRS clamped-opaque enables SRC_ALPHA / INV_SRC_ALPHA even in
        // the opaque queue. CustomBlending avoids Three's opaque-Normal shortcut.
        material.blending = T.CustomBlending;
        material.blendSrc = material.blendSrcAlpha = T.SrcAlphaFactor;
        material.blendDst = material.blendDstAlpha = T.OneMinusSrcAlphaFactor;
        material.blendEquation = material.blendEquationAlpha = T.AddEquation;
      }
      registerSourceDepth(material, {
        cacheKey: `native-cables:${clamp}`,
        apply(shader) {
          vertex(shader, clamp, false);
        },
      });
      material.needsUpdate = true;
    }
    installSourceShadowDepth(object);
  }
  return {
    lookup,
    meshes: meshes.length,
    materials: patched.size,
    /** Qualified browser host binding; native A/D member aliases are not asserted.
     * Supply full view pixel height once, keeping half-resolution depth consumers
     * on the same angular width. Orthographic shadow views use physical radii. */
    update(camera: T.Camera, pixelHeight: number) {
      if (disposed) return;
      const projection = camera.projectionMatrix;
      if (projection.elements[15] !== 0) {
        scale.value = 0;
        return;
      }
      const angle = (2 * Math.atan(1 / Math.abs(projection.elements[5])) * 180) / Math.PI;
      scale.value = sourceCableViewScale(angle, pixelHeight);
    },
    setNativeViewInputs(angleDegrees: number, pixelDimension: number) {
      if (!disposed) scale.value = sourceCableViewScale(angleDegrees, pixelDimension);
    },
    dispose() {
      // MapResources captures all material/shadow variants. Shared lookup lives
      // beyond any one map; this view owns no texture or geometry allocations.
      disposed = true;
    },
  };
}
export async function loadNativeCableView(root: T.Object3D) {
  return applyNativeMapCables(root, await loadSourceSurfaceLookup());
}
