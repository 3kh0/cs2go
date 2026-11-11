import * as T from "three";
const FIRE_SWAY = 0.075;
const BLAST_INITIAL_SIZE = 0.25;
const BLAST_GROWTH = 2.4;
const FLOAT32_PADDING = 16 * 2 ** -23;
/** Bounded procedural flame/dust billboards. Source2 particle graphs are not executed. */
export class UtilityVisual {
  readonly mesh: T.InstancedMesh;
  private geometry = new T.PlaneGeometry(1, 1);
  private material: T.ShaderMaterial;
  private bounds = new T.Sphere();
  private blastCenterRadius: number | undefined;
  private coordinateMagnitude = 1;
  constructor(kind: "fire" | "blast" | "flash", positions: T.Vector3[]) {
    const fire = kind === "fire",
      count = fire ? positions.length * 3 : 12;
    this.material = new T.ShaderMaterial({
      uniforms: { time: { value: 0 }, fade: { value: 1 } },
      transparent: true,
      depthWrite: false,
      side: T.DoubleSide,
      forceSinglePass: true,
      blending: T.NormalBlending,
      vertexShader: `uniform float time; varying vec2 vUv; varying float vPhase;
        void main(){vUv=uv;vPhase=instanceMatrix[3].x*17.13+instanceMatrix[3].z*9.7;
        vec3 p=position;
        ${
          fire
            ? `p.y+=0.5; p.x+=sin(time*7.0+vPhase+p.y*5.0)*p.y*${FIRE_SWAY};
          vec4 center=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);
          center.xy+=p.xy*vec2(length(instanceMatrix[0].xyz),length(instanceMatrix[1].xyz));
          gl_Position=projectionMatrix*center;`
            : `vec4 center=modelViewMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0);
          center.xy+=position.xy*(${BLAST_INITIAL_SIZE}+time*${BLAST_GROWTH});gl_Position=projectionMatrix*center;`
        }}
      `,
      fragmentShader: `uniform float time;uniform float fade;varying vec2 vUv;varying float vPhase;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        void main(){
        ${
          fire
            ? `float y=vUv.y;float n=noise(vec2(vUv.x*6.0+vPhase,y*7.0-time*3.5))*0.65+noise(vec2(vUv.x*13.0+vPhase,y*15.0-time*5.0))*0.35;
          float width=(1.0-y)*(0.25+0.2*n);float edge=abs(vUv.x-0.5+sin(y*9.0-time*6.0+vPhase)*y*0.08);
          float alpha=(1.0-smoothstep(width*0.35,width+0.035,edge))*(1.0-smoothstep(0.6,1.0,y+n*0.25))*fade*smoothstep(0.0,0.05,y);
          vec3 color=mix(vec3(1.0,0.16,0.015),vec3(1.0,0.92,0.4),clamp((1.0-y)*0.75+n*0.35,0.0,1.0));
          gl_FragColor=vec4(color,alpha*0.72);`
            : `float d=length((vUv-0.5)*2.0);float n=noise(vUv*8.0+vPhase+time*0.7);
          float alpha=(1.0-smoothstep(0.25,1.0,d+n*0.15))*fade*0.28;
          float flash=exp(-time*28.0);
          gl_FragColor=vec4(${kind === "flash" ? "vec3(1.0)" : "mix(vec3(0.22,0.18,0.13),vec3(1.0,0.82,0.46),flash)"},alpha);`
        }
        #include <colorspace_fragment>
        }`,
    });
    this.mesh = new T.InstancedMesh(this.geometry, this.material, count);
    const matrix = new T.Matrix4();
    if (fire)
      positions.forEach((p, i) => {
        for (let side = 0; side < 3; side++) {
          matrix.makeRotationY((side * Math.PI) / 3);
          matrix.scale(new T.Vector3(1.4, 0.65 + 0.25 * Math.sin(i * 17 + side * 3), 1));
          matrix.setPosition(
            p.x + Math.sin(side * 2.094) * 0.18,
            p.y - 0.16,
            p.z + Math.cos(side * 2.094) * 0.18,
          );
          this.mesh.setMatrixAt(i * 3 + side, matrix);
        }
      });
    else
      for (let i = 0; i < count; i++) {
        matrix.makeTranslation(
          positions[0].x + Math.sin(i * 2.4) * i * 0.07,
          positions[0].y + 0.04 * i,
          positions[0].z + Math.cos(i * 2.4) * i * 0.07,
        );
        this.mesh.setMatrixAt(i, matrix);
      }

    // The shader ignores instance rotation and expands vertices in camera space.
    // Three's ordinary plane bounds therefore miss both billboard orientations
    // and the animated displacement. Bound the uploaded float32 centers, then
    // add an orientation-independent radius for every possible shader vertex.
    // Effect meshes and their parents must retain unit scale: billboard offsets
    // are in view-space units and deliberately ignore the model's scale.
    const centers = new T.Box3();
    const center = new T.Vector3();
    for (let i = 0; i < count; i++) {
      this.mesh.getMatrixAt(i, matrix);
      centers.expandByPoint(center.setFromMatrixPosition(matrix));
      this.coordinateMagnitude = Math.max(
        this.coordinateMagnitude,
        Math.abs(center.x),
        Math.abs(center.y),
        Math.abs(center.z),
      );
    }
    centers.getCenter(this.bounds.center);
    let centerRadius = 0;
    for (let i = 0; i < count; i++) {
      this.mesh.getMatrixAt(i, matrix);
      const distance = center.setFromMatrixPosition(matrix).distanceTo(this.bounds.center);
      centerRadius = Math.max(centerRadius, distance);
      // Plane y is shifted to [0,1], making |x| <= 0.5 + FIRE_SWAY.
      // Column lengths match the shader's per-instance width/height scaling.
      const extent = fire
        ? Math.hypot(
            (0.5 + FIRE_SWAY) * center.setFromMatrixColumn(matrix, 0).length(),
            center.setFromMatrixColumn(matrix, 1).length(),
          )
        : Math.SQRT1_2 * BLAST_INITIAL_SIZE;
      this.bounds.radius = Math.max(this.bounds.radius, distance + extent);
    }
    if (!fire) this.blastCenterRadius = centerRadius;
    this.bounds.radius = this.paddedRadius(this.bounds.radius);
    this.mesh.boundingSphere = this.bounds;
  }
  private paddedRadius(radius: number) {
    // Cover float32 shader matrix products/additions versus CPU double bounds,
    // including cancellation near frustum edges, plus a small absolute margin.
    return radius + FLOAT32_PADDING * Math.max(this.coordinateMagnitude, radius) + 0.0001;
  }
  update(age: number, fade: number) {
    this.material.uniforms.time.value = age;
    this.material.uniforms.fade.value = fade;
    if (this.blastCenterRadius !== undefined) {
      // Follow the actual shader time, including an overshooting final frame;
      // this remains conservative if gameplay effect lifetimes change.
      this.bounds.radius = this.paddedRadius(
        this.blastCenterRadius + Math.SQRT1_2 * Math.abs(BLAST_INITIAL_SIZE + age * BLAST_GROWTH),
      );
    }
  }
  dispose() {
    this.mesh.dispose();
    this.material.dispose();
    this.geometry.dispose();
  }
}
