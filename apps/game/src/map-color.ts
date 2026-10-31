import * as T from "three";

/** Mild display-space grade for imported scenery; HUD, agents and weapons stay untouched. */
export function gradeMapColors(root: T.Object3D) {
  const materials = new Set<T.Material>();
  root.traverse((object) => {
    if (object instanceof T.Mesh)
      for (const material of Array.isArray(object.material) ? object.material : [object.material])
        materials.add(material);
  });
  for (const material of materials) {
    const priorKey = material.customProgramCacheKey();
    const compile = material.onBeforeCompile.bind(material);
    material.onBeforeCompile = function (shader, renderer) {
      compile(shader, renderer);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <colorspace_fragment>",
        `#include <colorspace_fragment>
        float mapLuma = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
        gl_FragColor.rgb = clamp((mix(vec3(mapLuma), gl_FragColor.rgb, 1.12) - 0.5) * 1.04 + 0.5, 0.0, 1.0);
      `,
      );
    };
    material.customProgramCacheKey = () => `${priorKey}:cs2go-map-color-v2`;
    material.needsUpdate = true;
  }
}
