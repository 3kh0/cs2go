import * as T from "three";

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
  constructor() {
    this.scene.add(this.quad);
  }
  render(renderer: T.WebGLRenderer, capture: () => void, team: "ct" | "t", panel?: DOMRect) {
    if (!this.captured) {
      const previous = renderer.getRenderTarget();
      try {
        renderer.setRenderTarget(this.target);
        capture();
        renderer.setRenderTarget(this.blurred);
        renderer.clear();
        renderer.render(this.scene, this.camera);
        this.quad.material = this.display;
        this.captured = true;
      } finally {
        renderer.setRenderTarget(previous);
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
