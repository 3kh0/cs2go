import { nativeComplexRareSources } from "./native-complex-rare-source-fixture";
import { nativeOpaqueAlphaMaterials } from "../src/native-complex-alpha-fence";
import { renderNativeComplexRareCoverage } from "./native-complex-rare-fixture";
export function renderNativeAlphaFence() {
  const resource =
      "materials/models/props/de_nuke/hr_nuke/chainlink_fence_001/chainlink_fence_wire_001.vmat",
    native = nativeOpaqueAlphaMaterials[resource];
  const source = {
    ...nativeComplexRareSources.mountains,
    nativeResource: resource,
    IntParams: { F_ALPHA_TEST: 1 },
    advancedSelection: {
      contract: "opaque-alpha-build26445667" as const,
      group: "opaque-alpha" as const,
      sourceSha256: native.sha256,
    },
    resolvedMaterialInputs: {
      ...nativeComplexRareSources.mountains.resolvedMaterialInputs,
      ...Object.fromEntries(Object.entries(native.scalars).map(([k, v]) => [k, [v, v, v, v]])),
    },
  };
  return {
    native: renderNativeComplexRareCoverage(source),
    hardMask: renderNativeComplexRareCoverage(source, { hardMask: true }),
    withoutPrepass: renderNativeComplexRareCoverage(source, { skipDepth: true }),
    wrongCutoff: renderNativeComplexRareCoverage(source, { wrongCutoff: true }),
    metal: renderNativeComplexRareCoverage(source, { debugMetal: true }),
    clone: renderNativeComplexRareCoverage(source, { clone: true }),
    mipBase: renderNativeComplexRareCoverage(source, { mip: "base" }),
    mipFar: renderNativeComplexRareCoverage(source, { mip: "far" }),
  };
}
