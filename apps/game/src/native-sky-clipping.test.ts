import { expect, test } from "vitest";
import * as T from "three";
import { StaticSkyClipping } from "./native-sky-clipping";
function camera() {
  const camera = new T.PerspectiveCamera(90, 16 / 9, 0.05, 110);
  camera.updateMatrixWorld(true);
  return camera;
}
test("sky clipping preserves nearby geometry while improving depth precision over a kilometre range", () => {
  const scene = new T.Scene(),
    mesh = new T.Mesh(new T.BoxGeometry(100, 100, 10));
  mesh.position.z = -1000;
  scene.add(mesh);
  const fit = new StaticSkyClipping([scene]),
    view = camera();
  const near = fit.near(view);
  expect(near).toBeGreaterThan(100);
  expect(near).toBeLessThan(995);
  view.position.z = -20;
  view.updateMatrixWorld(true);
  expect(fit.near(view)).toBeLessThan(near);
  view.position.z = -995;
  view.updateMatrixWorld(true);
  expect(fit.near(view)).toBe(0.01);
});
test("indexed sky bounds ignore unused origin vertices and camera rotation retains conservative clipping", () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute([0, 0, 0, -5, -5, -100, 5, -5, -100, 0, 5, -100], 3),
  );
  geometry.setIndex([1, 2, 3]);
  const root = new T.Mesh(geometry),
    view = camera(),
    fit = new StaticSkyClipping([root]);
  expect(fit.near(view)).toBeGreaterThan(10);
  view.rotation.y = 0.1;
  view.updateMatrixWorld(true);
  expect(fit.near(view)).toBeGreaterThan(10);
  view.position.x = 0.5;
  view.updateMatrixWorld(true);
  expect(fit.near(view)).toBeLessThan(50);
});

test("triangle refinement handles bounds surrounding the camera, with a safe fallback for animated geometry", () => {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute(
    "position",
    new T.Float32BufferAttribute([-100, -100, -100, 100, -100, 100, 0, 100, 100], 3),
  );
  const view = camera(),
    mesh = new T.Mesh(geometry);
  expect(new StaticSkyClipping([mesh]).near(view)).toBeGreaterThan(1);
  const animated = new T.InstancedMesh(new T.BoxGeometry(), new T.MeshBasicMaterial(), 1);
  expect(new StaticSkyClipping([animated]).near(view)).toBe(0.01);
});
