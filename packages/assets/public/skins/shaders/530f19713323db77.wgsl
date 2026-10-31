struct type_8 {
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
    member_16: i32,
    member_17: vec4<f32>,
    member_18: f32,
    member_19: vec4<f32>,
    member_20: f32,
    member_21: f32,
    member_22: f32,
    member_23: f32,
    member_24: vec4<f32>,
    member_25: vec3<f32>,
    member_26: vec3<f32>,
    member_27: i32,
    member_28: i32,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(43) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(42) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(45) 
var global_11: texture_2d<f32>;
var<private> global_12: vec2<f32>;
@group(1) @binding(40) 
var global_13: texture_2d<f32>;
@group(1) @binding(44) 
var global_14: texture_2d<f32>;
@group(1) @binding(35) 
var global_15: texture_2d<f32>;
@group(1) @binding(37) 
var global_16: texture_2d<f32>;
@group(1) @binding(38) 
var global_17: texture_2d<f32>;
@group(1) @binding(34) 
var global_18: texture_2d<f32>;
@group(1) @binding(39) 
var global_19: texture_2d<f32>;
var<private> global_20: vec4<f32>;

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

    let _e97 = global;
    let _e100 = _e97.xy;
    let _e101 = textureSample(global_1, global_2, _e100);
    let _e104 = textureSample(global_3, global_2, _e100);
    let _e106 = global_4;
    let _e108 = textureSample(global_5, global_6, _e106.xy);
    let _e111 = textureSample(global_7, global_8, _e97.zw);
    let _e112 = textureSample(global_9, global_6, _e100);
    let _e115 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e112, (vec4<f32>(1f, 1f, 1f, 1f) - _e112)));
    let _e122 = global_10.member_22;
    let _e126 = (mix(0.5f, pow(_e101.x, 0.85f), _e122) * mix(1f, (_e101.y * (min(_e115.x, _e115.y) * 2f)), _e122));
    let _e127 = (_e126 * 2f);
    let _e131 = global_10.member_21;
    let _e140 = global_10.member_23;
    let _e141 = (max((_e111.y * _e131), (((1f - _e101.y) * 0.2f) * _e122)) + _e140);
    let _e142 = _e97.zw;
    let _e145 = textureSample(global_7, global_8, (_e142 + vec2<f32>(0.00048828125f, 0.00048828125f)).xy);
    let _e148 = textureSample(global_7, global_8, (_e142 + vec2<f32>(-0.00048828125f, -0.00048828125f)).xy);
    let _e151 = textureSample(global_7, global_8, (_e142 + vec2<f32>(-0.00048828125f, 0.00048828125f)).xy);
    let _e154 = textureSample(global_7, global_8, (_e142 + vec2<f32>(0.00048828125f, -0.00048828125f)).xy);
    let _e168 = textureSample(global_11, global_2, vec2<f32>(mix(_e127, (_e126 + _e111.x), _e131), _e141));
    let _e171 = textureSample(global_11, global_2, vec2<f32>(mix(_e127, (_e126 + _e145.x), _e131), _e141));
    let _e176 = textureSample(global_11, global_2, vec2<f32>(mix(_e127, (_e126 + _e148.x), _e131), _e141));
    let _e181 = textureSample(global_11, global_2, vec2<f32>(mix(_e127, (_e126 + _e151.x), _e131), _e141));
    let _e186 = textureSample(global_11, global_2, vec2<f32>(mix(_e127, (_e126 + _e154.x), _e131), _e141));
    let _e191 = global_12;
    let _e193 = textureSample(global_13, global_6, _e191.xy);
    let _e195 = global_10.member_27;
    switch _e195 {
        case 1: {
            phi_19017_ = vec4<f32>(_e193.x, _e193.y, _e193.z, (_e193.w * (1f - max(_e104.x, max(_e104.y, _e104.z)))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e193.x, _e193.y, _e193.z, (_e193.w * (_e104.x * (1f - max(_e104.y, _e104.z)))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e193.x, _e193.y, _e193.z, (_e193.w * (_e104.y * (1f - _e104.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e193.x, _e193.y, _e193.z, (_e193.w * _e104.z));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e193.x, _e193.y, _e193.z, (_e193.w * max(_e104.x, max(_e104.y, _e104.z))));
            break;
        }
        default: {
            phi_19017_ = _e193;
            break;
        }
    }
    let _e254 = phi_19017_;
    let _e257 = global_10.member_3;
    let _e258 = (_e254.w * _e257);
    let _e261 = global_10.member_5;
    let _e262 = (_e254.xyz * _e261);
    let _e266 = vec4<f32>(_e262.x, _e262.y, _e262.z, _e258);
    let _e267 = (_e108.x * _e101.x);
    let _e270 = global_10.member_20;
    let _e272 = ((_e270 * 6f) + 1f);
    let _e276 = global_10.member_6;
    let _e280 = global_10.member_15;
    let _e290 = mix(mix(mix(_e280.x, _e280.y, _e104.x), _e280.z, _e104.y), _e280.w, _e104.z);
    let _e293 = global_10.member_10;
    let _e294 = (_e293 * _e290);
    let _e295 = (0.58f - _e294);
    let _e296 = (0.68f + _e294);
    let _e297 = smoothstep(_e295, _e296, ((((_e101.w + _e267) * _e272) * mix(1f, _e276, _e254.w)) * _e290));
    let _e299 = smoothstep(_e295, _e296, ((_e267 * _e272) * _e276));
    if (_e195 == 0i) {
        phi_21709_ = max(0f, mix(_e297, min(_e297, _e299), _e258));
    } else {
        phi_21709_ = _e297;
    }
    let _e305 = phi_21709_;
    let _e307 = global_10.member_28;
    phi_19287_ = _e266;
    if (_e307 == 4i) {
        phi_19287_ = vec4<f32>(_e266.x, _e266.y, _e266.z, (_e258 * clamp((1f - _e299), 0f, 1f)));
    }
    let _e318 = phi_19287_;
    let _e320 = textureSample(global_14, global_6, _e106.zw);
    let _e327 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e320, vec4(((pow((1f - _e101.x), 4f) * 0.25f) + (0.75f * _e270))));
    let _e329 = global_10.member_19;
    let _e336 = mix(mix(mix(_e329.x, _e329.y, _e104.x), _e329.z, _e104.y), _e329.w, _e104.z);
    let _e338 = global_10.member;
    if (_e338 != 0i) {
        let _e340 = textureSample(global_15, global_2, _e100);
        let _e350 = textureSample(global_16, global_6, _e100);
        let _e353 = global_10.member_16;
        if (_e353 != 0i) {
            let _e356 = global_10.member_17;
            phi_21710_ = mix(mix(mix(_e356.x, _e356.y, _e104.x), _e356.z, _e104.y), _e356.w, _e104.z);
        } else {
            phi_21710_ = _e350.x;
        }
        let _e365 = phi_21710_;
        let _e367 = global_10.member_4;
        let _e368 = (((1f - _e299) * _e318.w) * _e367);
        let _e370 = global_10.member_7;
        let _e373 = global_10.member_8;
        let _e374 = mix(_e336, _e373, _e368);
        let _e384 = mix(vec4<f32>(min(1f, (mix(_e365, _e370, _e368) + ((((1f - _e327.w) * _e270) * _e270) * 0.5f))), _e374, 0f, 1f), vec4<f32>(_e340.x, _e340.y, _e340.z, _e340.w), vec4(_e305));
        let _e386 = textureSample(global_17, global_6, _e100);
        let _e390 = global_10.member_9;
        let _e392 = mix(((1f - _e305) * _e386.x), (_e390 - _e305), _e368);
        let _e399 = global_10.member_18;
        let _e401 = vec4<f32>(_e384.x, _e384.y, _e392, _e384.w).xyz;
        let _e402 = (_e401 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e405 = pow(((_e401 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e384.x <= 0.04045f) {
            phi_21354_ = _e402.x;
        } else {
            phi_21354_ = _e405.x;
        }
        let _e411 = phi_21354_;
        if (_e384.y <= 0.04045f) {
            phi_23035_ = _e402.y;
        } else {
            phi_23035_ = _e405.y;
        }
        let _e417 = phi_23035_;
        if (_e392 <= 0.04045f) {
            phi_19513_ = _e402.z;
        } else {
            phi_19513_ = _e405.z;
        }
        let _e422 = phi_19513_;
        let _e423 = vec4<f32>(_e411, _e417, _e392, min(1f, _e399));
        phi_11711_ = vec4<f32>(_e423.x, _e423.y, _e422, _e423.w);
        phi_10247_ = _e374;
    } else {
        phi_11711_ = vec4<f32>(_e97.xy, 0f, 1f);
        phi_10247_ = _e336;
    }
    let _e430 = phi_11711_;
    let _e432 = phi_10247_;
    phi_22401_ = _e430;
    if (_e338 == 0i) {
        let _e434 = textureSample(global_18, global_2, _e100);
        let _e436 = global_10.member_11;
        let _e438 = (((((_e168.xyzw + _e171.xyzw).xyzw + _e176.xyzw).xyzw + _e181.xyzw).xyzw + _e186.xyzw).xyzw * 0.2f).xyz;
        let _e440 = global_10.member_24;
        let _e446 = global_10.member_12;
        let _e455 = global_10.member_13;
        let _e464 = global_10.member_14;
        let _e470 = mix(mix(mix(mix(_e436.xyz, _e438, vec3(_e440.x)).xyz, mix(_e446.xyz, _e438, vec3(_e440.y)), vec3(_e104.x)).xyz, mix(_e455.xyz, _e438, vec3(_e440.z)), vec3(_e104.y)).xyz, mix(_e464.xyz, _e438, vec3(_e440.w)), vec3(_e104.z));
        switch _e307 {
            case 0: {
                phi_19629_ = mix(_e470.xyz, _e318.xyz, vec3(_e318.w));
                break;
            }
            case 1: {
                let _e480 = _e470.xyz;
                let _e482 = global_10.member_1;
                let _e500 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e318.xyz * _e480).xyz)) * 1.06f);
                let _e502 = _e500.xyz;
                phi_19629_ = mix(_e480, mix(vec3(_e482.x), max(((((_e502 * _e482.x) * 1.732f) / vec3(length(_e502))) / vec3(dot(_e500.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e500 * mix(_e482.x, _e482.z, clamp(pow(max(_e470.x, max(_e470.y, _e470.z)), _e482.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e482.x, dot(clamp((_e480 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e318.w));
                break;
            }
            case 2: {
                let _e523 = _e470.xyz;
                let _e525 = (_e523 * _e318.xyz);
                let _e527 = global_10.member_1;
                let _e547 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e525.xyz)) * 1.06f);
                let _e549 = _e547.xyz;
                phi_19629_ = mix(_e523, mix(vec3(_e527.x), max(((((_e549 * _e527.x) * 1.732f) / vec3(length(_e549))) / vec3(dot(_e547.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e547 * mix(_e527.x, _e527.z, clamp(pow(max(_e525.x, max(_e525.y, _e525.z)), _e527.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e527.x, dot(clamp((_e525.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e318.w));
                break;
            }
            case 3: {
                let _e570 = _e470.xyz;
                let _e572 = (_e570 + _e318.xyz);
                let _e574 = global_10.member_1;
                let _e579 = dot(clamp((_e572.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e595 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e572.xyz)) * 1.06f);
                let _e597 = _e595.xyz;
                let _e608 = max(((((_e597 * _e574.x) * 1.732f) / vec3(length(_e597))) / vec3(dot(_e595.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e595 * mix(_e574.x, _e574.z, clamp(pow((max(_e572.x, max(_e572.y, _e572.z)) * 2f), _e574.y), 0f, 1f)))).xyz;
                let _e615 = global_10.member_2;
                phi_19629_ = mix(_e570, mix(vec3(_e574.x), mix(_e608, min(_e574.zzz, (_e608 + (vec3(_e579) * 2f))), vec3((1f / _e615))).xyz, vec3(pow(smoothstep(0.0003f, _e574.x, _e579), 0.5f))).xyz, vec3(_e318.w));
                break;
            }
            case 4: {
                phi_19629_ = mix(_e470.xyz, _e318.xyz, vec3(_e318.w));
                break;
            }
            default: {
                phi_19629_ = _e470.xyz;
                break;
            }
        }
        let _e635 = phi_19629_;
        let _e636 = _e635.xyz;
        let _e638 = (_e636 * _e327.xyz);
        let _e643 = global_10.member_25;
        let _e645 = global_10.member_26;
        let _e648 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e638.xyz));
        let _e655 = mix(_e643.xyz, _e645.xyz, vec3(_e432));
        let _e677 = mix(mix(_e638, ((_e648.xyz * mix(min(_e655.x, dot(_e636, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e655.z, clamp(pow(max(_e638.x, max(_e638.y, _e638.z)), _e655.y), 0f, 1f))) / vec3(max(_e648.x, max(_e648.y, _e648.z)))).xyz, vec3(_e270)), _e434.xyz, vec3(_e305));
        phi_22401_ = vec4<f32>(_e677.x, _e677.y, _e677.z, 1f);
    }
    let _e683 = phi_22401_;
    let _e684 = textureSample(global_19, global_6, _e100);
    phi_6805_ = _e683;
    if (_e684.w < 0f) {
        let _e692 = vec4<f32>(_e684.x, _e683.y, _e683.z, _e683.w);
        let _e698 = vec4<f32>(_e692.x, _e684.y, _e692.z, _e692.w);
        phi_6805_ = vec4<f32>(_e698.x, _e698.y, _e684.z, _e698.w);
    }
    let _e706 = phi_6805_;
    global_20 = _e706;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_12 = param_2;
    function_();
    let _e7 = global_20;
    return _e7;
}
