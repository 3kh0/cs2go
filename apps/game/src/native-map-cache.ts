/** A preparation lease protects consumers even before their map becomes active.
 * Abandoned allocations finish serially and release their owned resources. */
export class NativeMapCache<Id, World extends { dispose(): void }> {
  private worlds = new Map<Id, World>();
  private leases = new Map<Id, number>();
  private pending = new Map<Id, Promise<World>>();
  private preparation = Promise.resolve();
  private readonly permanent: Id;
  private readonly capacity: number;
  constructor(permanent: Id, capacity = 2) {
    this.permanent = permanent;
    this.capacity = capacity;
  }

  get(id: Id) {
    const world = this.worlds.get(id);
    if (world) {
      this.worlds.delete(id);
      this.worlds.set(id, world);
    }
    return world;
  }

  set(id: Id, world: World) {
    this.worlds.set(id, world);
  }

  values() {
    return this.worlds.values();
  }

  /** Native texture banks are large: deduplicate a shared request and allocate
   * one world at a time. A cancelled queued selection never starts loading. */
  load(id: Id, create: () => Promise<World>) {
    const cached = this.get(id);
    if (cached) return Promise.resolve(cached);
    const shared = this.pending.get(id);
    if (shared) return shared;
    const pending = this.preparation.then(async () => {
      if (!this.leases.has(id)) throw new DOMException("Map preparation cancelled", "AbortError");
      const world = await create();
      if (!this.leases.has(id)) {
        world.dispose();
        throw new DOMException("Map preparation cancelled", "AbortError");
      }
      this.set(id, world);
      return world;
    });
    this.pending.set(id, pending);
    // A failure or cancellation must not wedge later selections or retries.
    this.preparation = pending.then(
      () => {},
      () => {},
    );
    void pending
      .finally(() => {
        if (this.pending.get(id) === pending) this.pending.delete(id);
      })
      .catch(() => {});
    return pending;
  }

  retain(id: Id) {
    this.leases.set(id, (this.leases.get(id) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const count = (this.leases.get(id) ?? 1) - 1;
      if (count) this.leases.set(id, count);
      else this.leases.delete(id);
    };
  }

  prune(protectedWorlds: readonly (World | undefined)[], incoming = 0) {
    let count = this.worlds.size - Number(this.worlds.has(this.permanent));
    for (const [id, world] of this.worlds) {
      if (count <= Math.max(0, this.capacity - incoming)) break;
      if (id === this.permanent || this.leases.has(id) || protectedWorlds.includes(world)) continue;
      this.worlds.delete(id);
      world.dispose();
      count--;
    }
  }
}
