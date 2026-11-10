import { expect, test } from "vitest";
import * as T from "three";
import { excludeNativeToolsMaterials } from "./native-tools-materials";

test("only exact source-flagged tool batches are hidden, independent of name resemblance", () => {
  const root = new T.Group(),
    geometry = new T.BoxGeometry();
  const tools = new T.MeshBasicMaterial();
  tools.name = "ordinary-looking-author-name";
  const visible = new T.MeshBasicMaterial();
  visible.name = "toolsblocklight";
  const a = new T.Mesh(geometry, tools),
    b = new T.Mesh(geometry, visible);
  root.add(a, b);
  expect(excludeNativeToolsMaterials(root, [tools.name])).toBe(1);
  expect(a.visible).toBe(false);
  expect(a.userData.nativeToolsMaterial).toBe(true);
  expect(b.visible).toBe(true);
  expect(excludeNativeToolsMaterials(root, [])).toBe(0);
  expect(a.visible).toBe(false);
  geometry.dispose();
  tools.dispose();
  visible.dispose();
});
test("mixed tool/visible batches fail rather than hiding visible map geometry", () => {
  const tools = new T.MeshBasicMaterial(),
    visible = new T.MeshBasicMaterial();
  tools.name = "source-flag";
  const geometry = new T.BoxGeometry(),
    mesh = new T.Mesh(geometry, [tools, visible]);
  expect(() => excludeNativeToolsMaterials(mesh, [tools.name])).toThrow("Mixed native");
  expect(mesh.visible).toBe(true);
  geometry.dispose();
  tools.dispose();
  visible.dispose();
});
