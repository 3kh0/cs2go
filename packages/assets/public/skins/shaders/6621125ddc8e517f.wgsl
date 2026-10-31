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
@group(1) @binding(40) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
var<private> global_7: vec2<f32>;
@group(1) @binding(37) 
var global_8: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_9: type_9;
@group(1) @binding(41) 
var global_10: texture_2d<f32>;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(34) 
var global_12: texture_2d<f32>;
@group(1) @binding(36) 
var global_13: texture_2d<f32>;
var<private> global_14: vec4<f32>;

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

    let _e77 = global;
    let _e80 = _e77.xy;
    let _e81 = textureSample(global_1, global_2, _e80);
    let _e83 = textureSample(global_3, global_2, _e80);
    let _e85 = global_4;
    let _e87 = textureSample(global_5, global_6, _e85.xy);
    let _e89 = global_7;
    let _e91 = textureSample(global_8, global_6, _e89.xy);
    let _e93 = global_9.member_24;
    switch _e93 {
        case 1: {
            phi_19017_ = vec4<f32>(_e91.x, _e91.y, _e91.z, (_e91.w * (1f - max(_e83.x, max(_e83.y, _e83.z)))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e91.x, _e91.y, _e91.z, (_e91.w * (_e83.x * (1f - max(_e83.y, _e83.z)))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e91.x, _e91.y, _e91.z, (_e91.w * (_e83.y * (1f - _e83.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e91.x, _e91.y, _e91.z, (_e91.w * _e83.z));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e91.x, _e91.y, _e91.z, (_e91.w * max(_e83.x, max(_e83.y, _e83.z))));
            break;
        }
        default: {
            phi_19017_ = _e91;
            break;
        }
    }
    let _e152 = phi_19017_;
    let _e155 = global_9.member_3;
    let _e156 = (_e152.w * _e155);
    let _e159 = global_9.member_5;
    let _e160 = (_e152.xyz * _e159);
    let _e164 = vec4<f32>(_e160.x, _e160.y, _e160.z, _e156);
    let _e165 = (_e87.x * _e81.x);
    let _e168 = global_9.member_21;
    let _e170 = ((_e168 * 6f) + 1f);
    let _e174 = global_9.member_6;
    let _e178 = global_9.member_15;
    let _e188 = mix(mix(mix(_e178.x, _e178.y, _e83.x), _e178.z, _e83.y), _e178.w, _e83.z);
    let _e191 = global_9.member_10;
    let _e192 = (_e191 * _e188);
    let _e193 = (0.58f - _e192);
    let _e194 = (0.68f + _e192);
    let _e195 = smoothstep(_e193, _e194, ((((_e81.w + _e165) * _e170) * mix(1f, _e174, _e152.w)) * _e188));
    let _e197 = smoothstep(_e193, _e194, ((_e165 * _e170) * _e174));
    if (_e93 == 0i) {
        phi_21709_ = max(0f, mix(_e195, min(_e195, _e197), _e156));
    } else {
        phi_21709_ = _e195;
    }
    let _e203 = phi_21709_;
    let _e205 = global_9.member_25;
    phi_19287_ = _e164;
    if (_e205 == 4i) {
        phi_19287_ = vec4<f32>(_e164.x, _e164.y, _e164.z, (_e156 * clamp((1f - _e197), 0f, 1f)));
    }
    let _e216 = phi_19287_;
    let _e218 = textureSample(global_10, global_6, _e85.zw);
    let _e225 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e218, vec4(((pow((1f - _e81.x), 4f) * 0.25f) + (0.75f * _e168))));
    let _e227 = global_9.member_20;
    let _e234 = mix(mix(mix(_e227.x, _e227.y, _e83.x), _e227.z, _e83.y), _e227.w, _e83.z);
    let _e236 = global_9.member;
    if (_e236 != 0i) {
        let _e238 = textureSample(global_11, global_2, _e80);
        let _e249 = global_9.member_17;
        if (_e249 != 0i) {
            let _e252 = global_9.member_18;
            phi_21710_ = mix(mix(mix(_e252.x, _e252.y, _e83.x), _e252.z, _e83.y), _e252.w, _e83.z);
        } else {
            let _e261 = global_9.member_16;
            phi_21710_ = _e261;
        }
        let _e263 = phi_21710_;
        let _e265 = global_9.member_4;
        let _e266 = (((1f - _e197) * _e216.w) * _e265);
        let _e268 = global_9.member_7;
        let _e271 = global_9.member_8;
        let _e272 = mix(_e234, _e271, _e266);
        let _e282 = mix(vec4<f32>(min(1f, (mix(_e263, _e268, _e266) + ((((1f - _e225.w) * _e168) * _e168) * 0.5f))), _e272, 0f, 1f), vec4<f32>(_e238.x, _e238.y, _e238.z, _e238.w), vec4(_e203));
        let _e285 = global_9.member_9;
        let _e287 = mix((1f - _e203), (_e285 - _e203), _e266);
        let _e294 = global_9.member_19;
        let _e296 = vec4<f32>(_e282.x, _e282.y, _e287, _e282.w).xyz;
        let _e297 = (_e296 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e300 = pow(((_e296 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e282.x <= 0.04045f) {
            phi_21354_ = _e297.x;
        } else {
            phi_21354_ = _e300.x;
        }
        let _e306 = phi_21354_;
        if (_e282.y <= 0.04045f) {
            phi_23035_ = _e297.y;
        } else {
            phi_23035_ = _e300.y;
        }
        let _e312 = phi_23035_;
        if (_e287 <= 0.04045f) {
            phi_19513_ = _e297.z;
        } else {
            phi_19513_ = _e300.z;
        }
        let _e317 = phi_19513_;
        let _e318 = vec4<f32>(_e306, _e312, _e287, min(1f, _e294));
        phi_11711_ = vec4<f32>(_e318.x, _e318.y, _e317, _e318.w);
        phi_10247_ = _e272;
    } else {
        phi_11711_ = vec4<f32>(_e77.xy, 0f, 1f);
        phi_10247_ = _e234;
    }
    let _e325 = phi_11711_;
    let _e327 = phi_10247_;
    phi_22401_ = _e325;
    if (_e236 == 0i) {
        let _e329 = textureSample(global_12, global_2, _e80);
        let _e331 = global_9.member_11;
        let _e334 = global_9.member_12;
        let _e338 = global_9.member_13;
        let _e342 = global_9.member_14;
        let _e343 = mix(mix(mix(_e331, _e334, vec3(_e83.x)), _e338, vec3(_e83.y)), _e342, vec3(_e83.z));
        switch _e205 {
            case 0: {
                phi_19629_ = mix(_e343.xyz, _e216.xyz, vec3(_e216.w));
                break;
            }
            case 1: {
                let _e350 = _e343.xyz;
                let _e352 = global_9.member_1;
                let _e373 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e216.xyz * _e350).xyz)) * 1.06f);
                let _e375 = _e373.xyz;
                phi_19629_ = mix(_e350, mix(vec3(_e352.x), max(((((_e375 * _e352.x) * 1.732f) / vec3(length(_e375))) / vec3(dot(_e373.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e373 * mix(_e352.x, _e352.z, clamp(pow(max(_e343.x, max(_e343.y, _e343.z)), _e352.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e352.x, dot(clamp((_e350 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e216.w));
                break;
            }
            case 2: {
                let _e396 = _e343.xyz;
                let _e398 = (_e396 * _e216.xyz);
                let _e400 = global_9.member_1;
                let _e420 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e398.xyz)) * 1.06f);
                let _e422 = _e420.xyz;
                phi_19629_ = mix(_e396, mix(vec3(_e400.x), max(((((_e422 * _e400.x) * 1.732f) / vec3(length(_e422))) / vec3(dot(_e420.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e420 * mix(_e400.x, _e400.z, clamp(pow(max(_e398.x, max(_e398.y, _e398.z)), _e400.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e400.x, dot(clamp((_e398.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e216.w));
                break;
            }
            case 3: {
                let _e443 = _e343.xyz;
                let _e445 = (_e443 + _e216.xyz);
                let _e447 = global_9.member_1;
                let _e452 = dot(clamp((_e445.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e468 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e445.xyz)) * 1.06f);
                let _e470 = _e468.xyz;
                let _e481 = max(((((_e470 * _e447.x) * 1.732f) / vec3(length(_e470))) / vec3(dot(_e468.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e468 * mix(_e447.x, _e447.z, clamp(pow((max(_e445.x, max(_e445.y, _e445.z)) * 2f), _e447.y), 0f, 1f)))).xyz;
                let _e488 = global_9.member_2;
                phi_19629_ = mix(_e443, mix(vec3(_e447.x), mix(_e481, min(_e447.zzz, (_e481 + (vec3(_e452) * 2f))), vec3((1f / _e488))).xyz, vec3(pow(smoothstep(0.0003f, _e447.x, _e452), 0.5f))).xyz, vec3(_e216.w));
                break;
            }
            case 4: {
                phi_19629_ = mix(_e343.xyz, _e216.xyz, vec3(_e216.w));
                break;
            }
            default: {
                phi_19629_ = _e343.xyz;
                break;
            }
        }
        let _e508 = phi_19629_;
        let _e509 = _e508.xyz;
        let _e511 = (_e509 * _e225.xyz);
        let _e516 = global_9.member_22;
        let _e518 = global_9.member_23;
        let _e521 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e511.xyz));
        let _e528 = mix(_e516.xyz, _e518.xyz, vec3(_e327));
        let _e550 = mix(mix(_e511, ((_e521.xyz * mix(min(_e528.x, dot(_e509, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e528.z, clamp(pow(max(_e511.x, max(_e511.y, _e511.z)), _e528.y), 0f, 1f))) / vec3(max(_e521.x, max(_e521.y, _e521.z)))).xyz, vec3(_e168)), _e329.xyz, vec3(_e203));
        phi_22401_ = vec4<f32>(_e550.x, _e550.y, _e550.z, 1f);
    }
    let _e556 = phi_22401_;
    let _e557 = textureSample(global_13, global_6, _e80);
    phi_6805_ = _e556;
    if (_e557.w < 0f) {
        let _e565 = vec4<f32>(_e557.x, _e556.y, _e556.z, _e556.w);
        let _e571 = vec4<f32>(_e565.x, _e557.y, _e565.z, _e565.w);
        phi_6805_ = vec4<f32>(_e571.x, _e571.y, _e557.z, _e571.w);
    }
    let _e579 = phi_6805_;
    global_14 = _e579;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_7 = param_2;
    function_();
    let _e7 = global_14;
    return _e7;
}
