import type * as T from "three";
import type { SourceEnvironmentMaterial } from "./native-map-environment";

/** Installed ENV VCS MATERIAL_PARAM / FLOAT(0x3c23d70a) / MUL / RETURN
 * resolves authored bevel strength before the pixel shader's separate *100.
 * The authored value is not the shader uniform, despite their identical names. */
export function environmentBevelStrength(authored: number) {
  return Math.fround(Math.fround(authored) * Math.fround(0.01));
}

/** Native VCS g_vAmbientOcclusionLevels{1,2,3} expression. Retain its
 * authored control encoding and literal 0x3fb8aa65, rather than an ideal log2
 * conversion. JS log's final bits may differ from the native SIMD evaluator. */
export function environmentAmbientOcclusionLevels(authored: readonly number[]) {
  if (authored.length < 3 || authored.slice(0, 3).some((value) => !Number.isFinite(value)))
    throw new Error("Invalid authored native environment AO levels");
  const f = Math.fround;
  return [
    -f(authored[0]),
    f(-f(1.4427000284194946) * f(Math.log(Math.max(f(0.0001), f(1 - f(authored[1])))))),
    f(2 - f(authored[2])),
  ];
}

/** Material values belong to uniforms, while native feature decisions and
 * verified texture constants remain in the generated shader. Pack scalars so
 * three-layer materials do not consume one fragment uniform vector per float. */
export class EnvironmentShaderParameters {
  private readonly values: number[][] = [];
  private readonly expressions = new Map<string, { size: number; expression: string }>();
  private scalarSlot = -1;
  private scalarComponent = 4;

  value(key: string, value: readonly number[]) {
    if (value.length < 1 || value.length > 4 || value.some((number) => !Number.isFinite(number)))
      throw new Error(`Invalid native environment parameter: ${key}`);
    const previous = this.expressions.get(key);
    if (previous) {
      if (previous.size !== value.length)
        throw new Error(`Native environment parameter shape changed: ${key}`);
      return previous.expression;
    }
    let index: number,
      component = 0;
    if (value.length === 1) {
      if (this.scalarComponent === 4) {
        this.scalarSlot = this.values.length;
        this.values.push([0, 0, 0, 0]);
        this.scalarComponent = 0;
      }
      index = this.scalarSlot;
      component = this.scalarComponent++;
      this.values[index][component] = value[0];
    } else {
      index = this.values.length;
      this.values.push([...value, ...Array<number>(4 - value.length).fill(0)]);
    }
    const expression = `environmentParameters[${index}].${"xyzw".slice(component, component + value.length)}`;
    this.expressions.set(key, { size: value.length, expression });
    return expression;
  }

  float(source: SourceEnvironmentMaterial, key: string, fallback: number) {
    const authored = source.FloatParams[key] ?? fallback;
    const value =
      key === "g_flBevelStrength2" || key === "g_flBevelStrength3"
        ? environmentBevelStrength(authored)
        : authored;
    // Native zero/identity controls often remove an entire texture contribution.
    // Preserve those compile-time eliminations, especially on 16-sampler GPUs.
    return value === 0 || value === 1 ? `${value}.0` : this.value(`float:${key}`, [value]);
  }

  vector(
    source: SourceEnvironmentMaterial,
    key: string,
    fallback: number[],
    size = fallback.length,
  ) {
    const authored = (source.VectorParams[key] ?? fallback).slice(0, size);
    return this.value(
      `vector:${key}:${size}`,
      /^g_vAmbientOcclusionLevels[123]$/.test(key)
        ? environmentAmbientOcclusionLevels(authored)
        : authored,
    );
  }

  get vectorCount() {
    return this.values.length;
  }

  bind(shader: T.WebGLProgramParametersWithUniforms) {
    if (!this.values.length) return "";
    shader.uniforms.environmentParameters = { value: new Float32Array(this.values.flat()) };
    return `uniform vec4 environmentParameters[${this.values.length}];`;
  }
}
