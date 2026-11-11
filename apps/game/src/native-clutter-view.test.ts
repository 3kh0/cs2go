import { expect, it, vi } from "vitest";
import * as T from "three";
import { assetFetch } from "./asset-url";
import { fetchGzipped, loadGzipped } from "./gltf";
import { loadNativeMapFoliage, type NativeFoliageMaterial } from "./native-map-foliage";
import { loadNativeClutterView } from "./native-clutter-view";
import { nativeClutterSwayPadding } from "./native-clutter-wind";
import { MapResources } from "./map-resources";
import type { SourceReflections } from "./source-reflections";

vi.mock("./asset-url", () => ({ assetFetch: vi.fn() }));
vi.mock("./gltf", () => ({ fetchGzipped: vi.fn(), loadGzipped: vi.fn() }));
vi.mock("./native-map-foliage", async (original) => ({
  ...(await original<typeof import("./native-map-foliage")>()),
  loadNativeMapFoliage: vi.fn(),
}));

function definition(): NativeFoliageMaterial {
  return {
    shader: "csgo_foliage.vfx",
    nativeResource: "leaf.vmat",
    IntParams: { F_VERTEX_ANIMATION: 1, F_ALPHA_TEST: 1 },
    FloatParams: Object.fromEntries(
      [
        "g_flAlphaTestReference",
        "g_flAlphaBoostDistance",
        "g_flAlphaBoostStrength",
        "g_flGrazingAngleMask",
        "g_flVertexAmbientOcclusionAmount",
        "g_flVertexAmbientOcclusionPower",
        "g_flHeightGradientAmount",
        "g_flHeightGradientPower",
        "g_flReflectance",
        "g_fTextureNormalContrast",
        "g_fTextureRoughnessContrast",
        "g_fTextureRoughnessBrightness",
        "g_flSwayAmount",
        "g_flSwaySpeed",
        "g_flSwayNoiseScale",
        "g_flSwayFalloff",
        "g_flFlutterAmount",
        "g_flFlutterSpeed",
        "g_flFlutterNoiseScale",
        "g_flFlutterFalloff",
      ].map((name) => [name, name === "g_flHeightGradientAmount" ? 0 : 1]),
    ),
    VectorParams: {},
    textures: { g_tColor: "color", g_tNormal: "normal", g_tAmbientOcclusion: "ao" },
    resolvedMaterialInputs: {
      g_bDontFlipBackfaceNormals: 0,
      g_bRenderBackfaceNormals: 0,
      g_bTransmissiveShadows: 1,
      g_bApplyColorCorrectionToTransmissiveColor: 0,
      g_vTexCoordXform0: [1, 0, 0, 0],
      g_vTexCoordXform1: [0, 1, 0, 0],
      g_vTexCoordScrollSpeed: [0, 0, 0, 0],
    },
  };
}

it.each(["main", "sky"] as const)(
  "%s clutter retains complete local wind bounds in color and depth under placement",
  async (scope) => {
    const bounds = { m_vMinBounds: [0, 0, 0], m_vMaxBounds: [10000, 10000, 10000] };
    const fields = {
      version: 1,
      scope,
      placements: { count: 2, stride: 24, bytes: 48, file: "placements.gz" },
      groups: [
        {
          id: "tile",
          nativeGroupIndex: 0,
          nativeResource: "leaf",
          templateNativeSha256: "pin",
          materialGroup: "",
          firstInstance: 0,
          instanceCount: 2,
          nativeLayer: 0,
          nativeFlags: "OBJECT_TYPE_NONE",
          nativeBeginCullSize: 0.02,
          nativeEndCullSize: 0.01,
          nativeBounds: bounds,
          nativeTiles: [{ m_nFirstInstance: 0, m_nLastInstance: 2, m_BoundsWs: bounds }],
        },
      ],
      geometryManifest: "/geometry.json",
      foliageMaterials: "/foliage/source.json",
      reflectionMetadata: { file: "unused", volumes: 0, maxGpuBytes: 0 },
    };
    const bytes = new ArrayBuffer(48),
      values = new DataView(bytes);
    for (let i = 0; i < 2; i++) {
      const offset = i * 24;
      values.setFloat32(offset, 100 + i * 400, true);
      values.setFloat32(offset + 4, 200, true);
      values.setFloat32(offset + 8, 300, true);
      values.setFloat32(offset + 12, 1.6 + i * 0.4, true);
      values.setUint32(offset + 16, 1735371784, true);
      for (let c = 20; c < 23; c++) values.setUint8(offset + c, 255);
    }
    const template = new T.Group(),
      geometry = new T.PlaneGeometry(2, 3),
      material = new T.MeshStandardMaterial();
    geometry.computeTangents();
    geometry.setAttribute("color", new T.Float32BufferAttribute(new Float32Array(16).fill(1), 4));
    material.name = "unique_leaf";
    material.userData.nativeGltfMaterialIndex = 0;
    template.add(new T.Mesh(geometry, material));
    const native = definition(),
      textures = new Map(
        ["color", "normal", "ao"].map((key) => [key, new T.DataTexture(new Uint8Array(4), 1, 1)]),
      ),
      noise = new T.Data3DTexture(new Uint8Array(32), 2, 2, 2);
    noise.colorSpace = T.NoColorSpace;
    const bundle = {
      materials: { leaf: native },
      textures,
      noise,
      lookup: new T.DataTexture(),
      source: {
        noise: "unit",
        materials: { leaf: native },
        textures: {},
        controllers: [
          {
            space: scope === "sky" ? "sky0" : "main",
            values: {
              classname: "env_wind",
              minwind: 20,
              maxwind: 20,
              mingust: 30,
              maxgust: 40,
              mingustdelay: 10,
              maxgustdelay: 20,
              gustduration: 5,
              gustdirchange: 20,
              windradius: -1,
              angles: [0, 0, 0],
            },
          },
        ],
      },
    };
    vi.mocked(assetFetch).mockImplementation(async (path) =>
      Response.json(
        path === "/geometry.json"
          ? {
              models: [
                {
                  kind: "clutter-template",
                  scope,
                  file: "/leaf.glb.gz",
                  resource: "leaf",
                  nativeModelSha256: "pin",
                  nativeShaders: ["csgo_foliage.vfx"],
                  materials: ["unique_leaf"],
                  nativeDrawMaterials: ["leaf"],
                },
              ],
            }
          : fields,
      ),
    );
    vi.mocked(fetchGzipped).mockResolvedValue(bytes);
    vi.mocked(loadGzipped).mockResolvedValue({ scene: template } as Awaited<
      ReturnType<typeof loadGzipped>
    >);
    vi.mocked(loadNativeMapFoliage).mockResolvedValue(bundle);
    const renderer = {
      autoClear: true,
      getRenderTarget: () => ({ samples: 4 }),
      render: vi.fn(),
    };
    const placement =
        scope === "sky"
          ? new T.Matrix4().compose(
              new T.Vector3(100, -50, 300),
              new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), 0.6),
              new T.Vector3(16, 16, 16),
            )
          : new T.Matrix4(),
      resources = new MapResources();
    try {
      const view = await loadNativeClutterView(
        renderer as unknown as T.WebGLRenderer,
        "/clutter/source.json",
        resources,
        { volumes: [] } as unknown as SourceReflections,
        placement,
      );
      const color = view.foliage.children[0] as T.InstancedMesh;
      const base = new T.Box3();
      geometry.computeBoundingBox();
      for (let i = 0; i < color.count; i++) {
        const matrix = new T.Matrix4();
        color.getMatrixAt(i, matrix);
        base.union(geometry.boundingBox!.clone().applyMatrix4(matrix));
      }
      const padding = nativeClutterSwayPadding(
        {
          swayAmount: 1,
          swaySpeed: 1,
          swayNoiseScale: 1,
          swayFalloff: 1,
          flutterAmount: 1,
          flutterSpeed: 1,
          flutterNoiseScale: 1,
          flutterFalloff: 1,
        },
        0.35,
      );
      const expected = base.clone().expandByScalar(padding).getBoundingSphere(new T.Sphere());
      expect(color.frustumCulled).toBe(true);
      expect(color.boundingSphere).toEqual(expected);
      expect(color.boundingSphere!.radius).toBeGreaterThan(
        base.getBoundingSphere(new T.Sphere()).radius,
      );
      view.renderDepth(new T.PerspectiveCamera());
      const depthScene = renderer.render.mock.calls[0][0] as T.Scene;
      const depth = depthScene.children[0] as T.InstancedMesh;
      expect(depth.frustumCulled).toBe(true);
      expect(depth.boundingSphere).toEqual(expected);
      expect(depth.boundingSphere).not.toBe(color.boundingSphere);
      expect(depth.matrix.elements).toEqual(color.matrixWorld.elements);
      const worldSphere = expected.clone().applyMatrix4(placement);
      expect(color.boundingSphere!.clone().applyMatrix4(color.matrixWorld)).toEqual(worldSphere);
      expect(depth.boundingSphere!.clone().applyMatrix4(depth.matrix)).toEqual(worldSphere);
      const camera = new T.PerspectiveCamera(40, 1, 0.1, 100000);
      camera.position.copy(worldSphere.center).add(new T.Vector3(0, 0, 1000));
      camera.lookAt(worldSphere.center);
      camera.updateMatrixWorld();
      const frustum = new T.Frustum().setFromProjectionMatrix(
        new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      );
      expect(frustum.intersectsObject(color)).toBe(true);
      expect(frustum.intersectsObject(depth)).toBe(true);
      camera.lookAt(camera.position.clone().add(new T.Vector3(0, 0, 1000)));
      camera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(
        new T.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse),
      );
      expect(frustum.intersectsObject(color)).toBe(false);
      expect(frustum.intersectsObject(depth)).toBe(false);
      color.boundingSphere!.radius += 1;
      expect(depth.boundingSphere).toEqual(expected);
      view.renderDepth(camera);
      expect(depth.boundingSphere).toEqual(color.boundingSphere);
    } finally {
      resources.dispose();
      bundle.lookup.dispose();
      vi.clearAllMocks();
    }
  },
);
