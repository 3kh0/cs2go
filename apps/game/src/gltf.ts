import { assetFetch } from "./asset-url";
import { createLoadQueue } from "./loading";
import type * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// Shared loader for meshopt geometry and KTX2 (Basis) textures. KTX2Loader
// resolves its Basis transcoder through import.meta.url, so Vite bundles it.
// Fetch ahead through network latency while retaining only six jobs and at
// most two parsers/transcoders. Map jobs can bypass the long animation queue.
const load = createLoadQueue(6);
const parse = createLoadQueue(2);
const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export function enableTextureTranscoding(renderer: T.WebGLRenderer) {
  gltf.setKTX2Loader(new KTX2Loader().setWorkerLimit(2).detectSupport(renderer));
}
// Vercel compresses only text-like MIME types, so large GLBs ship pre-gzipped.
// A server that adds Content-Encoding has already decoded it; check the magic.
export async function fetchGzipped(url: string) {
  const response = await assetFetch(url);
  if (!response.ok) throw new Error(`${url} could not load`);
  const bytes = await response.arrayBuffer();
  const [a, b] = new Uint8Array(bytes, 0, Math.min(2, bytes.byteLength));
  return a === 0x1f && b === 0x8b
    ? await new Response(
        new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer()
    : bytes;
}
export function loadModel(url: string, priority = 0) {
  // The production build creates lossless gzip siblings; originals remain the
  // source of truth for importers and the development server.
  return loadGzipped(import.meta.env.PROD ? `${url}.gz` : url, priority);
}
export function loadGzipped(url: string, priority = 0) {
  return load(async () => {
    const data = await fetchGzipped(url);
    return parse(() => gltf.parseAsync(data, url.slice(0, url.lastIndexOf("/") + 1)), priority);
  }, priority);
}
