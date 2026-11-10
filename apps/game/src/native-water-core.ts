/** Lowered from installed csgo_water_fancy PS856/d2 build26445667.
 * Native material expressions, waves, shoreline/debris/foam, refraction,
 * absorption and receiver caustics remain separate. WebGL camera unprojection,
 * fine derivatives and runtime interaction/noise inputs are qualified adapters.
 * Proven current Nuke TEXCOORD4=(0,0,0,0); native rain default=0 is folded.
 * Evidence: native-water-evidence/water_ps_s88_d2.resources.glsl + replay_water.py.
 */
export const nativeWaterPrepare = `
void waterPrepare(){
vec4 _11408=gl_FragCoord;
    bool _12885;
    if (g_bRenderBackfaceNormals != 0)
    {
        _12885 = g_bDontFlipBackfaceNormals == 0;
    }
    else
    {
        _12885 = false;
    }
    vec3 _10251=vec3(0.0);
    
    if (_12885)
    {
        _10251 = vWaterSourceNormal.xyz * (gl_FrontFacing ? 1.0 : (-1.0));
    }
    else
    {
        _10251 = vWaterSourceNormal.xyz;
    }
    vec3 _7715 = vWaterSourcePosition + vec3(0.0);
    bvec4 _24464 = notEqual(ivec4(0), ivec4(0));
    bool _20058 = _24464.x;
    float _14000;
    if (_20058)
    {
        _14000 = g_flSkyBoxScale;
    }
    else
    {
        _14000 = 1.0;
    }
    vec4 _19511 = texelFetch(g_tBlueNoise, ivec3(ivec2(_11408.xy) & ivec2(7), 0).xy, 0);
    vec2 _4130 = _19511.xy;
    vec2 _21412 = (_11408.xy-waterViewport.xy)/waterViewport.zw;
    vec3 _19475 = _7715.xyz;
    vec3 _3980 = _19475 - waterCameraSource;
    vec3 _25095 = normalize(_3980);
    vec3 _3072 = -_25095;
    float _3558 = length(_3980) * _14000;
    vec2 _10337 = _3072.xy;
    float _20990 = _3072.z;
    vec3 _11306 = mix(vec3(_10337 / vec2(_20990), sqrt(_20990)), vec3(0.0), bvec3(_20058));
    vec2 _5201 = (-_10337) / vec2(_20990 + 0.25);
    bool _8776 = !_20058;
    float _13136;
    float _13378;
    vec4 _14948=vec4(0.0);
    float _16305;
    vec3 _17114=vec3(0.0);
    if (_8776)
    {
        vec2 _15784 = _21412.xy;
        float _21984 = clamp((textureLod(g_tSceneDepth, _15784, 0.0).x - 0.0) / (1.0 - 0.0), 0.0, 1.0);
        vec4 _20991 = texture(g_tRefractionMap, _15784);
        float _4284 = clamp(dot(_20991.xyz, vec3(0.2125000059604644775390625, 0.7153999805450439453125, 0.07209999859333038330078125)), 0.0, 0.4000000059604644775390625) * (-0.02999999932944774627685546875);
        vec3 _12686 = _25095.xyz;
        _13136 = _4284;
        _16305 = _21984;
        _17114 = waterReceiver(_15784,_21984);
        _14948 = _20991;
        _13378 = (max((vec4(_7715.xyz, 1.0).xyzw * waterSourceViewTranspose).z - (1.0 / ((waterDepthCoefficients.x * _21984) + waterDepthCoefficients.y)), 0.0) * 0.00999999977648258209228515625) + _4284;
    }
    else
    {
        _13136 = 0.0;
        _16305 = 1.0;
        _17114 = vec3(0.0);
        _14948 = vec4(0.0);
        _13378 = 1.0;
    }
    float _9935 = max(0.0, _13378 - 0.0199999995529651641845703125);
    float _5722 = _13378 * _20990;
    vec2 _19865 = (_7715.xy - g_vMapUVMin) / (g_vMapUVMax - g_vMapUVMin);
    _19865.y = 1.0 - _19865.y;
    float _24840;
    if (_20058)
    {
        _24840 = g_flWaterRoughnessMax;
    }
    else
    {
        _24840 = max(0.0, mix(g_flWaterRoughnessMin, g_flWaterRoughnessMax, vec4(0.0).x));
    }
    float _7010 = _20058 ? 0.0 : max(0.0, mix(g_flDebrisMin, g_flDebrisMax, vec4(0.0).z));
    float _13154 = _20058 ? 0.0 : max(0.0, mix(g_flFoamMin, g_flFoamMax, vec4(0.0).y));
    vec2 _3386 = ((_19475 * _14000) + (_11306 * (0.5 - g_flWaterPlaneOffset))).xy * vec2(0.0333333350718021392822265625);
    vec2 _21434 = dFdx(_3386);
    vec2 _21118 = dFdy(_3386);
    float _4694 = (0.5 * pow(max(dot(_21434, _21434), dot(_21118, _21118)), 0.100000001490116119384765625)) * g_flReflectionDistanceEffect;
    vec4 _10684 = texture(g_tWaterEffectsMap, (((_11408.xy - waterViewport.xy).xy * (1.0/waterViewport.zw)).xy * vec2(1.0)).xy);
    vec2 _20371 = clamp((_10684 - vec4(0.5)).yz * 2.0, vec2(0.0), vec2(1.0));
    float _22427 = _20371.y;
    vec4 _24505=vec4(0.0);
    _24505.z = _22427;
    float _18208 = (_20371.x + _22427) * g_flWaterEffectDisturbanceStrength;
    float _7242 = _18208 * 0.25;
    vec2 _13137=vec2(0.0);
    vec2 _16306=vec2(0.0);
    vec3 _17116=vec3(0.0);
    float _17117;
    vec2 _17133=vec2(0.0);
    _13137 = vec2(0.0);
    _16306 = g_vWaveScale;
    _17116 = vec3(0.0, 0.0, 1.0);
    _17117 = 0.0;
    _17133 = vec2(0.0);
    vec2 _6759=vec2(0.0);
    uint _8069;
    vec3 _8417=vec3(0.0);
    vec2 _8974=vec2(0.0);
    float _9798;
    float _10149;
    vec2 _10517=vec2(0.0);
    uint _14533;
    uint _17017 = 0u;
    float _17115 = g_flWaterInitialDirection;
    for (;;)
    {
        _14533 = g_nWaveIterations;
        if (!(_17017 < _14533))
        {
            break;
        }
        float _14123 = (float(_17017) / (float(_14533) - 1.0)) * 2.0;
        float _14126 = mix(mix(g_flLowFreqWeight + (_18208 * 0.0500000007450580596923828125), g_flMedFreqWeight + _7242, clamp(_14123, 0.0, 1.0)), (g_flHighFreqWeight * _24840) + _7242, clamp(_14123 - 1.0, 0.0, 1.0));
        vec2 _15840 = _3386.xy;
        vec2 _14060 = (vec2(sin(_17115), cos(_17115)) * ((waterTime * g_flWavesSpeed) * 0.5)) * sqrt(vec2(1.0) / _16306);
        float _6695 = (-1.0) * clamp(_4694, 0.0, 0.5);
        vec3 _19401 = texture(g_tWavesNormalHeight, ((((_15840 + (_13137 * 3.0)) + _17133) / _16306) + _14060).xy, _6695).xyz - vec3(0.5);
        float _9160 = length(_16306);
        vec2 _9388 = _19401.xy * 2.0;
        float _16755 = min(1.0, _16306.y / _16306.x);
        float _7337 = min(1.0, _16306.x / _16306.y);
        float _8090 = _14126 * 0.100000001490116119384765625;
        vec2 _11360 = (((-_5201.xy) * (((_19401.z * _14126) * _9160) * 0.00999999977648258209228515625)) * g_flWavesHeightOffset) * _24840;
        vec2 _22910 = (((vec2(_9388.x * _16755, _9388.y * _7337).xy * _8090).xy * g_flWavesSharpness) * _16306) * g_flWavesPhaseOffset;
        vec3 _19402 = texture(g_tWavesNormalHeight, ((((_15840 + ((_13137 + _11360) * 3.0)) + (_17133 + _22910)) / _16306) + _14060).xy, _6695).xyz - vec3(0.5);
        vec2 _10376 = _19402.xy * 2.0;
        _6759 = _13137.xy + _11360;
        _8974 = _17133.xy + _22910;
        _9798 = _17117 + (((_19402.z * _14126) * _9160) * 0.00999999977648258209228515625);
        vec2 _23792 = _17116.xy + (vec2(_10376.x * _16755, _10376.y * _7337).xy * _8090);
        vec3 _20488=vec3(0.0);
        _20488.x = _23792.x;
        _8417 = _20488;
        _8417.y = _23792.y;
        _10517 = _16306 * g_flWavesPhaseOffset;
        _8069 = _17017 + 1u;
        _10149 = _17115 + (3.5 / float(_8069));
        _13137 = _6759;
        _16306 = _10517;
        _17115 = _10149;
        _17116 = _8417;
        _17117 = _9798;
        _17133 = _8974;
        _17017 = _8069;
        continue;
    }
    vec2 _9431 = mix(vec2(0.0), _17133, vec2(0.100000001490116119384765625));
    vec3 _20576 = _17116 * _24840;
    vec3 _11008=vec3(0.0);
    float _13456;
    if (_8776)
    {
        vec3 _5599 = _17114 + (_11306 * clamp(dot(_14948.xyz, vec3(0.2125000059604644775390625, 0.7153999805450439453125, 0.07209999859333038330078125)), 0.0, 0.4000000059604644775390625));
        vec3 _24294 = -normalize(cross(dFdx(_5599), dFdy(_5599)));
        vec2 _8218 = _24294.xy + ((_4130 - vec2(0.5)) * 0.0500000007450580596923828125);
        vec3 _20489 = _24294;
        _20489.x = _8218.x;
        _20489.y = _8218.y;
        _11008 = _20489;
        _13456 = g_flEdgeShapeEffect * clamp(1.2000000476837158203125 - (_24294.z * (1.0 - clamp(_5722 * 8.0, 0.0, 1.0))), 0.0, 1.0);
    }
    else
    {
        _11008 = vec3(0.0, 0.0, 1.0);
        _13456 = g_flEdgeShapeEffect;
    }
    float _11974 = (_17117 * _24840) * 60.0;
    vec3 _6616=vec3(0.0);
    float _13138;
    vec4 _13694=vec4(0.0);
    vec2 _16307=vec2(0.0);
    float _17120;
    float _17121;
    vec2 _17122=vec2(0.0);
    vec2 _17123=vec2(0.0);
    float _17124;
    if (_8776)
    {
        vec3 _21979 = (_19475 + (_11306 * (mix(0.0, _11974, _13456) - g_flWaterPlaneOffset))) + (vec3(_20576.xy, 0.0) * (-16.0));
        vec4 _21447 = vec4(0.0) * 1.0;
        vec4 _18621 = (vec4(_21979.xyz, 1.0) + _21447).xyzw * waterSourceProjectionTranspose;
        vec2 _10502 = _18621.xy / vec2(_18621.w);
        vec4 _7435 = texture(g_tWaterEffectsMap, (((vec2(_10502.x, -_10502.y) * 0.5) + vec2(0.5)).xy * vec2(1.0)).xy) - vec4(0.5);
        vec3 _5680 = _21979 + (_11306 * ((20.0 * _7435.x) + (2.0 * clamp(_7435.yz * 2.0, vec2(0.0), vec2(1.0)).x)));
        vec4 _9193 = (vec4(_5680.xyz, 1.0) + _21447).xyzw * waterSourceProjectionTranspose;
        vec2 _10503 = _9193.xy / vec2(_9193.w);
        vec2 _4929 = ((vec2(_10503.x, -_10503.y) * 0.5) + vec2(0.5)).xy * vec2(1.0);
        vec4 _7436 = texture(g_tWaterEffectsMap, _4929.xy) - vec4(0.5);
        vec2 _20373 = clamp(_7436.yz * 2.0, vec2(0.0), vec2(1.0));
        float _19557 = _20373.x;
        float _22428 = _20373.y;
        vec4 _24771=vec4(0.0);
        _24771.z = _22428;
        vec4 _9194 = (vec4((_5680 + vec3(1.0, 0.0, 0.0)).xyz, 1.0) + _21447).xyzw * waterSourceProjectionTranspose;
        vec2 _10504 = _9194.xy / vec2(_9194.w);
        vec2 _3484 = (((vec2(_10504.x, -_10504.y) * 0.5) + vec2(0.5)) * vec2(1.0)) - _4929;
        vec4 _9195 = (vec4((_5680 + vec3(0.0, -1.0, 0.0)).xyz, 1.0) + _21447).xyzw * waterSourceProjectionTranspose;
        vec2 _10506 = _9195.xy / vec2(_9195.w);
        vec2 _5909 = (((vec2(_10506.x, -_10506.y) * 0.5) + vec2(0.5)) * vec2(1.0)) - _4929;
        vec2 _6014 = vec2(0.00039999998989515006542205810546875) / vec2(length(_3484), length(_5909));
        vec4 _7437 = texture(g_tWaterEffectsMap, (_4929 + (normalize(_3484) * 0.004999999888241291046142578125)).xy) - vec4(0.5);
        vec2 _20374 = clamp(_7437.yz * 2.0, vec2(0.0), vec2(1.0));
        vec4 _7438 = texture(g_tWaterEffectsMap, (_4929 + (normalize(_5909) * 0.004999999888241291046142578125)).xy) - vec4(0.5);
        vec2 _20375 = clamp(_7438.yz * 2.0, vec2(0.0), vec2(1.0));
        float _22235 = _6014.x;
        float _23185 = _7436.x;
        float _18860 = _6014.y;
        vec2 _4508 = ((normalize(cross(vec3(_22235, 0.0, _23185 - _7437.x), vec3(0.0, _18860, _23185 - _7438.x))).xy * vec2(-1.0, 1.0)) * (abs(_23185) * 4.0)) * g_flWaterEffectsRippleStrength;
        float _11338 = _11974 + ((_23185 * g_flWaterEffectsRippleStrength) * 12.0);
        _13138 = _22428 * g_flWaterEffectSiltStrength;
        _16307 = normalize(cross(vec3(_22235, 0.0, _19557 - _20374.x), vec3(0.0, _18860, _19557 - _20375.x))).xy * vec2(-1.0, 1.0);
        _17120 = _19557 * g_flWaterEffectFoamStrength;
        _17121 = ((_19557 + _22428) * g_flWaterEffectDisturbanceStrength) * 0.25;
        _17122 = (normalize(cross(vec3(_22235, 0.0, _22428 - _20374.y), vec3(0.0, _18860, _22428 - _20375.y))).xy * vec2(-1.0, 1.0)) * pow(_22428, 3.5);
        _17123 = _4508;
        _17124 = _11338;
        _13694 = _24771;
        _6616 = (_19475 + (_11306 * (mix(0.5, _11338, _13456) - g_flWaterPlaneOffset))) + (vec3(_4508.xy, 0.0) * (-4.0));
    }
    else
    {
        _13138 = 0.0;
        _16307 = vec2(0.0);
        _17120 = 0.0;
        _17121 = _7242;
        _17122 = vec2(0.0);
        _17123 = vec2(0.0);
        _17124 = _11974;
        _13694 = _24505;
        _6616 = _7715.xyz + (_11306 * (mix(0.5, _11974, _13456) - g_flWaterPlaneOffset));
    }
    vec2 _13140=vec2(0.0);vec4 _13151=_13694;vec3 _24633=_7715;
    vec3 _15100 = vec3(_17123.xy, 0.0);
    vec3 _3271 = (_24633.xyz + (_11306 * (mix(0.5, _17124, _13456 * 0.5) - g_flWaterPlaneOffset))) + (_15100 * (-2.0));
    float _4520 = (waterTime * 3.0) + (sin(waterTime * 0.5) * 0.100000001490116119384765625);
    vec2 _3085 = vec2(sin(_4520 + (_6616.y * 0.070000000298023223876953125)), cos(_4520 + (_6616.x * 0.070000000298023223876953125)));
    vec2 _13940 = _3271.xy;
    vec2 _13285 = vec2(g_flFoamScale);
    vec2 _3790 = _13940 / _13285;
    vec2 _4842 = (_3790 + (((_9431 * g_flFoamWobble) * 0.5) * (1.0 - _13154))) - (_17122 / _13285);
    float _9037 = 0.0500000007450580596923828125 + _13151.z;
    vec2 _9083 = vec2(clamp(_9935 * 10.0, 0.0, 1.0));
    vec4 _19338 = texture(g_tFoam, mix(_3790, _4842 + ((_3085 * _9037) * 0.02999999932944774627685546875), _9083).xy);
    vec4 _20669 = texture(g_tFoam, mix(_3790.yx * 0.731000006198883056640625, (_4842.yx * 0.731000006198883056640625) + ((vec2(sin(_4520 + (_6616.y * 0.0599999986588954925537109375)), cos(_4520 + (_6616.x * 0.0599999986588954925537109375))) * _9037) * 0.0199999995529651641845703125), _9083).xy);
    float _21881 = _20669.z;
    float _12091 = _19338.z;
    float _13724 = _19511.x;
    float _4812 = max(_12091, _21881) + (sin(_13724) * 0.125);
    float _20709 = clamp(((_13154 * (1.0 + (_17124 * 0.008000000379979610443115234375))) * (1.0 - clamp(_17121 * 2.0, 0.0, 1.0))) + _17120, 0.0, 1.0);
    float _8031 = pow(_13151.z, 1.5);
    vec2 _13286 = vec2(g_flDebrisScale);
    vec2 _3839 = _13940 / _13286;
    vec2 _22564 = _9431 * g_flDebrisWobble;
    vec2 _8892 = _5201.xy;
    float _6924 = abs(_17122.x);
    float _15937 = _17122.y * float(abs(_17122.y) > _6924);
    vec2 _10787 = (vec2(_17122.x * float(_6924 > abs(_15937)), _15937) / _13286) * 400.0;
    vec2 _9084 = vec2(clamp(_9935 * 4.0, 0.0, 1.0));
    vec2 _8513 = mix(_3839, (((_3839 + (_22564 * (1.0 - _7010))) + ((_8892 * ((1.0 + ((sin(_13151.z * 50.0) * 4.0) * clamp(0.100000001490116119384765625 - _8031, 0.0, 1.0))) * _8031)) * 0.100000001490116119384765625)) + ((_3085 * (0.100000001490116119384765625 + _13151.z)) * 0.0199999995529651641845703125)) - _10787, _9084).xy;
    vec4 _18109 = texture(g_tDebris, _8513, _8031 * 3.0);
    float _9406 = _18109.w - 0.5;
    float _3542 = _9406 * 2.0;
    float _17085 = 1.0 - (_7010 * clamp(1.39999997615814208984375 - (_13151.z / mix(1.0, 0.4000000059604644775390625, _18109.w)), 0.0, 1.0));
    float _6806 = clamp((_18109.w - _17085) * g_flDebrisEdgeSharpness, 0.0, 1.0);
    float _19396 = max(0.0, (2.0 * _8031) - _3542);
    float _4500 = clamp(1.0 - (_19396 * 10.0), 0.0, 1.0) * _6806;
    vec3 _19287 = texture(g_tDebrisNormal, _8513).xyz - vec3(0.5);
    _19287.y = -_19287.y;
    vec2 _11003 = _19287.xy * g_flDebrisNormalStrength;
    vec3 _8674=vec3(0.0);
    _8674.x = _11003.x;
    _8674.y = _11003.y;
    float _12904 = clamp((((_20709 * _4812) * 0.25) + (clamp(_20709 - (1.0 - _4812), 0.0, 1.0) * 0.75)) - _4500, 0.0, 1.0);
    float _16601 = mix(_17124, (_17124 * 0.5) + _3542, _4500);
    vec3 _10932=vec3(0.0);
    float _12918;
    if (_8776)
    {
        vec3 _13370 = (_24633.xyz + (_11306 * (mix(0.5, _16601, _13456) - g_flWaterPlaneOffset))) + (_15100 * (-12.0));
        _10932 = _13370;
        _12918 = (max((vec4(_13370.xyz, 1.0).xyzw * waterSourceViewTranspose).z - (1.0 / ((waterDepthCoefficients.x * _16305) + waterDepthCoefficients.y)), 0.0) * 0.00999999977648258209228515625) + _13136;
    }
    else
    {
        _10932 = _6616;
        _12918 = _13378;
    }
    float _11381 = clamp(_6806 + _12904, 0.0, 1.0);
    vec2 _11876 = (((_20576.xy * 2.0) * g_flWavesNormalStrength) * mix(1.0, 2.0, _4694)) * 1.0;
    vec3 _8675=vec3(0.0);
    _8675.x = _11876.x;
    _8675.y = _11876.y;
    vec2 _21285 = _8675.xy * (1.0 + (clamp(0.20000000298023223876953125 - _12918, 0.0, 1.0) * 8.0));
    vec3 _8676=vec3(0.0);
    _8676.x = _21285.x;
    _8676.y = _21285.y;
    vec2 _13842 = _8676.xy + ((_8674.xy * _4500) * 1.5);
    vec3 _13831=vec3(0.0);
    _13831.x = _13842.x;
    _13831.y = _13842.y;
    vec2 _24094 = _13831.xy + (mix(_19338.xy - vec2(0.5), _20669.xy - vec2(0.5), vec2(bvec2(_21881 > _12091))).xy * _12904);
    vec3 _20491=vec3(0.0);
    _20491.x = _24094.x;
    _20491.y = _24094.y;
    vec2 _13861 = _20491.xy + ((_16307.xy * _12904) * 0.5);
    vec3 _20492=vec3(0.0);
    _20492.x = _13861.x;
    _20492.y = _13861.y;
    vec2 _13862 = _20492.xy + ((_17123.xy * (1.0 - clamp(_4500 + _12904, 0.0, 1.0))) * 2.0);
    vec3 _20493=vec3(0.0);
    _20493.x = _13862.x;
    _20493.y = _13862.y;
    vec2 _24095 = _20493.xy + (_13140 * 0.5);
    vec3 _20494=vec3(0.0);
    _20494.x = _24095.x;
    _20494.y = _24095.y;
    vec2 _6752 = _4130 - vec2(0.5);
    vec2 _22768 = _20494.xy * (vec2(1.0) + ((_6752 * 2.0) * g_flWavesNormalJitter));
    vec3 _23714=vec3(0.0);
    _23714.x = _22768.x;
    _23714.y = _22768.y;
    vec3 _25156 = vec3(_23714.xy, sqrt(1.0 - clamp(dot(_23714.xy, _23714.xy), 0.0, 1.0)));
    vec2 _8369 = _25156.xy * 3.0;
    vec3 _3653 = vec3(_8369, sqrt(1.0 - clamp(dot(_8369, _8369), 0.0, 1.0)));
    vec3 _9985=vec3(0.0);
    vec3 _24109=vec3(0.0);
    if (_8776)
    {
        float _20588 = mix(60.0, 120.0, _11008.z);
        vec3 _15760 = vec3((clamp((clamp(((1.0 / _20588) - _12918) * _20588, 0.0, 1.0) + clamp((0.02500000037252902984619140625 - _12918) * 8.0, 0.0, 1.0)) - (fwidth(_16305) * 1000.0), 0.0, 1.0) / (1.0 + (_3558 * 0.00200000009499490261077880859375))) * 0.60000002384185791015625);
        _9985 = normalize(mix(_25156, _11008, _15760));
        _24109 = normalize(mix(_3653, _11008, _15760));
    }
    else
    {
        _9985 = _25156;
        _24109 = _3653;
    }
    float _16080 = clamp(dot(_3072, _24109.xyz), 0.0, 1.0);
    float _16820 = pow(1.0 - _16080, g_flFresnelExponent);
    vec3 _5903 = g_vFoamColor.xyz * (1.0 + (_12904 * 0.5));
    float _6617;
    vec4 _13144=vec4(0.0);
    float _13695;
    vec3 _16311=vec3(0.0);
    float _17125;
    if (_8776)
    {
        vec2 _25179 = (vec2(dot(_24109.xy, cross(_3072.xyz, vec3(0.0, 0.0, -1.0)).xy), dot(_24109.xy, _10337)) + ((_6752 * 0.00200000009499490261077880859375) * g_flWaterFogStrength)).xy * min(g_flRefractionLimit, _12918);
        vec2 _7831 = _21412.xy;
        float _10956 = 1.0 - 0.0;
        vec4 _17973 = vec4(_10932.xyz, 1.0).xyzw * waterSourceViewTranspose;
        float _18739 = _17973.z;
        vec2 _3433 = _25179 * clamp(((max(_18739 - (1.0 / ((waterDepthCoefficients.x * clamp((textureLod(g_tSceneDepth, _7831 + _25179.xy, 0.0).x - 0.0) / _10956, 0.0, 1.0)) + waterDepthCoefficients.y)), 0.0) * 0.00999999977648258209228515625) + _13136) * 10.0, 0.0, 1.0);
        vec2 _19158 = _3433.xy;
        float _10820 = clamp((textureLod(g_tSceneDepth, _7831 + _19158, 0.0).x - 0.0) / _10956, 0.0, 1.0);
        vec4 _18433 = texture(g_tRefractionMap, clamp(_21412.xy + _19158, vec4(0.0,0.0,1.0,1.0).xy, vec4(0.0,0.0,1.0,1.0).zw).xy);
        vec3 _21971 = pow(_18433.xyz, vec3(1.10000002384185791015625)) * g_flUnderwaterDarkening;
        float _5358 = g_flWaterFogStrength + (_13138 * 2.0);
        float _9484 = clamp((dot(_21971.xyz, vec3(0.2125000059604644775390625, 0.7153999805450439453125, 0.07209999859333038330078125)) - g_flCausticShadowCutOff) * (2.0 + g_flCausticShadowCutOff), 0.0, 1.0);
        vec4 _13143=vec4(0.0);
        vec3 _16381=vec3(0.0);
        float _16479;
        if (_9484 > 0.0)
        {
            vec3 _22329 = (-normalize((((waterUpSource * _3433.y) * 2.0) - _25095) + ((cross(waterForwardSource, waterUpSource) * (-_3433.x)) * 2.0))).xyz;
            vec3 _24116 = waterReceiver(_21412.xy+_19158,_10820);
            vec3 _9856 = _24116.xyz;
            vec3 _19321=vec3(0.0);
            if (g_bUseTriplanarCaustics != 0)
            {
                vec3 _22326 = abs(_11008);
                float _15437 = _22326.y;
                float _17713 = _22326.x;
                _19321 = mix(waterSunDirection, mix(mix(vec3(0.0, 1.0, 1.0), vec3(1.0, 0.0, 1.0), bvec3(_15437 < _17713)), vec3(0.0, 0.0, 1.0), bvec3(_22326.z > max(_17713, _15437))), vec3(0.64999997615814208984375));
            }
            else
            {
                _19321 = waterSunDirection;
            }
            float _4382 = _3271.z - _24116.z;
            vec3 _7984 = mix(_9856 + ((_19321.xyz * _19321.z) * _4382), _10932.xyz, vec3(clamp((pow(_13724, 2.0) * _5358) * 0.012500000186264514923095703125, 0.0, 1.0)));
            float _18491 = distance(_7984, _9856);
            vec2 _20997 = _7984.xy;
            vec2 _3358 = _20997 / _13286;
            vec4 _20361 = texture(g_tDebris, mix(_3358, (((_3358 + (_22564 * _17085)) + ((_8892 * _19396) * 0.100000001490116119384765625)) + ((_3085 * 0.100000001490116119384765625) * 0.039999999105930328369140625)) - _10787, _9084).xy, _4382 * 0.0500000007450580596923828125);
            float _20466 = clamp(((_20361.w - (_17085 * 0.89999997615814208984375)) - _6806) * 1.10000002384185791015625, 0.0, 1.0);
            vec4 _16121=vec4(0.0);
            _16121.w = _20466;
            float _12082 = _18491 / g_flCausticDepthFallOffDistance;
            float _20105 = clamp(1.0 - _12082, 0.0, 1.0);
            float _14250 = (_9484 * clamp(_18491 * 0.0500000007450580596923828125, 0.0, 1.0)) * _20105;
            float _10021;
            if (g_bUseTriplanarCaustics == 0)
            {
                _10021 = _14250 * clamp(dot(_11008, _19321.xyz), 0.0, 1.0);
            }
            else
            {
                _10021 = _14250;
            }
            vec2 _5614 = (_20997 * vec2(0.0333333350718021392822265625)) * g_flCausticUVScaleMultiple;
            vec2 _13141=vec2(0.0);
            vec2 _17134=vec2(0.0);
            _13141 = g_vWaveScale;
            _17134 = vec2(0.0);
            uint _7275;
            float _10150;
            vec2 _15431=vec2(0.0);
            vec2 _22514=vec2(0.0);
            float _16309 = g_flWaterInitialDirection;
            uint _17019 = 0u;
            
            for (;;)
            {
                if (!(_17019 < 3u))
                {
                    break;
                }
                _15431 = _17134.xy + (((((texture(g_tWavesNormalHeight, (((_5614.xy + _17134) / _13141) + ((vec2(sin(_16309), cos(_16309)) * ((waterTime * g_flWavesSpeed) * 0.5)) * sqrt(vec2(1.0) / _13141))).xy, (1.0 - (g_flCausticSharpness * (1.0 - clamp(_12082, 0.0, 1.0)))) * 6.0).xyz - vec3(0.5)).xy * 0.5) * g_flCausticDistortion) * (vec2(1.0) + _13141)) * (0.25 + _12082));
                _22514 = _13141 * g_flWavesPhaseOffset;
                _7275 = _17019 + 1u;
                _10150 = _16309 + (3.5 / float(_7275));
                _13141 = _22514;
                _16309 = _10150;
                _17134 = _15431;
                _17019 = _7275;
                continue;
            }
            vec2 _13142=vec2(0.0);
            vec3 _17135=vec3(0.0);
            _13142 = g_vWaveScale;
            _17135 = vec3(0.0);
            float _4987;
            vec2 _5398=vec2(0.0);
            uint _7276;
            vec3 _16230=vec3(0.0);
            float _16310 = g_flWaterInitialDirection;
            uint _17020 = 0u;
            
            for (;;)
            {
                if (!(_17020 < 3u))
                {
                    break;
                }
                float _14124 = (float(_17020) / (float(_14533) - 1.0)) * 2.0;
                float _19848 = g_flCausticSharpness * (1.0 - clamp(_12082, 0.0, 1.0));
                _16230 = _17135 + (((((pow(vec3(texture(g_tWavesNormalHeight, (((_5614.xy + _17134) / _13142) + ((vec2(sin(_16310), cos(_16310)) * ((waterTime * g_flWavesSpeed) * 0.5)) * sqrt(vec2(1.0) / _13142))).xy, (1.0 - _19848) * 6.0).z), vec3(_19848 * 5.0)) * clamp(mix(mix(g_flLowFreqWeight + (_17121 * 0.100000001490116119384765625), g_flMedFreqWeight + _17121, clamp(_14124, 0.0, 1.0)), (g_flHighFreqWeight * _24840) + _17121, clamp(_14124 - 1.0, 0.0, 1.0)), 0.100000001490116119384765625, 0.4000000059604644775390625)) * (vec3(1.0) + (_17135 * 2.0))) * _20105) * _19848) * 2.0);
                _5398 = _13142 * g_flWavesPhaseOffset;
                _7276 = _17020 + 1u;
                _4987 = _16310 + (3.5 / float(_7276));
                _13142 = _5398;
                _16310 = _4987;
                _17135 = _16230;
                _17020 = _7276;
                continue;
            }
            vec4 _18622 = (vec4((_7984.xyz + ((vec3(_17134, 0.0) * 60.0) * _17135.x)).xyz, 1.0) + (vec4(0.0) * 1.0)).xyzw * waterSourceProjectionTranspose;
            vec2 _10508 = _18622.xy / vec2(_18622.w);
            vec2 _22988 = (vec2(_10508.x, -_10508.y) * 0.5) + vec2(0.5);
            vec4 _7439 = texture(g_tWaterEffectsMap, (_22988.xy * vec2(1.0)).xy) - vec4(0.5);
            vec2 _20390 = clamp(_7439.yz * 2.0, vec2(0.0), vec2(1.0));
            vec4 _13514 = _7439;
            _13514.y = _20390.x;
            _13514.z = _20390.y;
            float _14324 = _22988.y;
            float _14539 = _22988.x;
            vec4 _4276 = _13514 * clamp((((_14324 * (1.0 - _14324)) * _14539) * (1.0 - _14539)) * 40.0, 0.0, 1.0);
            float _20150 = _4276.x;
            float _12449 = _20150 + (_20150 / ((fwidth(_20150) * 1000.0) + 0.5));
            vec3 _16129 = (_17135 + vec3(((clamp(_12449, 0.0, 1.0) * 4.0) * g_flWaterEffectCausticStrength) - ((clamp(-_12449, 0.0, 1.0) * 0.1500000059604644775390625) * g_flWaterEffectCausticStrength))) * mix(1.0, 0.0, clamp((_20466 * 2.0) + (_4276.y * 0.4000000059604644775390625), 0.0, 1.0));
            float _13526 = _16129.x;
            vec3 _4046 = _21971 * (vec3(1.0) + (((((pow(max(_16129 * (vec3(1.0) + (vec3(1.25, -0.25, -1.0) * (clamp(dFdx(_13526) * 200.0, -1.0, 1.0) * clamp(1.0 - (_13526 * 3.0), 0.0, 1.0)))), vec3(0.001000000047497451305389404296875)) * 8.0, vec3(2.5)) * _10021) * waterSunColor) * g_vCausticsTint.xyz) * g_flCausticsStrength) * 0.100000001490116119384765625));
            float _16517 = pow(dot(_4046.xyz, vec3(0.2125000059604644775390625, 0.7153999805450439453125, 0.07209999859333038330078125)), 0.20000000298023223876953125);
            float _14716 = clamp(dFdx(_16517), -1.0, 1.0) + clamp(dFdy(_16517), -1.0, 1.0);
            _13143 = _16121;
            _16381 = mix(_4046, _4046 * (vec3(1.0) + (vec3(2.5, 0.0, -2.0) * float(int(sign(_14716 * clamp(abs(_14716) - 0.100000001490116119384765625, 0.0, 1.0)))))), vec3(clamp(200.0 / _3558, 0.0, 1.0) * 0.100000001490116119384765625));
            _16479 = _4276.z;
        }
        else
        {
            _13143 = vec4(0.0);
            _16381 = _21971;
            _16479 = 0.0;
        }
        _13144 = _13143;
        _16311 = _16381;
        _17125 = _16479;
        _13695 = _5358;
        _6617 = (max(_18739 - (1.0 / ((waterDepthCoefficients.x * _10820) + waterDepthCoefficients.y)), 0.0) * 0.00999999977648258209228515625) + _13136;
    }
    else
    {
        _13144 = vec4(0.0);
        _16311 = vec3(0.0);
        _17125 = 0.0;
        _13695 = g_flWaterFogStrength;
        _6617 = _12918;
    }
    float _6655 = min(g_flWaterMaxDepth, _6617);
    vec3 _11466 = exp(((g_vWaterDecayColor - vec3(1.0)) * vec3(g_flWaterDecayStrength)) * _6655);
    float _8790 = max(_13695, _17125);
    float _5577 = _20709 + clamp(_17125 - 0.5, 0.0, 1.0);
    float _4632 = (1.0 - exp((-_6655) * _8790)) + ((_5577 - (clamp(_13724, 0.0, 1.0) * 0.25)) * 0.100000001490116119384765625);
    vec3 _5353 = mix(g_vWaterFogColor, _5903, vec3(_5577 * 0.100000001490116119384765625)) * mix(_11466, vec3(1.0), vec3(clamp(_8790 * 0.039999999105930328369140625, 0.0, 1.0)));
    vec3 _6968 = -normalize(_10932.xyz - waterCameraSource.xyz);
    float _14778 = clamp(dot(-waterSunDirection, reflect(_6968, normalize(mix(normalize(_10251).xyz, _24109.xyz, vec3(g_flSpecularNormalMultiple * (1.0 + (_3558 * 0.0005000000237487256526947021484375))))))), 0.0, 1.0);
    float _3579 = mix(g_flSpecularPower, g_flDebrisReflectance * 8.0, _6806) * mix(2.0, 0.20000000298023223876953125, clamp(_24840, 0.0, 1.0));
    float _16651 = (pow(_14778, _3579) * 0.100000001490116119384765625) + pow(_14778, _3579 * 10.0);
    float _9615 = 1.0 - _4632;
    float _3039 = (clamp((1.0 - _6806) + _19396, 0.0, 1.0) * clamp(1.0 - (_12904 * 4.0), 0.0, 1.0)) * _9615;
    float _17347 = pow(_3039, 2.0);
    float _12400 = mix(1.0, _6655 * 2.0, 0.75);

waterState.normal=_9985;waterState.strongNormal=_24109;waterState.view=_6968;
waterState.geometricNormal=normalize(_10251);waterState.distance=_3558;
waterState.specularPower=_3579;waterState.fogColor=_5353;waterState.fog=_4632;
waterState.foamColor=_5903;waterState.foam=_12904;waterState.debrisColor=_18109.rgb;
waterState.debris=_6806;waterState.debrisCoverage=_4500;waterState.debrisEdge=_19396;
waterState.refractionWeight=_3039;waterState.refracted=_16311;waterState.decay=_11466;
waterState.combinedMask=_11381;waterState.receiverDebris=_13144.w;
waterState.depth=_6655;waterState.thickness=_5722;waterState.alphaEdge=_3542;
waterState.original=_14948.rgb;
float reflectance=mix(g_flReflectance,g_flDebrisReflectance,_4500);
waterState.reflectionWeight=1.5*((_16820*(1.0-reflectance))+reflectance)*((1.0-(_11381*.75))-(_12904*2.0));
}
`;
