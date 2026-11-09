import * as T from "three";
import { assetFetch, assetUrl } from "./asset-url";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { yieldLoadingWork } from "./loading";

export type InspectionProfile = "weapon" | "knife" | "music";

const loadingClearColor = new T.Color();
/** Keep the native opaque loading panel until its real camera/assets are ready. */
export function drawInspectionLoading(renderer: T.WebGLRenderer) {
  renderer.getClearColor(loadingClearColor);
  const alpha = renderer.getClearAlpha();
  const scissorTest = renderer.getScissorTest();
  try {
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 1);
    renderer.clear();
  } finally {
    renderer.setClearColor(loadingClearColor, alpha);
    renderer.setScissorTest(scissorTest);
  }
}

const colorCorrection = { value: null as T.Data3DTexture | null };
const colorCorrectionReady = { value: 0 };
let colorCorrectionLoad: Promise<void> | undefined;
type NativeProfile = {
  item: { origin: number[]; scales: number[] };
  camera: {
    angles: number[];
    origin: number[];
    VerticalFOV: number;
    ZNear?: number;
    ZFar?: number;
  };
  light: {
    origin: number[];
    angles: number[];
    size_params: number[];
    range: number;
    brightness_lumens: number;
    brightnessscale: number;
    color: number[];
    soft_x: number;
    soft_y: number;
    skirt_near: number;
    skirt: number;
  };
};
let profiles: Record<string, NativeProfile> | undefined;
let nativeEnvironment: T.WebGLRenderTarget | undefined;
let nativeReflection: T.DataTexture | undefined;
let nativeLoad: Promise<void> | undefined;
let nativePreparation: Promise<void> | undefined;

function prepareNativeEnvironment(renderer: T.WebGLRenderer) {
  if (nativeEnvironment || !nativeReflection) return;
  const target = renderer.getRenderTarget();
  const viewport = renderer.getViewport(new T.Vector4());
  const scissor = renderer.getScissor(new T.Vector4());
  const scissorTest = renderer.getScissorTest();
  const autoClear = renderer.autoClear;
  const toneMapping = renderer.toneMapping;
  const clearColor = renderer.getClearColor(new T.Color());
  const clearAlpha = renderer.getClearAlpha();
  const generator = new T.PMREMGenerator(renderer);
  try {
    nativeEnvironment = generator.fromEquirectangular(nativeReflection);
    nativeReflection.dispose();
    nativeReflection = undefined;
  } finally {
    generator.dispose();
    renderer.setRenderTarget(target);
    renderer.setViewport(viewport);
    renderer.setScissor(scissor);
    renderer.setScissorTest(scissorTest);
    renderer.autoClear = autoClear;
    renderer.toneMapping = toneMapping;
    renderer.setClearColor(clearColor, clearAlpha);
  }
}

/** Start on Inventory/inspection intent, never on startup or for the whole library.
 * The shared promise includes native decode, PMREM creation and LUT GPU upload. */
export function prepareInspectionLighting(renderer: T.WebGLRenderer) {
  return (nativePreparation ??= (async () => {
    await loadNativeProfile();
    await yieldLoadingWork();
    prepareNativeEnvironment(renderer);
    if (colorCorrection.value) renderer.initTexture(colorCorrection.value);
  })().catch((error: unknown) => {
    nativePreparation = undefined;
    throw error;
  }));
}
function loadNativeProfile() {
  return (nativeLoad ??= Promise.allSettled([
    loadColorCorrection(),
    assetFetch("/models/inspection-lighting/dust2-profiles.json").then(async (response) => {
      if (!response.ok) throw new Error("Native inspection profile could not load");
      return ((await response.json()) as { profiles: Record<string, NativeProfile> }).profiles;
    }),
    new EXRLoader()
      .setDataType(T.HalfFloatType)
      .loadAsync(assetUrl("/models/inspection-lighting/dust2-reflection.exr")),
  ] as const)
    .then(([grade, config, reflection]) => {
      if (
        grade.status === "rejected" ||
        config.status === "rejected" ||
        reflection.status === "rejected"
      ) {
        if (reflection.status === "fulfilled") reflection.value.dispose();
        const failed = [grade, config, reflection].find((result) => result.status === "rejected");
        throw failed?.reason;
      }
      profiles = config.value;
      nativeReflection = reflection.value;
    })
    .catch((error: unknown) => {
      nativeLoad = undefined;
      throw error;
    }));
}
function loadColorCorrection() {
  return (colorCorrectionLoad ??= assetFetch(
    "/models/inspection-lighting/dust2-color-correction.bin",
  )
    .then(async (response) => {
      if (!response.ok) throw new Error("Inspection color correction could not load");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== 32 ** 3 * 4) throw new Error("Invalid inspection color correction");
      const texture = new T.Data3DTexture(bytes, 32, 32, 32);
      texture.colorSpace = T.NoColorSpace;
      texture.minFilter = texture.magFilter = T.LinearFilter;
      texture.unpackAlignment = 1;
      texture.needsUpdate = true;
      colorCorrection.value = texture;
      colorCorrectionReady.value = 1;
    })
    .catch((error: unknown) => {
      colorCorrectionLoad = undefined;
      throw error;
    }));
}

/** The Dust II inspection profile, scoped to owned inspector materials.
 * Native sources: de_dust2_vanity entity/VPOST dump and Panorama inspect.js.
 * The authored profile is distinct from Dust II's gameplay VPOST.
 * Barn geometry/photometry adapted from Source2Viewer20.1 SceneLight.cs and
 * lighting.barn.slang (MIT), Copyright(c)2015 ValveResourceFormat Contributors.
 * Full notice: packages/assets/public/models/maps/licenses/ValveResourceFormat-MIT.txt. */
export class InspectionLighting {
  private scene: T.Scene;
  private sun = new T.DirectionalLight(0xf8e6d5, 1.1 * Math.PI);
  private patched = new WeakSet<T.Material>();
  private worldToPreview = new T.Matrix4();
  private profile: InspectionProfile = "weapon";
  private versions = new WeakMap<T.Object3D, { version: number; children: number }>();
  private origin = { value: new T.Vector3() };
  private sourceFromPreview = { value: new T.Matrix3() };
  private previewFromSource = { value: new T.Matrix3() };
  private sourceScale = { value: 1 / 0.0254 };
  private itemScale = 1;
  private barnEye = { value: new T.Vector3() };
  private barnForward = { value: new T.Vector3() };
  private barnRight = { value: new T.Vector3() };
  private barnUp = { value: new T.Vector3() };
  private barnProjection = { value: new T.Vector4() };
  private barnSkirts = { value: new T.Vector2() };
  private barnEdge = { value: new T.Vector2() };
  private barnColor = { value: new T.Color() };
  private directSpecularScale = { value: 1 / Math.PI };

  constructor(scene: T.Scene, profile: InspectionProfile) {
    this.scene = scene;
    scene.add(this.sun, this.sun.target);
    this.setProfile(profile);
  }

  async load() {
    await loadNativeProfile();
    this.setProfile(this.profile);
  }

  get postProcessing() {
    return { texture: colorCorrection, ready: colorCorrectionReady };
  }

  configureBackgroundCamera(camera: T.PerspectiveCamera, origin?: readonly number[]) {
    const data = profiles?.[this.profile === "knife" ? "melee" : this.profile];
    if (!data) return;
    const source = origin ?? data.camera.origin;
    const [pitchDegrees, yawDegrees, rollDegrees] = data.camera.angles;
    const pitch = T.MathUtils.degToRad(pitchDegrees);
    const yaw = T.MathUtils.degToRad(yawDegrees);
    camera.position.set(source[0] * 0.0254, source[2] * 0.0254, -source[1] * 0.0254);
    camera.up.set(0, 1, 0);
    camera.lookAt(
      camera.position.x + Math.cos(pitch) * Math.cos(yaw),
      camera.position.y - Math.sin(pitch),
      camera.position.z - Math.cos(pitch) * Math.sin(yaw),
    );
    if (rollDegrees) camera.rotateZ(-T.MathUtils.degToRad(rollDegrees));
    camera.fov = data.camera.VerticalFOV;
    camera.near = (data.camera.ZNear ?? 4) * 0.0254;
    camera.far = (data.camera.ZFar ?? 10000) * 0.0254;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }

  setProfile(profile: InspectionProfile) {
    this.profile = profile;
    // Native close-up cameras: weapon/melee yaw75; music close yaw57.968277.
    // Local inspection +Z points back toward the camera, unlike Source +X.
    const data = profiles?.[profile === "knife" ? "melee" : profile];
    const cameraYaw =
      data?.camera.angles[1] ?? (profile === "music" ? 57.96827697753906 : 74.99998474121094);
    const localToWorldYaw = T.MathUtils.degToRad(cameraYaw - 90);
    this.worldToPreview.makeRotationY(-localToWorldYaw);
    this.scene.environmentRotation.y = Math.PI + localToWorldYaw;
    this.sourceFromPreview.value.set(
      Math.cos(localToWorldYaw),
      0,
      Math.sin(localToWorldYaw),
      Math.sin(localToWorldYaw),
      0,
      -Math.cos(localToWorldYaw),
      0,
      1,
      0,
    );
    this.previewFromSource.value.copy(this.sourceFromPreview.value).transpose();
    // Native sun pitch/yaw50/43, inspector script SetLightBrightness1.1.
    // Source diffuse omits Lambert's1/pi, hence the same pi conversion as dust2.ts.
    const pitch = T.MathUtils.degToRad(50);
    const yaw = T.MathUtils.degToRad(43);
    this.sun.position
      .set(-Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw))
      .applyMatrix4(this.worldToPreview)
      .multiplyScalar(100);
    if (!data) return;
    this.origin.value.fromArray(data.item.origin);
    this.itemScale = data.item.scales[0];
    const light = data.light;
    const [pitchDegrees, yawDegrees, rollDegrees] = light.angles;
    const p = T.MathUtils.degToRad(pitchDegrees);
    const y = T.MathUtils.degToRad(yawDegrees);
    const r = T.MathUtils.degToRad(rollDegrees);
    const cp = Math.cos(p),
      sp = Math.sin(p),
      cy = Math.cos(y),
      sy = Math.sin(y),
      cr = Math.cos(r),
      sr = Math.sin(r);
    this.barnForward.value.set(cp * cy, cp * sy, -sp);
    this.barnUp.value.set(cr * sp * cy + sr * sy, cr * sp * sy - sr * cy, cr * cp);
    this.barnRight.value.crossVectors(this.barnUp.value, this.barnForward.value).normalize();
    const near = 1 / light.size_params[2],
      far = near + light.range;
    this.barnEye.value.fromArray(light.origin).addScaledVector(this.barnForward.value, -near);
    this.barnProjection.value.set(light.size_params[0], light.size_params[1], near, far);
    this.barnSkirts.value.set(
      (near + light.skirt_near * light.range) / (far * light.skirt_near),
      (near + (1 - light.skirt) * light.range) / (near * light.skirt),
    );
    this.barnEdge.value.set(1 - light.soft_x, 1 - light.soft_y);
    const [sx, sy2] = light.size_params;
    const solidAngle =
      4 * Math.atan((sx * sy2) / (near * Math.sqrt(near * near + sx * sx + sy2 * sy2)));
    const divisor = (solidAngle * near * near) / (4 * Math.PI * 10);
    this.barnColor.value
      .setRGB(light.color[0] / 255, light.color[1] / 255, light.color[2] / 255, T.SRGBColorSpace)
      .multiplyScalar((light.brightness_lumens * light.brightnessscale) / divisor);
  }

  private material(material: T.Material) {
    if (!(material instanceof T.MeshStandardMaterial)) return;
    // Native weapon/knife clones inherit the armory's procedural RoomEnvironment.
    // That explicit map wins over scene.environment; clear only owned clones.
    if (material.envMap) {
      material.envMap = null;
      material.envMapIntensity = 1;
      material.needsUpdate = true;
    }
    if (this.patched.has(material)) return;
    this.patched.add(material);
    const priorCompile = material.onBeforeCompile.bind(material);
    const priorKey = material.customProgramCacheKey();
    material.onBeforeCompile = (shader, renderer) => {
      priorCompile(shader, renderer);
      shader.uniforms.inspectionColorCorrection = colorCorrection;
      shader.uniforms.inspectionColorCorrectionReady = colorCorrectionReady;
      Object.assign(shader.uniforms, {
        inspectionItemOrigin: this.origin,
        inspectionSourceFromPreview: this.sourceFromPreview,
        inspectionPreviewFromSource: this.previewFromSource,
        inspectionSourceScale: this.sourceScale,
        inspectionBarnEye: this.barnEye,
        inspectionBarnForward: this.barnForward,
        inspectionBarnRight: this.barnRight,
        inspectionBarnUp: this.barnUp,
        inspectionBarnProjection: this.barnProjection,
        inspectionBarnSkirts: this.barnSkirts,
        inspectionBarnEdge: this.barnEdge,
        inspectionBarnColor: this.barnColor,
        inspectionDirectSpecularScale: this.directSpecularScale,
      });
      shader.fragmentShader =
        `uniform highp sampler3D inspectionColorCorrection;
uniform float inspectionColorCorrectionReady;
uniform vec3 inspectionItemOrigin, inspectionBarnEye, inspectionBarnForward, inspectionBarnRight, inspectionBarnUp, inspectionBarnColor;
uniform mat3 inspectionSourceFromPreview, inspectionPreviewFromSource;
uniform float inspectionSourceScale;
uniform float inspectionDirectSpecularScale;
uniform vec4 inspectionBarnProjection;
uniform vec2 inspectionBarnSkirts, inspectionBarnEdge;\n` + shader.fragmentShader;
      // Perspective barn-door geometry/photometry follows VRF20.1 SceneLight.cs
      // and lighting.barn.slang. CS2 uses the modern lumen branch, not ADJ's
      // legacy brightness. Source fixtures have no cookie, shear or shadows.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <lights_fragment_end>",
        `{
          vec3 inspectionLocalPosition = cameraPosition + transpose(mat3(viewMatrix))*(-vViewPosition);
          vec3 inspectionSourcePosition = inspectionItemOrigin + inspectionSourceFromPreview*inspectionLocalPosition*inspectionSourceScale;
          vec3 inspectionDelta = inspectionSourcePosition-inspectionBarnEye;
          float inspectionDepth = dot(inspectionDelta, inspectionBarnForward);
          float inspectionNear = inspectionBarnProjection.z, inspectionFar = inspectionBarnProjection.w;
          if(inspectionDepth > inspectionNear && inspectionDepth < inspectionFar) {
            vec2 inspectionNdc = vec2(dot(inspectionDelta,inspectionBarnRight),dot(inspectionDelta,inspectionBarnUp))*inspectionNear/(inspectionDepth*inspectionBarnProjection.xy);
            float inspectionZ = inspectionFar/(inspectionFar-inspectionNear)*(1.0-inspectionNear/inspectionDepth);
            vec2 inspectionBorder = abs(inspectionNdc);
            if(all(lessThan(inspectionBorder,vec2(1.0)))) {
              vec2 inspectionSmooth = clamp((inspectionBorder-vec2(1.0))/(inspectionBarnEdge-vec2(1.0)),0.0,1.0);
              inspectionSmooth *= inspectionSmooth*(3.0-2.0*inspectionSmooth);
              float inspectionSkirt = clamp(inspectionZ*inspectionBarnSkirts.x,0.0,1.0);
              inspectionSkirt *= inspectionSkirt*(3.0-2.0*inspectionSkirt);
              float inspectionFarSkirt = clamp((1.0-inspectionZ)*inspectionBarnSkirts.y,0.0,1.0);
              inspectionFarSkirt *= inspectionFarSkirt*(3.0-2.0*inspectionFarSkirt);
              float inspectionAttenuation = inspectionNear*inspectionNear/max(dot(inspectionDelta,inspectionDelta),inspectionNear*inspectionNear);
              inspectionAttenuation *= inspectionSmooth.x*inspectionSmooth.y*inspectionSkirt*inspectionFarSkirt;
              directLight.direction = mat3(viewMatrix)*(inspectionPreviewFromSource*normalize(-inspectionDelta));
              directLight.color = inspectionBarnColor*(PI*inspectionAttenuation);
              directLight.visible = true;
              float inspectionOriginalRoughness = material.roughness;
              material.roughness = max(material.roughness,0.04);
              RE_Direct(directLight,geometryPosition,geometryNormal,geometryViewDir,geometryClearcoatNormal,material,reflectedLight);
              material.roughness = inspectionOriginalRoughness;
            }
          }
        }
        // Source's diffuse has no Lambert1/pi; its GGX distribution already
        // includes1/pi. Sun/barn lights therefore use pi-scaled irradiance for
        // Three's diffuse, while direct specular must undo that scale. IBL is
        // untouched. VRF20.1 common/pbr.slang35-42,193,292-309.
        reflectedLight.directSpecular *= inspectionDirectSpecularScale;
        #include <lights_fragment_end>`,
      );
      // A=0,B=C=.001,D=E=F=1. Cancel the common near-equal term analytically.
      // Keep the map renderer's linear-light calibration; these VPOST curve
      // coefficients and fixed exposure1 are specific to the vanity scene.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <tonemapping_fragment>",
        `#ifdef TONE_MAPPING
          const float inspectionWhitePoint = exp2(1.4985569715499878);
          vec3 inspectionExposed = min(max(gl_FragColor.rgb, vec3(0.0))*2.8, vec3(inspectionWhitePoint));
          gl_FragColor.rgb = inspectionExposed*(1.0+0.001*inspectionWhitePoint)/(inspectionWhitePoint*(vec3(1.0)+0.001*inspectionExposed));
        #endif`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <colorspace_fragment>",
        `#include <colorspace_fragment>
        if (inspectionColorCorrectionReady > 0.5) {
          vec3 inspectionLutUv = clamp(gl_FragColor.rgb, 0.0, 1.0)*(31.0/32.0)+(0.5/32.0);
          gl_FragColor.rgb = texture(inspectionColorCorrection, inspectionLutUv).rgb;
        }`,
      );
    };
    material.customProgramCacheKey = () => `${priorKey}:source2-dust2-inspection-v2`;
    material.needsUpdate = true;
  }

  private object = (object: T.Object3D) => {
    if (!(object instanceof T.Mesh)) return;
    if (Array.isArray(object.material))
      for (const material of object.material) this.material(material);
    else this.material(object.material);
  };

  update(root: T.Object3D, environment?: T.Texture | null, renderer?: T.WebGLRenderer) {
    if (renderer) prepareNativeEnvironment(renderer);
    this.scene.environment = nativeEnvironment?.texture ?? environment ?? null;
    this.sourceScale.value = this.itemScale / (Math.max(root.scale.x, 0.0001) * 0.0254);
    const version = root.userData.skinVisualVersion ?? 0;
    const previous = this.versions.get(root);
    if (previous && previous.version === version && previous.children === root.children.length)
      return;
    // Legacy finish bodies publish a visual version when their async material
    // commit completes. Static inspectors need no repeated material traversal.
    root.traverse(this.object);
    this.versions.set(root, { version, children: root.children.length });
  }
}
