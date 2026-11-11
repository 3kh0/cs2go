import * as T from "three";
import { NativeMapLocalLights, applyNativeMapLocalLights } from "../src/native-map-local-lights";
import { createSourceReflectionField } from "../src/source-reflection-field";
import type { SourceReflections } from "../src/source-reflections";
import { applySourceSurface } from "../src/source-surface";

/** Actual map adapter plus reflection transport: one light, one affine probe,
 * 1x1 targets, two contexts. The uint count is read as uint in the shader. */
export function renderNativeUboCoexistence() {
  const field = createSourceReflectionField({
    uniforms: [
      {
        origin: new T.Vector3(0, 1, 0),
        index: 0,
        mins: new T.Vector3(-1, -1, -1),
        maxs: new T.Vector3(1, 1, 1),
        invEdge: new T.Vector3(1, 1, 1),
        sh: new T.Vector4(),
      },
    ],
    volumes: [{}],
  } as SourceReflections);
  const identity = new T.Matrix4().toArray();
  const worlds = Array.from({ length: 2 }, (_, world) => {
    const lights = new NativeMapLocalLights({
      version: 1,
      qualification: "Bounded GPU transport fixture",
      rejected: [],
      lights: [
        {
          id: `fixture-${world}`,
          qualification: "Finite red record",
          record: {
            projection: identity,
            worldToBounds: identity,
            positionRadius: [0, 0, 0, 1],
            depthFalloff: [1, 0, 0, 0],
            color: [1, 0, 0],
            rotation: [0, 0, 0, 1],
            angularLine: [0, 0, 0],
            barn: [0, 0, 0],
            shadowWeights: [0, 0, 0, 0],
            minimumRoughness: 1,
            cookieKind: 0,
          },
        },
      ],
    });
    const materials = Array.from({ length: 2 }, (_, variant) => {
      const material = new T.MeshStandardMaterial();
      material.name = `world${world}-material${variant}`;
      material.userData.nativeSourceFamily = "complex";
      material.userData.nativeBakedVisibility = "probe";
      field.attach(material);
      material.onBeforeCompile = (shader) => {
        applySourceSurface(shader, { directSpecular: true, indirectSpecular: false });
        shader.fragmentShader =
          "layout(std140) uniform NativeSourceReflectionField {vec4 nativeReflectionWords[13];};\n" +
          "struct SourceGpuProbe {vec4 occlusion;}; SourceGpuProbe nativePropProbe;\n" +
          shader.fragmentShader.replace(
            "void main() {",
            "void main() { nativePropProbe.occlusion=vec4(0.); ",
          );
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          "gl_FragColor=vec4(nativeLocalCount.x==1u && nativeLocalWorldToSource[3][3]==1. ? nativeLocalRecords[0].color.rgb+nativeReflectionWords[0].rgb : vec3(0.,0.,1.),1.);",
        );
      };
      material.customProgramCacheKey = () => `native-map-ubo-coexistence:${variant}`;
      return material;
    });
    const scene = new T.Scene();
    const geometry = new T.PlaneGeometry(2, 2);
    const mesh = new T.Mesh(geometry, materials[0]);
    scene.add(mesh);
    // Both variants must be admitted by the actual adapter.
    const secondary = new T.Mesh(geometry, materials[1]);
    secondary.visible = false;
    scene.add(secondary);
    applyNativeMapLocalLights(scene, lights);
    return { lights, materials, geometry, scene, mesh };
  });
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 3;
  const contexts = Array.from({ length: 2 }, () => {
    const renderer = new T.WebGLRenderer({ antialias: false });
    renderer.setSize(1, 1);
    renderer.outputColorSpace = T.LinearSRGBColorSpace;
    const target = new T.WebGLRenderTarget(1, 1);
    target.texture.colorSpace = T.LinearSRGBColorSpace;
    return { renderer, target };
  });
  const rows: {
    context: number;
    name: string;
    material: string;
    pixel: number[];
    expected: number[];
    blocks: { name: string; index: number; binding: number }[];
    error: number;
  }[] = [];
  const draw = (context: number, name: string, world: number, variant: number) => {
    const { renderer, target } = contexts[context];
    const { scene, mesh, materials } = worlds[world];
    mesh.material = materials[variant];
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixel = new Uint8Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
    const blocks = ["NativeMapLocalLightBlock", "NativeSourceReflectionField"].map((name) => {
      const index = gl.getUniformBlockIndex(program, name);
      return {
        name,
        index,
        binding: gl.getActiveUniformBlockParameter(
          program,
          index,
          gl.UNIFORM_BLOCK_BINDING,
        ) as number,
      };
    });
    rows.push({
      context,
      name,
      material: mesh.material.name,
      pixel: [...pixel],
      expected: [255, 255, 0, 255],
      blocks,
      error: gl.getError(),
    });
  };
  try {
    for (const context of [0, 1]) {
      const { renderer } = contexts[context];
      worlds[0].lights.render(renderer, () => {
        draw(context, "first-map", 0, 0);
        draw(context, "material-switch", 0, 1);
        worlds[1].lights.render(renderer, () => {
          draw(context, "nested-second-map", 1, 0);
          draw(context, "nested-material-switch", 1, 1);
        });
        draw(context, "restored-first-map", 0, 0);
      });
      worlds[1].lights.render(renderer, () => draw(context, "second-map-scope", 1, 0));
      worlds[0].lights.render(renderer, () => draw(context, "first-map-again", 0, 1));
      // Three owns all bindings; map materials also remain valid outside a scope.
      draw(context, "unwrapped-material", 0, 0);
    }
    worlds[0].lights.render(contexts[0].renderer, () => draw(0, "return-to-first-context", 0, 1));
    return { rows };
  } finally {
    worlds.forEach(({ lights, materials, geometry }) => {
      lights.dispose();
      materials.forEach((material) => material.dispose());
      geometry.dispose();
    });
    contexts.forEach(({ renderer, target }) => {
      target.dispose();
      renderer.dispose();
    });
  }
}
