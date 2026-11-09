import * as T from "three";
import { assetUrl } from "./asset-url";
import { loadModel } from "./gltf";
import { MenuBackdrop, inspectionBackdropOptions } from "./menu-backdrop";
import { framePreview } from "./preview-framing";
import { InspectionLighting, drawInspectionLoading } from "./inspection-lighting";

/** A lazy inventory inspection, drawn by the game's existing renderer and clock. */
export class MusicKitPreview {
  private scene = new T.Scene();
  private lighting = new InspectionLighting(this.scene, "music");
  private camera = new T.PerspectiveCamera(35, 1, 0.01, 20);
  private pivot = new T.Group();
  private backdrop = new MenuBackdrop(inspectionBackdropOptions(this.lighting.postProcessing));
  private backgroundCamera = new T.PerspectiveCamera(35, 1, 4 * 0.0254, 10000 * 0.0254);
  get inspectionCamera() {
    return this.backgroundCamera;
  }
  private loading?: Promise<void>;
  private cover?: T.Texture;
  private sleeve?: T.MeshStandardMaterial;
  private textureLoader = new T.TextureLoader();
  private bounds = new T.Box3();
  private viewport = new T.Vector4();
  private scissor = new T.Vector4();
  private size = new T.Vector2();
  private generation = 0;
  private open = false;
  private dragging?: { id: number; x: number; y: number };
  private fittedAspect = 0;
  private stage: HTMLElement;
  private idleElapsed = 0;
  private idleRunning = true;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  constructor(stage: HTMLElement) {
    this.stage = stage;
    this.scene.add(this.pivot);
    stage.addEventListener("pointerdown", this.pointerDown);
    stage.addEventListener("pointermove", this.pointerMove);
    stage.addEventListener("pointerup", this.pointerUp);
    stage.addEventListener("pointercancel", this.pointerUp);
    stage.addEventListener("lostpointercapture", this.pointerUp);
    stage.addEventListener("keydown", this.keyDown);
    stage.addEventListener("dblclick", this.reset);
    this.reset();
  }

  private syncRotation() {
    this.stage.dataset.yaw = String(this.pivot.rotation.y);
    this.stage.dataset.pitch = String(this.pivot.rotation.x);
  }
  private reset = () => {
    // Native item4 Source yaw162.968155, front+Y, camera yaw57.968277:
    // its sleeve normal is15degrees right of the camera's backward direction.
    this.pivot.rotation.set(0, T.MathUtils.degToRad(15), 0);
    this.idleElapsed = 0;
    this.idleRunning = true;
    this.syncRotation();
  };
  private pointerDown = (event: PointerEvent) => {
    if (!this.open || event.button !== 0) return;
    // Native auto_recenter is false: taking control freezes the visible pose.
    this.idleRunning = false;
    event.preventDefault();
    this.stage.focus({ preventScroll: true });
    this.stage.setPointerCapture(event.pointerId);
    this.dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.stage.dataset.dragging = "true";
  };
  private pointerMove = (event: PointerEvent) => {
    const drag = this.dragging;
    if (!drag || drag.id !== event.pointerId) return;
    const scale = (Math.PI * 2) / Math.max(1, this.stage.clientWidth);
    this.pivot.rotation.y = T.MathUtils.clamp(
      this.pivot.rotation.y + (event.clientX - drag.x) * scale,
      -T.MathUtils.degToRad(55),
      T.MathUtils.degToRad(55),
    );
    this.pivot.rotation.x = T.MathUtils.clamp(
      this.pivot.rotation.x + (event.clientY - drag.y) * scale,
      -T.MathUtils.degToRad(55),
      T.MathUtils.degToRad(55),
    );
    drag.x = event.clientX;
    drag.y = event.clientY;
    this.syncRotation();
  };
  private pointerUp = (event: PointerEvent) => {
    if (this.dragging?.id !== event.pointerId) return;
    this.dragging = undefined;
    delete this.stage.dataset.dragging;
    if (this.stage.hasPointerCapture(event.pointerId))
      this.stage.releasePointerCapture(event.pointerId);
  };
  private keyDown = (event: KeyboardEvent) => {
    if (!this.open) return;
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
      this.idleRunning = false;
    if (event.key === "Home") this.reset();
    else if (event.key === "ArrowLeft")
      this.pivot.rotation.y = Math.max(-T.MathUtils.degToRad(55), this.pivot.rotation.y - 0.12);
    else if (event.key === "ArrowRight")
      this.pivot.rotation.y = Math.min(T.MathUtils.degToRad(55), this.pivot.rotation.y + 0.12);
    else if (event.key === "ArrowUp")
      this.pivot.rotation.x = Math.max(-T.MathUtils.degToRad(55), this.pivot.rotation.x - 0.12);
    else if (event.key === "ArrowDown")
      this.pivot.rotation.x = Math.min(T.MathUtils.degToRad(55), this.pivot.rotation.x + 0.12);
    else return;
    event.preventDefault();
    this.syncRotation();
  };

  private texture(path: string, color = true) {
    return this.textureLoader.loadAsync(assetUrl(`/models/music-kit/${path}`)).then((texture) => {
      texture.flipY = false;
      texture.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
      return texture;
    });
  }
  private load() {
    return (this.loading ??= Promise.allSettled([
      loadModel("/models/music-kit/mesh.glb"),
      this.texture("label.png"),
      this.texture("label-normal.png", false),
      this.texture("sleeve-normal.png", false),
      this.texture("record.png"),
      this.texture("record-normal.png", false),
      this.texture("sleeve-roughness.png", false),
      this.texture("label-roughness.png", false),
    ] as const)
      .then((results) => {
        const failure = results.find((result) => result.status === "rejected");
        if (failure) {
          for (const result of results) {
            if (result.status !== "fulfilled") continue;
            if (result.value instanceof T.Texture) result.value.dispose();
            else
              result.value.scene.traverse((object) => {
                if (!(object instanceof T.Mesh)) return;
                object.geometry.dispose();
                const material = object.material as T.MeshStandardMaterial;
                for (const value of Object.values(material))
                  if (value instanceof T.Texture) value.dispose();
                material.dispose();
              });
          }
          throw failure.reason;
        }
        // All results are settled and verified before the owned resources are adopted.
        return results.map((result) => (result as PromiseFulfilledResult<unknown>).value) as [
          Awaited<ReturnType<typeof loadModel>>,
          T.Texture,
          T.Texture,
          T.Texture,
          T.Texture,
          T.Texture,
          T.Texture,
          T.Texture,
        ];
      })
      .then(
        ([
          gltf,
          label,
          labelNormal,
          sleeveNormal,
          record,
          recordNormal,
          sleeveRoughness,
          labelRoughness,
        ]) => {
          // The native node faces +X. Turn it toward the inspection camera; this
          // also places the protruding record on the right without mirroring UVs.
          const model = gltf.scene;
          model.rotation.y = -Math.PI / 2;
          const obsolete = new Set<T.Texture>();
          model.traverse((object) => {
            if (!(object instanceof T.Mesh)) return;
            const material = object.material as T.MeshStandardMaterial;
            for (const value of Object.values(material))
              if (value instanceof T.Texture) obsolete.add(value);
            material.map = null;
            material.normalMap = null;
            material.metalnessMap = null;
            material.roughnessMap = null;
            material.metalness = 0;
            material.roughness = 0.65;
            if (material.name === "sleeve_cover") {
              this.sleeve = material;
              material.normalMap = sleeveNormal;
              material.metalness = 0.25;
              material.roughnessMap = sleeveRoughness;
              material.roughness = 1;
            } else if (material.name === "label_cs2") {
              material.map = label;
              material.normalMap = labelNormal;
              material.metalness = 0.288;
              material.roughnessMap = labelRoughness;
              material.roughness = 1;
            } else if (material.name === "record") {
              // Native csgo_complex enables anisotropic gloss on the vinyl. The
              // Normal/color and metalness are native. Source's AnisoGloss RG
              // encodes two roughness axes, not Three's direction/strength map;
              // use a bounded constant approximation rather than misread it.
              const vinyl = new T.MeshPhysicalMaterial({
                name: material.name,
                map: record,
                normalMap: recordNormal,
                metalness: 0.834,
                roughness: 0.24,
                anisotropy: 0.7,
              });
              object.material = vinyl;
              material.dispose();
            }
            material.needsUpdate = true;
          });
          for (const texture of obsolete) texture.dispose();
          this.bounds.setFromObject(model);
          model.position.sub(this.bounds.getCenter(new T.Vector3()));
          this.pivot.add(model);
          this.bounds.setFromObject(this.pivot);
          this.camera.position.set(0, 0, 2);
          this.camera.lookAt(0, 0, 0);
          this.fittedAspect = 0;
        },
      )
      .catch((error: unknown) => {
        this.loading = undefined;
        throw error;
      }));
  }

  async show(kitId: string) {
    const generation = ++this.generation;
    this.open = true;
    this.backdrop.invalidate();
    this.reset();
    this.stage.dataset.loading = "true";
    delete this.stage.dataset.kit;
    await Promise.all([this.load(), this.lighting.load()]);
    if (generation !== this.generation) return;
    this.lighting.configureBackgroundCamera(this.backgroundCamera);
    this.backdrop.invalidate();
    const cover = await this.texture(`covers/${kitId}.png`);
    if (generation !== this.generation) {
      cover.dispose();
      return;
    }
    if (!this.sleeve) {
      cover.dispose();
      throw new Error("The music kit sleeve could not load.");
    }
    this.sleeve.map = cover;
    this.sleeve.needsUpdate = true;
    this.cover?.dispose();
    this.cover = cover;
    this.stage.dataset.kit = kitId;
    delete this.stage.dataset.loading;
  }
  hide() {
    ++this.generation;
    this.open = false;
    this.idleRunning = false;
    if (this.dragging && this.stage.hasPointerCapture(this.dragging.id))
      this.stage.releasePointerCapture(this.dragging.id);
    this.dragging = undefined;
    delete this.stage.dataset.dragging;
    delete this.stage.dataset.loading;
  }

  render(renderer: T.WebGLRenderer, capture?: () => void, environment?: T.Texture, dt = 0) {
    if (!this.open || !this.stage.checkVisibility()) return false;
    if (!this.stage.dataset.kit) {
      drawInspectionLoading(renderer);
      return true;
    }
    const rect = this.stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    if (this.idleRunning && !this.reducedMotion.matches && this.stage.dataset.kit) {
      // Native inspect.js: auto_rotate_x10, period20s; auto_rotate_y0.
      // Horizontal X means yaw. Sinusoidal phase/easing approximates the engine;
      // elapsed time comes only from the existing visible game render clock.
      this.idleElapsed += Math.min(Math.max(dt, 0), 0.1);
      const limit = T.MathUtils.degToRad(55);
      this.pivot.rotation.y = T.MathUtils.clamp(
        T.MathUtils.degToRad(15) +
          T.MathUtils.degToRad(10) * Math.sin((this.idleElapsed * Math.PI * 2) / 20),
        -limit,
        limit,
      );
      this.pivot.rotation.x = 0;
      this.syncRotation();
    }
    this.lighting.update(this.pivot, environment, renderer);
    const autoClear = renderer.autoClear;
    const toneMapping = renderer.toneMapping;
    const scissorTest = renderer.getScissorTest();
    renderer.getViewport(this.viewport);
    renderer.getScissor(this.scissor);
    renderer.getSize(this.size);
    const backgroundAspect = this.size.x / this.size.y;
    if (this.backgroundCamera.aspect !== backgroundAspect) {
      this.backgroundCamera.aspect = backgroundAspect;
      this.backgroundCamera.updateProjectionMatrix();
      this.backdrop.invalidate();
    }
    try {
      renderer.setScissorTest(false);
      if (capture) this.backdrop.render(renderer, capture, "ct");
      // CSS is measured in layout pixels; the renderer applies its own pixel ratio.
      const canvas = renderer.domElement.getBoundingClientRect();
      const x = ((rect.left - canvas.left) * this.size.x) / canvas.width;
      const y = ((canvas.bottom - rect.bottom) * this.size.y) / canvas.height;
      const width = (rect.width * this.size.x) / canvas.width;
      const height = (rect.height * this.size.y) / canvas.height;
      const aspect = width / height;
      if (aspect !== this.fittedAspect && !this.bounds.isEmpty()) {
        framePreview(this.camera, this.bounds, aspect);
        this.fittedAspect = aspect;
      }
      renderer.autoClear = false;
      renderer.toneMapping = T.CustomToneMapping;
      renderer.setViewport(x, y, width, height);
      renderer.setScissor(x, y, width, height);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      if (this.stage.dataset.kit) renderer.render(this.scene, this.camera);
    } finally {
      renderer.autoClear = autoClear;
      renderer.toneMapping = toneMapping;
      renderer.setViewport(this.viewport);
      renderer.setScissor(this.scissor);
      renderer.setScissorTest(scissorTest);
    }
    return true;
  }
}
