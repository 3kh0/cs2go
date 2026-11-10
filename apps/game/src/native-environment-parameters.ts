import type * as T from "three";
import type { SourceEnvironmentMaterial } from "./native-map-environment";

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
    const value = source.FloatParams[key] ?? fallback;
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
    return this.value(
      `vector:${key}:${size}`,
      (source.VectorParams[key] ?? fallback).slice(0, size),
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
