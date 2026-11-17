import * as T from "three";

type Binding = { page: number; offset: number };
let nextField = 1;

/** Bank immutable material constants without adding texture samplers or
 * compiling their values into hundreds of distinct shader programs. */
export class NativeEnvironmentParameterField {
  private readonly id = nextField++;
  private readonly pages: { group: T.UniformsGroup; values: T.Vector4[]; used: number }[] = [];
  private readonly bindings = new Map<string, Binding>();

  private readonly capacity: number;
  private readonly maxPages: number;
  constructor(capacity: number, maxPages: number) {
    this.capacity = capacity;
    this.maxPages = maxPages;
  }

  add(material: T.Material, words: Float32Array): Binding | undefined {
    if (!words.length || words.length % 4 || words.length / 4 > this.capacity) return;
    // Preserve Float32 identity, including signed zero, when sharing rows.
    const key = new Uint32Array(words.buffer, words.byteOffset, words.length).join(",");
    let binding = this.bindings.get(key);
    if (!binding) {
      let page = this.pages.at(-1);
      if (!page || page.used + words.length / 4 > this.capacity) {
        if (this.pages.length >= this.maxPages) return;
        const values = Array.from({ length: this.capacity }, () => new T.Vector4(0, 0, 0, 0));
        page = {
          group: new T.UniformsGroup()
            .setName("NativeEnvironmentParameterField")
            .add(new T.Uniform(values)),
          values,
          used: 0,
        };
        this.pages.push(page);
      }
      binding = { page: this.pages.length - 1, offset: page.used };
      for (let i = 0; i < words.length; i += 4) page.values[page.used++].fromArray(words, i);
      this.bindings.set(key, binding);
    }
    // Material clones retain numeric ownership tags; no GPU resources enter
    // userData's JSON cloning path.
    material.userData.nativeEnvironmentField = this.id;
    material.userData.nativeEnvironmentPage = binding.page;
    return binding;
  }

  apply(shader: T.WebGLProgramParametersWithUniforms, binding: Binding) {
    delete shader.uniforms.environmentParameters;
    shader.uniforms.nativeEnvironmentParameterOffset = { value: binding.offset };
    const convert = (source: string) =>
      source
        .replace(
          /uniform vec4 environmentParameters\[\d+\];/g,
          `layout(std140) uniform NativeEnvironmentParameterField { vec4 nativeEnvironmentParameters[${this.capacity}]; };uniform int nativeEnvironmentParameterOffset;`,
        )
        .replace(
          /environmentParameters\[([^\]]+)\]/g,
          "nativeEnvironmentParameters[nativeEnvironmentParameterOffset+($1)]",
        );
    shader.vertexShader = convert(shader.vertexShader);
    shader.fragmentShader = convert(shader.fragmentShader);
  }

  attach(material: T.Material) {
    if (material.userData.nativeEnvironmentField !== this.id) return;
    const group = this.pages[material.userData.nativeEnvironmentPage]?.group;
    if (!group) throw new Error("Native environment parameter bank unavailable");
    const target = material as T.Material & { uniformsGroups?: T.UniformsGroup[] };
    if (!target.uniformsGroups?.includes(group))
      target.uniformsGroups = [...(target.uniformsGroups ?? []), group];
  }

  get cacheKey() {
    return `environment-parameter-field:${this.capacity}`;
  }
  dispose() {
    for (const page of this.pages) page.group.dispose();
  }
}
