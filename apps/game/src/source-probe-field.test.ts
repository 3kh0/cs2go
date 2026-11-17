import * as T from "three";
import { expect, test, vi } from "vitest";
import { bindSourceProbeField } from "./source-probe-field";
import type { SourceGpuProbes } from "./source-gpu-probes";

test("switching probe maps retains other blocks and does not dispose a shared field", () => {
  const material = new T.ShaderMaterial(),
    reflection = new T.UniformsGroup(),
    first = new T.UniformsGroup(),
    second = new T.UniformsGroup(),
    disposed = vi.fn();
  first.addEventListener("dispose", disposed);
  material.uniformsGroups = [reflection];
  const probes = (uniformsGroup: T.UniformsGroup) => ({ uniformsGroup }) as SourceGpuProbes;
  bindSourceProbeField(material, probes(first));
  bindSourceProbeField(material, probes(first));
  expect(material.uniformsGroups).toEqual([reflection, first]);
  bindSourceProbeField(material, probes(second));
  expect(material.uniformsGroups).toEqual([reflection, second]);
  bindSourceProbeField(material, null);
  expect(material.uniformsGroups).toEqual([reflection]);
  expect(disposed).not.toHaveBeenCalled();
  material.dispose();
  first.dispose();
  second.dispose();
  reflection.dispose();
});
