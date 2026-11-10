import * as T from "three";
import {
  registerActorLighting,
  updateActorLighting,
  disposeActorLighting,
} from "../src/actor-lighting";
import {
  applyNativeMapFog,
  nativeFogParameters,
  type NativeFogDefinition,
} from "../src/native-map-fog";

export function renderNativeFog() {
  const renderer = new T.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
  renderer.setSize(33, 33);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const errors: string[] = [];
  renderer.debug.onShaderError = () => errors.push("shader compile failure");
  const cases: Record<string, number[]> = {};
  const cubeData = new Uint8Array(4 * 4 * 6 * 4);
  const faces = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 0, 255],
  ];
  for (let face = 0; face < 6; face++)
    for (let pixel = 0; pixel < 16; pixel++)
      cubeData.set([...faces[face], 255], (face * 16 + pixel) * 4);
  const cube = new T.DataArrayTexture(cubeData, 4, 4, 6);
  cube.minFilter = cube.magFilter = T.LinearFilter;
  cube.needsUpdate = true;
  function draw(
    name: string,
    definition: NativeFogDefinition,
    blend: "ordinary" | "additive" | "mod2x" = "ordinary",
    height = 0,
    actor = false,
    vertical = false,
  ) {
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(60, 1, 0.01, 10);
    camera.position.y = height * 0.0254;
    const material = actor
      ? new T.MeshStandardMaterial({ color: 0, emissive: new T.Color(0.2, 0.2, 0.2) })
      : new T.MeshBasicMaterial({ color: new T.Color(0.2, 0.2, 0.2) });
    // Select the real adapter's blend path without framebuffer composition;
    // read the factor itself for Mod2x and attenuation for additive.
    if (blend === "mod2x") material.userData.nativeStaticOverlayBlendMode = 3;
    if (blend === "additive") material.blending = T.AdditiveBlending;
    const plane = new T.Mesh(new T.PlaneGeometry(1, 1), material);
    plane.position.set(0, height * 0.0254, -20 * 0.0254);
    scene.add(plane);
    if (vertical) {
      camera.position.set(0, (height + 20) * 0.0254, 0);
      camera.up.set(0, 0, -1);
      camera.lookAt(plane.position.set(0, height * 0.0254, 0));
      plane.lookAt(camera.position);
    }
    const fog = {
      definition,
      parameters: nativeFogParameters(definition),
      cube: definition.cube ? cube : undefined,
    };
    if (actor) {
      registerActorLighting(plane, true);
      updateActorLighting(
        plane,
        plane.position,
        undefined,
        0,
        undefined,
        undefined,
        undefined,
        null,
        undefined,
        fog,
      );
    } else applyNativeMapFog(scene, fog);
    renderer.render(scene, camera);
    const gl = renderer.getContext(),
      pixel = new Uint8Array(4);
    gl.readPixels(16, 16, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    cases[name] = Array.from(pixel);
    if (actor) disposeActorLighting(plane);
    material.dispose();
    plane.geometry.dispose();
  }
  const gradient: NativeFogDefinition = {
    gradient: { distance: [10, 30, 1], color: [0.8, 0.2, 0.1], strength: 1, opacity: 0.8 },
  };
  draw("gradient", gradient);
  draw("actorGradient", gradient, "ordinary", 0, true);
  draw("vertical3DDistance", gradient, "ordinary", 0, false, true);
  draw("height", { gradient: { ...gradient.gradient!, height: [0, 20, 1] } }, "ordinary", 10);
  draw("additive", gradient, "additive");
  draw("mod2x", gradient, "mod2x");
  const cubeDefinition: NativeFogDefinition = {
    cube: {
      distance: [10, 30, 1],
      angles: [0, 0, 0],
      exposure: 1,
      opacity: 0.8,
      lodBias: 0,
      texture: {
        format: "BC6H",
        file: "fixture",
        gpuBytes: 96,
        mips: [{ width: 4, height: 4, bytes: 96 }],
        fallbackFile: "fixture",
        fallbackBytes: 768,
        fallbackMips: [{ width: 4, height: 4, bytes: 768 }],
      },
    },
  };
  draw("cubeSourcePositiveY", cubeDefinition);
  draw("cubeYaw90", { cube: { ...cubeDefinition.cube!, angles: [0, 90, 0] } });
  draw("orderedGradientThenCube", { ...gradient, ...cubeDefinition });
  draw("cubeDisabledHeightAtDifferentElevation", cubeDefinition, "ordinary", 100);
  const result = { cases, errors, glError: renderer.getContext().getError() };
  cube.dispose();
  renderer.dispose();
  return result;
}
