// Native paint descriptions from the CS2 Inspects composite API.
export type Value = number | number[];
export type Variables = Record<string, Value>;
export type PaintPass = {
  target_param: string;
  resolution: number;
  variables: Variables;
  textures: Record<string, string>;
  shader: {
    vs_wgsl_url: string;
    ps_wgsl_url: string;
    vs_ubo_size: number;
    ps_ubo_size: number;
    vs_ubo_globals: Uniform[];
    ps_ubo_globals: Uniform[];
    textures_layout: { name: string; binding: number; srgb: boolean }[];
    samplers: { binding: number; filter_mode: number; address_u: number; address_v: number }[];
    feat_values: number[];
    dynamic_globals: { name: string; exprs: string[] }[];
  };
};
export type Uniform = { name: string; type: string; dest: number };
export type PaintTarget = {
  target_vmat: string;
  passes: PaintPass[];
  direct_textures: Record<string, string>;
  rng: {
    roll_order: {
      seed_var: string;
      rolls: { key: string; min: number; max: number; apply: boolean }[];
    }[];
  };
};
export type Paint = { mesh_group: string; targets: PaintTarget[] };

// Source's shuffled Park-Miller stream. Consume even disabled rolls so the
// following wear/grunge rolls remain aligned with the original paint seed.
export function randomStream(seed: number) {
  let state = Math.max(1, Math.abs(Math.trunc(seed)));
  const table: number[] = [];
  const next = () => {
    state = (state * 16807) % 2147483647;
    return state;
  };
  for (let i = 39; i >= 0; i--) {
    const value = next();
    if (i < 32) table[i] = value;
  }
  let previous = table[0];
  return () => {
    const index = Math.floor(previous / 67108864);
    previous = table[index];
    table[index] = next();
    return previous / 2147483647;
  };
}
function hash(name: string) {
  const bytes = new TextEncoder().encode(name.toLowerCase());
  let h = (826366246 ^ bytes.length) >>> 0;
  let i = 0;
  for (; i + 4 <= bytes.length; i += 4) {
    let k = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24);
    k = Math.imul(k, 1540483477);
    k ^= k >>> 24;
    h = Math.imul(h, 1540483477) ^ Math.imul(k, 1540483477);
  }
  const remaining = bytes.length - i;
  if (remaining >= 3) h ^= bytes[i + 2] << 16;
  if (remaining >= 2) h ^= bytes[i + 1] << 8;
  if (remaining >= 1) h = Math.imul(h ^ bytes[i], 1540483477);
  h ^= h >>> 13;
  h = Math.imul(h, 1540483477);
  return (h ^ (h >>> 15)) >>> 0;
}
const scalar = (v: Value) => (Array.isArray(v) ? v[0] : v);
function binary(a: Value, b: Value, fn: (a: number, b: number) => number): Value {
  if (!Array.isArray(a) && !Array.isArray(b)) return fn(a, b);
  const length = Math.max(Array.isArray(a) ? a.length : 1, Array.isArray(b) ? b.length : 1);
  return Array.from({ length }, (_, i) =>
    fn(Array.isArray(a) ? (a[i] ?? 0) : a, Array.isArray(b) ? (b[i] ?? 0) : b),
  );
}
const argc = [
  1, 1, 1, 1, 1, 1, 1, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 4, 3, 2, 0, 2, 2, 1, 1,
];
function call(id: number, args: Value[]): Value {
  const [a = 0, b = 0, c = 0] = args.map(scalar);
  switch (id) {
    case 0:
      return Math.sin(a);
    case 1:
      return Math.cos(a);
    case 2:
      return Math.tan(a);
    case 3:
      return a - Math.floor(a);
    case 4:
      return Math.floor(a);
    case 5:
      return Math.ceil(a);
    case 6:
      return binary(args[0], 0, (x) => Math.max(0, Math.min(1, x)));
    case 7:
      return Math.max(b, Math.min(c, a));
    case 8:
      return binary(args[0], args[1], (x, y) => x + (y - x) * c);
    case 9:
    case 10:
    case 11:
      return (args[0] as number[])
        .slice(0, 13 - id)
        .reduce((sum, x, i) => sum + x * (args[1] as number[])[i], 0);
    case 12:
      return Math.log(a);
    case 13:
      return Math.log2(a);
    case 14:
      return Math.log10(a);
    case 15:
      return Math.exp(a);
    case 16:
      return 2 ** a;
    case 17:
      return Math.sqrt(a);
    case 18:
      return 1 / Math.sqrt(a);
    case 19:
      return Math.sign(a);
    case 20:
      return Math.abs(a);
    case 21:
      return a ** b;
    case 22:
      return b < a ? 0 : 1;
    case 23: {
      const t = Math.max(0, Math.min(1, (c - a) / (b - a)));
      return t * t * (3 - 2 * t);
    }
    case 24:
    case 25:
    case 26:
      return args.map(scalar);
    case 27:
      return 0;
    case 28:
      return Math.min(a, b);
    case 29:
      return Math.max(a, b);
    case 30:
    case 31: {
      // Source converts RGB only; alpha remains linear.
      const convert =
        id === 30
          ? (x: number) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055)
          : (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
      return Array.isArray(args[0]) ? args[0].map((x, i) => (i < 3 ? convert(x) : x)) : convert(a);
    }
    default:
      throw new Error(`Unsupported paint expression function ${id}`);
  }
}
// A small bounded interpreter for the original Source material expressions.
// Only numeric bytecode is accepted; this never evaluates JavaScript from assets.
export function expression(hex: string, vars: Variables, features: number[]): Value {
  const bytes = Uint8Array.from(hex.match(/../g) ?? [], (x) => parseInt(x, 16));
  const view = new DataView(bytes.buffer);
  const names = new Map(Object.keys(vars).map((name) => [hash(name), name]));
  const stack: Value[] = [],
    locals: Value[] = [];
  const pop = () => {
    const v = stack.pop();
    if (v === undefined) throw new Error("Paint stack underflow");
    return v;
  };
  let pc = 0,
    steps = 0;
  while (pc < bytes.length && steps++ < 10000) {
    const op = bytes[pc++];
    if (op === 0) return pop();
    if (op === 1 || op === 3 || op === 5) continue;
    if (op === 7) {
      stack.push(view.getFloat32(pc, true));
      pc += 4;
    } else if (op === 8) locals[bytes[pc++]] = pop();
    else if (op === 9) stack.push(locals[bytes[pc++]] ?? 0);
    else if (op === 25 || op === 29 || op === 31) {
      const name = names.get(view.getUint32(pc, true));
      pc += 4;
      if (op === 31) stack.push(Number(name !== undefined));
      else if (name !== undefined) stack.push(vars[name]);
      else throw new Error("Unknown paint expression variable");
    } else if (op === 26) stack.push(features[bytes[pc++]] ?? 0);
    else if (op === 27 || op === 28) {
      pc++;
      stack.push(0);
    } else if (op === 30) {
      const v = pop(),
        channels = bytes[pc++];
      const indices = [0, 1, 2, 3].map((i) => (channels >> (i * 2)) & 3);
      while (indices.length > 1 && indices.at(-1) === indices.at(-2)) indices.pop();
      const values = indices.map((i) => (Array.isArray(v) ? (v[i] ?? 0) : i === 0 ? v : 0));
      stack.push(values.length === 1 ? values[0] : values);
    } else if (op === 6) {
      const id = view.getUint16(pc, true);
      pc += 2;
      if (argc[id] === undefined) throw new Error(`Unsupported paint function ${id}`);
      stack.push(call(id, stack.splice(stack.length - argc[id], argc[id])));
    } else if (op === 2) pc = view.getUint16(pc, true);
    else if (op === 4) pc = view.getUint16(pc + (scalar(pop()) ? 0 : 2), true);
    else if (op === 12) stack.push(Number(!scalar(pop())));
    else if (op === 24) stack.push(binary(pop(), 0, (a) => -a));
    else if (op >= 10 && op <= 23) {
      const b = pop(),
        a = pop();
      stack.push(
        binary(a, b, (x, y) => {
          switch (op) {
            case 10:
              return Number(!!x || !!y);
            case 11:
              return Number(!!x && !!y);
            case 13:
              return Number(x === y);
            case 14:
              return Number(x !== y);
            case 15:
              return Number(x > y);
            case 16:
              return Number(x >= y);
            case 17:
              return Number(x < y);
            case 18:
              return Number(x <= y);
            case 19:
              return x + y;
            case 20:
              return x - y;
            case 21:
              return x * y;
            case 22:
              return y ? x / y : 0;
            case 23:
              return y ? x % y : 0;
            default:
              throw new Error("Unknown paint operator");
          }
        }),
      );
    } else throw new Error(`Unsupported paint opcode ${op}`);
  }
  throw new Error("Incomplete paint expression");
}
export function paintVariables(pass: PaintPass, target: PaintTarget, seed: number, wear: number) {
  const vars: Variables = structuredClone(pass.variables);
  for (const group of target.rng.roll_order) {
    const random = randomStream(/alt/i.test(group.seed_var) ? seed + 1 : seed);
    for (const roll of group.rolls) {
      const value = roll.min + random() * (roll.max - roll.min);
      if (!roll.apply) continue;
      const [, name, component] = roll.key.split(".");
      const existing = vars[name];
      if (Array.isArray(existing) && component) existing["xyzw".indexOf(component)] = value;
      else vars[name] = value;
    }
  }
  vars.g_flWearAmount = vars.g_fWearProgress = wear;
  // Skip unused composite globals (halftone variants are absent in many shaders).
  const used = new Set(
    [...pass.shader.vs_ubo_globals, ...pass.shader.ps_ubo_globals].map((x) => x.name),
  );
  for (const global of pass.shader.dynamic_globals) {
    if (!used.has(global.name)) continue;
    let error: unknown;
    for (const code of global.exprs) {
      try {
        vars[global.name] = expression(code, vars, pass.shader.feat_values);
        error = undefined;
        break;
      } catch (e) {
        error = e;
      }
    }
    if (error) throw error;
  }
  return vars;
}
