import { describe, expect, it } from "vitest";
import { DataTexture, Matrix3, RepeatWrapping, Texture, Vector2 } from "three";
import { textureCoordinateKey, withTextureCoordinates } from "./skin-texture";

describe("paint replacement on compressed model UVs", () => {
  it("preserves the imported UV decode transform instead of sampling one atlas corner", () => {
    const imported = new Texture();
    imported.flipY = false;
    imported.wrapS = imported.wrapT = RepeatWrapping;
    imported.offset.set(0, 0.00357066561);
    imported.repeat.set(15.6207514, 15.9074459);
    const baked = new DataTexture(new Uint8Array(16), 2, 2);
    baked.flipY = false;
    baked.wrapS = baked.wrapT = RepeatWrapping;
    const painted = withTextureCoordinates(baked, imported);
    const quantizedUV = new Vector2(0.043, 0.051);
    const expected = imported.transformUv(quantizedUV.clone());
    expect(painted.transformUv(quantizedUV.clone()).distanceTo(expected)).toBeLessThan(1e-10);
    expect(baked.transformUv(quantizedUV.clone()).distanceTo(expected)).toBeGreaterThan(0.8);
    expect(painted.source).toBe(baked.source);
    expect(baked.repeat.toArray()).toEqual([1, 1]);
  });
  it("keeps independent material channels and manually supplied matrices", () => {
    const baked = new Texture();
    const original = new Texture();
    original.channel = 2;
    original.matrixAutoUpdate = false;
    original.matrix = new Matrix3().setUvTransform(0.2, 0.3, 2, 3, 0.5, 0.4, 0.5);
    const a = withTextureCoordinates(baked, original);
    const key = textureCoordinateKey(original);
    original.matrix.elements[6] += 0.25;
    const b = withTextureCoordinates(baked, original);
    expect(a.channel).toBe(2);
    expect(a.matrixAutoUpdate).toBe(false);
    expect(a.matrix.equals(b.matrix)).toBe(false);
    expect(textureCoordinateKey(original)).not.toBe(key);
    expect(a.source).toBe(b.source);
  });
});
