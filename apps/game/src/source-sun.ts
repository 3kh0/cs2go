import * as T from "three";

/** Fit receivers in light-space XY, but retain off-nav roofs in the depth
 * range. Map elevation must not leave the entire level behind the sun camera. */
export function fitSourceSunShadow(
  sun: T.DirectionalLight,
  areas: readonly { corners: readonly number[][] }[],
  scenery: T.Object3D,
) {
  const receivers = new T.Box3(),
    point = new T.Vector3();
  for (const area of areas)
    for (const corner of area.corners) {
      point.fromArray(corner);
      receivers.expandByPoint(point);
      point.y += 5;
      receivers.expandByPoint(point);
    }
  if (receivers.isEmpty()) return;
  const direction = sun.position.clone().sub(sun.target.position).normalize();
  sun.target.position.copy(receivers.getCenter(new T.Vector3()));
  sun.position.copy(sun.target.position).addScaledVector(direction, 100);
  sun.updateWorldMatrix(true, false);
  sun.target.updateWorldMatrix(true, false);
  sun.shadow.updateMatrices(sun);
  const view = sun.shadow.camera.matrixWorldInverse;
  const receiverView = new T.Box3();
  for (const area of areas)
    for (const corner of area.corners) {
      point.fromArray(corner).applyMatrix4(view);
      receiverView.expandByPoint(point);
      point.fromArray(corner);
      point.y += 5;
      receiverView.expandByPoint(point.applyMatrix4(view));
    }
  const depthBounds = receiverView.clone(),
    matrix = new T.Matrix4();
  scenery.updateWorldMatrix(true, true);
  scenery.traverseVisible((object) => {
    if (!(object instanceof T.Mesh) || !object.castShadow) return;
    let box: T.Box3 | null;
    if (object instanceof T.InstancedMesh) {
      if (!object.boundingBox) object.computeBoundingBox();
      box = object.boundingBox;
    } else {
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      box = object.geometry.boundingBox;
    }
    if (!box || box.isEmpty()) return;
    matrix.multiplyMatrices(view, object.matrixWorld);
    depthBounds.union(box.clone().applyMatrix4(matrix));
  });
  const padding = 8,
    near = 1;
  // Moving along the sun axis leaves its direction and receiver XY unchanged.
  sun.position.addScaledVector(direction, depthBounds.max.z + padding + near);
  Object.assign(sun.shadow.camera, {
    left: receiverView.min.x - padding,
    right: receiverView.max.x + padding,
    bottom: receiverView.min.y - padding,
    top: receiverView.max.y + padding,
    near,
    far: depthBounds.max.z - depthBounds.min.z + 2 * padding + near,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.updateWorldMatrix(true, false);
  sun.shadow.updateMatrices(sun);
  sun.shadow.needsUpdate = true;
}

const configured = new WeakSet<T.Mesh>();
/** Keep static silhouettes cached while drawing moving casters in a separate map. */
export function sourceSunCaster(root: T.Object3D, dynamic: boolean) {
  root.traverse((object) => {
    if (!(object instanceof T.Mesh)) return;
    object.userData.sourceSunDynamic = dynamic;
    if (dynamic) object.castShadow = true;
    if (configured.has(object)) return;
    configured.add(object);
    const before = object.onBeforeShadow.bind(object),
      after = object.onAfterShadow.bind(object);
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
    "#include <lights_fragment_begin>",
    T.ShaderChunk.lights_fragment_begin,
  );
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
