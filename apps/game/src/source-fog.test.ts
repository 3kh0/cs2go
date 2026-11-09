import * as T from "three";
import { expect, test } from "vitest";
import { applySourceFog, setSourceFogSky, withoutSourceFog } from "./source-fog";

test("vanity fog isolation restores gameplay uniforms after nested captures and failures", () => {
  const texture = new T.CubeTexture();
  setSourceFogSky(texture);
  const shader = {
    uniforms: {},
    fragmentShader: "#include <tonemapping_fragment>",
  } as T.WebGLProgramParametersWithUniforms;
  applySourceFog(shader);
  const ready = shader.uniforms.sourceFogReady;
  expect(ready.value).toBe(1);
  expect(() =>
    withoutSourceFog(() => {
      expect(ready.value).toBe(0);
      withoutSourceFog(() => expect(ready.value).toBe(0));
      expect(ready.value).toBe(0);
      throw new Error("capture failed");
    }),
  ).toThrow("capture failed");
  expect(ready.value).toBe(1);
  setSourceFogSky();
  texture.dispose();
});
