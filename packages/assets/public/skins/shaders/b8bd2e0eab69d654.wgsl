struct type_9 {
    member: i32,
    member_1: vec3<f32>,
    member_2: f32,
    member_3: f32,
    member_4: f32,
    member_5: f32,
    member_6: f32,
    member_7: f32,
    member_8: f32,
    member_9: f32,
    member_10: f32,
    member_11: vec3<f32>,
    member_12: vec3<f32>,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
    member_15: f32,
    member_16: vec4<f32>,
    member_17: f32,
    member_18: i32,
    member_19: vec4<f32>,
    member_20: f32,
    member_21: vec4<f32>,
    member_22: f32,
    member_23: vec3<f32>,
    member_24: vec3<f32>,
    member_25: i32,
    member_26: i32,
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
var<private> global_9: vec2<f32>;
@group(1) @binding(37) 
var global_10: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_11: type_9;
@group(1) @binding(41) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(34) 
var global_14: texture_2d<f32>;
@group(1) @binding(36) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_19017_: vec4<f32>;
    var phi_21709_: f32;
    var phi_10021_: f32;
    var phi_21710_: f32;
    var phi_19287_: vec4<f32>;
    var phi_12885_: f32;
    var phi_21711_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_21712_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e89 = global;
    let _e92 = _e89.xy;
    let _e93 = textureSample(global_1, global_2, _e92);
    let _e95 = textureSample(global_3, global_2, _e92);
    let _e97 = global_4;
    let _e99 = textureSample(global_5, global_6, _e97.xy);
    let _e102 = textureSample(global_7, global_8, _e89.zw);
    let _e103 = global_9;
    let _e105 = textureSample(global_10, global_6, _e103.xy);
    let _e107 = global_11.member_25;
    switch _e107 {
        case 1: {
            phi_19017_ = vec4<f32>(_e105.x, _e105.y, _e105.z, ((_e105.w * (1f - max(_e102.x, max(_e102.y, _e102.z)))) * (1f - max(_e95.y, _e95.z))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e105.x, _e105.y, _e105.z, ((_e105.w * (_e102.x * (1f - max(_e102.y, _e102.z)))) * (1f - max(_e95.y, _e95.z))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e105.x, _e105.y, _e105.z, (_e105.w * (max((_e102.y * (1f - _e102.z)), _e95.y) * (1f - _e95.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e105.x, _e105.y, _e105.z, (_e105.w * max((_e102.z * (1f - _e95.y)), _e95.z)));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e105.x, _e105.y, _e105.z, (_e105.w * max(_e102.x, max(_e102.y, max(_e102.z, max(_e95.y, _e95.z))))));
            break;
        }
        case 7: {
            phi_19017_ = vec4<f32>(_e105.x, _e105.y, _e105.z, (_e105.w * (1f - max(_e95.y, _e95.z))));
            break;
        }
        default: {
            phi_19017_ = _e105;
            break;
        }
    }
    let _e201 = phi_19017_;
    let _e204 = global_11.member_3;
    let _e205 = (_e201.w * _e204);
    let _e208 = global_11.member_5;
    let _e209 = (_e201.xyz * _e208);
    let _e213 = vec4<f32>(_e209.x, _e209.y, _e209.z, _e205);
    let _e214 = (_e99.x * _e93.x);
    let _e217 = global_11.member_22;
    let _e219 = ((_e217 * 6f) + 1f);
    let _e225 = clamp((_e95.y + _e95.z), 0f, 1f);
    let _e229 = (smoothstep(0.5f, 0.6f, _e102.w) * smoothstep(1f, 0.9f, _e102.w));
    let _e231 = smoothstep(0f, 0.5f, _e102.w);
    let _e232 = (_e107 == 0i);
    if _e232 {
        phi_21709_ = max(_e225, _e231);
    } else {
        phi_21709_ = _e231;
    }
    let _e235 = phi_21709_;
    let _e237 = global_11.member_6;
    let _e239 = (_e235 * mix(1f, _e237, _e201.w));
    if (_e107 > 0i) {
        phi_10021_ = max(_e225, _e239);
    } else {
        phi_10021_ = _e239;
    }
    let _e243 = phi_10021_;
    let _e246 = global_11.member_16;
    let _e258 = mix(mix(mix(mix(mix(_e246.x, _e246.y, _e102.x), _e246.z, _e102.y), _e246.w, _e102.z), _e246.z, _e95.y), _e246.w, _e95.z);
    let _e259 = (((((_e93.w + _e214) * _e219) + _e229) * _e243) * _e258);
    let _e261 = global_11.member_10;
    let _e262 = (_e261 * _e258);
    let _e267 = (0.56f - (0.06f * _e217));
    let _e271 = (0.54f - (_e217 * 0.12f));
    let _e281 = (_e102.xyz * vec3<f32>(smoothstep((0.58f + _e262), (_e267 - _e262), _e259), smoothstep((_e267 + _e262), (_e271 - _e262), _e259), smoothstep((_e271 + _e262), ((0.52f - (_e217 * 0.17999999f)) - _e262), _e259)).xyz);
    let _e285 = (0.58f - _e262);
    let _e286 = (0.68f + _e262);
    let _e287 = smoothstep(_e285, _e286, _e259);
    let _e292 = smoothstep(_e285, _e286, ((_e214 * _e219) * _e237));
    if _e232 {
        phi_21710_ = max(0f, mix(_e287, min(_e287, _e292), _e205));
    } else {
        phi_21710_ = _e287;
    }
    let _e297 = phi_21710_;
    let _e299 = global_11.member_26;
    phi_19287_ = _e213;
    if (_e299 == 4i) {
        phi_19287_ = vec4<f32>(_e213.x, _e213.y, _e213.z, (_e205 * clamp((1f - _e292), 0f, 1f)));
    }
    let _e310 = phi_19287_;
    let _e312 = textureSample(global_12, global_6, _e97.zw);
    let _e319 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e312, vec4(((pow((1f - _e93.x), 4f) * 0.25f) + (0.75f * _e217))));
    let _e321 = global_11.member_21;
    let _e330 = mix(mix(mix(mix(mix(_e321.x, _e321.y, _e281.x), _e321.z, _e281.y), _e321.w, _e281.z), _e321.z, _e95.y), _e321.w, _e95.z);
    let _e332 = global_11.member;
    if (_e332 != 0i) {
        let _e334 = textureSample(global_13, global_2, _e92);
        let _e345 = global_11.member_18;
        let _e346 = (_e345 != 0i);
        if _e346 {
            let _e348 = global_11.member_19;
            phi_12885_ = mix(mix(mix(_e348.x, _e348.y, _e281.x), _e348.z, _e281.y), _e348.w, _e281.z);
        } else {
            let _e357 = global_11.member_17;
            phi_12885_ = _e357;
        }
        let _e359 = phi_12885_;
        phi_21711_ = _e359;
        if _e346 {
            let _e361 = global_11.member_19;
            phi_21711_ = mix(mix(_e359, _e361.z, _e95.y), _e361.w, _e95.z);
        }
        let _e367 = phi_21711_;
        let _e369 = global_11.member_4;
        let _e370 = (((1f - _e292) * _e310.w) * _e369);
        let _e372 = global_11.member_7;
        let _e375 = global_11.member_8;
        let _e376 = mix(_e330, _e375, _e370);
        let _e386 = mix(vec4<f32>(min(1f, (mix(_e367, _e372, _e370) + ((((1f - _e319.w) * _e217) * _e217) * 0.5f))), _e376, 0f, 1f), vec4<f32>(_e334.x, _e334.y, _e334.z, _e334.w), vec4(_e297));
        let _e389 = global_11.member_9;
        let _e391 = mix((1f - _e297), (_e389 - _e297), _e370);
        let _e398 = global_11.member_20;
        let _e400 = vec4<f32>(_e386.x, _e386.y, _e391, _e386.w).xyz;
        let _e401 = (_e400 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e404 = pow(((_e400 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e386.x <= 0.04045f) {
            phi_21354_ = _e401.x;
        } else {
            phi_21354_ = _e404.x;
        }
        let _e410 = phi_21354_;
        if (_e386.y <= 0.04045f) {
            phi_23035_ = _e401.y;
        } else {
            phi_23035_ = _e404.y;
        }
        let _e416 = phi_23035_;
        if (_e391 <= 0.04045f) {
            phi_19513_ = _e401.z;
        } else {
            phi_19513_ = _e404.z;
        }
        let _e421 = phi_19513_;
        let _e422 = vec4<f32>(_e410, _e416, _e391, min(1f, _e398));
        phi_11711_ = vec4<f32>(_e422.x, _e422.y, _e421, _e422.w);
        phi_10247_ = _e376;
    } else {
        phi_11711_ = vec4<f32>(_e89.xy, 0f, 1f);
        phi_10247_ = _e330;
    }
    let _e429 = phi_11711_;
    let _e431 = phi_10247_;
    phi_22401_ = _e429;
    if (_e332 == 0i) {
        let _e433 = textureSample(global_14, global_2, _e92);
        let _e436 = global_11.member_11;
        let _e438 = global_11.member_12;
        let _e442 = global_11.member_13;
        let _e446 = global_11.member_14;
        let _e453 = _e433.xyz;
        let _e454 = vec3(_e297);
        let _e455 = mix(mix(mix(mix(mix(mix(_e436, _e438, vec3(_e281.x)), _e442, vec3(_e281.y)), _e446, vec3(_e281.z)), _e442, vec3(_e95.y)), _e446, vec3(_e95.z)).xyz, _e453, _e454);
        switch _e299 {
            case 0: {
                phi_21712_ = mix(_e455.xyz, _e310.xyz, vec3(_e310.w));
                break;
            }
            case 1: {
                let _e463 = global_11.member_1;
                let _e464 = _e455.xyz;
                let _e485 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e310.xyz * _e464).xyz)) * 1.06f);
                let _e487 = _e485.xyz;
                phi_21712_ = mix(_e455.xyz, mix(vec3(_e463.x), max(((((_e487 * _e463.x) * 1.732f) / vec3(length(_e487))) / vec3(dot(_e485.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e485 * mix(_e463.x, _e463.z, clamp(pow(max(_e455.x, max(_e455.y, _e455.z)), _e463.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e463.x, dot(clamp((_e464 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e310.w));
                break;
            }
            case 2: {
                let _e508 = _e455.xyz;
                let _e510 = (_e508 * _e310.xyz);
                let _e512 = global_11.member_1;
                let _e532 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e510.xyz)) * 1.06f);
                let _e534 = _e532.xyz;
                phi_21712_ = mix(_e508, mix(vec3(_e512.x), max(((((_e534 * _e512.x) * 1.732f) / vec3(length(_e534))) / vec3(dot(_e532.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e532 * mix(_e512.x, _e512.z, clamp(pow(max(_e510.x, max(_e510.y, _e510.z)), _e512.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e512.x, dot(clamp((_e510.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e310.w));
                break;
            }
            case 3: {
                let _e555 = _e455.xyz;
                let _e557 = (_e555 + _e310.xyz);
                let _e559 = global_11.member_1;
                let _e564 = dot(clamp((_e557.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e580 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e557.xyz)) * 1.06f);
                let _e582 = _e580.xyz;
                let _e593 = max(((((_e582 * _e559.x) * 1.732f) / vec3(length(_e582))) / vec3(dot(_e580.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e580 * mix(_e559.x, _e559.z, clamp(pow((max(_e557.x, max(_e557.y, _e557.z)) * 2f), _e559.y), 0f, 1f)))).xyz;
                let _e600 = global_11.member_2;
                phi_21712_ = mix(_e555, mix(vec3(_e559.x), mix(_e593, min(_e559.zzz, (_e593 + (vec3(_e564) * 2f))), vec3((1f / _e600))).xyz, vec3(pow(smoothstep(0.0003f, _e559.x, _e564), 0.5f))).xyz, vec3(_e310.w));
                break;
            }
            case 4: {
                phi_21712_ = mix(_e455.xyz, _e310.xyz, vec3(_e310.w));
                break;
            }
            default: {
                phi_21712_ = _e455;
                break;
            }
        }
        let _e620 = phi_21712_;
        let _e622 = global_11.member_15;
        let _e625 = clamp((_e620 * mix(_e622, 1f, (smoothstep(0f, 0.01f, _e287) * (1f - _e229)))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e628 = (_e625.xyz * _e319.xyz);
        let _e633 = global_11.member_23;
        let _e635 = global_11.member_24;
        let _e638 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e628.xyz));
        let _e646 = mix(_e633.xyz, _e635.xyz, vec3(_e431));
        let _e666 = mix(mix(_e628, ((_e638.xyz * mix(min(_e646.x, dot(_e625.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e646.z, clamp(pow(max(_e628.x, max(_e628.y, _e628.z)), _e646.y), 0f, 1f))) / vec3(max(_e638.x, max(_e638.y, _e638.z)))).xyz, vec3(_e217)), _e453, _e454);
        phi_22401_ = vec4<f32>(_e666.x, _e666.y, _e666.z, 1f);
    }
    let _e672 = phi_22401_;
    let _e673 = textureSample(global_15, global_6, _e92);
    phi_6805_ = _e672;
    if (_e673.w < 0f) {
        let _e681 = vec4<f32>(_e673.x, _e672.y, _e672.z, _e672.w);
        let _e687 = vec4<f32>(_e681.x, _e673.y, _e681.z, _e681.w);
        phi_6805_ = vec4<f32>(_e687.x, _e687.y, _e673.z, _e687.w);
    }
    let _e695 = phi_6805_;
    global_16 = _e695;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_9 = param_2;
    function_();
    let _e7 = global_16;
    return _e7;
}
