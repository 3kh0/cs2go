import { expect, test, vi } from "vitest";
import * as T from "three";
import { MapResources } from "./map-resources";

test("map disposal owns original and replacement materials while retaining shared actor inputs", () => {
  const resources = new MapResources();
  const shared = new T.Texture();
  resources.external(shared);
  const map = new T.Texture();
  const geometry = new T.BoxGeometry();
  const original = new T.MeshStandardMaterial({ map, envMap: shared });
  const root = new T.Mesh(geometry, original);
  const disposed = {
    geometry: vi.fn(),
    original: vi.fn(),
    replacement: vi.fn(),
    texture: vi.fn(),
    shared: vi.fn(),
  };
  geometry.addEventListener("dispose", disposed.geometry);
  original.addEventListener("dispose", disposed.original);
  map.addEventListener("dispose", disposed.texture);
  shared.addEventListener("dispose", disposed.shared);
  resources.capture(root);
  const replacement = original.clone();
  replacement.addEventListener("dispose", disposed.replacement);
  root.material = replacement;
  resources.capture(root);
  // A shader may reference a shared player/home LUT, which never establishes
  // ownership even when it is attached after the import has completed.
  const shader = new T.ShaderMaterial({ uniforms: { sharedLut: { value: shared } } });
  root.add(new T.Mesh(new T.PlaneGeometry(), shader));
  resources.capture(root);
  resources.dispose();
  resources.dispose();
  for (const key of ["geometry", "original", "replacement", "texture"] as const)
    expect(disposed[key]).toHaveBeenCalledTimes(1);
  expect(disposed.shared).not.toHaveBeenCalled();
  shared.dispose();
});

test("offscreen attachments and lazily created shadow targets release once", () => {
  const resources = new MapResources();
  const target = new T.WebGLRenderTarget(1, 1, { depthTexture: new T.DepthTexture(1, 1) });
  const targetDisposed = vi.fn();
  const textureDisposed = vi.fn();
  target.addEventListener("dispose", targetDisposed);
  target.texture.addEventListener("dispose", textureDisposed);
  resources.target(target);
  resources.capture(
    new T.Mesh(new T.PlaneGeometry(), new T.MeshBasicMaterial({ map: target.texture })),
  );
  const sun = new T.DirectionalLight();
  const shadowDisposed = vi.fn();
  resources.capture(sun);
  // Three allocates this lazily during rendering, after the map finished loading.
  sun.shadow.map = new T.WebGLRenderTarget(1, 1);
  sun.shadow.map.addEventListener("dispose", shadowDisposed);
  resources.dispose();
  resources.dispose();
  expect(targetDisposed).toHaveBeenCalledTimes(1);
  expect(shadowDisposed).toHaveBeenCalledTimes(1);
  expect(textureDisposed).not.toHaveBeenCalled();
});

test("an aborted map releases late load results without disposing excluded shared textures", () => {
  const resources = new MapResources();
  const shared = new T.Texture();
  const own = new T.Texture();
  const ownDisposed = vi.fn();
  const sharedDisposed = vi.fn();
  own.addEventListener("dispose", ownDisposed);
  shared.addEventListener("dispose", sharedDisposed);
  resources.external(shared);
  resources.dispose();
  const root = new T.Group();
  const geometry = new T.PlaneGeometry();
  const material = new T.MeshBasicMaterial({ map: own, envMap: shared });
  root.add(new T.Mesh(geometry, material), new T.Mesh(geometry, material));
  resources.capture(root);
  resources.capture(root);
  expect(ownDisposed).toHaveBeenCalledTimes(1);
  expect(sharedDisposed).not.toHaveBeenCalled();
  shared.dispose();
});

test("map-owned native shadow materials are captured once and never dispose excluded shared lookup textures", () => {
  const resources = new MapResources(),
    shared = new T.Texture(),
    material = new T.MeshStandardMaterial(),
    depth = new T.MeshDepthMaterial({ map: shared }),
    distance = new T.MeshDistanceMaterial({ map: shared });
  const mesh = new T.Mesh(new T.PlaneGeometry(), material);
  mesh.customDepthMaterial = depth;
  mesh.customDistanceMaterial = distance;
  const depthDisposed = vi.fn(),
    distanceDisposed = vi.fn(),
    sharedDisposed = vi.fn();
  depth.addEventListener("dispose", depthDisposed);
  distance.addEventListener("dispose", distanceDisposed);
  shared.addEventListener("dispose", sharedDisposed);
  resources.external(shared);
  resources.capture(mesh);
  resources.capture(mesh);
  resources.dispose();
  resources.dispose();
  expect(depthDisposed).toHaveBeenCalledTimes(1);
  expect(distanceDisposed).toHaveBeenCalledTimes(1);
  expect(sharedDisposed).not.toHaveBeenCalled();
  shared.dispose();
});
