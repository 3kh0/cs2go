import * as T from "three";

const configured = new WeakSet<T.Mesh>();
/** Keep static silhouettes cached while drawing moving casters in a separate map. */
export function sourceSunCaster(root: T.Object3D, dynamic: boolean) {
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    object.userData.sourceSunDynamic = dynamic;
    if (dynamic) object.castShadow = true;
    if (configured.has(object)) return;
    configured.add(object);
    const before = object.onBeforeShadow,
      after = object.onAfterShadow;
    let skipped = false,
      start = 0,
      count = Infinity;
    object.onBeforeShadow = function (...args) {
      before.apply(this, args);
      const pass = args[3].userData.sourceSunPass;
      skipped = pass !== undefined && pass !== Number(this.userData.sourceSunDynamic);
      if (skipped) {
        start = args[4].drawRange.start;
        count = args[4].drawRange.count;
        // A range beyond the buffer exits renderBufferDirect before a GL draw;
        // zero-count ranges still consume draw calls in the current renderer.
        const end = args[4].index?.count ?? args[4].getAttribute("position").count;
        args[4].setDrawRange(end + 1, 0);
      }
    };
    object.onAfterShadow = function (...args) {
      if (skipped) args[4].setDrawRange(start, count);
      after.apply(this, args);
    };
  });
}

export function addSourceDynamicSun(
  root: T.Object3D,
  sun: T.DirectionalLight,
  scenery: T.Object3D,
) {
  sun.shadow.camera.userData.sourceSunPass = 0;
  sourceSunCaster(scenery, false);
  const dynamic = new T.DirectionalLight(0xffffff, 0);
  dynamic.name = "Dust II moving sun shadows";
  dynamic.position.copy(sun.position);
  dynamic.target.position.copy(sun.target.position);
  dynamic.castShadow = true;
  dynamic.shadow.camera.copy(sun.shadow.camera);
  dynamic.shadow.camera.userData.sourceSunPass = 1;
  dynamic.shadow.mapSize.copy(sun.shadow.mapSize);
  dynamic.shadow.bias = sun.shadow.bias;
  dynamic.shadow.normalBias = sun.shadow.normalBias;
  dynamic.shadow.radius = sun.shadow.radius;
  root.add(dynamic, dynamic.target);
  return dynamic;
}

// The first light supplies native sunlight. The zero-intensity second light
// renders only moving casters; its visibility also gates the first light.
export function applySourceSunShadows(shader: T.WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <shadowmap_pars_fragment>",
    `#include <shadowmap_pars_fragment>
    float sourceMovingSunVisibility() {
      #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 1
        DirectionalLightShadow s=directionalLightShadows[1];
        return getShadow(directionalShadowMap[1],s.shadowMapSize,s.shadowIntensity,s.shadowBias,s.shadowRadius,vDirectionalShadowCoord[1]);
      #else
        return 1.0;
      #endif
    }
  `,
  );
  shader.fragmentShader = shader.fragmentShader.replaceAll(
    "getDirectionalLightInfo( directionalLight, directLight );",
    "getDirectionalLightInfo( directionalLight, directLight );\nif (UNROLLED_LOOP_INDEX == 0) directLight.color *= sourceMovingSunVisibility();",
  );
}
