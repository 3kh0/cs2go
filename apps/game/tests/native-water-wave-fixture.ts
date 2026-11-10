import * as T from "three";
import { nativeWaterPrepare } from "../src/native-water-core";
import { nativeWaterConstants } from "../src/native-water-shader";
import { nativeWaterSource } from "./native-water-source-fixture";
/** Actual PS856 octave body with a controlled varying sample function. This
 * distinguishes its second sample from the proved quality0 first-sample path. */
export function renderNativeWaterPredictor() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.toneMapping = T.NoToneMapping;
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType });
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  const results = [];
  const sample = (u: number, v: number) => [
    0.1 * u + 0.05 * v,
    0.05 * u - 0.1 * v,
    0.075 * (u + v),
  ];
  function reference(corrected: boolean) {
    let scale = 15,
      height = 0;
    const carry = [0, 0],
      phase = [0, 0],
      normal = [0, 0];
    for (let i = 0; i < 3; i++) {
      const weight = [0.15, 0.25, 0.015][i],
        animation = [0, 0];
      const a = sample(
        (7.3 + 3 * carry[0] + phase[0]) / scale + animation[0],
        (-11.7 + 3 * carry[1] + phase[1]) / scale + animation[1],
      );
      const h = a[2] * weight * Math.SQRT2 * scale * 0.01,
        q = [a[0] * 2 * weight * 0.1, a[1] * 2 * weight * 0.1];
      carry[0] += -0.17 * h * 1.5 * 0.1;
      carry[1] += 0.23 * h * 1.5 * 0.1;
      phase[0] += q[0] * 0.3 * scale * 0.398;
      phase[1] += q[1] * 0.3 * scale * 0.398;
      const b = corrected
        ? sample(
            (7.3 + 3 * carry[0] + phase[0]) / scale + animation[0],
            (-11.7 + 3 * carry[1] + phase[1]) / scale + animation[1],
          )
        : a;
      height += b[2] * weight * Math.SQRT2 * scale * 0.01;
      normal[0] += b[0] * 2 * weight * 0.1;
      normal[1] += b[1] * 2 * weight * 0.1;
      scale *= 0.398;
    }
    return [height, ...normal];
  }
  const start = nativeWaterPrepare.indexOf("    vec2 _13137"),
    end = nativeWaterPrepare.indexOf("    vec2 _9431");
  if (start < 0 || end < start) throw Error("Native quality1 wave source span missing");
  const body = nativeWaterPrepare
    .slice(start, end)
    .replaceAll("texture(g_tWavesNormalHeight,", "waveSample(");
  for (const corrected of [false, true]) {
    const scene = new T.Scene(),
      code = corrected ? body : body.replace(/vec3 _19402 =[^;]+;/, "vec3 _19402 = _19401;");
    const material = new T.ShaderMaterial({
      vertexShader: "void main(){gl_Position=vec4(position,1.0);}",
      fragmentShader: `${nativeWaterConstants(nativeWaterSource)}
vec4 waveSample(vec2 uv,float bias){return vec4(.5+.1*uv.x+.05*uv.y,.5+.05*uv.x-.1*uv.y,.5+.075*(uv.x+uv.y),1.0);}
void main(){vec2 _3386=vec2(7.3,-11.7),_5201=vec2(.17,-.23);float _24840=.1,_4694=0.0,_18208=0.0,_7242=0.0,waterTime=0.0;
${code}
gl_FragColor=vec4(_17117,_17116.xy,1.0);}`,
    });
    scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), material));
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const pixel = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel);
    results.push({
      corrected,
      actual: [...pixel].slice(0, 3),
      expected: reference(corrected),
      error: renderer.getContext().getError(),
    });
    material.dispose();
  }
  target.dispose();
  renderer.dispose();
  return results;
}
