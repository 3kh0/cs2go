import * as T from "three";

/** Ownership is established while loading a map, before material adapters replace
 * imported materials. Never discover ownership from shared runtime shader uniforms. */
export class MapResources {
  private disposed = false;
  private released = new WeakSet<object>();
  private release(resource: { dispose(): void }) {
    if (this.released.has(resource)) return;
    this.released.add(resource);
    resource.dispose();
  }
  private geometries = new Set<T.BufferGeometry>();
  private instances = new Set<T.InstancedMesh>();
  private materials = new Set<T.Material>();
  private textures = new Set<T.Texture>();
  private externalTextures = new Set<T.Texture>();
  private shadows = new Set<T.LightShadow>();
  private targets = new Set<T.WebGLRenderTarget>();
  private cleanup = new Set<() => void>();

  external(texture: T.Texture) {
    this.externalTextures.add(texture);
    this.textures.delete(texture);
  }

  texture(texture?: T.Texture) {
    if (texture && !this.externalTextures.has(texture)) {
      if (this.disposed) this.release(texture);
      else this.textures.add(texture);
    }
    return texture;
  }

  capture(root: T.Object3D) {
    root.traverse((object) => {
      if (object instanceof T.InstancedMesh) {
        if (this.disposed) this.release(object);
        else this.instances.add(object);
      }
      if (object instanceof T.Mesh || object instanceof T.Line || object instanceof T.Points) {
        if (this.disposed) this.release(object.geometry);
        else this.geometries.add(object.geometry);
        const materials = Array.isArray(object.material) ? [...object.material] : [object.material];
        if (object instanceof T.Mesh) {
          if (object.customDepthMaterial) materials.push(object.customDepthMaterial);
          if (object.customDistanceMaterial) materials.push(object.customDistanceMaterial);
        }
        for (const material of materials) {
          for (const value of Object.values(material))
            if (value instanceof T.Texture) this.texture(value);
          if (this.disposed) this.release(material);
          else this.materials.add(material);
        }
      }
      if (
        object instanceof T.DirectionalLight ||
        object instanceof T.SpotLight ||
        object instanceof T.PointLight
      ) {
        if (this.disposed) this.release(object.shadow);
        else this.shadows.add(object.shadow);
      }
    });
  }

  target(target: T.WebGLRenderTarget) {
    // RenderTarget owns its attachments; their dispose event must not also be
    // triggered through materials that sample the offscreen result.
    for (const texture of target.textures) this.external(texture);
    if (target.depthTexture) this.external(target.depthTexture);
    if (this.disposed) this.release(target);
    else this.targets.add(target);
    return target;
  }

  onDispose(cleanup: () => void) {
    if (this.disposed) cleanup();
    else this.cleanup.add(cleanup);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const cleanup of this.cleanup) cleanup();
    for (const instance of this.instances) this.release(instance);
    for (const shadow of this.shadows) this.release(shadow);
    for (const target of this.targets) this.release(target);
    for (const material of this.materials) this.release(material);
    for (const geometry of this.geometries) this.release(geometry);
    for (const texture of this.textures) this.release(texture);
    this.cleanup.clear();
    this.instances.clear();
    this.shadows.clear();
    this.targets.clear();
    this.materials.clear();
    this.geometries.clear();
    this.textures.clear();
  }
}
