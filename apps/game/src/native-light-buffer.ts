import type * as T from "three";

type Allocation = { gl: WebGL2RenderingContext; buffer: WebGLBuffer; invalidate: () => void };

/** Browser transport for map-owned native light records. std140 data stays out
 * of the fragment default-uniform/sampler budgets. The associated native
 * standalone shader declares one block, whose WebGL default binding is zero.
 * This raw fallback requires exclusive point-zero ownership: draw callbacks
 * must not process Three uniformsGroups or modify indexed UBO bindings/ranges.
 * Map materials use Three-managed groups instead. Callbacks are synchronous
 * and may nest across raw main/own-sky worlds. */
export class NativeLightBuffer {
  private readonly data: Uint8Array;
  private readonly allocations = new Map<T.WebGLRenderer, Allocation>();
  private disposed = false;

  constructor(data: Float32Array | Uint32Array) {
    if (
      !data.length ||
      data.byteLength % 16 ||
      (data instanceof Float32Array && data.some((value) => !Number.isFinite(value)))
    )
      throw new Error("Invalid native light std140 records");
    // uint fields may legitimately have NaN-shaped bit patterns. Their native
    // bits are opaque here; field-specific validation belongs to the packer.
    this.data = new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
  }

  get byteLength() {
    return this.data.byteLength;
  }

  withBinding<Value>(renderer: T.WebGLRenderer, draw: () => Value): Value {
    if (this.disposed) throw new Error("Native light buffer is disposed");
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (gl.isContextLost()) return draw();
    let allocation = this.allocations.get(renderer);
    if (!allocation) {
      const limit = gl.getParameter(gl.MAX_UNIFORM_BLOCK_SIZE) as number;
      if (this.data.byteLength > limit)
        throw new Error(
          `Native light records exceed uniform-block capacity (${this.data.byteLength}/${limit})`,
        );
      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Native light uniform buffer allocation failed");
      const previous = gl.getParameter(gl.UNIFORM_BUFFER_BINDING) as WebGLBuffer | null;
      try {
        gl.bindBuffer(gl.UNIFORM_BUFFER, buffer);
        gl.bufferData(gl.UNIFORM_BUFFER, this.data, gl.STATIC_DRAW);
      } catch (error) {
        gl.deleteBuffer(buffer);
        throw error;
      } finally {
        gl.bindBuffer(gl.UNIFORM_BUFFER, previous);
      }
      // Invalidate on loss so even an earlier application restore listener can
      // render safely before any of our own restore callbacks would run.
      const invalidate = () => this.allocations.delete(renderer);
      allocation = { gl, buffer, invalidate };
      this.allocations.set(renderer, allocation);
      renderer.domElement.addEventListener("webglcontextlost", invalidate, { once: true });
    }
    const previousIndexed = gl.getIndexedParameter(
      gl.UNIFORM_BUFFER_BINDING,
      0,
    ) as WebGLBuffer | null;
    const previousGeneric = gl.getParameter(gl.UNIFORM_BUFFER_BINDING) as WebGLBuffer | null;
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, allocation.buffer);
    try {
      return draw();
    } finally {
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, previousIndexed);
      gl.bindBuffer(gl.UNIFORM_BUFFER, previousGeneric);
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const [renderer, { gl, buffer, invalidate }] of this.allocations) {
      renderer.domElement.removeEventListener("webglcontextlost", invalidate);
      gl.deleteBuffer(buffer);
    }
    this.allocations.clear();
  }
}
