import { assetUrl } from "./asset-url";
import * as T from "three";
import { SOURCE_UNIT, weapons, weaponSlot } from "./physics";

// Native CS2 particle speeds, maximum trail lengths and length fade-in times.
// See public/effects/tracer-source.json for the pinned resources and limitations.
export function tracerProfile(weapon: number) {
  if (weapons[weapon]?.pellets > 1)
    return {
      speed: 24250 * SOURCE_UNIT,
      length: 900 * SOURCE_UNIT,
      grow: 0.05,
      trail: 0.04,
      fadeIn: [0.15, 0.25],
    };
  if (weaponSlot(weapon) === 2)
    return {
      speed: 18000 * SOURCE_UNIT,
      length: 900 * SOURCE_UNIT,
      grow: 0.05,
      trail: 0.05,
      fadeIn: [0.2, 0.35],
    };
  if (weapons[weapon]?.zoomLevels > 1)
    return {
      speed: 30000 * SOURCE_UNIT,
      length: 900 * SOURCE_UNIT,
      grow: 0.1,
      trail: 0.1,
      fadeIn: [0.2, 0.3],
    };
  return {
    speed: 20500 * SOURCE_UNIT,
    length: 1200 * SOURCE_UNIT,
    grow: 0.08,
    trail: 0.0925,
    fadeIn: [0.2, 0.3],
  };
}
const geometry = new T.PlaneGeometry(1, 1);
const material = new T.ShaderMaterial({
  uniforms: {
    start: { value: new T.Vector3() },
    end: { value: new T.Vector3() },
    opacity: { value: 0 },
    core: { value: null },
    glow: { value: null },
  },
  vertexShader: `
    uniform vec3 start, end;
    varying vec2 texcoord;
    void main() {
      vec3 a = (viewMatrix * vec4(start, 1.0)).xyz;
      vec3 b = (viewMatrix * vec4(end, 1.0)).xyz;
      vec3 axis = b - a;
      vec2 lateral = vec2(-axis.y, axis.x);
      if (dot(lateral, lateral) < 0.000001) lateral = vec2(1.0, 0.0);
      vec3 point = mix(a, b, uv.y);
      float radius = clamp(0.0254 * 0.75, max(0.001, -point.z * 0.00075), max(0.002, -point.z * 0.002));
      point.xy += normalize(lateral) * position.x * radius * 2.0;
      gl_Position = projectionMatrix * vec4(point, 1.0);
      texcoord = vec2(uv.x, 1.0 - uv.y);
    }`,
  fragmentShader: `
    uniform sampler2D core, glow;
    uniform float opacity;
    varying vec2 texcoord;
    void main() {
      vec4 sharp = texture2D(core, texcoord);
      vec4 soft = texture2D(glow, texcoord);
      vec3 light = sharp.rgb * sharp.a + soft.rgb * soft.a * vec3(1.0, 0.48, 0.12) * 0.22;
      gl_FragColor = vec4(light, opacity);
      #include <colorspace_fragment>
    }`,
  transparent: true,
  blending: T.AdditiveBlending,
  depthWrite: false,
  depthTest: true,
  side: T.DoubleSide,
  toneMapped: false,
});
export async function loadTracerTextures() {
  const loader = new T.TextureLoader();
  const [core, glow] = await Promise.all([
    loader.loadAsync(assetUrl("/effects/tracer-core.png")),
    loader.loadAsync(assetUrl("/effects/tracer-glow.png")),
  ]);
  for (const texture of [core, glow]) texture.colorSpace = T.SRGBColorSpace;
  material.uniforms.core.value = core;
  material.uniforms.glow.value = glow;
}
export function createTracer() {
  const instance = material.clone();
  instance.uniforms.core.value = material.uniforms.core.value;
  instance.uniforms.glow.value = material.uniforms.glow.value;
  const mesh = new T.Mesh(geometry, instance);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return {
    mesh,
    life: 0,
    age: 0,
    flight: 0,
    distance: 0,
    fresh: true,
    endpointShown: false,
    from: new T.Vector3(),
    direction: new T.Vector3(),
    profile: tracerProfile(0),
  };
}
export type Tracer = ReturnType<typeof createTracer>;
export function launchTracer(tracer: Tracer, from: T.Vector3, to: T.Vector3, weapon: number) {
  tracer.profile = tracerProfile(weapon);
  tracer.from.copy(from);
  tracer.direction.copy(to).sub(from);
  tracer.distance = tracer.direction.length();
  tracer.direction.normalize();
  tracer.flight = tracer.distance / tracer.profile.speed;
  tracer.life = tracer.flight;
  tracer.age = 0;
  tracer.fresh = true;
  tracer.endpointShown = false;
  tracer.mesh.visible = tracer.distance >= 0.01;
}
export function updateTracer(tracer: Tracer, dt: number) {
  if (tracer.life <= 0 || tracer.endpointShown) {
    tracer.life = 0;
    tracer.mesh.visible = false;
    return;
  }
  // Sample sub-frame flights once instead of losing close shots at low FPS.
  tracer.age += tracer.fresh ? Math.min(dt * 0.5, tracer.flight * 0.65) : dt;
  tracer.fresh = false;
  const age = Math.min(tracer.age, tracer.flight * 0.97);
  const head = Math.min(tracer.distance, tracer.age * tracer.profile.speed);
  const length = Math.min(
    head,
    tracer.profile.length,
    tracer.profile.speed * tracer.profile.trail * Math.min(1, age / tracer.profile.grow),
  );
  const uniforms = tracer.mesh.material.uniforms;
  uniforms.start.value
    .copy(tracer.from)
    .addScaledVector(tracer.direction, Math.max(0, head - length));
  uniforms.end.value.copy(tracer.from).addScaledVector(tracer.direction, head);
  const fraction = age / tracer.flight;
  uniforms.opacity.value =
    0.66 *
    T.MathUtils.smoothstep(fraction, tracer.profile.fadeIn[0], tracer.profile.fadeIn[1]) *
    (1 - T.MathUtils.smoothstep(fraction, 0.95, 1));
  tracer.life = Math.max(0.000001, tracer.flight - tracer.age);
  tracer.endpointShown = tracer.age >= tracer.flight;
}
