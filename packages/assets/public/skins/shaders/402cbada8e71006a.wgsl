struct type_9 {
    member: i32,
    member_1: vec3<f32>,
    member_2: f32,
    member_3: i32,
    member_4: i32,
    member_5: i32,
    member_6: f32,
    member_7: f32,
    member_8: f32,
    member_9: f32,
    member_10: f32,
    member_11: f32,
    member_12: f32,
    member_13: f32,
    member_14: f32,
    member_15: f32,
    member_16: f32,
    member_17: vec3<f32>,
    member_18: vec3<f32>,
    member_19: i32,
    member_20: i32,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
var<private> global_3: vec4<f32>;
@group(1) @binding(44) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(43) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
var<private> global_8: vec2<f32>;
@group(1) @binding(41) 
var global_9: texture_2d<f32>;
@group(1) @binding(42) 
var global_10: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_11: type_9;
@group(1) @binding(45) 
var global_12: texture_2d<f32>;
@group(1) @binding(39) 
var global_13: texture_2d<f32>;
@group(1) @binding(35) 
var global_14: texture_2d<f32>;
@group(1) @binding(37) 
var global_15: texture_2d<f32>;
@group(1) @binding(38) 
var global_16: texture_2d<f32>;
@group(1) @binding(34) 
var global_17: texture_2d<f32>;
@group(1) @binding(36) 
var global_18: texture_2d<f32>;
@group(1) @binding(40) 
var global_19: texture_2d<f32>;
var<private> global_20: vec4<f32>;

fn function_() {
    var phi_19017_: vec4<f32>;
    var phi_21709_: f32;
    var phi_10021_: f32;
    var phi_21710_: f32;
    var phi_19287_: vec4<f32>;
    var phi_21711_: f32;
    var phi_21712_: f32;
    var phi_19018_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_19629_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e87 = global;
    let _e90 = _e87.xy;
    let _e91 = textureSample(global_1, global_2, _e90);
    let _e94 = (pow(_e91.x, 1.5f) * 0.96f);
    let _e96 = global_3;
    let _e98 = textureSample(global_4, global_5, _e96.xy);
    let _e100 = _e87.zw;
    let _e101 = textureSample(global_6, global_7, _e100);
    let _e102 = global_8;
    let _e104 = textureSample(global_9, global_5, _e102.xy);
    let _e105 = textureSample(global_10, global_5, _e90);
    let _e108 = global_11.member_19;
    phi_19017_ = _e104;
    if (_e108 == 8i) {
        phi_19017_ = vec4<f32>(_e104.x, _e104.y, _e104.z, (_e104.w * _e105.x));
    }
    let _e118 = phi_19017_;
    let _e121 = global_11.member_6;
    let _e122 = (_e118.w * _e121);
    let _e125 = global_11.member_8;
    let _e126 = (_e118.xyz * _e125);
    let _e130 = vec4<f32>(_e126.x, _e126.y, _e126.z, _e122);
    let _e135 = global_11.member_16;
    let _e138 = (_e98.x * mix(smoothstep(0f, 0.72f, pow(_e94, 1.3f)), smoothstep(0f, 0.4f, _e94), pow(_e135, 1.2f)));
    let _e141 = ((_e135 * 6f) + 1f);
    let _e149 = smoothstep(0f, 0.5f, _e101.w);
    let _e150 = (_e108 == 0i);
    if _e150 {
        phi_21709_ = max(0f, _e149);
    } else {
        phi_21709_ = _e149;
    }
    let _e153 = phi_21709_;
    let _e155 = global_11.member_9;
    let _e157 = (_e153 * mix(1f, _e155, _e118.w));
    if (_e108 > 0i) {
        phi_10021_ = max(0f, _e157);
    } else {
        phi_10021_ = _e157;
    }
    let _e161 = phi_10021_;
    let _e164 = global_11.member_13;
    let _e165 = (_e164 * _e161);
    let _e166 = (0.56f - _e165);
    let _e167 = (0.74f + _e165);
    let _e168 = smoothstep(_e166, _e167, ((((_e91.w + _e138) * _e141) + (smoothstep(0.5f, 0.6f, _e101.w) * smoothstep(1f, 0.9f, _e101.w))) * _e161));
    let _e170 = smoothstep(_e166, _e167, ((_e138 * _e141) * _e155));
    if _e150 {
        phi_21710_ = max(0f, mix(_e168, min(_e168, _e170), _e122));
    } else {
        phi_21710_ = _e168;
    }
    let _e175 = phi_21710_;
    let _e177 = global_11.member_20;
    phi_19287_ = _e130;
    if (_e177 == 4i) {
        phi_19287_ = vec4<f32>(_e130.x, _e130.y, _e130.z, (_e122 * clamp((1f - _e170), 0f, 1f)));
    }
    let _e188 = phi_19287_;
    let _e190 = textureSample(global_12, global_5, _e96.zw);
    let _e197 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e190, vec4(((pow((1f - _e94), 4f) * 0.25f) + (0.75f * _e135))));
    let _e199 = global_11.member_5;
    if (_e199 != 0i) {
        let _e201 = textureSample(global_13, global_5, _e100);
        phi_21711_ = _e201.x;
    } else {
        let _e203 = textureSample(global_13, global_5, _e90);
        phi_21711_ = _e203.x;
    }
    let _e206 = phi_21711_;
    let _e208 = global_11.member;
    phi_11711_ = vec4<f32>(_e87.xy, 0f, 1f);
    phi_10247_ = _e206;
    if (_e208 != 0i) {
        let _e210 = textureSample(global_14, global_2, _e90);
        let _e221 = global_11.member_3;
        if (_e221 != 0i) {
            let _e223 = textureSample(global_15, global_5, _e100);
            phi_21712_ = _e223.x;
        } else {
            let _e225 = textureSample(global_15, global_5, _e90);
            phi_21712_ = _e225.x;
        }
        let _e228 = phi_21712_;
        let _e230 = global_11.member_7;
        let _e231 = (((1f - _e170) * _e188.w) * _e230);
        let _e233 = global_11.member_10;
        let _e236 = global_11.member_11;
        let _e237 = mix(_e206, _e236, _e231);
        let _e247 = mix(vec4<f32>(min(1f, (mix(_e228, _e233, _e231) + ((((1f - _e197.w) * _e135) * _e135) * 0.5f))), _e237, 0f, 1f), vec4<f32>(_e210.x, _e210.y, _e210.z, _e210.w), vec4(_e175));
        let _e248 = (1f - _e175);
        let _e250 = global_11.member_4;
        if (_e250 != 0i) {
            let _e252 = textureSample(global_16, global_5, _e100);
            phi_19018_ = vec4<f32>(_e247.x, _e247.y, (_e248 * _e252.x), _e247.w);
        } else {
            let _e260 = textureSample(global_16, global_5, _e90);
            let _e262 = (_e248 * _e260.x);
            phi_19018_ = vec4<f32>(_e247.x, _e247.y, (_e262 * _e262), _e247.w);
        }
        let _e270 = phi_19018_;
        let _e273 = global_11.member_12;
        let _e275 = mix(_e270.z, (_e273 - _e175), _e231);
        let _e282 = global_11.member_15;
        let _e284 = vec4<f32>(_e270.x, _e270.y, _e275, _e270.w).xyz;
        let _e285 = (_e284 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e288 = pow(((_e284 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e270.x <= 0.04045f) {
            phi_21354_ = _e285.x;
        } else {
            phi_21354_ = _e288.x;
        }
        let _e294 = phi_21354_;
        if (_e270.y <= 0.04045f) {
            phi_23035_ = _e285.y;
        } else {
            phi_23035_ = _e288.y;
        }
        let _e300 = phi_23035_;
        if (_e275 <= 0.04045f) {
            phi_19513_ = _e285.z;
        } else {
            phi_19513_ = _e288.z;
        }
        let _e305 = phi_19513_;
        let _e306 = vec4<f32>(_e294, _e300, _e275, min(1f, _e282));
        phi_11711_ = vec4<f32>(_e306.x, _e306.y, _e305, _e306.w);
        phi_10247_ = _e237;
    }
    let _e313 = phi_11711_;
    let _e315 = phi_10247_;
    phi_22401_ = _e313;
    if (_e208 == 0i) {
        let _e317 = textureSample(global_17, global_2, _e90);
        let _e320 = global_11.member_14;
        let _e324 = _e317.xyz;
        let _e325 = vec3(_e175);
        let _e326 = mix(clamp((_e101.xyz * _e320), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, _e324, _e325);
        switch _e177 {
            case 0: {
                phi_19629_ = mix(_e326.xyz, _e188.xyz, vec3(_e188.w));
                break;
            }
            case 1: {
                let _e334 = global_11.member_1;
                let _e335 = _e326.xyz;
                let _e356 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e188.xyz * _e335).xyz)) * 1.06f);
                let _e358 = _e356.xyz;
                phi_19629_ = mix(_e326.xyz, mix(vec3(_e334.x), max(((((_e358 * _e334.x) * 1.732f) / vec3(length(_e358))) / vec3(dot(_e356.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e356 * mix(_e334.x, _e334.z, clamp(pow(max(_e326.x, max(_e326.y, _e326.z)), _e334.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e334.x, dot(clamp((_e335 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e188.w));
                break;
            }
            case 2: {
                let _e379 = _e326.xyz;
                let _e381 = (_e379 * _e188.xyz);
                let _e383 = global_11.member_1;
                let _e403 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e381.xyz)) * 1.06f);
                let _e405 = _e403.xyz;
                phi_19629_ = mix(_e379, mix(vec3(_e383.x), max(((((_e405 * _e383.x) * 1.732f) / vec3(length(_e405))) / vec3(dot(_e403.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e403 * mix(_e383.x, _e383.z, clamp(pow(max(_e381.x, max(_e381.y, _e381.z)), _e383.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e383.x, dot(clamp((_e381.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e188.w));
                break;
            }
            case 3: {
                let _e426 = _e326.xyz;
                let _e428 = (_e426 + _e188.xyz);
                let _e430 = global_11.member_1;
                let _e435 = dot(clamp((_e428.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e451 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e428.xyz)) * 1.06f);
                let _e453 = _e451.xyz;
                let _e464 = max(((((_e453 * _e430.x) * 1.732f) / vec3(length(_e453))) / vec3(dot(_e451.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e451 * mix(_e430.x, _e430.z, clamp(pow((max(_e428.x, max(_e428.y, _e428.z)) * 2f), _e430.y), 0f, 1f)))).xyz;
                let _e471 = global_11.member_2;
                phi_19629_ = mix(_e426, mix(vec3(_e430.x), mix(_e464, min(_e430.zzz, (_e464 + (vec3(_e435) * 2f))), vec3((1f / _e471))).xyz, vec3(pow(smoothstep(0.0003f, _e430.x, _e435), 0.5f))).xyz, vec3(_e188.w));
                break;
            }
            case 4: {
                phi_19629_ = mix(_e326.xyz, _e188.xyz, vec3(_e188.w));
                break;
            }
            default: {
                phi_19629_ = _e326;
                break;
            }
        }
        let _e491 = phi_19629_;
        let _e494 = (_e491.xyz * _e197.xyz);
        let _e499 = global_11.member_17;
        let _e501 = global_11.member_18;
        let _e504 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e494.xyz));
        let _e512 = mix(_e499.xyz, _e501.xyz, vec3(_e315));
        let _e532 = mix(mix(_e494, ((_e504.xyz * mix(min(_e512.x, dot(_e491.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e512.z, clamp(pow(max(_e494.x, max(_e494.y, _e494.z)), _e512.y), 0f, 1f))) / vec3(max(_e504.x, max(_e504.y, _e504.z)))).xyz, vec3(_e135)), _e324, _e325);
        phi_22401_ = vec4<f32>(_e532.x, _e532.y, _e532.z, 1f);
    }
    let _e538 = phi_22401_;
    let _e539 = textureSample(global_18, global_5, _e90);
    phi_22402_ = _e538;
    if (_e539.w < 0f) {
        let _e547 = vec4<f32>(_e539.x, _e538.y, _e538.z, _e538.w);
        let _e553 = vec4<f32>(_e547.x, _e539.y, _e547.z, _e547.w);
        phi_22402_ = vec4<f32>(_e553.x, _e553.y, _e539.z, _e553.w);
    }
    let _e561 = phi_22402_;
    let _e562 = textureSample(global_19, global_5, _e90);
    phi_6805_ = _e561;
    if (_e562.w < 0f) {
        let _e570 = vec4<f32>(_e562.x, _e561.y, _e561.z, _e561.w);
        let _e576 = vec4<f32>(_e570.x, _e562.y, _e570.z, _e570.w);
        phi_6805_ = vec4<f32>(_e576.x, _e576.y, _e562.z, _e576.w);
    }
    let _e584 = phi_6805_;
    global_20 = _e584;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    global_8 = param_2;
    function_();
    let _e7 = global_20;
    return _e7;
}
