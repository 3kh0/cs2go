import * as T from "three";
import { nativeWaterReflectionNormalGLSL } from "../src/native-water-reflection-normal";
export function renderNativeWaterReflectionNormal() {
  const renderer = new T.WebGLRenderer({ antialias: false });
  renderer.setSize(1, 1);
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  const target = new T.WebGLRenderTarget(1, 1, { type: T.FloatType }),
    scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  const noViewAmplitude = nativeWaterReflectionNormalGLSL
    .slice(nativeWaterReflectionNormalGLSL.indexOf("vec3 sourceWaterReflectionNormal("))
    .replace("sourceWaterReflectionNormal(", "sourceWaterReflectionNormalNoAmplitude(")
    .replace("viewNormal.yz*=2.0;", "");
  const normal = { value: new T.Vector3() },
    row = { value: new T.Matrix4() },
    mode = { value: 0 };
  const material = new T.ShaderMaterial({
    uniforms: { normalSource: normal, nativeViewRow: row, mode },
    vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `uniform vec3 normalSource;uniform mat4 nativeViewRow;uniform int mode;${nativeWaterReflectionNormalGLSL}\n${noViewAmplitude}\nvoid main(){vec3 n=mode==1?normalize(normalSource):mode==2?sourceWaterReflectionNormal(normalSource,transpose(nativeViewRow)):mode==3?sourceWaterReflectionNormalNoAmplitude(normalSource,nativeViewRow):sourceWaterReflectionNormal(normalSource,mode==4?sourceWaterViewRowFromBrowser(viewMatrix):nativeViewRow);gl_FragColor=vec4(n*.5+.5,1.);}`,
  });
  scene.add(new T.Mesh(new T.PlaneGeometry(2, 2), material));
  const n = new T.Vector3(0.2, 0.1, 1),
    r45 = new T.Matrix4().makeRotationZ(Math.PI / 4),
    translated = r45.clone();
  translated.elements[3] = 12000;
  translated.elements[7] = -900;
  translated.elements[11] = 450;
  const basis = new T.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1),
    browserView = r45.clone().transpose().multiply(basis.clone().transpose());
  camera.matrixAutoUpdate = false;
  camera.matrix.copy(browserView.clone().invert());
  camera.updateMatrixWorld(true);
  const cases = [
    { name: "identity", n: [1, 1, 1], m: new T.Matrix4(), mode: 0, expected: [3, 6, 1] },
    {
      name: "quarterTurn",
      n: [1, 1, 1],
      m: new T.Matrix4().makeRotationZ(Math.PI / 2),
      mode: 0,
      expected: [6, 3, 1],
    },
    { name: "diagonal", n: n.toArray(), m: r45, mode: 0, expected: [0.75, 0.15, 1] },
    { name: "translation", n: n.toArray(), m: translated, mode: 0, expected: [0.75, 0.15, 1] },
    { name: "browserBridge", n: n.toArray(), m: r45, mode: 4, expected: [0.75, 0.15, 1] },
    { name: "oldUnshaped", n: n.toArray(), m: r45, mode: 1 },
    { name: "wrongInverseRole", n: n.toArray(), m: r45, mode: 2 },
    { name: "missingViewAmplitude", n: [1, 1, 1], m: new T.Matrix4(), mode: 3 },
  ];
  const results = [];
  for (const c of cases) {
    normal.value.fromArray(c.n);
    row.value.copy(c.m);
    mode.value = c.mode;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    const values = new Float32Array(4);
    renderer.readRenderTargetPixels(target, 0, 0, 1, 1, values);
    results.push({
      name: c.name,
      normal: Array.from(values.slice(0, 3), (v) => 2 * v - 1),
      expected: c.expected ? new T.Vector3(...c.expected).normalize().toArray() : undefined,
      error: renderer.getContext().getError(),
    });
  }
  (scene.children[0] as T.Mesh).geometry.dispose();
  material.dispose();
  target.dispose();
  renderer.dispose();
  return results;
}
