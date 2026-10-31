struct type_9 {
    member: i32,
    member_1: vec3<f32>,
    member_2: f32,
    member_3: i32,
    member_4: i32,
    member_5: f32,
    member_6: f32,
    member_7: f32,
    member_8: f32,
    member_9: f32,
    member_10: f32,
    member_11: f32,
    member_12: f32,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
    member_15: vec3<f32>,
    member_16: vec3<f32>,
    member_17: f32,
    member_18: vec4<f32>,
    member_19: i32,
    member_20: vec4<f32>,
    member_21: f32,
    member_22: vec4<f32>,
    member_23: f32,
    member_24: vec3<f32>,
    member_25: vec3<f32>,
    member_26: i32,
    member_27: i32,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(42) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(41) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
var<private> global_9: vec2<f32>;
@group(1) @binding(39) 
var global_10: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_11: type_9;
@group(1) @binding(43) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
@group(1) @binding(37) 
var global_15: texture_2d<f32>;
@group(1) @binding(34) 
var global_16: texture_2d<f32>;
@group(1) @binding(38) 
var global_17: texture_2d<f32>;
var<private> global_18: vec4<f32>;

fn function_() {
    var phi_19017_: vec4<f32>;
    var phi_21709_: f32;
    var phi_10021_: f32;
    var phi_21710_: f32;
    var phi_19287_: vec4<f32>;
    var phi_21711_: f32;
    var phi_12885_: f32;
    var phi_21712_: f32;
    var phi_15784_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_21713_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e92 = global;
    let _e95 = _e92.xy;
    let _e96 = textureSample(global_1, global_2, _e95);
    let _e98 = textureSample(global_3, global_2, _e95);
    let _e100 = global_4;
    let _e102 = textureSample(global_5, global_6, _e100.xy);
    let _e104 = _e92.zw;
    let _e105 = textureSample(global_7, global_8, _e104);
    let _e106 = global_9;
    let _e108 = textureSample(global_10, global_6, _e106.xy);
    let _e110 = global_11.member_26;
    switch _e110 {
        case 1: {
            phi_19017_ = vec4<f32>(_e108.x, _e108.y, _e108.z, ((_e108.w * (1f - max(_e105.x, max(_e105.y, _e105.z)))) * (1f - max(_e98.y, _e98.z))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e108.x, _e108.y, _e108.z, ((_e108.w * (_e105.x * (1f - max(_e105.y, _e105.z)))) * (1f - max(_e98.y, _e98.z))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e108.x, _e108.y, _e108.z, (_e108.w * (max((_e105.y * (1f - _e105.z)), _e98.y) * (1f - _e98.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e108.x, _e108.y, _e108.z, (_e108.w * max((_e105.z * (1f - _e98.y)), _e98.z)));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e108.x, _e108.y, _e108.z, (_e108.w * max(_e105.x, max(_e105.y, max(_e105.z, max(_e98.y, _e98.z))))));
            break;
        }
        case 7: {
            phi_19017_ = vec4<f32>(_e108.x, _e108.y, _e108.z, (_e108.w * (1f - max(_e98.y, _e98.z))));
            break;
        }
        default: {
            phi_19017_ = _e108;
            break;
        }
    }
    let _e204 = phi_19017_;
    let _e207 = global_11.member_5;
    let _e208 = (_e204.w * _e207);
    let _e211 = global_11.member_7;
    let _e212 = (_e204.xyz * _e211);
    let _e216 = vec4<f32>(_e212.x, _e212.y, _e212.z, _e208);
    let _e217 = (_e102.x * _e96.x);
    let _e220 = global_11.member_23;
    let _e222 = ((_e220 * 6f) + 1f);
    let _e228 = clamp((_e98.y + _e98.z), 0f, 1f);
    let _e232 = (smoothstep(0.5f, 0.6f, _e105.w) * smoothstep(1f, 0.9f, _e105.w));
    let _e234 = smoothstep(0f, 0.5f, _e105.w);
    let _e235 = (_e110 == 0i);
    if _e235 {
        phi_21709_ = max(_e228, _e234);
    } else {
        phi_21709_ = _e234;
    }
    let _e238 = phi_21709_;
    let _e240 = global_11.member_8;
    let _e242 = (_e238 * mix(1f, _e240, _e204.w));
    if (_e110 > 0i) {
        phi_10021_ = max(_e228, _e242);
    } else {
        phi_10021_ = _e242;
    }
    let _e246 = phi_10021_;
    let _e249 = global_11.member_18;
    let _e261 = mix(mix(mix(mix(mix(_e249.x, _e249.y, _e105.x), _e249.z, _e105.y), _e249.w, _e105.z), _e249.z, _e98.y), _e249.w, _e98.z);
    let _e262 = (((((_e96.w + _e217) * _e222) + _e232) * _e246) * _e261);
    let _e264 = global_11.member_12;
    let _e265 = (_e264 * _e261);
    let _e270 = (0.56f - (0.06f * _e220));
    let _e274 = (0.54f - (_e220 * 0.12f));
    let _e284 = (_e105.xyz * vec3<f32>(smoothstep((0.58f + _e265), (_e270 - _e265), _e262), smoothstep((_e270 + _e265), (_e274 - _e265), _e262), smoothstep((_e274 + _e265), ((0.52f - (_e220 * 0.17999999f)) - _e265), _e262)).xyz);
    let _e288 = (0.58f - _e265);
    let _e289 = (0.68f + _e265);
    let _e290 = smoothstep(_e288, _e289, _e262);
    let _e295 = smoothstep(_e288, _e289, ((_e217 * _e222) * _e240));
    if _e235 {
        phi_21710_ = max(0f, mix(_e290, min(_e290, _e295), _e208));
    } else {
        phi_21710_ = _e290;
    }
    let _e300 = phi_21710_;
    let _e302 = global_11.member_27;
    phi_19287_ = _e216;
    if (_e302 == 4i) {
        phi_19287_ = vec4<f32>(_e216.x, _e216.y, _e216.z, (_e208 * clamp((1f - _e295), 0f, 1f)));
    }
    let _e313 = phi_19287_;
    let _e315 = textureSample(global_12, global_6, _e100.zw);
    let _e322 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e315, vec4(((pow((1f - _e96.x), 4f) * 0.25f) + (0.75f * _e220))));
    let _e324 = global_11.member_22;
    let _e333 = mix(mix(mix(mix(mix(_e324.x, _e324.y, _e284.x), _e324.z, _e284.y), _e324.w, _e284.z), _e324.z, _e98.y), _e324.w, _e98.z);
    let _e335 = global_11.member;
    if (_e335 != 0i) {
        let _e337 = textureSample(global_13, global_2, _e95);
        let _e348 = global_11.member_3;
        if (_e348 != 0i) {
            let _e350 = textureSample(global_14, global_6, _e104);
            phi_21711_ = _e350.x;
        } else {
            let _e352 = textureSample(global_14, global_6, _e95);
            phi_21711_ = _e352.x;
        }
        let _e355 = phi_21711_;
        let _e357 = global_11.member_19;
        let _e358 = (_e357 != 0i);
        phi_12885_ = _e355;
        if _e358 {
            let _e360 = global_11.member_20;
            phi_12885_ = mix(mix(mix(_e360.x, _e360.y, _e284.x), _e360.z, _e284.y), _e360.w, _e284.z);
        }
        let _e369 = phi_12885_;
        phi_21712_ = _e369;
        if _e358 {
            let _e371 = global_11.member_20;
            phi_21712_ = mix(mix(_e369, _e371.z, _e98.y), _e371.w, _e98.z);
        }
        let _e377 = phi_21712_;
        let _e379 = global_11.member_6;
        let _e380 = (((1f - _e295) * _e313.w) * _e379);
        let _e382 = global_11.member_9;
        let _e385 = global_11.member_10;
        let _e386 = mix(_e333, _e385, _e380);
        let _e396 = mix(vec4<f32>(min(1f, (mix(_e377, _e382, _e380) + ((((1f - _e322.w) * _e220) * _e220) * 0.5f))), _e386, 0f, 1f), vec4<f32>(_e337.x, _e337.y, _e337.z, _e337.w), vec4(_e300));
        let _e397 = (1f - _e300);
        let _e399 = global_11.member_4;
        if (_e399 != 0i) {
            let _e401 = textureSample(global_15, global_6, _e104);
            phi_15784_ = vec4<f32>(_e396.x, _e396.y, (_e397 * _e401.x), _e396.w);
        } else {
            let _e409 = textureSample(global_15, global_6, _e95);
            let _e411 = (_e397 * _e409.x);
            phi_15784_ = vec4<f32>(_e396.x, _e396.y, (_e411 * _e411), _e396.w);
        }
        let _e419 = phi_15784_;
        let _e425 = global_11.member_11;
        let _e427 = mix((_e419.z * (1f - max(_e98.y, _e98.z))), (_e425 - _e300), _e380);
        let _e434 = global_11.member_21;
        let _e436 = vec4<f32>(_e419.x, _e419.y, _e427, _e419.w).xyz;
        let _e437 = (_e436 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e440 = pow(((_e436 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e419.x <= 0.04045f) {
            phi_21354_ = _e437.x;
        } else {
            phi_21354_ = _e440.x;
        }
        let _e446 = phi_21354_;
        if (_e419.y <= 0.04045f) {
            phi_23035_ = _e437.y;
        } else {
            phi_23035_ = _e440.y;
        }
        let _e452 = phi_23035_;
        if (_e427 <= 0.04045f) {
            phi_19513_ = _e437.z;
        } else {
            phi_19513_ = _e440.z;
        }
        let _e457 = phi_19513_;
        let _e458 = vec4<f32>(_e446, _e452, _e427, min(1f, _e434));
        phi_11711_ = vec4<f32>(_e458.x, _e458.y, _e457, _e458.w);
        phi_10247_ = _e386;
    } else {
        phi_11711_ = vec4<f32>(_e92.xy, 0f, 1f);
        phi_10247_ = _e333;
    }
    let _e465 = phi_11711_;
    let _e467 = phi_10247_;
    phi_22401_ = _e465;
    if (_e335 == 0i) {
        let _e469 = textureSample(global_16, global_2, _e95);
        let _e472 = global_11.member_13;
        let _e474 = global_11.member_14;
        let _e478 = global_11.member_15;
        let _e482 = global_11.member_16;
        let _e489 = _e469.xyz;
        let _e490 = vec3(_e300);
        let _e491 = mix(mix(mix(mix(mix(mix(_e472, _e474, vec3(_e284.x)), _e478, vec3(_e284.y)), _e482, vec3(_e284.z)), _e478, vec3(_e98.y)), _e482, vec3(_e98.z)).xyz, _e489, _e490);
        switch _e302 {
            case 0: {
                phi_21713_ = mix(_e491.xyz, _e313.xyz, vec3(_e313.w));
                break;
            }
            case 1: {
                let _e499 = global_11.member_1;
                let _e500 = _e491.xyz;
                let _e521 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e313.xyz * _e500).xyz)) * 1.06f);
                let _e523 = _e521.xyz;
                phi_21713_ = mix(_e491.xyz, mix(vec3(_e499.x), max(((((_e523 * _e499.x) * 1.732f) / vec3(length(_e523))) / vec3(dot(_e521.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e521 * mix(_e499.x, _e499.z, clamp(pow(max(_e491.x, max(_e491.y, _e491.z)), _e499.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e499.x, dot(clamp((_e500 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e313.w));
                break;
            }
            case 2: {
                let _e544 = _e491.xyz;
                let _e546 = (_e544 * _e313.xyz);
                let _e548 = global_11.member_1;
                let _e568 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e546.xyz)) * 1.06f);
                let _e570 = _e568.xyz;
                phi_21713_ = mix(_e544, mix(vec3(_e548.x), max(((((_e570 * _e548.x) * 1.732f) / vec3(length(_e570))) / vec3(dot(_e568.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e568 * mix(_e548.x, _e548.z, clamp(pow(max(_e546.x, max(_e546.y, _e546.z)), _e548.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e548.x, dot(clamp((_e546.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e313.w));
                break;
            }
            case 3: {
                let _e591 = _e491.xyz;
                let _e593 = (_e591 + _e313.xyz);
                let _e595 = global_11.member_1;
                let _e600 = dot(clamp((_e593.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e616 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e593.xyz)) * 1.06f);
                let _e618 = _e616.xyz;
                let _e629 = max(((((_e618 * _e595.x) * 1.732f) / vec3(length(_e618))) / vec3(dot(_e616.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e616 * mix(_e595.x, _e595.z, clamp(pow((max(_e593.x, max(_e593.y, _e593.z)) * 2f), _e595.y), 0f, 1f)))).xyz;
                let _e636 = global_11.member_2;
                phi_21713_ = mix(_e591, mix(vec3(_e595.x), mix(_e629, min(_e595.zzz, (_e629 + (vec3(_e600) * 2f))), vec3((1f / _e636))).xyz, vec3(pow(smoothstep(0.0003f, _e595.x, _e600), 0.5f))).xyz, vec3(_e313.w));
                break;
            }
            case 4: {
                phi_21713_ = mix(_e491.xyz, _e313.xyz, vec3(_e313.w));
                break;
            }
            default: {
                phi_21713_ = _e491;
                break;
            }
        }
        let _e656 = phi_21713_;
        let _e658 = global_11.member_17;
        let _e661 = clamp((_e656 * mix(_e658, 1f, (smoothstep(0f, 0.01f, _e290) * (1f - _e232)))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e664 = (_e661.xyz * _e322.xyz);
        let _e669 = global_11.member_24;
        let _e671 = global_11.member_25;
        let _e674 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e664.xyz));
        let _e682 = mix(_e669.xyz, _e671.xyz, vec3(_e467));
        let _e702 = mix(mix(_e664, ((_e674.xyz * mix(min(_e682.x, dot(_e661.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e682.z, clamp(pow(max(_e664.x, max(_e664.y, _e664.z)), _e682.y), 0f, 1f))) / vec3(max(_e674.x, max(_e674.y, _e674.z)))).xyz, vec3(_e220)), _e489, _e490);
        phi_22401_ = vec4<f32>(_e702.x, _e702.y, _e702.z, 1f);
    }
    let _e708 = phi_22401_;
    let _e709 = textureSample(global_17, global_6, _e95);
    phi_6805_ = _e708;
    if (_e709.w < 0f) {
        let _e717 = vec4<f32>(_e709.x, _e708.y, _e708.z, _e708.w);
        let _e723 = vec4<f32>(_e717.x, _e709.y, _e717.z, _e717.w);
        phi_6805_ = vec4<f32>(_e723.x, _e723.y, _e709.z, _e723.w);
    }
    let _e731 = phi_6805_;
    global_18 = _e731;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_9 = param_2;
    function_();
    let _e7 = global_18;
    return _e7;
}
