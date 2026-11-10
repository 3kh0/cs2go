import * as T from "three";
import {
  applySourceReflections,
  loadSourceReflections,
  sourceCubeSampling,
} from "../src/source-reflections";

export async function renderSourceReflections() {
  const renderer = new T.WebGLRenderer();
  const data = await loadSourceReflections(renderer);
  if (!data) throw new Error("Native reflection fixture requires desktop BPTC support");
  const target = new T.WebGLRenderTarget(32, 32, { type: T.FloatType });
  renderer.setRenderTarget(target);
  const scene = new T.Scene(),
    camera = new T.Camera();
  const geometry = new T.PlaneGeometry(2, 2);
  const uniforms = {
    sourceReflectionCubes0: { value: data.textures[0] },
    sourceReflectionCubes1: { value: data.textures[1] },
    referenceCube: { value: null as T.CompressedCubeTexture | null },
    testCube: { value: 0 },
    testFace: { value: 0 },
    testLod: { value: 0 },
    testManual: { value: 0 },
    testFixed: { value: 0 },
    testDirection: { value: new T.Vector3(1, 0, 0) },
    testNanBits: { value: 0x7fc00000 },
  };
  const vertexShader = "void main(){gl_Position=vec4(position,1.0);}";
  const material = new T.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader:
      sourceCubeSampling +
      `
    uniform samplerCube referenceCube;uniform int testCube;uniform int testFace;
    uniform float testLod;uniform int testNanBits;uniform int testManual;uniform int testFixed;uniform vec3 testDirection;
    void main(){
      vec3 direction=testFixed==1?testDirection:sourceCubeDirection((gl_FragCoord.xy-1.5)/29.0,testFace);
      if(testFixed==2)direction=vec3(uintBitsToFloat(uint(testNanBits)));
      if(testManual==3){gl_FragColor=vec4(vec3(isnan(direction)),1.0);return;}
      if(testManual==2){
        vec3 a=sourceCubeAddress(direction);
        gl_FragColor=vec4(testCube<42?textureLod(sourceReflectionCubes0,vec3(a.xy,float(testCube*6)+a.z),testLod).rgb:textureLod(sourceReflectionCubes1,vec3(a.xy,float((testCube-42)*6)+a.z),testLod).rgb,1.0);return;
      }
      vec3 color=testManual==1?sourceCubeSample(direction,testCube,testLod):textureLod(referenceCube,direction,testLod).rgb;
      gl_FragColor=vec4(color,1.0);
    }`,
  });
  const mesh = new T.Mesh(geometry, material);
  scene.add(mesh);
  const read = () => {
    renderer.render(scene, camera);
    const pixels = new Float32Array(32 * 32 * 4);
    renderer.readRenderTargetPixels(target, 0, 0, 32, 32, pixels);
    return pixels;
  };
  const reference = (index: number) => {
    uniforms.referenceCube.value?.dispose();
    const array = data.textures[index < 42 ? 0 : 1],
      local = index < 42 ? index : 0;
    const faces = Array.from({ length: 6 }, (_, face) => ({
      width: 256,
      height: 256,
      mipmaps: array.mipmaps.map((mip) => {
        const bytes = Math.ceil(mip.width / 4) ** 2 * 16;
        return {
          width: mip.width,
          height: mip.height,
          data: (mip.data as Uint8Array).subarray(
            (local * 6 + face) * bytes,
            (local * 6 + face + 1) * bytes,
          ),
        };
      }),
    }));
    const cube = new T.CompressedCubeTexture(faces, T.RGB_BPTC_UNSIGNED_Format);
    cube.colorSpace = T.NoColorSpace;
    cube.minFilter = T.LinearMipmapLinearFilter;
    cube.magFilter = T.LinearFilter;
    cube.needsUpdate = true;
    uniforms.referenceCube.value = cube;
    uniforms.testCube.value = index;
  };
  let maxError = 0,
    squaredError = 0,
    samples = 0;
  let nonCornerMaxError = 0,
    nonCornerSquaredError = 0,
    nonCornerSamples = 0;
  const hardwareCornerDifferences: number[][] = [];
  const unorderedSamples: { cube: number; lod: number; hardware: number[]; manual: number[] }[] =
    [];
  reference(0);
  uniforms.testFixed.value = 2;
  uniforms.testManual.value = 3;
  const unorderedInputChannels = Array.from(read().subarray(0, 3)).filter(
    (value) => value === 1,
  ).length;
  for (const cube of [0, 42]) {
    reference(cube);
    for (const lod of [0, 2.5, 5]) {
      uniforms.testLod.value = lod;
      uniforms.testManual.value = 2;
      const hardware = Array.from(read().subarray(0, 3));
      uniforms.testManual.value = 1;
      const manual = Array.from(read().subarray(0, 3));
      unorderedSamples.push({ cube, lod, hardware, manual });
    }
  }
  uniforms.testFixed.value = 0;
  for (const cube of [0, 29, 42]) {
    reference(cube);
    for (const lod of [0, 2.5, 5])
      for (let face = 0; face < 6; face++) {
        uniforms.testLod.value = lod;
        uniforms.testFace.value = face;
        uniforms.testManual.value = 0;
        const native = read();
        uniforms.testManual.value = 1;
        const manual = read();
        for (let i = 0; i < native.length; i++)
          if (i % 4 !== 3) {
            if (!Number.isFinite(native[i]) || !Number.isFinite(manual[i]))
              throw new Error("Non-finite native reflection sample");
            const error = Math.abs(native[i] - manual[i]);
            maxError = Math.max(maxError, error);
            squaredError += error * error;
            samples++;
            // Cube-corner replacement is implementation-dependent in ES.
            // Compare hardware elsewhere; verify our three-corner average below.
            const px = Math.floor(i / 4) % 32,
              py = Math.floor(i / 4 / 32);
            const u = ((px - 1) / 29) * 2 - 1,
              v = ((py - 1) / 29) * 2 - 1;
            const directions = [
              [1, -v, -u],
              [-1, -v, u],
              [u, 1, v],
              [u, -1, -v],
              [u, -v, 1],
              [-u, -v, -1],
            ];
            const [dx, dy, dz] = directions[face],
              ax = Math.abs(dx),
              ay = Math.abs(dy),
              az = Math.abs(dz);
            let s: number, t: number;
            if (ax >= ay && ax >= az) {
              s = (dx > 0 ? -dz : dz) / ax;
              t = -dy / ax;
            } else if (ay >= az) {
              s = dx / ay;
              t = (dy > 0 ? dz : -dz) / ay;
            } else {
              s = (dz > 0 ? dx : -dx) / az;
              t = -dy / az;
            }
            const inset = 1 / (256 >> Math.ceil(lod));
            const corner = 1 - Math.abs(s) < inset && 1 - Math.abs(t) < inset;
            if (!corner) {
              nonCornerMaxError = Math.max(nonCornerMaxError, error);
              nonCornerSquaredError += error * error;
              nonCornerSamples++;
            }
            if (corner && error > 0.02 && hardwareCornerDifferences.length < 8)
              hardwareCornerDifferences.push([cube, lod, face, i, native[i], manual[i]]);
          }
      }
  }
  uniforms.testFixed.value = 1;
  const nativeSample = (cube: number, direction: T.Vector3, lod = 0) => {
    reference(cube);
    uniforms.testManual.value = 0;
    uniforms.testLod.value = lod;
    uniforms.testDirection.value.copy(direction);
    return Array.from(read().subarray(0, 3));
  };
  const a = nativeSample(0, new T.Vector3(1, 0, 0)),
    b = nativeSample(42, new T.Vector3(1, 0, 0));
  const volumes = data.uniforms.map((v) => ({ ...v }));
  const near = 255 / 256;
  const cornerNeighbors = [
    new T.Vector3(1, near, near),
    new T.Vector3(near, 1, near),
    new T.Vector3(near, near, 1),
  ].map((direction) => nativeSample(29, direction));
  const hardwareCorner = nativeSample(29, new T.Vector3(1, 1, 1));
  uniforms.testManual.value = 1;
  const manualCorner = Array.from(read().subarray(0, 3));
  const cornerAverage = [0, 1, 2].map((channel) =>
    cornerNeighbors.reduce((sum, rgb) => sum + rgb[channel] / 3, 0),
  );
  for (let i = 0; i < 2; i++)
    volumes[i] = {
      origin: new T.Vector3(),
      index: i ? 42 : 0,
      mins: new T.Vector3(-10, -10, -10),
      maxs: new T.Vector3(10, 10, 10),
      invEdge: new T.Vector3(0.1, 0.1, 0.1),
      sh: new T.Vector4(0, 0, 0, 0),
    };
  const position = { value: new T.Vector3() },
    normal = { value: new T.Vector3(1, 0, 0) },
    view = { value: new T.Vector3(1, 0, 0) },
    roughness = { value: 0 },
    irradiance = { value: new T.Vector3(1, 1, 1) };
  const blend = new T.ShaderMaterial({
    vertexShader,
    uniforms: {
      testPosition: position,
      testNormal: normal,
      testView: view,
      testRoughness: roughness,
      testIrradiance: irradiance,
    },
    // This probe calls sourceMapReflection directly. Retain Three's guarded
    // lighting anchor for the production adapter without executing its lighting.
    fragmentShader: `
    #if 0
    #include <lights_fragment_end>
    #endif
    uniform vec3 testPosition;uniform vec3 testNormal;uniform vec3 testView;uniform float testRoughness;uniform vec3 testIrradiance;
    void main(){gl_FragColor=vec4(sourceMapReflection(testPosition,testNormal,testView,testRoughness,testIrradiance),1.0);}`,
  });
  let candidateUniform: { value: Int32Array } | undefined;
  blend.onBeforeCompile = (shader) => {
    applySourceReflections(shader, { ...data, uniforms: volumes }, [0, 1]);
    candidateUniform = shader.uniforms.sourceEnvironmentCandidates;
  };
  blend.customProgramCacheKey = () => "reflection-blend";
  mesh.material = blend;
  const sample = () => Array.from(read().subarray(0, 3));
  const priorityA = sample();
  const shared = blend.clone();
  shared.onBeforeCompile = (shader) =>
    applySourceReflections(shader, { ...data, uniforms: volumes }, [1, 0]);
  shared.customProgramCacheKey = () => "reflection-blend";
  mesh.material = shared;
  const sharedPriorityB = sample();
  mesh.material = blend;
  const restoredPriorityA = sample();
  shared.dispose();
  candidateUniform!.value.set([1, 0]);
  const priorityB = sample();
  candidateUniform!.value.set([0, 1]);
  volumes[0].invEdge.set(0.05, 0.05, 0.05);
  const halfBlend = sample();
  position.value.set(100, 100, 100);
  const outside = sample();
  position.value.set(0, 0, 0);
  volumes[0].invEdge.set(0.1, 0.1, 0.1);
  volumes[0].sh.set(0, 0, 0, 2);
  irradiance.value.setScalar(0.5);
  const normalized = sample();
  irradiance.value.set(1, 0, 0);
  const coloredNormalized = sample();
  irradiance.value.setScalar(4);
  const noBrightening = sample();
  volumes[0].sh.set(0, 0, 0, 0);
  volumes[0].invEdge.setScalar(100);
  position.value.set(5, 0, 0);
  normal.value.set(0, 0, 1);
  view.value.set(0, 0, 1);
  const parallax = sample();
  roughness.value = 0.5;
  const roughParallax = sample();
  view.value.set(0.6, 0, 0.8);
  const obliqueParallax = sample();
  const R = view.value.clone().negate().reflect(normal.value);
  R.copy(normal.value.clone().lerp(R, 0.75 * (Math.sqrt(0.75) + 0.25))).normalize();
  const far = [0, 1, 2].map((axis) =>
    Math.max(
      (-10 - position.value.getComponent(axis)) / R.getComponent(axis),
      (10 - position.value.getComponent(axis)) / R.getComponent(axis),
    ),
  );
  const distance = Math.abs(Math.min(...far));
  const obliqueDirection = position.value
    .clone()
    .addScaledVector(R, distance)
    .multiplyScalar(0.5)
    .addScaledVector(R, 0.5);
  mesh.material = material;
  const parallaxExpected = nativeSample(0, new T.Vector3(5, 0, 10));
  const roughParallaxExpected = nativeSample(0, new T.Vector3(2.5, 0, 5.5), Math.sqrt(0.5) * 5);
  const obliqueParallaxExpected = nativeSample(0, obliqueDirection, Math.sqrt(0.5) * 5);
  const result = {
    rendererIdentity: (() => {
      const gl = renderer.getContext(),
        debug = gl.getExtension("WEBGL_debug_renderer_info");
      return gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) as string;
    })(),
    glError: renderer.getContext().getError(),
    maxError,
    nonCornerMaxError,
    nonCornerRmsError: Math.sqrt(nonCornerSquaredError / nonCornerSamples),
    nonCornerSamples,
    manualCorner,
    hardwareCorner,
    cornerAverage,
    rmsError: Math.sqrt(squaredError / samples),
    samples,
    hardwareCornerDifferences,
    unorderedInputChannels,
    unorderedSamples,
    a,
    b,
    priorityA,
    sharedPriorityB,
    restoredPriorityA,
    priorityB,
    halfBlend,
    outside,
    normalized,
    coloredNormalized,
    noBrightening,
    parallax,
    parallaxExpected,
    roughParallax,
    roughParallaxExpected,
    obliqueParallax,
    obliqueParallaxExpected,
    gpuBytes: data.textures.reduce(
      (sum, t) => sum + t.mipmaps.reduce((bytes, mip) => bytes + mip.data.byteLength, 0),
      0,
    ),
  };
  uniforms.referenceCube.value?.dispose();
  for (const texture of data.textures) texture.dispose();
  blend.dispose();
  material.dispose();
  geometry.dispose();
  target.dispose();
  renderer.dispose();
  return result;
}
