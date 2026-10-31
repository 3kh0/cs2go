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
    member_15: vec4<f32>,
    member_16: f32,
    member_17: i32,
    member_18: vec4<f32>,
    member_19: f32,
    member_20: vec4<f32>,
    member_21: f32,
    member_22: vec3<f32>,
    member_23: vec3<f32>,
    member_24: i32,
    member_25: i32,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(41) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
var<private> global_7: vec2<f32>;
@group(1) @binding(38) 
var global_8: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_9: type_9;
@group(1) @binding(42) 
var global_10: texture_2d<f32>;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(37) 
var global_14: texture_2d<f32>;
var<private> global_15: vec4<f32>;

fn function_() {
    var phi_19017_: vec4<f32>;
    var phi_21709_: f32;
    var phi_19287_: vec4<f32>;
    var phi_21710_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_19629_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e78 = global;
    let _e81 = _e78.xy;
    let _e82 = textureSample(global_1, global_2, _e81);
    let _e84 = textureSample(global_3, global_2, _e81);
    let _e86 = global_4;
    let _e88 = textureSample(global_5, global_6, _e86.xy);
    let _e90 = global_7;
    let _e92 = textureSample(global_8, global_6, _e90.xy);
    let _e94 = global_9.member_24;
    switch _e94 {
        case 1: {
            phi_19017_ = vec4<f32>(_e92.x, _e92.y, _e92.z, (_e92.w * (1f - max(_e84.x, max(_e84.y, _e84.z)))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e92.x, _e92.y, _e92.z, (_e92.w * (_e84.x * (1f - max(_e84.y, _e84.z)))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e92.x, _e92.y, _e92.z, (_e92.w * (_e84.y * (1f - _e84.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e92.x, _e92.y, _e92.z, (_e92.w * _e84.z));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e92.x, _e92.y, _e92.z, (_e92.w * max(_e84.x, max(_e84.y, _e84.z))));
            break;
        }
        default: {
            phi_19017_ = _e92;
            break;
        }
    }
    let _e153 = phi_19017_;
    let _e156 = global_9.member_3;
    let _e157 = (_e153.w * _e156);
    let _e160 = global_9.member_5;
    let _e161 = (_e153.xyz * _e160);
    let _e165 = vec4<f32>(_e161.x, _e161.y, _e161.z, _e157);
    let _e166 = (_e88.x * _e82.x);
    let _e169 = global_9.member_21;
    let _e171 = ((_e169 * 6f) + 1f);
    let _e175 = global_9.member_6;
    let _e179 = global_9.member_15;
    let _e189 = mix(mix(mix(_e179.x, _e179.y, _e84.x), _e179.z, _e84.y), _e179.w, _e84.z);
    let _e192 = global_9.member_10;
    let _e193 = (_e192 * _e189);
    let _e194 = (0.58f - _e193);
    let _e195 = (0.68f + _e193);
    let _e196 = smoothstep(_e194, _e195, ((((_e82.w + _e166) * _e171) * mix(1f, _e175, _e153.w)) * _e189));
    let _e198 = smoothstep(_e194, _e195, ((_e166 * _e171) * _e175));
    if (_e94 == 0i) {
        phi_21709_ = max(0f, mix(_e196, min(_e196, _e198), _e157));
    } else {
        phi_21709_ = _e196;
    }
    let _e204 = phi_21709_;
    let _e206 = global_9.member_25;
    phi_19287_ = _e165;
    if (_e206 == 4i) {
        phi_19287_ = vec4<f32>(_e165.x, _e165.y, _e165.z, (_e157 * clamp((1f - _e198), 0f, 1f)));
    }
    let _e217 = phi_19287_;
    let _e219 = textureSample(global_10, global_6, _e86.zw);
    let _e226 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e219, vec4(((pow((1f - _e82.x), 4f) * 0.25f) + (0.75f * _e169))));
    let _e228 = global_9.member_20;
    let _e235 = mix(mix(mix(_e228.x, _e228.y, _e84.x), _e228.z, _e84.y), _e228.w, _e84.z);
    let _e237 = global_9.member;
    if (_e237 != 0i) {
        let _e239 = textureSample(global_11, global_2, _e81);
        let _e250 = global_9.member_17;
        if (_e250 != 0i) {
            let _e253 = global_9.member_18;
            phi_21710_ = mix(mix(mix(_e253.x, _e253.y, _e84.x), _e253.z, _e84.y), _e253.w, _e84.z);
        } else {
            let _e262 = global_9.member_16;
            phi_21710_ = _e262;
        }
        let _e264 = phi_21710_;
        let _e266 = global_9.member_4;
        let _e267 = (((1f - _e198) * _e217.w) * _e266);
        let _e269 = global_9.member_7;
        let _e272 = global_9.member_8;
        let _e273 = mix(_e235, _e272, _e267);
        let _e283 = mix(vec4<f32>(min(1f, (mix(_e264, _e269, _e267) + ((((1f - _e226.w) * _e169) * _e169) * 0.5f))), _e273, 0f, 1f), vec4<f32>(_e239.x, _e239.y, _e239.z, _e239.w), vec4(_e204));
        let _e285 = textureSample(global_12, global_6, _e81);
        let _e289 = global_9.member_9;
        let _e291 = mix(((1f - _e204) * _e285.x), (_e289 - _e204), _e267);
        let _e298 = global_9.member_19;
        let _e300 = vec4<f32>(_e283.x, _e283.y, _e291, _e283.w).xyz;
        let _e301 = (_e300 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e304 = pow(((_e300 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e283.x <= 0.04045f) {
            phi_21354_ = _e301.x;
        } else {
            phi_21354_ = _e304.x;
        }
        let _e310 = phi_21354_;
        if (_e283.y <= 0.04045f) {
            phi_23035_ = _e301.y;
        } else {
            phi_23035_ = _e304.y;
        }
        let _e316 = phi_23035_;
        if (_e291 <= 0.04045f) {
            phi_19513_ = _e301.z;
        } else {
            phi_19513_ = _e304.z;
        }
        let _e321 = phi_19513_;
        let _e322 = vec4<f32>(_e310, _e316, _e291, min(1f, _e298));
        phi_11711_ = vec4<f32>(_e322.x, _e322.y, _e321, _e322.w);
        phi_10247_ = _e273;
    } else {
        phi_11711_ = vec4<f32>(_e78.xy, 0f, 1f);
        phi_10247_ = _e235;
    }
    let _e329 = phi_11711_;
    let _e331 = phi_10247_;
    phi_22401_ = _e329;
    if (_e237 == 0i) {
        let _e333 = textureSample(global_13, global_2, _e81);
        let _e335 = global_9.member_11;
        let _e338 = global_9.member_12;
        let _e342 = global_9.member_13;
        let _e346 = global_9.member_14;
        let _e347 = mix(mix(mix(_e335, _e338, vec3(_e84.x)), _e342, vec3(_e84.y)), _e346, vec3(_e84.z));
        switch _e206 {
            case 0: {
                phi_19629_ = mix(_e347.xyz, _e217.xyz, vec3(_e217.w));
                break;
            }
            case 1: {
                let _e354 = _e347.xyz;
                let _e356 = global_9.member_1;
                let _e377 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e217.xyz * _e354).xyz)) * 1.06f);
                let _e379 = _e377.xyz;
                phi_19629_ = mix(_e354, mix(vec3(_e356.x), max(((((_e379 * _e356.x) * 1.732f) / vec3(length(_e379))) / vec3(dot(_e377.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e377 * mix(_e356.x, _e356.z, clamp(pow(max(_e347.x, max(_e347.y, _e347.z)), _e356.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e356.x, dot(clamp((_e354 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e217.w));
                break;
            }
            case 2: {
                let _e400 = _e347.xyz;
                let _e402 = (_e400 * _e217.xyz);
                let _e404 = global_9.member_1;
                let _e424 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e402.xyz)) * 1.06f);
                let _e426 = _e424.xyz;
                phi_19629_ = mix(_e400, mix(vec3(_e404.x), max(((((_e426 * _e404.x) * 1.732f) / vec3(length(_e426))) / vec3(dot(_e424.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e424 * mix(_e404.x, _e404.z, clamp(pow(max(_e402.x, max(_e402.y, _e402.z)), _e404.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e404.x, dot(clamp((_e402.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e217.w));
                break;
            }
            case 3: {
                let _e447 = _e347.xyz;
                let _e449 = (_e447 + _e217.xyz);
                let _e451 = global_9.member_1;
                let _e456 = dot(clamp((_e449.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e472 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e449.xyz)) * 1.06f);
                let _e474 = _e472.xyz;
                let _e485 = max(((((_e474 * _e451.x) * 1.732f) / vec3(length(_e474))) / vec3(dot(_e472.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e472 * mix(_e451.x, _e451.z, clamp(pow((max(_e449.x, max(_e449.y, _e449.z)) * 2f), _e451.y), 0f, 1f)))).xyz;
                let _e492 = global_9.member_2;
                phi_19629_ = mix(_e447, mix(vec3(_e451.x), mix(_e485, min(_e451.zzz, (_e485 + (vec3(_e456) * 2f))), vec3((1f / _e492))).xyz, vec3(pow(smoothstep(0.0003f, _e451.x, _e456), 0.5f))).xyz, vec3(_e217.w));
                break;
            }
            case 4: {
                phi_19629_ = mix(_e347.xyz, _e217.xyz, vec3(_e217.w));
                break;
            }
            default: {
                phi_19629_ = _e347.xyz;
                break;
            }
        }
        let _e512 = phi_19629_;
        let _e513 = _e512.xyz;
        let _e515 = (_e513 * _e226.xyz);
        let _e520 = global_9.member_22;
        let _e522 = global_9.member_23;
        let _e525 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e515.xyz));
        let _e532 = mix(_e520.xyz, _e522.xyz, vec3(_e331));
        let _e554 = mix(mix(_e515, ((_e525.xyz * mix(min(_e532.x, dot(_e513, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e532.z, clamp(pow(max(_e515.x, max(_e515.y, _e515.z)), _e532.y), 0f, 1f))) / vec3(max(_e525.x, max(_e525.y, _e525.z)))).xyz, vec3(_e169)), _e333.xyz, vec3(_e204));
        phi_22401_ = vec4<f32>(_e554.x, _e554.y, _e554.z, 1f);
    }
    let _e560 = phi_22401_;
    let _e561 = textureSample(global_14, global_6, _e81);
    phi_6805_ = _e560;
    if (_e561.w < 0f) {
        let _e569 = vec4<f32>(_e561.x, _e560.y, _e560.z, _e560.w);
        let _e575 = vec4<f32>(_e569.x, _e561.y, _e569.z, _e569.w);
        phi_6805_ = vec4<f32>(_e575.x, _e575.y, _e561.z, _e575.w);
    }
    let _e583 = phi_6805_;
    global_15 = _e583;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_7 = param_2;
    function_();
    let _e7 = global_15;
    return _e7;
}
