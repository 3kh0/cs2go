import { assetFetch } from "./asset-url";
import { createLoadQueue } from "./loading";
import {
  paintVariables,
  type Paint,
  type PaintPass,
  type Uniform,
  type Variables,
} from "./skin-paint";

// WebGPU flag values are fixed by the WebGPU IDL. TypeScript DOM types
// include interfaces but omit these constant namespace declarations.
const GPUBufferUsage = { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, VERTEX: 32, STORAGE: 128 };
const GPUTextureUsage = { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, RENDER_ATTACHMENT: 16 };
const GPUShaderStage = { VERTEX: 1, FRAGMENT: 2 };
const GPUMapMode = { READ: 1 };
const SIZE = 1024;
let devicePromise: Promise<GPUDevice> | undefined;
async function device() {
  devicePromise ??= (async () => {
    const adapter = await navigator.gpu?.requestAdapter();
    if (!adapter)
      throw new Error("Skin customization needs WebGPU. Open the game in current Chrome or Edge.");
    const gpu = await adapter.requestDevice();
    void gpu.lost.then(() => {
      releaseCache(gpu);
      devicePromise = undefined;
    });
    return gpu;
  })();
  try {
    return await devicePromise;
  } catch (e) {
    devicePromise = undefined;
    throw e;
  }
}
async function response(url: string) {
  if (!url.startsWith("/skins/")) throw new Error("Nonlocal skin asset");
  const r = await assetFetch(url);
  if (!r.ok) throw new Error(`Skin asset could not load: ${url}`);
  return r;
}
function uniforms(gpu: GPUDevice, layout: Uniform[], vars: Variables, size: number) {
  const buffer = new ArrayBuffer(Math.max(16, size));
  const float = new Float32Array(buffer),
    int = new Int32Array(buffer);
  for (const item of layout) {
    const value = vars[item.name] ?? 0;
    const values = Array.isArray(value) ? value : [value];
    (item.type.startsWith("Float") ? float : int).set(values, item.dest);
  }
  const out = gpu.createBuffer({
    size: buffer.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  gpu.queue.writeBuffer(out, 0, buffer);
  return out;
}
export async function skinTextureBytes(url: string) {
  const r = await response(url);
  const data = await r.arrayBuffer();
  const bytes = new Uint8Array(data);
  return bytes[0] === 31 && bytes[1] === 139
    ? await new Response(
        new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer()
    : data;
}
async function texture(gpu: GPUDevice, url: string, srgb: boolean) {
  const bytes = await skinTextureBytes(url),
    h = new DataView(bytes);
  const ktx = url.endsWith(".ktx2.gz");
  if (ktx && (h.getUint32(12, true) !== 97 || h.getUint32(44, true) !== 0))
    throw new Error("Unsupported raw paint texture");
  const width = h.getUint32(ktx ? 20 : 0, true),
    height = h.getUint32(ktx ? 24 : 4, true);
  const offset = ktx ? Number(h.getBigUint64(80, true)) : 8;
  const stride = ktx ? 8 : 4;
  const t = gpu.createTexture({
    size: [width, height],
    format: ktx ? "rgba16float" : srgb ? "rgba8unorm-srgb" : "rgba8unorm",
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });
  gpu.queue.writeTexture(
    { texture: t },
    new Uint8Array(bytes, offset, width * height * stride),
    { bytesPerRow: width * stride },
    [width, height],
  );
  return t;
}
function quad(code: string) {
  const signature = code.match(/fn\s+MainVs\s*\(([\s\S]*?)\)\s*->/)?.[1] ?? "";
  const inputs = [...signature.matchAll(/@location\((\d+)\)\s*\w+\s*:\s*(vec([234])<f32>|f32)/g)]
    .map((m) => ({ location: Number(m[1]), count: Number(m[3] ?? 1) }))
    .sort((a, b) => a.location - b.location);
  if (!inputs.length) throw new Error("Missing paint shader vertex inputs");
  let offset = 0;
  const attributes: GPUVertexAttribute[] = inputs.map((i) => {
    const attribute = {
      shaderLocation: i.location,
      offset,
      format: (i.count === 1 ? "float32" : `float32x${i.count}`) as GPUVertexFormat,
    };
    offset += i.count * 4;
    return attribute;
  });
  const vertices = new Float32Array(offset);
  let at = 0;
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ])
    for (const input of inputs) {
      for (let i = 0; i < input.count; i++)
        vertices[at + i] =
          input.location === 0
            ? i === 0
              ? x * SIZE
              : i === 1
                ? y * SIZE
                : 0
            : input.location === inputs.at(-1)!.location
              ? i === 0
                ? x
                : i === 1
                  ? y
                  : 0
              : 1;
      at += input.count;
    }
  return { vertices, layout: { arrayStride: offset, attributes } };
}
export type BakedTarget = {
  material: string;
  maps: Record<string, Uint8Array>;
  direct: Record<string, string>;
};
// Keep reusable inputs bounded; outputs still belong only to the active finish.
const INPUT_BUDGET = 64 * 1024 * 1024;
const PIPELINE_LIMIT = 24;
type Program = {
  geometry: ReturnType<typeof quad>;
  layouts: GPUBindGroupLayout[];
  pipeline: GPURenderPipeline;
};
type BakeCache = {
  textures: Map<string, GPUTexture>;
  programs: Map<string, Promise<Program>>;
};
const caches = new WeakMap<GPUDevice, BakeCache>();
function cacheFor(gpu: GPUDevice) {
  let cache = caches.get(gpu);
  if (!cache) {
    cache = { textures: new Map(), programs: new Map() };
    caches.set(gpu, cache);
  }
  return cache;
}
function releaseCache(gpu: GPUDevice) {
  const cache = caches.get(gpu);
  if (!cache) return;
  for (const texture of cache.textures.values()) texture.destroy();
  cache.textures.clear();
  cache.programs.clear();
  caches.delete(gpu);
}
function trimTextures(cache: BakeCache) {
  const bytes = (t: GPUTexture) => t.width * t.height * (t.format === "rgba16float" ? 8 : 4);
  let size = [...cache.textures.values()].reduce((sum, t) => sum + bytes(t), 0);
  // Evict only after submitted work has finished; a pass may still use an old input.
  for (const [key, texture] of cache.textures) {
    if (size <= INPUT_BUDGET) break;
    size -= bytes(texture);
    texture.destroy();
    cache.textures.delete(key);
  }
}
function program(gpu: GPUDevice, cache: BakeCache, pass: PaintPass) {
  const key = JSON.stringify(pass.shader);
  const existing = cache.programs.get(key);
  if (existing) {
    cache.programs.delete(key);
    cache.programs.set(key, existing);
    return existing;
  }
  const work = (async () => {
    const [vs, ps] = await Promise.all([
      response(pass.shader.vs_wgsl_url).then((r) => r.text()),
      response(pass.shader.ps_wgsl_url).then((r) => r.text()),
    ]);
    const geometry = quad(vs);
    // Explicit layouts preserve bindings optimized out of shader entry points.
    const layouts = bindingLayouts(gpu, pass);
    const pipeline = await gpu.createRenderPipelineAsync({
      layout: gpu.createPipelineLayout({ bindGroupLayouts: layouts }),
      vertex: {
        module: gpu.createShaderModule({ code: vs }),
        entryPoint: "MainVs",
        buffers: [geometry.layout],
      },
      fragment: {
        module: gpu.createShaderModule({ code: ps }),
        entryPoint: "MainPs",
        targets: [{ format: "rgba8unorm-srgb" }],
      },
      primitive: { topology: "triangle-strip" },
    });
    return { geometry, layouts, pipeline };
  })().catch((error: unknown) => {
    cache.programs.delete(key);
    throw error;
  });
  cache.programs.set(key, work);
  if (cache.programs.size > PIPELINE_LIMIT)
    cache.programs.delete(cache.programs.keys().next().value!);
  return work;
}
async function bake(paint: Paint, seed: number, wear: number): Promise<BakedTarget[]> {
  const gpu = await device();
  const cache = cacheFor(gpu);
  const inputs = new Map<string, Promise<GPUTexture>>();
  const load = createLoadQueue(3);
  const inputTexture = (url: string, srgb: boolean) => {
    const key = `${url}:${srgb}`;
    const cached = cache.textures.get(key);
    if (cached) {
      cache.textures.delete(key);
      cache.textures.set(key, cached);
      return Promise.resolve(cached);
    }
    let pending = inputs.get(key);
    if (!pending) {
      pending = load(async () => {
        const t = await texture(gpu, url, srgb);
        cache.textures.set(key, t);
        return t;
      });
      inputs.set(key, pending);
    }
    return pending;
  };
  const buffers: GPUBuffer[] = [];
  const outputs: GPUTexture[] = [];
  const result: BakedTarget[] = [];
  gpu.pushErrorScope("validation");
  let scopeOpen = true;
  try {
    for (const target of paint.targets) {
      const maps: Record<string, Uint8Array> = {};
      for (const pass of target.passes) {
        // Fetch/decode up to three inputs while the driver compiles the program.
        // Settle all work even on failure before closing the GPU error scope.
        const [compiled, ...loaded] = await Promise.allSettled([
          program(gpu, cache, pass),
          ...pass.shader.textures_layout.map(async (input) => {
            const url = pass.textures[input.name];
            if (!url) throw new Error(`Missing skin texture ${input.name}`);
            return inputTexture(url, input.srgb);
          }),
        ] as const);
        if (compiled.status === "rejected") throw compiled.reason;
        const { geometry, layouts, pipeline } = compiled.value;
        const entries: GPUBindGroupEntry[] = [];
        for (const [i, result] of loaded.entries()) {
          if (result.status === "rejected") throw result.reason;
          entries.push({
            binding: pass.shader.textures_layout[i].binding,
            resource: result.value.createView(),
          });
        }
        const vars = paintVariables(pass, target, seed, wear);
        vars.g_vViewport = [0, 0, SIZE, SIZE];
        const vertex = uniforms(gpu, pass.shader.vs_ubo_globals, vars, pass.shader.vs_ubo_size);
        const fragment = uniforms(gpu, pass.shader.ps_ubo_globals, vars, pass.shader.ps_ubo_size);
        const points = gpu.createBuffer({
          size: geometry.vertices.byteLength,
          usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        gpu.queue.writeBuffer(points, 0, geometry.vertices);
        buffers.push(vertex, fragment, points);
        entries.push({ binding: 0, resource: { buffer: fragment } });
        for (const input of pass.shader.samplers) {
          const address = (n: number): GPUAddressMode =>
            n === 2 ? "clamp-to-edge" : n === 1 ? "mirror-repeat" : "repeat";
          const filter: GPUFilterMode = input.filter_mode === 0 ? "nearest" : "linear";
          entries.push({
            binding: input.binding,
            resource: gpu.createSampler({
              magFilter: filter,
              minFilter: filter,
              mipmapFilter: filter,
              addressModeU: address(input.address_u),
              addressModeV: address(input.address_v),
            }),
          });
        }
        const output = gpu.createTexture({
          size: [SIZE, SIZE],
          format: "rgba8unorm-srgb",
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        });
        outputs.push(output);
        const readback = gpu.createBuffer({
          size: SIZE * SIZE * 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
        buffers.push(readback);
        const commands = gpu.createCommandEncoder();
        const render = commands.beginRenderPass({
          colorAttachments: [
            {
              view: output.createView(),
              loadOp: "clear",
              storeOp: "store",
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
            },
          ],
        });
        render.setPipeline(pipeline);
        render.setBindGroup(
          0,
          gpu.createBindGroup({
            layout: layouts[0],
            entries: [{ binding: 0, resource: { buffer: vertex } }],
          }),
        );
        render.setBindGroup(1, gpu.createBindGroup({ layout: layouts[1], entries }));
        render.setVertexBuffer(0, points);
        render.draw(4);
        render.end();
        commands.copyTextureToBuffer(
          { texture: output },
          { buffer: readback, bytesPerRow: SIZE * 4 },
          [SIZE, SIZE],
        );
        gpu.queue.submit([commands.finish()]);
        await readback.mapAsync(GPUMapMode.READ);
        maps[pass.target_param] = new Uint8Array(readback.getMappedRange().slice(0));
        readback.unmap();
      }
      result.push({ material: target.target_vmat, maps, direct: target.direct_textures });
    }
    const error = await gpu.popErrorScope();
    scopeOpen = false;
    if (error) throw new Error(error.message);
    return result;
  } catch (error) {
    // A failed device/validation must not poison subsequent attempts.
    releaseCache(gpu);
    throw error;
  } finally {
    if (scopeOpen) await gpu.popErrorScope();
    for (const t of outputs) t.destroy();
    trimTextures(cache);
    for (const b of buffers) b.destroy();
  }
}
function bindingLayouts(gpu: GPUDevice, pass: PaintPass) {
  return [
    gpu.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "read-only-storage" } },
      ],
    }),
    gpu.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: "read-only-storage" } },
        ...pass.shader.textures_layout.map((t) => ({
          binding: t.binding,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" as GPUTextureSampleType },
        })),
        ...pass.shader.samplers.map((s) => ({
          binding: s.binding,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" as GPUSamplerBindingType },
        })),
      ],
    }),
  ];
}

// Serialize GPU work: error scopes and temporary textures belong to one bake.
let queue: Promise<unknown> = Promise.resolve();
export function bakeSkin(paint: Paint, seed: number, wear: number, isCurrent = () => true) {
  // Superseded selections can wait behind another finish. Skip their fetches,
  // compilation and GPU work when they finally reach the head of the queue.
  const work = queue.then(() => (isCurrent() ? bake(paint, seed, wear) : []));
  queue = work.catch(() => {});
  return work;
}
