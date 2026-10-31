import * as T from "three";

export const SMOKE_CELL_RADIUS = 1.05;
const RECOVERY = 0.35;
/** Bound overlapping fragment work while retaining the analytic ray length. */
export function smokeSampleBudget(clouds: number, lowQuality: boolean) {
  return clouds > 8 ? 1 : clouds > 4 || lowQuality ? 2 : 4;
}
/** Optical density shared by the renderer and bot sight queries. */
export function smokeCellDensity(clock: number, holeUntil: number, cleared: number) {
  const bullet = holeUntil > 0 ? T.MathUtils.clamp((clock - holeUntil) / RECOVERY, 0, 1) : 1;
  const blast = cleared > -RECOVERY ? T.MathUtils.clamp(-cleared / RECOVERY, 0, 1) : 1;
  return Math.min(bullet, blast);
}

/** Up to four bounded density samples per fragment; one instanced draw per cloud.
 * Authored browser approximation, not Source 2 voxel simulation. Front faces
 * bound outside rays; back faces cover the camera inside a cell,
 * so crossing into smoke does not expose a hollow shell.
 */
export class SmokeRenderer {
  readonly material: T.ShaderMaterial;
  readonly batch: T.InstancedMesh;
  readonly densities: T.InstancedBufferAttribute;
  readonly geometry: T.BufferGeometry;
  constructor(cells: T.Vector3[], geometry: T.BufferGeometry) {
    // Attributes belong to the effect, never mutate/dispose the shared sphere.
    this.geometry = geometry.clone();
    this.densities = new T.InstancedBufferAttribute(new Float32Array(cells.length).fill(1), 1);
    this.densities.setUsage(T.DynamicDrawUsage);
    this.geometry.setAttribute("smokeDensity", this.densities);
    this.material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      forceSinglePass: true,
      side: T.DoubleSide,
      uniforms: {
        age: { value: 0 },
        samples: { value: 4 },
        useDepth: { value: false },
        sceneDepth: { value: null },
        resolution: { value: new T.Vector2(1, 1) },
        viewportOrigin: { value: new T.Vector2() },
        inverseProjection: { value: new T.Matrix4() },
        fade: { value: 0 },
        groundHeight: { value: cells.length ? Math.min(...cells.map((cell) => cell.y)) - 0.3 : 0 },
      },
      vertexShader: `
        attribute float smokeDensity;
        varying vec3 worldExit;
        varying vec3 center;
        varying float density;
        void main() {
          vec4 world = modelMatrix * instanceMatrix * vec4(position, 1.0);
          worldExit = world.xyz;
          center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          density = smokeDensity;
          gl_Position = projectionMatrix * viewMatrix * world;
        }
      `,
      fragmentShader: `
        uniform float age;
        uniform float samples;
        uniform float fade;
        uniform float groundHeight;
        uniform bool useDepth;
        uniform sampler2D sceneDepth;
        uniform vec2 resolution;
        uniform vec2 viewportOrigin;
        uniform mat4 inverseProjection;
        varying vec3 worldExit;
        varying vec3 center;
        varying float density;
        float hash(vec3 p) {
          p = fract(p * 0.1031);
          p += dot(p, p.yzx + 33.33);
          return fract((p.x + p.y) * p.z);
        }
        float noise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                         mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                     mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                         mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
        }
        void main() {
          if (density * fade < 0.001) discard;
          vec3 ray = normalize(worldExit - cameraPosition);
          vec3 offset = cameraPosition - center;
          bool inside = dot(offset, offset) < 1.1025;
          if (gl_FrontFacing == inside) discard;
          float b = dot(offset, ray);
          float discriminant = b*b - dot(offset, offset) + 1.1025;
          if (discriminant <= 0.0) discard;
          float root = sqrt(discriminant);
          float enter = max(0.0, -b-root);
          float leave = -b+root;
          if (useDepth) {
            vec2 uv = (gl_FragCoord.xy - viewportOrigin) / resolution;
            float depth = texture2D(sceneDepth, uv).x;
            vec4 viewPoint = inverseProjection * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
            leave = min(leave, length(viewPoint.xyz / viewPoint.w));
          } else if (ray.y < -0.0001) leave = min(leave, (groundHeight-cameraPosition.y)/ray.y);
          if (leave <= enter) discard;
          float stride = max(0.0, leave-enter) / samples;
          float optical = 0.0;
          float illumination = 0.0;
          for (int i=0; i<4; i++) {
            if (float(i) >= samples) break;
            vec3 p = cameraPosition + ray * (enter + (float(i)+0.5)*stride);
            vec3 local = p-center;
            float edge = 1.0-smoothstep(0.45, 1.05, length(local));
            float turbulent = noise(p*2.7 + vec3(age*0.075, -age*0.12, age*0.04));
            float d = edge * (0.45 + turbulent*0.85);
            optical += d * stride;
            illumination += d * stride * (0.70 + local.y*0.15 + turbulent*0.20);
          }
          float alpha = 1.0-exp(-optical*density*fade*2.7);
          vec3 tint = vec3(0.57, 0.59, 0.57) * (illumination/max(optical, 0.001));
          gl_FragColor = vec4(tint, alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    this.batch = new T.InstancedMesh(this.geometry, this.material, cells.length);
    const matrix = new T.Matrix4();
    cells.forEach((cell, i) => {
      matrix.makeScale(SMOKE_CELL_RADIUS, SMOKE_CELL_RADIUS, SMOKE_CELL_RADIUS).setPosition(cell);
      this.batch.setMatrixAt(i, matrix);
    });
    this.batch.computeBoundingSphere();
  }
  update(age: number, fade: number, clock: number, holes: number[], cleared: number, samples = 4) {
    this.material.uniforms.age.value = age;
    this.material.uniforms.samples.value = samples;
    this.material.uniforms.fade.value = fade;
    let changed = false;
    for (let i = 0; i < this.densities.count; i++) {
      const density = smokeCellDensity(clock, holes[i] ?? 0, cleared);
      if (Math.abs(this.densities.getX(i) - density) > 0.0001) {
        this.densities.setX(i, density);
        changed = true;
      }
    }
    if (changed) this.densities.needsUpdate = true;
    this.batch.visible = fade > 0 && cleared <= 0;
  }
  useSceneDepth(
    texture: T.DepthTexture,
    size: T.Vector2,
    inverseProjection: T.Matrix4,
    viewport: T.Vector4,
  ) {
    this.material.uniforms.useDepth.value = true;
    this.material.uniforms.sceneDepth.value = texture;
    this.material.uniforms.resolution.value.copy(size);
    this.material.uniforms.viewportOrigin.value.set(viewport.x, viewport.y);
    this.material.uniforms.inverseProjection.value.copy(inverseProjection);
    // Inside a cell its visible back face may lie behind cover; the sampled
    // scene depth clips the ray correctly instead of rejecting all its fog.
    this.material.depthTest = false;
  }
  clearSceneDepth() {
    this.material.uniforms.useDepth.value = false;
    this.material.uniforms.sceneDepth.value = null;
    this.material.depthTest = true;
  }
  dispose() {
    this.geometry.dispose();
    this.material.dispose();
    this.batch.dispose();
  }
}

/** Scene depth is rendered with cached unlit material variants, preserving the
 * world's original display transform, cutout textures and animated geometry.
 */
export class SmokeComposite {
  target?: T.WebGLRenderTarget;
  private size = new T.Vector2();
  private viewportSize = new T.Vector2();
  private viewport = new T.Vector4();
  private logicalViewport = new T.Vector4();
  private depthCamera = new T.PerspectiveCamera();
  private bounds = new T.Sphere();
  private cameraPosition = new T.Vector3();
  private variants = new WeakMap<T.Material, T.MeshDepthMaterial>();
  private arrays = new WeakMap<T.Material[], T.Material[]>();
  private objects: T.Mesh[] = [];
  private originals: (T.Material | T.Material[])[] = [];
  private depthVariant(source: T.Material) {
    let depth = this.variants.get(source);
    if (!depth) {
      depth = new T.MeshDepthMaterial({ colorWrite: false });
      this.variants.set(source, depth);
      source.addEventListener("dispose", () => depth!.dispose());
    }
    const mapped = source as T.MeshStandardMaterial;
    const cutout = source.alphaTest > 0 || source.alphaHash;
    const map = cutout ? (mapped.map ?? null) : null,
      alphaMap = cutout ? (mapped.alphaMap ?? null) : null;
    if (
      !!depth.map !== !!map ||
      !!depth.alphaMap !== !!alphaMap ||
      depth.alphaTest !== source.alphaTest
    )
      depth.needsUpdate = true;
    depth.map = map;
    depth.alphaMap = alphaMap;
    depth.alphaTest = source.alphaTest;
    depth.opacity = source.opacity;
    depth.alphaHash = source.alphaHash;
    depth.side = source.side;
    depth.visible = source.visible && source.depthWrite;
    depth.displacementMap = mapped.displacementMap ?? null;
    depth.displacementScale = mapped.displacementScale ?? 1;
    depth.displacementBias = mapped.displacementBias ?? 0;
    depth.clippingPlanes = source.clippingPlanes;
    depth.clipIntersection = source.clipIntersection;
    depth.polygonOffset = source.polygonOffset;
    depth.polygonOffsetFactor = source.polygonOffsetFactor;
    depth.polygonOffsetUnits = source.polygonOffsetUnits;
    return depth;
  }
  private replaceMaterial = (object: T.Object3D) => {
    if (!(object instanceof T.Mesh) || object.layers.isEnabled(31)) return;
    this.objects.push(object);
    this.originals.push(object.material);
    if (Array.isArray(object.material)) {
      let depth = this.arrays.get(object.material);
      if (!depth) {
        depth = [];
        this.arrays.set(object.material, depth);
      }
      for (let i = 0; i < object.material.length; i++)
        depth[i] = this.depthVariant(object.material[i]);
      object.material = depth;
    } else object.material = this.depthVariant(object.material);
  };
  render(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
    camera: T.PerspectiveCamera,
    clouds: readonly SmokeRenderer[],
    lowQuality = false,
  ) {
    if (!clouds.length) {
      this.target?.dispose();
      this.target = undefined;
      renderer.render(scene, camera);
      return;
    }
    const destination = renderer.getRenderTarget();
    if (destination) this.viewportSize.set(destination.width, destination.height);
    else renderer.getDrawingBufferSize(this.viewportSize);
    this.size
      .copy(this.viewportSize)
      .multiplyScalar(lowQuality ? 0.5 : 1)
      .ceil();
    renderer.getViewport(this.logicalViewport);
    renderer.getCurrentViewport(this.viewport);
    this.viewportSize.set(this.viewport.z, this.viewport.w);
    if (!this.target) {
      this.target = new T.WebGLRenderTarget(this.size.x, this.size.y, {
        format: T.RedFormat,
        minFilter: T.NearestFilter,
        magFilter: T.NearestFilter,
        depthTexture: new T.DepthTexture(this.size.x, this.size.y, T.UnsignedIntType),
      });
    } else if (this.target.width !== this.size.x || this.target.height !== this.size.y) {
      this.target.setSize(this.size.x, this.size.y);
    }
    const background = scene.background;
    const mask = camera.layers.mask;
    const shadowUpdate = renderer.shadowMap.autoUpdate;
    let shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try {
      for (const cloud of clouds) cloud.batch.layers.set(31);
      camera.layers.mask = mask & ~(1 << 31);
      scene.background = null;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      camera.updateWorldMatrix(true, false);
      this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
      let smokeFar = camera.near + 0.01;
      for (const cloud of clouds) {
        cloud.batch.updateWorldMatrix(true, false);
        this.bounds.copy(cloud.batch.boundingSphere!).applyMatrix4(cloud.batch.matrixWorld);
        smokeFar = Math.max(
          smokeFar,
          this.cameraPosition.distanceTo(this.bounds.center) + this.bounds.radius,
        );
      }
      this.depthCamera.copy(camera, false);
      this.depthCamera.matrixWorldAutoUpdate = false;
      this.depthCamera.far = Math.min(camera.far, smokeFar);
      this.depthCamera.updateProjectionMatrix();
      scene.traverseVisible(this.replaceMaterial);
      renderer.setRenderTarget(this.target);
      renderer.clear();
      renderer.render(scene, this.depthCamera);
      for (let i = 0; i < this.objects.length; i++) this.objects[i].material = this.originals[i];
      this.objects.length = this.originals.length = 0;
      scene.background = background;
      renderer.shadowMap.autoUpdate = shadowUpdate;
      renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
      renderer.setRenderTarget(destination);
      if (!destination) renderer.setViewport(this.logicalViewport);
      renderer.clear();
      renderer.render(scene, camera);
      shadowNeedsUpdate = renderer.shadowMap.needsUpdate;
      for (const cloud of clouds)
        cloud.useSceneDepth(
          this.target.depthTexture!,
          this.viewportSize,
          this.depthCamera.projectionMatrixInverse,
          this.viewport,
        );
      camera.layers.set(31);
      scene.background = null;
      renderer.shadowMap.autoUpdate = false;
      renderer.shadowMap.needsUpdate = false;
      renderer.render(scene, camera);
    } finally {
      for (let i = 0; i < this.objects.length; i++) this.objects[i].material = this.originals[i];
      this.objects.length = this.originals.length = 0;
      camera.layers.mask = mask;
      scene.background = background;
      renderer.shadowMap.autoUpdate = shadowUpdate;
      renderer.autoClear = autoClear;
      renderer.shadowMap.needsUpdate = shadowNeedsUpdate;
      renderer.setRenderTarget(destination);
      if (!destination) renderer.setViewport(this.logicalViewport);
      for (const cloud of clouds) {
        cloud.batch.layers.set(0);
        cloud.clearSceneDepth();
      }
    }
  }
}
