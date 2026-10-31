import * as T from "three";
import { setActorReflection } from "./actor-lighting";
import { nearestSourceProbe, loadSourceReflection } from "./source-lighting";

type Request = { root: T.Object3D; position: T.Vector3 };
/** Eight shared low-resolution PMREMs; one decode/upload in flight at a time. */
export class ActorReflections {
  private cache = new Map<number, T.WebGLRenderTarget>();
  private failed = new Set<number>();
  private loading = false;
  private desired = new Set<number>();
  private generator?: T.PMREMGenerator;
  private previous = new Set<T.Object3D>();
  update(renderer: T.WebGLRenderer, requests: Request[]) {
    const chosen = new Set<number>();
    const current = new Set<T.Object3D>();
    const indices = requests.map(({ position }) => nearestSourceProbe(position));
    for (const index of indices) {
      if (index !== null && chosen.size < 8) chosen.add(index);
    }
    this.desired = chosen;
    for (let i = 0; i < requests.length; i++) {
      const { root } = requests[i];
      const index = indices[i];
      current.add(root);
      setActorReflection(
        root,
        index !== null && chosen.has(index) ? this.cache.get(index)?.texture : undefined,
      );
    }
    for (const root of this.previous) if (!current.has(root)) setActorReflection(root);
    this.previous = current;
    for (const [index, target] of this.cache) {
      if (!chosen.has(index)) {
        target.dispose();
        this.cache.delete(index);
      }
    }
    if (this.loading) return;
    const next = [...chosen].find((index) => !this.cache.has(index) && !this.failed.has(index));
    if (next === undefined) return;
    this.loading = true;
    void loadSourceReflection(next)
      .then((texture) => {
        try {
          if (!this.desired.has(next) || this.cache.size >= 8) return;
          this.generator ??= new T.PMREMGenerator(renderer);
          this.cache.set(next, this.generator.fromEquirectangular(texture));
        } finally {
          texture.dispose();
        }
      })
      .catch(() => {
        // Local fallback remains valid if a cached asset cannot be decoded.
        this.failed.add(next);
      })
      .finally(() => {
        this.loading = false;
      });
  }
}
