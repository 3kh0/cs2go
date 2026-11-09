import * as T from "three";
import { createNativeWorldGun } from "./weapon-motion";
import { createWorldBayonet, disposeWorldGun } from "./weapons";
import { createInspectsWorldKnife } from "./inspects-knife";
import { bindWeaponInstance, type SkinChoice } from "./skins";
import { isKnife } from "./physics";
import { MenuBackdrop, inspectionBackdropOptions } from "./menu-backdrop";
import { previewBounds } from "./preview-framing";
import {
  InspectionLighting,
  drawInspectionLoading,
  prepareInspectionLighting,
} from "./inspection-lighting";
import { yieldLoadingWork } from "./loading";
import nativeCameras from "./data/weapon-inspect-cameras.json";

/** A lazy inventory inspection, drawn by the game's existing renderer and clock. */
export class WeaponInspectPreview {
  private scene = new T.Scene();
  private lighting = new InspectionLighting(this.scene, "weapon");
  private camera = new T.PerspectiveCamera(35, 1, 0.01, 20);
  private pivot = new T.Group();
  private backdrop = new MenuBackdrop(inspectionBackdropOptions(this.lighting.postProcessing));
  private backgroundCamera = new T.PerspectiveCamera(35, 1, 4 * 0.0254, 10000 * 0.0254);
  get inspectionCamera() {
    return this.backgroundCamera;
  }
  private model?: T.Group;
  private weapon = -1;
  private radius = 0;
  private framingBounds = new T.Box3();
  private projectedCorner = new T.Vector3();
  private requestedZoom = 1;
  private nativeDistance = 0;
  private restCameraDistance = 0;
  private introDistanceRatio = 1;
  private introRatio = 1;
  private introElapsed = nativeCameras.intro.holdSeconds + nativeCameras.intro.transitionSeconds;
  private baseZoom = 1;
  private visualVersion = -1;
  private viewport = new T.Vector4();
  private scissor = new T.Vector4();
  private size = new T.Vector2();
  private generation = 0;
  private open = false;
  private idle = true;
  private idleElapsed = 0;
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  private dragging?: { id: number; x: number; y: number };
  private fittedAspect = 0;
  private stage: HTMLElement;

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
    stage.addEventListener("wheel", this.wheel, { passive: false });
    this.reset();
  }

  private syncRotation() {
    this.stage.dataset.yaw = String(this.pivot.rotation.y);
    this.stage.dataset.pitch = String(this.pivot.rotation.x);
  }
  private reset = () => {
    this.idle = true;
    this.idleElapsed = 0;
    this.stage.dataset.idle = String(!this.reducedMotion.matches);
    this.pivot.rotation.set(-0.1, -0.22, 0);
    this.requestedZoom = 1;
    this.stage.dataset.requestedZoom = "1";
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.stage.dataset.zoom = "1";
    this.syncRotation();
  };
  private freezeIdle() {
    // Native auto_recenter is false: the first manual input keeps the current
    // displayed pose instead of returning to an authored starting orientation.
    this.idle = false;
    this.stage.dataset.idle = "false";
  }
  private updateIdle(dt: number) {
    this.stage.dataset.idle = String(this.idle && !this.reducedMotion.matches);
    if (!this.idle || this.reducedMotion.matches || !(dt > 0)) return;
    this.idleElapsed += Math.min(dt, 0.1);
    // inspect.js _InitWeaponScene/_InitMelee: auto_rotate_x=35/period15,
    // auto_rotate_y=10/period25. Source's exact easing/phase isn't exposed;
    // these sine phases reconstruct its gentle motion using the game clock.
    this.pivot.rotation.set(
      -0.1 + T.MathUtils.degToRad(10) * Math.sin((this.idleElapsed * Math.PI * 2) / 25),
      -0.22 + T.MathUtils.degToRad(35) * Math.sin((this.idleElapsed * Math.PI * 2) / 15),
      0,
    );
    this.syncRotation();
  }
  private updateIntro(dt: number) {
    const { holdSeconds, transitionSeconds } = nativeCameras.intro;
    const end = holdSeconds + transitionSeconds;
    this.introElapsed = this.reducedMotion.matches
      ? end
      : Math.min(end, this.introElapsed + Math.max(0, Math.min(dt, 0.1)));
    const progress = T.MathUtils.clamp((this.introElapsed - holdSeconds) / transitionSeconds, 0, 1);
    this.introRatio = T.MathUtils.lerp(this.introDistanceRatio, 1, progress);
    this.stage.dataset.intro =
      this.introElapsed >= end
        ? "settled"
        : this.introElapsed < holdSeconds
          ? "hold"
          : "transition";
    this.stage.dataset.introProgress = String(progress);
  }
  private wheel = (event: WheelEvent) => {
    if (!this.open) return;
    event.preventDefault();
    this.freezeIdle();
    this.requestedZoom = T.MathUtils.clamp(
      this.requestedZoom * Math.exp(-event.deltaY * 0.001),
      0.75,
      1.8,
    );
    this.stage.dataset.requestedZoom = String(this.requestedZoom);
    this.fitZoom();
  };
  private pointerDown = (event: PointerEvent) => {
    if (!this.open || event.button !== 0) return;
    event.preventDefault();
    this.freezeIdle();
    this.stage.focus({ preventScroll: true });
    this.stage.setPointerCapture(event.pointerId);
    this.dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    this.stage.dataset.dragging = "true";
  };
  private pointerMove = (event: PointerEvent) => {
    const drag = this.dragging;
    if (!drag || drag.id !== event.pointerId) return;
    const scale = (Math.PI * 2) / Math.max(1, this.stage.clientWidth);
    this.pivot.rotation.y += (event.clientX - drag.x) * scale;
    this.pivot.rotation.x = T.MathUtils.clamp(
      this.pivot.rotation.x + (event.clientY - drag.y) * scale,
      -Math.PI / 2,
      Math.PI / 2,
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
    if (
      event.key !== "Home" &&
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      this.freezeIdle();
    if (event.key === "Home") this.reset();
    else if (event.key === "ArrowLeft") this.pivot.rotation.y -= 0.12;
    else if (event.key === "ArrowRight") this.pivot.rotation.y += 0.12;
    else if (event.key === "ArrowUp")
      this.pivot.rotation.x = Math.max(-Math.PI / 2, this.pivot.rotation.x - 0.12);
    else if (event.key === "ArrowDown")
      this.pivot.rotation.x = Math.min(Math.PI / 2, this.pivot.rotation.x + 0.12);
    else return;
    event.preventDefault();
    this.syncRotation();
  };

  private setModel(weapon: number, choice: SkinChoice) {
    this.lighting.setProfile(isKnife(weapon) ? "knife" : "weapon");
    if (!this.model || this.weapon !== weapon) {
      if (this.model) disposeWorldGun(this.model);
      this.pivot.clear();
      const model = isKnife(weapon)
        ? weapon === 4
          ? createWorldBayonet()
          : createInspectsWorldKnife(weapon)
        : createNativeWorldGun(weapon, true, undefined, true);
      model.userData.ownedWorldGun = true;
      this.model = model;
      this.visualVersion = -1;
      this.weapon = weapon;
      // Native models use different authored axes. Keep their longest axis
      // horizontal in the inspection view, then center the visible geometry.
      const size = previewBounds([model]).getSize(new T.Vector3());
      if (weapon === 37 || weapon === 38) {
        // Native default knives have their thin axis on X and blade length on Y.
        // Face the broad Y/Z side toward the camera before laying the blade flat.
        model.rotation.set(0, Math.PI / 2, -Math.PI / 2, "ZYX");
      } else if (size.z > size.x && size.z >= size.y) model.rotation.y = Math.PI / 2;
      else if (size.y > size.x) model.rotation.z = -Math.PI / 2;
      model.updateMatrixWorld(true);
      const bounds = previewBounds([model]);
      model.position.sub(bounds.getCenter(new T.Vector3()));
      const extent = bounds.getSize(size).length();
      model.scale.setScalar(1.6 / Math.max(0.001, extent));
      const cameraName = nativeCameras.weaponCameras[weapon];
      const camera = nativeCameras.cameras[cameraName as keyof typeof nativeCameras.cameras];
      this.lighting.configureBackgroundCamera(this.backgroundCamera, camera.origin);
      this.backdrop.invalidate();
      this.camera.fov = camera.verticalFov;
      this.introDistanceRatio = camera.introDistanceSourceUnits / camera.distanceSourceUnits;
      // Baked native world guns and imported knife geometry are metre-space.
      // Undo only our showcase normalization, retaining the native item's
      // calibrated preview-panel scale and selected de_dust2_vanity camera distance.
      // The raw authored entity scale remains recorded separately in the source data.
      this.nativeDistance =
        (camera.distanceSourceUnits * 0.0254 * model.scale.x) / camera.effectiveItemScale;
      this.stage.dataset.nativeCamera = cameraName;
      this.stage.dataset.nativeDistance = String(this.nativeDistance);
      // Scaling moves the center too, so apply the same factor to translation.
      model.position.multiplyScalar(model.scale.x);
      // Enclose the entire model before the draggable pivot transforms it.
      // A sphere keeps the same framing at every yaw/pitch instead of cutting
      // a long rifle off when its barrel rotates toward the viewport edge.
      this.radius = previewBounds([model]).getSize(size).length() / 2;
      this.pivot.add(model);
      this.camera.position.set(0, 0, 2);
      this.camera.lookAt(0, 0, 0);
      this.fittedAspect = 0;
    }
    bindWeaponInstance(this.model, {
      serial: -this.generation,
      creator: "inventory-inspection",
      weapon,
      skin: Object.freeze({ ...choice }),
    });
  }
  /** Warm only the selected item while its inventory remains visible. No open
   * state or intro clock starts until show() commits the inspection. */
  async prepare(renderer: T.WebGLRenderer, weapon: number, choice: SkinChoice) {
    const generation = ++this.generation;
    await Promise.all([this.lighting.load(), prepareInspectionLighting(renderer)]);
    if (generation !== this.generation) return;
    this.setModel(weapon, choice);
    this.lighting.update(this.model!, undefined, renderer);
    this.updateFraming();
    await yieldLoadingWork();
    if (generation !== this.generation) return;
    const programs = new Set(renderer.info.programs ?? []);
    const toneMapping = renderer.toneMapping;
    let compiled: Promise<unknown>;
    try {
      renderer.toneMapping = T.CustomToneMapping;
      compiled = renderer.compileAsync(this.scene, this.camera);
    } finally {
      renderer.toneMapping = toneMapping;
    }
    await compiled;
    if (generation !== this.generation) return;
    for (const program of renderer.info.programs ?? [])
      if (!programs.has(program)) program.getUniforms();
    const textures = new Set<T.Texture>();
    this.model!.traverse((object) => {
      if (!(object instanceof T.Mesh)) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        for (const value of Object.values(material))
          if (value instanceof T.Texture) textures.add(value);
    });
    for (const texture of textures) {
      if (generation !== this.generation) return;
      renderer.initTexture(texture);
      await yieldLoadingWork();
    }
  }
  async show(weapon: number, choice: SkinChoice) {
    const generation = ++this.generation;
    const wasOpen = this.open;
    const fresh = !wasOpen || this.weapon !== weapon;
    this.open = true;
    if (!wasOpen) {
      this.backdrop.invalidate();
      this.reset();
    }
    await this.lighting.load();
    if (generation !== this.generation) return;
    this.setModel(weapon, choice);
    if (fresh) {
      this.introElapsed = 0;
      this.introRatio = this.introDistanceRatio;
      this.stage.dataset.intro = this.reducedMotion.matches ? "settled" : "hold";
      this.stage.dataset.introProgress = "0";
    }
    this.stage.dataset.weapon = String(weapon);
    this.stage.dataset.skin = choice.id;
    this.stage.dataset.wear = String(choice.wear);
    this.stage.dataset.seed = String(choice.seed);
  }
  private updateFraming() {
    if (!this.model) return;
    const version = Number(this.model.userData.skinVisualVersion ?? 0);
    if (version === this.visualVersion) return;
    this.visualVersion = version;
    // Attached SkinnedMesh updates bindMatrixInverse in updateMatrixWorld, not
    // updateWorldMatrix. Refresh it after normalization before measuring bones.
    this.pivot.updateMatrixWorld(true);
    const inverse = this.pivot.matrixWorld.clone().invert();
    const matrix = new T.Matrix4();
    const bounds = new T.Box3();
    const part = new T.Box3();
    this.model.traverseVisible((object) => {
      if (!(object instanceof T.Mesh)) return;
      if (object instanceof T.SkinnedMesh) {
        object.computeBoundingBox();
        part.copy(object.boundingBox!);
      } else {
        if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
        part.copy(object.geometry.boundingBox!);
      }
      matrix.multiplyMatrices(inverse, object.matrixWorld);
      bounds.union(part.applyMatrix4(matrix));
    });
    if (bounds.isEmpty()) return;
    this.framingBounds.copy(bounds);
    // A legacy finish can arrive after the default HD body. Enclose its real
    // visible geometry around the pivot, including any shifted model center.
    this.radius = new T.Vector3(
      Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x)),
      Math.max(Math.abs(bounds.min.y), Math.abs(bounds.max.y)),
      Math.max(Math.abs(bounds.min.z), Math.abs(bounds.max.z)),
    ).length();
    this.fittedAspect = 0;
  }
  private fitZoom() {
    if (this.framingBounds.isEmpty()) return;
    this.pivot.updateWorldMatrix(true, false);
    const bounds = this.framingBounds;
    const tangent = Math.tan(T.MathUtils.degToRad(this.camera.fov / 2));
    let extent = 0;
    for (let corner = 0; corner < 8; corner++) {
      const point = this.projectedCorner
        .set(
          corner & 1 ? bounds.max.x : bounds.min.x,
          corner & 2 ? bounds.max.y : bounds.min.y,
          corner & 4 ? bounds.max.z : bounds.min.z,
        )
        .applyMatrix4(this.pivot.matrixWorld)
        .applyMatrix4(this.camera.matrixWorldInverse);
      const depth = Math.max(this.camera.near, -point.z);
      extent = Math.max(
        extent,
        Math.abs(point.x) / (depth * tangent * this.camera.aspect),
        Math.abs(point.y) / (depth * tangent),
      );
    }
    // Preserve the requested close-up on broadside views, but constrain the
    // effective lens when tilting a long barrel would otherwise cut it off.
    const zoom = Math.min(this.baseZoom * this.requestedZoom, 0.96 / Math.max(extent, 0.0001));
    if (Math.abs(this.camera.zoom - zoom) > 0.000001) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }
    this.stage.dataset.zoom = String(zoom);
  }
  hide() {
    ++this.generation;
    this.open = false;
    this.introElapsed = nativeCameras.intro.holdSeconds + nativeCameras.intro.transitionSeconds;
    this.introRatio = 1;
    delete this.stage.dataset.intro;
    delete this.stage.dataset.introProgress;
    if (this.dragging && this.stage.hasPointerCapture(this.dragging.id))
      this.stage.releasePointerCapture(this.dragging.id);
    this.dragging = undefined;
    delete this.stage.dataset.dragging;
    if (this.model) disposeWorldGun(this.model);
    this.model = undefined;
    this.framingBounds.makeEmpty();
    this.pivot.clear();
    delete this.stage.dataset.weapon;
  }

  render(renderer: T.WebGLRenderer, capture?: () => void, environment?: T.Texture | null, dt = 0) {
    if (!this.open || !this.stage.checkVisibility()) return false;
    if (!this.stage.dataset.weapon) {
      drawInspectionLoading(renderer);
      return true;
    }
    this.updateIdle(dt);
    this.updateIntro(dt);
    if (this.model) this.lighting.update(this.model, environment, renderer);
    this.updateFraming();
    const rect = this.stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
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
      if (aspect !== this.fittedAspect && this.radius > 0) {
        // Native item cameras use a 35-degree vertical lens. Fit the rotated
        // model's invariant sphere to the narrower viewport axis with 5% margin.
        const halfFov = T.MathUtils.degToRad(this.camera.fov / 2);
        const halfAngle = Math.atan(Math.tan(halfFov) * Math.min(1, aspect));
        const distance = (this.radius * 1.05) / Math.sin(halfAngle);
        this.restCameraDistance = distance;
        this.camera.position.set(0, 0, distance);
        this.baseZoom = this.nativeDistance > 0 ? distance / this.nativeDistance : 1;
        this.stage.dataset.baseZoom = String(this.baseZoom);
        this.camera.aspect = aspect;
        this.camera.far = Math.max(20, distance + this.radius * 2);
        this.camera.updateProjectionMatrix();
        this.camera.updateMatrixWorld(true);
        this.fittedAspect = aspect;
      }
      this.camera.position.z = this.restCameraDistance * this.introRatio;
      this.camera.updateMatrixWorld(true);
      this.fitZoom();
      renderer.autoClear = false;
      renderer.toneMapping = T.CustomToneMapping;
      renderer.setViewport(x, y, width, height);
      renderer.setScissor(x, y, width, height);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      if (this.model) renderer.render(this.scene, this.camera);
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
