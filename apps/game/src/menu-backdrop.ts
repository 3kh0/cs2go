import * as T from "three";

type BackdropPostProcessing = {
  texture: { value: T.Data3DTexture | null };
  ready: { value: number };
};
type BackdropOptions = {
  width: number;
  height: number;
  depthOfField: { near: number; far: number; crisp: number; blur: number };
  postProcessing: BackdropPostProcessing;
};

/** Native inspection distances are inches; the shared world uses metres. */
export function inspectionBackdropOptions(postProcessing: BackdropPostProcessing): BackdropOptions {
  return {
    width: 960,
    height: 540,
    depthOfField: {
      near: 4 * 0.0254,
      far: 10000 * 0.0254,
      crisp: 150 * 0.0254,
      blur: 200 * 0.0254,
    },
    postProcessing,
  };
}

/** Capture the menu scene once per opening; blur it without blurring foreground agents. */
export class MenuBackdrop {
  private target = new T.WebGLRenderTarget(320, 180, { depthBuffer: true });
  private scene = new T.Scene();
  private blurred = new T.WebGLRenderTarget(320, 180, { depthBuffer: false });
  private display = new T.ShaderMaterial({
    uniforms: {
      image: { value: this.blurred.texture },
      panel: { value: new T.Vector4() },
      tint: { value: new T.Color() },
      teamGradient: { value: new T.Vector2() },
    },
    vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `uniform sampler2D image; uniform vec4 panel; uniform vec3 tint; uniform vec2 teamGradient; varying vec2 vUv;
      void main(){
        vec3 color = texture2D(image, vUv).rgb;
        if(vUv.x >= panel.x && vUv.x <= panel.z && vUv.y >= panel.y && vUv.y <= panel.w) {
          float x = (vUv.x - panel.x) / max(panel.z - panel.x, .0001);
          // Native loadout_grid fades only the outer quarter of each team pane.
          float edge = mix(x, 1. - x, teamGradient.x);
          color = mix(color, tint, teamGradient.y * clamp(edge * 4., 0., 1.));
        }
        gl_FragColor = vec4(color, 1.);
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  private camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material = new T.ShaderMaterial({
    uniforms: { image: { value: this.target.texture } },
    vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `uniform sampler2D image; varying vec2 vUv;
      void main(){ vec3 color=vec3(0.); float weight=0.;
        for(int x=-3;x<=3;x++) for(int y=-3;y<=3;y++){
          float w=exp(-float(x*x+y*y)/5.);
          color+=texture2D(image, vUv+vec2(float(x)/320.,float(y)/180.)).rgb*w; weight+=w;
        }
        gl_FragColor=vec4(color/weight*.65,1.);
      }`,
    depthTest: false,
    depthWrite: false,
  });
  private geometry = new T.PlaneGeometry(2, 2);
  private captured = false;
  private quad = new T.Mesh<T.PlaneGeometry, T.Material>(this.geometry, this.material);
  constructor(options?: BackdropOptions) {
    if (options) {
      this.target.setSize(options.width, options.height);
      this.target.texture.type = T.HalfFloatType;
      this.target.depthTexture = new T.DepthTexture(
        options.width,
        options.height,
        T.UnsignedIntType,
      );
      this.blurred.setSize(options.width, options.height);
      this.blurred.texture.type = T.HalfFloatType;
      Object.assign(this.material.uniforms, {
        sceneDepth: { value: this.target.depthTexture },
        resolution: { value: new T.Vector2(options.width, options.height) },
        depthRange: {
          value: new T.Vector4(
            options.depthOfField.near,
            options.depthOfField.far,
            options.depthOfField.crisp,
            options.depthOfField.blur,
          ),
        },
        inspectionLut: options.postProcessing.texture,
        inspectionLutReady: options.postProcessing.ready,
      });
      // Gaussian reconstruction approximates Source's DOF filter. The camera,
      // near/far planes and far-crisp/far-blur distances are native scene values.
      this.material.fragmentShader = `uniform sampler2D image, sceneDepth;
uniform vec2 resolution; uniform vec4 depthRange;
uniform highp sampler3D inspectionLut; uniform float inspectionLutReady;
varying vec2 vUv;
void main() {
  float depth = texture2D(sceneDepth,vUv).r;
  float distance = depthRange.x*depthRange.y/(depthRange.y-depth*(depthRange.y-depthRange.x));
  float amount = smoothstep(depthRange.z,depthRange.w,distance);
  vec3 blurredColor=vec3(0.0); float weight=0.0;
  for(int x=-3;x<=3;x++) for(int y=-3;y<=3;y++) {
    float w=exp(-float(x*x+y*y)/5.0);
    blurredColor+=texture2D(image,vUv+vec2(float(x),float(y))/resolution).rgb*w;
    weight+=w;
  }
  vec3 color = mix(texture2D(image,vUv).rgb,blurredColor/weight,amount);
  const float whitePoint=exp2(1.4985569715499878);
  vec3 exposed=min(max(color,vec3(0.0))*2.8,vec3(whitePoint));
  color=exposed*(1.0+0.001*whitePoint)/(whitePoint*(vec3(1.0)+0.001*exposed));
  vec3 encoded=mix(color*12.92,1.055*pow(max(color,vec3(0.0)),vec3(1.0/2.4))-0.055,step(vec3(0.0031308),color));
  if(inspectionLutReady>0.5) encoded=texture(inspectionLut,clamp(encoded,0.0,1.0)*(31.0/32.0)+(0.5/32.0)).rgb;
  vec3 linearColor=mix(encoded/12.92,pow((encoded+0.055)/1.055,vec3(2.4)),step(vec3(0.04045),encoded));
  gl_FragColor=vec4(linearColor,1.0);
}`;
      this.material.toneMapped = false;
    }
    this.scene.add(this.quad);
  }
  invalidate() {
    this.captured = false;
    this.quad.material = this.material;
  }
  async prepare(renderer: T.WebGLRenderer, background: T.Scene, camera: T.Camera) {
    const target = renderer.getRenderTarget();
    let programs: Promise<unknown>[];
    try {
      renderer.setRenderTarget(this.target);
      const backgroundPrograms = renderer.compileAsync(background, camera);
      const blurPrograms = renderer.compileAsync(this.scene, this.camera);
      renderer.setRenderTarget(target);
      this.quad.material = this.display;
      programs = [backgroundPrograms, blurPrograms, renderer.compileAsync(this.scene, this.camera)];
    } finally {
      this.quad.material = this.material;
      renderer.setRenderTarget(target);
    }
    await Promise.all(programs);
  }
  render(renderer: T.WebGLRenderer, capture: () => void, team: "ct" | "t", panel?: DOMRect) {
    if (!this.captured) {
      const previous = renderer.getRenderTarget();
      const toneMapping = renderer.toneMapping;
      try {
        renderer.setRenderTarget(this.target);
        capture();
        renderer.toneMapping = toneMapping;
        renderer.setRenderTarget(this.blurred);
        renderer.clear();
        renderer.render(this.scene, this.camera);
        this.quad.material = this.display;
        this.captured = true;
      } finally {
        renderer.setRenderTarget(previous);
        renderer.toneMapping = toneMapping;
      }
    }
    if (panel)
      this.display.uniforms.panel.value.set(
        panel.left / innerWidth,
        1 - panel.bottom / innerHeight,
        panel.right / innerWidth,
        1 - panel.top / innerHeight,
      );
    this.display.uniforms.tint.value.set(team === "ct" ? 0x1d5687 : 0x645106);
    this.display.uniforms.teamGradient.value.set(
      team === "ct" ? 0 : 1,
      team === "ct" ? 0.422 : 0.5,
    );
    renderer.clear();
    renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.target.dispose();
    this.blurred.dispose();
    this.display.dispose();
    this.geometry.dispose();
    this.material.dispose();
  }
}
