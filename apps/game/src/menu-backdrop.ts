import * as T from "three";

/** Capture the menu scene once per opening; blur it without blurring foreground agents. */
export class MenuBackdrop {
  private target = new T.WebGLRenderTarget(320, 180, { depthBuffer: true });
  private scene = new T.Scene();
  private blurred = new T.WebGLRenderTarget(320, 180, { depthBuffer: false });
  private display = new T.MeshBasicMaterial({
    map: this.blurred.texture,
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
  render(renderer: T.WebGLRenderer, capture: () => void) {
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
