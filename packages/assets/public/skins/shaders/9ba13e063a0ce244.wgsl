struct type_8 {
    member: i32,
    member_1: i32,
    member_2: f32,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: vec3<f32>,
    member_7: f32,
    member_8: i32,
    member_9: f32,
    member_10: f32,
    member_11: i32,
    member_12: f32,
    member_13: f32,
    member_14: f32,
    member_15: f32,
    member_16: vec3<f32>,
    member_17: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(40) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(39) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(42) 
var global_11: texture_2d<f32>;
@group(1) @binding(41) 
var global_12: texture_2d<f32>;
@group(1) @binding(37) 
var global_13: texture_2d<f32>;
@group(1) @binding(35) 
var global_14: texture_2d<f32>;
@group(1) @binding(34) 
var global_15: texture_2d<f32>;
@group(1) @binding(38) 
var global_16: texture_2d<f32>;
var<private> global_17: vec4<f32>;

fn function_() {
    var phi_21709_: f32;
    var phi_21710_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e91 = global;
    let _e94 = _e91.xy;
    let _e95 = textureSample(global_1, global_2, _e94);
    let _e97 = pow(_e95.x, 1.5f);
    let _e98 = (_e97 * 0.96f);
    let _e100 = textureSample(global_3, global_2, _e94);
    let _e103 = (1f - _e100.x);
    let _e105 = global_4;
    let _e107 = textureSample(global_5, global_6, _e105.xy);
    let _e109 = _e91.zw;
    let _e110 = textureSample(global_7, global_8, _e109);
    let _e111 = textureSample(global_9, global_6, _e94);
    let _e114 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e111, (vec4<f32>(1f, 1f, 1f, 1f) - _e111)));
    let _e121 = global_10.member_14;
    let _e125 = (mix(0.5f, pow(_e98, 0.85f), _e121) * mix(1f, (_e95.y * (min(_e114.x, _e114.y) * 2f)), _e121));
    let _e126 = (_e125 * 2f);
    let _e130 = global_10.member_13;
    let _e139 = global_10.member_15;
    let _e140 = (max((_e110.y * _e130), (((1f - _e95.y) * 0.2f) * _e121)) + _e139);
    let _e141 = _e91.zw;
    let _e144 = textureSample(global_7, global_8, (_e141 + vec2<f32>(0.00048828125f, 0.00048828125f)).xy);
    let _e147 = textureSample(global_7, global_8, (_e141 + vec2<f32>(-0.00048828125f, -0.00048828125f)).xy);
    let _e150 = textureSample(global_7, global_8, (_e141 + vec2<f32>(-0.00048828125f, 0.00048828125f)).xy);
    let _e153 = textureSample(global_7, global_8, (_e141 + vec2<f32>(0.00048828125f, -0.00048828125f)).xy);
    let _e167 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e110.x), _e130), _e140));
    let _e170 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e144.x), _e130), _e140));
    let _e175 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e147.x), _e130), _e140));
    let _e180 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e150.x), _e130), _e140));
    let _e185 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e153.x), _e130), _e140));
    let _e194 = mix(_e110.xyzw, (((((_e167.xyzw + _e170.xyzw).xyzw + _e175.xyzw).xyzw + _e180.xyzw).xyzw + _e185.xyzw).xyzw * 0.2f).xyzw, vec4(_e100.y));
    let _e196 = mix(1f, _e194.w, _e100.y);
    let _e201 = global_10.member_12;
    let _e214 = max(0f, smoothstep(0f, 0.5f, _e194.w));
    let _e215 = ((((min(_e95.w, _e103) + (_e107.x * mix(smoothstep(0f, 0.72f, pow(_e98, 1.3f)), smoothstep(0f, 0.4f, _e98), pow(_e201, 1.2f)))) * ((_e201 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e194.w) * smoothstep(1f, 0.9f, _e194.w))) * _e214);
    let _e217 = global_10.member_2;
    let _e218 = (_e217 * _e214);
    let _e222 = (_e100.x > 0.99f);
    let _e224 = mix(smoothstep((0.58f - _e218), (0.68f + _e218), _e215), _e215, select(0f, 1f, _e222));
    let _e226 = textureSample(global_12, global_6, _e105.zw);
    let _e245 = smoothstep(0.2f, 0.6f, (((_e107.x * _e95.y) * (_e107.x * smoothstep(0.2f, 0.3f, _e98))) * _e201));
    let _e254 = (smoothstep((0.5f * _e201), 0f, clamp((((_e97 * 11.5199995f) * _e95.y) - ((_e201 * clamp(((_e226.x * _e226.y) * _e226.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e201);
    let _e255 = (1f - _e254);
    let _e259 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e226, vec4(((pow((1f - _e98), 4f) * 0.25f) + (0.75f * _e201)))), vec4(clamp((_e245 * 2f), 0f, 1f)));
    let _e261 = global_10.member_1;
    if (_e261 != 0i) {
        let _e263 = textureSample(global_13, global_6, _e109);
        phi_21709_ = _e263.x;
    } else {
        let _e265 = textureSample(global_13, global_6, _e94);
        phi_21709_ = _e265.x;
    }
    let _e268 = phi_21709_;
    let _e270 = global_10.member;
    if (_e270 != 0i) {
        let _e272 = textureSample(global_14, global_2, _e94);
        let _e274 = (1f - _e224);
        let _e281 = global_10.member_9;
        let _e283 = mix(_e281, (_e281 * (1f - (0.25f * dot(_e194.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))))), _e100.y);
        let _e286 = (1f - min(1f, (_e194.w * 2f)));
        let _e298 = dot(_e259.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e308 = ((1f - _e259.w) * _e201);
        let _e311 = clamp(((((mix(_e283, mix((((_e286 * _e286) * 0.85f) + 0.15f), _e283, select(0f, 1f, (_e194.w >= 0.5f))), _e100.x) * mix(1f, 0.9f, _e245)) + (((1f - _e298) * _e201) * 0.05f)) + ((_e254 * 0.15f) * _e201)) + (_e308 * 0.15f)), 0f, 1f);
        let _e322 = mix((_e196 * mix(1f, pow(((_e255 * _e259.w) * _e298), 0.5f), _e201)), 1f, _e245);
        let _e328 = vec4<f32>(mix(_e272.x, mix(min(1f, (_e311 + ((_e308 * _e201) * 0.5f))), _e311, _e100.x), select(max(0f, _e274), 1f, _e222)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e336 = vec4<f32>(_e328.x, mix(mix(_e268, _e272.y, _e224), _e322, _e100.x), _e328.z, _e328.w);
        let _e341 = vec4<f32>(_e336.x, _e336.y, _e274, _e336.w);
        let _e343 = global_10.member_11;
        phi_21710_ = _e341;
        if (_e343 != 0i) {
            phi_21710_ = vec4<f32>(_e341.x, _e341.y, (_e274 * _e100.x), _e341.w);
        }
        let _e352 = phi_21710_;
        let _e354 = global_10.member_10;
        let _e356 = _e352.xyz;
        let _e357 = (_e356 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e360 = pow(((_e356 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e352.x <= 0.04045f) {
            phi_21354_ = _e357.x;
        } else {
            phi_21354_ = _e360.x;
        }
        let _e366 = phi_21354_;
        if (_e352.y <= 0.04045f) {
            phi_21355_ = _e357.y;
        } else {
            phi_21355_ = _e360.y;
        }
        let _e372 = phi_21355_;
        if (_e352.z <= 0.04045f) {
            phi_22686_ = _e357.z;
        } else {
            phi_22686_ = _e360.z;
        }
        let _e378 = phi_22686_;
        phi_11711_ = vec4<f32>(_e366, _e372, _e378, min(1f, _e354));
        phi_10247_ = _e322;
    } else {
        phi_11711_ = vec4<f32>(_e91.xy, 0f, 1f);
        phi_10247_ = _e196;
    }
    let _e381 = phi_11711_;
    let _e383 = phi_10247_;
    phi_22401_ = _e381;
    if (_e270 == 0i) {
        let _e385 = textureSample(global_15, global_2, _e94);
        let _e387 = vec3(_e201);
        let _e389 = global_10.member_4;
        let _e391 = global_10.member_5;
        let _e393 = _e194.xyz;
        let _e395 = global_10.member_7;
        let _e398 = global_10.member_8;
        let _e402 = mix(_e393, (_e393 * _e395), vec3(max(_e100.x, f32(_e398))));
        let _e408 = vec4<f32>(_e402.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e414 = vec4<f32>(_e408.x, _e402.y, _e408.z, _e408.w);
        let _e420 = vec4<f32>(_e414.x, _e414.y, _e402.z, _e414.w);
        let _e424 = global_10.member_6;
        let _e428 = _e420.xyz;
        let _e432 = global_10.member_3;
        let _e436 = vec3(_e100.x);
        let _e443 = (mix(_e428, mix((mix(mix(_e389, _e424, vec3(pow(_e201, 0.5f))), mix(_e389, _e391, _e387), vec3(_e255)) * _e428), (_e432 * dot(_e420.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e245)), _e436).xyz * _e259.xyz);
        let _e449 = global_10.member_16;
        let _e451 = global_10.member_17;
        let _e454 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e443.xyz));
        let _e462 = mix(_e449.xyz, _e451.xyz, vec3(mix(_e268, _e383, _e100.x)));
        let _e483 = mix(mix(_e443, ((_e454.xyz * mix(min(_e462.x, dot(mix(_e428, (_e428 * _e389), _e436).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e462.z, clamp(pow(max(_e443.x, max(_e443.y, _e443.z)), _e462.y), 0f, 1f))) / vec3(max(_e454.x, max(_e454.y, _e454.z)))).xyz, _e387), _e385.xyz, vec3((_e224 * _e103)));
        phi_22401_ = vec4<f32>(_e483.x, _e483.y, _e483.z, 1f);
    }
    let _e489 = phi_22401_;
    let _e490 = textureSample(global_16, global_6, _e94);
    phi_6805_ = _e489;
    if (_e490.w < 0f) {
        let _e498 = vec4<f32>(_e490.x, _e489.y, _e489.z, _e489.w);
        let _e504 = vec4<f32>(_e498.x, _e490.y, _e498.z, _e498.w);
        phi_6805_ = vec4<f32>(_e504.x, _e504.y, _e490.z, _e504.w);
    }
    let _e512 = phi_6805_;
    global_17 = _e512;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_17;
    return _e5;
}
