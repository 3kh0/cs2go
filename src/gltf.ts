import type * as T from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

// Shared loader for meshopt geometry and KTX2 (Basis) textures. KTX2Loader
// resolves its Basis transcoder through import.meta.url, so Vite bundles it.
export const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export function enableTextureTranscoding(renderer: T.WebGLRenderer) {
  gltf.setKTX2Loader(new KTX2Loader().detectSupport(renderer));
}
// Vercel compresses only text-like MIME types, so large GLBs ship pre-gzipped.
// A server that adds Content-Encoding has already decoded it; check the magic.
export async function loadGzipped(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} could not load`);
  const blob = await response.blob();
  const [a, b] = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const data =
    a === 0x1f && b === 0x8b
      ? await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()
      : await blob.arrayBuffer();
  return gltf.parseAsync(data, url.slice(0, url.lastIndexOf("/") + 1));
}
