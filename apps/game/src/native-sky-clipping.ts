import * as T from "three";

/** Conservative clipping for static, separately placed sky geometry. Small
 * index blocks avoid whole-city accessor bounds enclosing the gameplay camera.
 * Geometry and matrices are never rewritten. Animated skies keep their old
 * range until their complete displacement bounds can supply the same proof. */
export class StaticSkyClipping {
  private boxes: { box: T.Box3; mesh: T.Mesh; from: number; end: number }[] = [];
  private valid = true;
  private anchor = new T.Vector3(Infinity, Infinity, Infinity);
  private clearance = 0;
  private position = new T.Vector3();
  constructor(roots: readonly T.Object3D[]) {
    const point = new T.Vector3();
    for (const root of roots) {
      root.updateWorldMatrix(true, true);
      root.traverseVisible((object) => {
        if (!(object instanceof T.Mesh)) return;
        if (object instanceof T.InstancedMesh || object instanceof T.SkinnedMesh) {
          this.valid = false;
          return;
        }
        const geometry = object.geometry,
          position = geometry.getAttribute("position"),
          index = geometry.index;
        if (!position || geometry.morphAttributes.position?.length) {
          this.valid = false;
          return;
        }
        const start = geometry.drawRange.start;
        const end =
          start +
          Math.floor(
            (Math.min(start + geometry.drawRange.count, index?.count ?? position.count) - start) /
              3,
          ) *
            3;
        for (let from = start; from < end; from += 768) {
          const box = new T.Box3();
          for (let at = from; at < Math.min(from + 768, end); at++)
            box.expandByPoint(point.fromBufferAttribute(position, index ? index.getX(at) : at));
          if (!box.isEmpty())
            this.boxes.push({
              box: box.applyMatrix4(object.matrixWorld),
              mesh: object,
              from,
              end: Math.min(from + 768, end),
            });
        }
      });
    }
  }
  near(camera: T.Camera) {
    if (!this.valid) return 0.01;
    this.position.setFromMatrixPosition(camera.matrixWorld);
    let moved = this.anchor.distanceTo(this.position);
    if (!Number.isFinite(moved) || moved > Math.max(1, this.clearance * 0.1)) {
      this.clearance = Infinity;
      const candidates = this.boxes
        .map((block) => ({ block, distance: block.box.distanceToPoint(this.position) }))
        .sort((a, b) => a.distance - b.distance);
      const triangle = new T.Triangle(),
        closest = new T.Vector3();
      let magnitude = this.position.length();
      for (const { block, distance } of candidates) {
        if (distance >= this.clearance) break;
        const geometry = block.mesh.geometry,
          position = geometry.getAttribute("position"),
          index = geometry.index;
        for (let at = block.from; at < block.end; at += 3) {
          for (const [offset, vertex] of [triangle.a, triangle.b, triangle.c].entries())
            vertex
              .fromBufferAttribute(position, index ? index.getX(at + offset) : at + offset)
              .applyMatrix4(block.mesh.matrixWorld);
          triangle.closestPointToPoint(this.position, closest);
          this.clearance = Math.min(this.clearance, closest.distanceTo(this.position));
        }
        magnitude = Math.max(magnitude, block.box.min.length(), block.box.max.length());
      }
      // Leave an additional numerical margin for FLOAT32 GPU transforms.
      this.clearance = Math.max(0, this.clearance - magnitude * 0.0001);
      this.anchor.copy(this.position);
      moved = 0;
    }
    if (!Number.isFinite(this.clearance)) return 0.01;
    // Distance to a fixed set is 1-Lipschitz. Movement only lowers the cached
    // guarantee; all visible rays also retain the widest frustum-corner angle.
    const p = camera.projectionMatrix.elements;
    const x = (1 + Math.abs(p[8])) / Math.abs(p[0]),
      y = (1 + Math.abs(p[9])) / Math.abs(p[5]);
    const cosine = 1 / Math.sqrt(1 + x * x + y * y);
    return Math.max(0.01, Math.max(0, this.clearance - moved) * cosine * 0.5);
  }
}

/** A panorama has direction, not a one-metre distance. Keep its projection at
 * infinity so a precision-correct sky near plane cannot cut a circle out of it. */
export function infiniteSkyPanorama(material: T.MeshBasicMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\ngl_Position.z=gl_Position.w;",
    );
  };
  material.customProgramCacheKey = () => "native-sky-panorama-infinite1";
}
