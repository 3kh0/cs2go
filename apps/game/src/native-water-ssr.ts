import * as T from "three";
/** Installed build26445667 PS860/d2. Native march/fades/fixed UV taps are
 * retained. Camera, rational depth and HDR capture are qualified browser
 * producers. Undefined exact secant0/0 lowers to0; unused vec4 lanes init0.
 * Main-world fountain only; no private engine upload parity claim. */
export const fountainWaterSourceSha256 =
  "83cd363cb8513b6823666355e32970bf8a0f4bc67a9904f692b750344fb8daf3";
export const fountainWaterProgramSha256 =
  "46c9b2762b632d393670ab78d86267f909f5167967dfc1209ec4776684d2c3aa";
export function waterSSRProjectionFromBrowser(projection: T.Matrix4) {
  // Native m2 consumes NEGATED viewSU, followed by projected-Y flip.
  // This explicit browser bridge uses no guessed inverse native matrix.
  return new T.Matrix4()
    .makeScale(1, -1, 1)
    .multiply(projection)
    .multiply(new T.Matrix4().makeScale(-0.0254, -0.0254, -0.0254));
}
export const nativeWaterSSRDeclarations = `
uniform mat4 waterSSRViewToClip;
vec3 nativeWaterSSRPosition;vec2 nativeWaterMapUv;
float nativeWaterSSRNoise,nativeWaterSSRLod,nativeWaterSSRCos,nativeWaterSSRFresnel;
`;
export const nativeWaterSSR = `
vec3 nativeWaterFountainReflection(vec3 cubeColor,vec3 baseDiffuse){
    float _7813 = clamp((waterForwardSource.z + 0.75) * 4.0, 0.0, 1.0);
    float _13438 = float(false);
    uint _4344 = uint((float(g_nSSRMaxForwardSteps) * mix(1.0, 0.5, _13438)) * _7813);
    vec3 _21711;
    if (_4344 > 0u)
    {
        float _4714 = ((nativeWaterSSRNoise - 0.5) * 2.0) * g_flSSRSampleJitter;
        float _4799 = g_flSSRMaxThickness + _4714;
        vec4 _24221 = vec4(normalize(vec3((waterState.normal.xy*3.0) * mix(2.0, 8.0, _13438), waterState.normal.z)).xyz, 0.0).xyzw * waterSourceViewTranspose;
        vec3 _15170 = _24221.xyz;
        vec2 _23670 = _24221.yz * 2.0;
        _15170.y = _23670.x;
        _15170.z = _23670.y;
        vec3 _22729 = (vec4(nativeWaterSSRPosition.xyz, 1.0).xyzw * waterSourceViewTranspose).xyz;
        vec3 _21677 = normalize(reflect(normalize(_22729), normalize(_15170)));
        vec4 _24894 = waterSSRViewToClip * vec4(-_22729, 1.0);
        vec3 _10509 = _24894.xyz / vec3(_24894.w);
        vec2 _21671 = (vec2(_10509.x, -_10509.y) * 0.5) + vec2(0.5);
        vec4 _20499=vec4(0.0);
        _20499.x = _21671.x;
        _20499.y = _21671.y;
        float _9277 = ((g_flSSRStepSize + _4714) / (1.0 + (nativeWaterSSRLod * 2.0))) * mix(20.0, 1.0, nativeWaterSSRCos);
        float _12508;
        if (false)
        {
            _12508 = _9277 * (waterState.distance * 0.00200000009499490261077880859375);
        }
        else
        {
            _12508 = _9277;
        }
        vec3 _16315;
        vec4 _17127;
        uint _17139;
        _16315 = _22729;
        _17127 = _20499;
        _17139 = 1u;
        float _3353;
        float _3746;
        vec3 _5027;
        vec4 _19412;
        float _22272;
        uint _23991;
        float _9988;
        vec4 _23824;
        float _13158 = 0.0;
        float _17024 = 0.0;
        float _17128 = _12508;
        for (;;)
        {
            if (!(_17139 <= _4344))
            {
                _9988 = _17024;
                _23824 = _17127;
                break;
            }
            _3353 = _17128 * 1.14999997615814208984375;
            _5027 = _16315 + (_21677.xyz * _3353);
            vec4 _18209 = waterSSRViewToClip * vec4(-_5027, 1.0);
            vec3 _10510 = _18209.xyz / vec3(_18209.w);
            vec2 _21672 = (vec2(_10510.x, -_10510.y) * 0.5) + vec2(0.5);
            vec4 _20500=vec4(0.0);
            _20500.x = _21672.x;
            _19412 = _20500;
            _19412.y = _21672.y;
            _3746 = (1.0 / ((waterDepthCoefficients.x * clamp((textureLod(g_tSceneDepth, _19412.xy * vec2(1.0), 0.0).x - 0.0) / (1.0 - 0.0), 0.0, 1.0)) + waterDepthCoefficients.y)) - _5027.z;
            // Explicit WebGL fallback only at native undefined secant0/0.
            _22272 = _3746 == _13158 ? 0.0 : clamp(_3746 / (_3746 - _13158), 0.0, 1.0);
            bool _12892;
            if (_3746 >= 0.0)
            {
                _12892 = _3746 < (_4799 * _3353);
            }
            else
            {
                _12892 = false;
            }
            
            if (_12892)
            {
                _9988 = _22272;
                _23824 = mix(_19412, _17127, vec4(_22272));
                break;
            }
            _23991 = _17139 + 1u;
            _13158 = _3746;
            _16315 = _5027;
            _17127 = _19412;
            _17128 = _3353;
            _17139 = _23991;
            _17024 = _22272;
            continue;
        }
        float _5420 = (float(_17139) - _9988) / float(_4344);
        vec3 _18229;
        if (true)
        {
            vec2 _15600 = (_23824.xy * vec2(1.0)).xy;
            float _8505 = _5420 * (-0.00390625);
            vec3 _14528 = (((texture(g_tRefractionMap, clamp(_15600 - vec2(_5420 * 0.00390625), vec2(0.0), vec2(1.0)).xy).xyz * 0.4444443881511688232421875) + (texture(g_tRefractionMap, clamp(_15600 + vec2(0.001953125, _8505), vec2(0.0), vec2(1.0)).xy).xyz * 0.22222219407558441162109375)) + (texture(g_tRefractionMap, clamp(_15600 + vec2(_8505, 0.001953125), vec2(0.0), vec2(1.0)).xy).xyz * 0.22222219407558441162109375)) + (texture(g_tRefractionMap, clamp(_15600 + vec2(0.001953125), vec2(0.0), vec2(1.0)).xy).xyz * 0.111111097037792205810546875);
            _18229 = (_14528 + ((normalize(_14528 + vec3(0.001000000047497451305389404296875)) * max(0.0, dot(_14528.xyz, vec3(0.2125000059604644775390625, 0.7153999805450439453125, 0.07209999859333038330078125)) - g_flSSRBoostThreshold)) * g_flSSRBoost)) * g_flSSRBrightness;
        }
        else
        {
            _18229 = mix((baseDiffuse + cubeColor) * 0.5, cubeColor, vec3(_5420));
        }
        // Projection bridge produces bottom-origin browser UVs; native edge
        // fade is defined in top-origin viewport UVs.
        _21711 = mix(cubeColor, _18229, vec3((clamp(1.0 - pow(_5420, 4.0), 0.0, 1.0) * clamp((1.0 - _23824.y) * 8.0, 0.0, 1.0)) * clamp(_7813 * 2.0, 0.0, 1.0)));
    }
    else
    {
        _21711 = cubeColor;
    }
return _21711;
}
`;
/** Native post-reflection iridescence; zero paint does not imply zero oil. */
export const nativeWaterOil = `
vec3 nativeWaterFountainOil(vec3 reflectionColor){
 float hue=fract(nativeWaterSSRFresnel*20.0+waterState.alphaEdge*4.0+waterTime*.1)*6.0;
 float band=floor(hue),part=fract(hue),down=.75*(1.0-part),up=.75*part;
 vec3 oil=band==0.0?vec3(.75,up,0.0):band==1.0?vec3(down,.75,0.0):band==2.0?vec3(0.0,.75,up):band==3.0?vec3(0.0,down,.75):band==4.0?vec3(up,0.0,.75):vec3(.75,0.0,down);
 float amount=clamp(waterState.debrisEdge*20.0,0.0,1.0)*g_flDebrisOilyness/(1.0+waterState.distance*.004999999888241291)*clamp(1.0-waterState.thickness*5.0,0.0,1.0);
 return mix(reflectionColor,reflectionColor*oil,amount);
}
`;
