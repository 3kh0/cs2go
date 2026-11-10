import * as T from "three";
import { withoutSourceColorCorrection } from "./map-color";
import { withoutNativeMapGrade, type NativeMapGrade } from "./native-map-color";

/** Native surface/blend operations precede VPOST. FP16 storage and the chosen
 * MSAA count are a bounded browser reconstruction, not observed engine format.
 * Bloom/eye adaptation remain separate; this pass changes composition order. */
export class NativeWorldFrameComposite {
  readonly target: T.WebGLRenderTarget;
  private readonly material: T.ShaderMaterial;
  private readonly geometry = new T.BufferGeometry();
  private readonly scene = new T.Scene();
  private readonly camera = new T.Camera();
  private disposed = false;

  constructor(renderer: T.WebGLRenderer, grade: NativeMapGrade, samples = 0) {
    if (!renderer.extensions.has("EXT_color_buffer_float"))
      throw new Error("Native HDR world composition requires EXT_color_buffer_float");
    if (!Number.isInteger(samples) || samples < 0)
      throw new Error("Invalid native world MSAA sample count");
    const gl = renderer.getContext() as WebGL2RenderingContext,
      supportedSamples = gl.getInternalformatParameter(
        gl.RENDERBUFFER,
        gl.RGBA16F,
        gl.SAMPLES,
      ) as Int32Array;
    const selectedSamples = Math.max(
      0,
      ...Array.from(supportedSamples).filter(
        (value) => value <= samples && value <= renderer.capabilities.maxSamples,
      ),
    );
    this.target = new T.WebGLRenderTarget(1, 1, {
      type: T.HalfFloatType,
      format: T.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
      samples: selectedSamples,
      minFilter: T.NearestFilter,
      magFilter: T.NearestFilter,
      generateMipmaps: false,
    });
    this.target.texture.colorSpace = T.LinearSRGBColorSpace;
    const p = grade.parameters;
    this.material = new T.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      blending: T.NoBlending,
      toneMapped: false,
      uniforms: {
        frame: { value: this.target.texture },
        lut: { value: grade.texture },
        frameUv: { value: new T.Vector4(0, 0, 1, 1) },
        abcd: {
          value: new T.Vector4(
            p.m_flShoulderStrength,
            p.m_flLinearStrength,
            p.m_flLinearAngle,
            p.m_flToeStrength,
          ),
        },
        efWhiteBias: {
          value: new T.Vector4(p.m_flToeNum, p.m_flToeDenom, p.m_flWhitePoint, p.m_flExposureBias),
        },
        exposure: { value: grade.exposure },
        toneExposure: { value: 1 },
      },
      vertexShader:
        "varying vec2 frameCoord;void main(){frameCoord=position.xy*.5+.5;gl_Position=vec4(position,1.0);}",
      // Same native parameterization and precision-preserving cancellation as
      // applyNativeMapGrade; output encoding precedes the authored display LUT.
      fragmentShader: `uniform sampler2D frame;uniform highp sampler3D lut;
uniform vec4 frameUv,abcd,efWhiteBias;uniform float exposure,toneExposure;varying vec2 frameCoord;
vec3 filmic(vec3 x){float A=abcd.x,B=abcd.y,C=abcd.z,D=abcd.w,E=efWhiteBias.x,F=efWhiteBias.y;return (A*(F-E)*x+B*(C*F-E))*x/(F*(A*x*x+B*x+D*F));}
void main(){vec4 hdr=texture2D(frame,frameUv.xy+frameCoord*frameUv.zw);
float white=efWhiteBias.z*2.8;
vec3 exposed=min(max(hdr.rgb,vec3(0))*toneExposure*exposure*exp2(efWhiteBias.w)*2.8,vec3(white));
vec3 display=sRGBTransferOETF(vec4(filmic(exposed)/filmic(vec3(white)),hdr.a)).rgb;
gl_FragColor=vec4(texture(lut,clamp(display,0.0,1.0)*(31.0/32.0)+vec3(.5/32.0)).rgb,hdr.a);}`,
    });
    this.geometry.setAttribute(
      "position",
      new T.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
    );
    const triangle = new T.Mesh(this.geometry, this.material);
    triangle.frustumCulled = false;
    this.scene.add(triangle);
  }

  /** draw includes world, transparent effects and viewmodel, before DOM HUD.
   * It must render to the current target; nested offscreen passes restore it. */
  render(renderer: T.WebGLRenderer, draw: () => void) {
    this.frame(renderer, draw, true);
  }
  /** Initiate synchronous world/viewmodel compile calls under the exact HDR
   * render state. Await compileAsync promises outside this scope if needed. */
  prepare(renderer: T.WebGLRenderer, compile: () => void) {
    this.frame(renderer, compile, false);
  }
  private frame(renderer: T.WebGLRenderer, draw: () => void, present: boolean) {
    if (this.disposed) throw new Error("Native world composite is disposed");
    if (renderer.getRenderTarget() === this.target)
      throw new Error("Native world composite cannot sample its own destination");
    const destination = renderer.getRenderTarget(),
      face = renderer.getActiveCubeFace(),
      mip = renderer.getActiveMipmapLevel();
    const viewport = renderer.getViewport(new T.Vector4()),
      current = renderer.getCurrentViewport(new T.Vector4()),
      scissor = renderer.getScissor(new T.Vector4()),
      scissorTest = renderer.getScissorTest(),
      clear = renderer.getClearColor(new T.Color()),
      alpha = renderer.getClearAlpha(),
      autoClear = renderer.autoClear,
      toneMapping = renderer.toneMapping,
      autoClearColor = renderer.autoClearColor,
      autoClearDepth = renderer.autoClearDepth,
      autoClearStencil = renderer.autoClearStencil,
      toneExposure = renderer.toneMappingExposure,
      outputColorSpace = renderer.outputColorSpace,
      shadowAuto = renderer.shadowMap.autoUpdate,
      shadowNeeds = renderer.shadowMap.needsUpdate;
    const size = destination
      ? new T.Vector2(destination.width, destination.height)
      : renderer.getDrawingBufferSize(new T.Vector2());
    if (this.target.width !== size.x || this.target.height !== size.y)
      this.target.setSize(size.x, size.y);
    const ratio = destination ? 1 : renderer.getPixelRatio();
    // Three exposes its logical scissor but no current target scissor getter.
    // Only nested target callers need the two cached GL-state queries.
    const physicalScissor = destination
        ? new T.Vector4().fromArray(
            renderer.getContext().getParameter(renderer.getContext().SCISSOR_BOX),
          )
        : scissor.clone().multiplyScalar(ratio),
      physicalScissorTest = destination
        ? renderer.getContext().isEnabled(renderer.getContext().SCISSOR_TEST)
        : scissorTest;
    const restoreDestination = () => {
      renderer.setRenderTarget(destination, face, mip);
      renderer.setViewport(viewport);
      renderer.setScissor(scissor);
      renderer.setScissorTest(scissorTest);
      if (destination) {
        const targetViewport = destination.viewport.clone(),
          targetScissor = destination.scissor.clone(),
          targetTest = destination.scissorTest;
        destination.viewport.copy(current);
        destination.scissor.copy(physicalScissor);
        destination.scissorTest = physicalScissorTest;
        renderer.setRenderTarget(destination, face, mip);
        destination.viewport.copy(targetViewport);
        destination.scissor.copy(targetScissor);
        destination.scissorTest = targetTest;
      }
    };
    this.target.viewport.copy(current);
    this.target.scissor.copy(physicalScissor);
    this.target.scissorTest = physicalScissorTest;
    let completed = false,
      postWorldShadowNeeds = shadowNeeds;
    try {
      renderer.setRenderTarget(this.target);
      renderer.setViewport(current);
      renderer.setScissor(physicalScissor);
      renderer.setScissorTest(physicalScissorTest);
      renderer.toneMapping = T.NoToneMapping;
      if (present) renderer.clear();
      withoutSourceColorCorrection(() => withoutNativeMapGrade(draw));
      postWorldShadowNeeds = renderer.shadowMap.needsUpdate;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      this.material.uniforms.frameUv.value.set(
        current.x / size.x,
        current.y / size.y,
        current.z / size.x,
        current.w / size.y,
      );
      this.material.uniforms.toneExposure.value = toneExposure;
      renderer.setRenderTarget(destination, face, mip);
      renderer.setViewport(current.clone().divideScalar(ratio));
      renderer.setScissor(physicalScissor.clone().divideScalar(ratio));
      renderer.setScissorTest(physicalScissorTest);
      renderer.autoClear = false;
      if (present) renderer.render(this.scene, this.camera);
      else renderer.compile(this.scene, this.camera);
      completed = true;
    } finally {
      restoreDestination();
      renderer.setClearColor(clear, alpha);
      renderer.autoClear = autoClear;
      renderer.autoClearColor = autoClearColor;
      renderer.autoClearDepth = autoClearDepth;
      renderer.autoClearStencil = autoClearStencil;
      renderer.toneMapping = toneMapping;
      renderer.toneMappingExposure = toneExposure;
      renderer.outputColorSpace = outputColorSpace;
      renderer.shadowMap.autoUpdate = shadowAuto;
      renderer.shadowMap.needsUpdate = completed && present ? postWorldShadowNeeds : shadowNeeds;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.target.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
