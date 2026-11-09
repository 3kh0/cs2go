import * as T from "three";
import { assetFetch, assetUrl } from "./asset-url";
import { loadModel } from "./gltf";
import { homeHazeMaterial, type HazeMaterial } from "./home-atmosphere-material";
import { HomeDebris } from "./home-debris";
import { gradeMapColors } from "./map-color";
import type { MapCollision } from "./map-collision";

const directory = "/models/home/atmosphere/";
interface AtmosphereAssets {
  backdrops: { file: string; material: string; tint: number[] }[];
  materials: Record<string, HazeMaterial>;
  textures: Record<string, string>;
  paper: string[];
  paperMaterial: { color: string; normal: string; orm: string };
  dust: {
    texture: string;
    frames: { uvMin: number[]; uvMax: number[]; uncroppedMin: number[]; uncroppedMax: number[] }[];
  };
}

export function atmosphereVertexColors(geometry: T.BufferGeometry) {
  const source = geometry.getAttribute("color");
  if (source?.itemSize === 4) return;
  const count = geometry.getAttribute("position").count;
  const colors = new Float32Array(count * 4).fill(1);
  if (source)
    for (let i = 0; i < count; i++) {
      colors[i * 4] = source.getX(i);
      colors[i * 4 + 1] = source.getY(i);
      colors[i * 4 + 2] = source.getZ(i);
    }
  geometry.setAttribute("color", new T.BufferAttribute(colors, 4));
}

/** Home-only native geometry and mask assets, with bounded wind/dust reconstruction. */
export class HomeAtmosphere {
  readonly root = new T.Group();
  readonly haze = new T.Group();
  readonly paper = new T.Group();
  private clock = { value: 0 };
  private viewport = { value: new T.Vector2() };
  private range = { value: new T.Vector2() };
  private depthTarget = new T.WebGLRenderTarget(1, 1, {
    depthTexture: new T.DepthTexture(1, 1, T.UnsignedIntType),
  });
  private depth = { value: this.depthTarget.depthTexture! };
  private depthMaterial = new T.MeshDepthMaterial({ colorWrite: false });
  private textures = new Map<string, T.Texture>();
  private debris?: HomeDebris;
  private previousCamera = new T.Matrix4();
  private depthReady = false;
  private wasReduced?: boolean;

  constructor() {
    this.root.name = "home-atmosphere";
    this.haze.name = "home-haze";
    this.paper.name = "home-windblown-paper";
    this.root.add(this.haze, this.paper);
  }

  async load(background: T.Object3D, floor: number, collision?: MapCollision) {
    const response = await assetFetch(directory + "source.json");
    if (!response.ok) throw new Error("Home atmosphere assets unavailable");
    const assets = (await response.json()) as AtmosphereAssets;
    const loader = new T.TextureLoader();
    await Promise.all(
      Object.entries(assets.textures).map(async ([key, file]) => {
        const texture = await loader.loadAsync(assetUrl(directory + file));
        texture.colorSpace = T.NoColorSpace;
        texture.wrapS = texture.wrapT = T.RepeatWrapping;
        texture.flipY = false;
        this.textures.set(key, texture);
      }),
    );
    const white = new T.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    white.needsUpdate = true;
    this.textures.set("white", white);
    await Promise.all(
      assets.backdrops.map(async (entry) => {
        const model = await loadModel(directory + entry.file);
        // The importer bakes the native placement into metres/Y-up once.
        model.scene.updateMatrixWorld(true);
        model.scene.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld);
          atmosphereVertexColors(geometry);
          const material = homeHazeMaterial(
            { ...assets.materials[entry.material], tint: entry.tint },
            this.textures,
            this.clock,
            this.depth,
            this.viewport,
            this.range,
          );
          const mesh = new T.Mesh(geometry, material);
          mesh.name = entry.file;
          this.haze.add(mesh);
        });
        // These exports are geometry-only. No source-template resources survive.
        model.scene.traverse((object) => {
          if (!(object instanceof T.Mesh)) return;
          object.geometry.dispose();
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            material.dispose();
        });
      }),
    );
    const papers = await Promise.all(assets.paper.map((file) => loadModel(directory + file)));
    this.textures.get(assets.dust.texture)!.colorSpace = T.SRGBColorSpace;
    const color = this.textures.get(assets.paperMaterial.color)!;
    color.colorSpace = T.SRGBColorSpace;
    const paperMaterial = new T.MeshStandardMaterial({
      name: "native-peeled-paper",
      map: color,
      normalMap: this.textures.get(assets.paperMaterial.normal),
      roughnessMap: this.textures.get(assets.paperMaterial.orm),
      aoMap: this.textures.get(assets.paperMaterial.orm),
      roughness: 1,
      metalness: 0,
      side: T.DoubleSide,
      alphaTest: 0.5,
      transparent: true,
      depthWrite: false,
    });
    paperMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader =
        "attribute float paperOpacity; varying float vPaperOpacity;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvPaperOpacity = paperOpacity;",
      );
      shader.fragmentShader = "varying float vPaperOpacity;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <alphatest_fragment>",
        "#include <alphatest_fragment>\ndiffuseColor.a *= vPaperOpacity;",
      );
    };
    paperMaterial.customProgramCacheKey = () => "home-paper-opacity-v1";
    for (const model of papers)
      model.scene.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          material.dispose();
        object.material = paperMaterial;
      });
    const dustMaterial = homeHazeMaterial(
      {
        masks: [assets.dust.texture, "white", "white"],
        pan: [
          [0, 0],
          [0, 0],
          [0, 0],
        ],
        scale: [
          [1, 1],
          [1, 1],
          [1, 1],
        ],
        tint: [1, 232 / 255, 209 / 255],
        opacity: 1,
        feather: 30,
        fresnel: 0.001,
        falloff: 1,
      },
      this.textures,
      this.clock,
      this.depth,
      this.viewport,
      this.range,
      true,
    );
    const frames = assets.dust.frames;
    const rects = new Float32Array(frames.length * 8);
    frames.forEach((frame, i) => {
      rects.set([...frame.uvMin, ...frame.uvMax], i * 4);
      rects.set([...frame.uncroppedMin, ...frame.uncroppedMax], frames.length * 4 + i * 4);
    });
    const frameTexture = new T.DataTexture(rects, frames.length, 2, T.RGBAFormat, T.FloatType);
    frameTexture.needsUpdate = true;
    this.textures.set("dust-frame-rects", frameTexture);
    dustMaterial.uniforms.frameRects.value = frameTexture;
    dustMaterial.uniforms.frameCount.value = frames.length;
    this.debris = new HomeDebris(
      papers.map((model) => model.scene),
      dustMaterial,
      this.paper,
      this.haze,
      background,
      floor,
      frames.length,
      collision,
    );
    gradeMapColors(this.haze);
  }

  update(dt: number, reduced: boolean) {
    if (this.wasReduced !== reduced) this.invalidateDepth();
    this.wasReduced = reduced;
    this.paper.visible = !reduced;
    this.debris?.setVisible(!reduced);
    if (reduced) return;
    // A tab returning from the background must not advance a huge wind step.
    this.clock.value += Math.min(dt, 0.1);
    this.debris?.update(Math.min(dt, 0.1));
  }

  invalidateDepth() {
    this.depthReady = false;
  }

  captureDepth(
    renderer: T.WebGLRenderer,
    scene: T.Scene,
    camera: T.PerspectiveCamera,
    reduced: boolean,
  ) {
    renderer.getDrawingBufferSize(this.viewport.value);
    const scale = Math.min(0.5, 1024 / this.viewport.value.x, 1024 / this.viewport.value.y);
    const width = Math.max(1, Math.ceil(this.viewport.value.x * scale));
    const height = Math.max(1, Math.ceil(this.viewport.value.y * scale));
    if (this.depthTarget.width !== width || this.depthTarget.height !== height) {
      this.depthTarget.setSize(width, height);
      this.depthReady = false;
    }
    camera.updateMatrixWorld();
    if (reduced && this.depthReady && this.previousCamera.equals(camera.matrixWorldInverse)) return;
    this.range.value.set(camera.near, camera.far);
    const target = renderer.getRenderTarget();
    const material = scene.overrideMaterial;
    const shadowUpdate = renderer.shadowMap.autoUpdate;
    const hazeVisible = this.haze.visible;
    try {
      // Half-resolution depth keeps cards soft at map/agent intersections;
      // never sample a texture attached to the framebuffer being drawn into.
      this.haze.visible = false;
      scene.overrideMaterial = this.depthMaterial;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(this.depthTarget);
      renderer.clear();
      renderer.render(scene, camera);
      this.depthReady = true;
      this.previousCamera.copy(camera.matrixWorldInverse);
    } finally {
      this.haze.visible = hazeVisible;
      scene.overrideMaterial = material;
      renderer.shadowMap.autoUpdate = shadowUpdate;
      renderer.setRenderTarget(target);
    }
  }

  dispose() {
    this.debris?.dispose();
    this.haze.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        material.dispose();
    });
    this.textures.forEach((texture) => texture.dispose());
    this.depthTarget.dispose();
    this.depthMaterial.dispose();
    this.root.removeFromParent();
  }
}
