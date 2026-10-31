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
    member_16: f32,
    member_17: i32,
    member_18: vec4<f32>,
    member_19: f32,
    member_20: vec4<f32>,
    member_21: f32,
    member_22: f32,
    member_23: f32,
    member_24: f32,
    member_25: vec4<f32>,
    member_26: vec3<f32>,
    member_27: vec3<f32>,
    member_28: i32,
    member_29: i32,
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
@group(1) @binding(40) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(43) 
var global_11: texture_2d<f32>;
var<private> global_12: vec2<f32>;
@group(1) @binding(38) 
var global_13: texture_2d<f32>;
@group(1) @binding(42) 
var global_14: texture_2d<f32>;
@group(1) @binding(35) 
var global_15: texture_2d<f32>;
@group(1) @binding(34) 
var global_16: texture_2d<f32>;
@group(1) @binding(37) 
var global_17: texture_2d<f32>;
var<private> global_18: vec4<f32>;

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

    let _e96 = global;
    let _e99 = _e96.xy;
    let _e100 = textureSample(global_1, global_2, _e99);
    let _e103 = textureSample(global_3, global_2, _e99);
    let _e105 = global_4;
    let _e107 = textureSample(global_5, global_6, _e105.xy);
    let _e110 = textureSample(global_7, global_8, _e96.zw);
    let _e111 = textureSample(global_9, global_6, _e99);
    let _e114 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e111, (vec4<f32>(1f, 1f, 1f, 1f) - _e111)));
    let _e121 = global_10.member_23;
    let _e125 = (mix(0.5f, pow(_e100.x, 0.85f), _e121) * mix(1f, (_e100.y * (min(_e114.x, _e114.y) * 2f)), _e121));
    let _e126 = (_e125 * 2f);
    let _e130 = global_10.member_22;
    let _e139 = global_10.member_24;
    let _e140 = (max((_e110.y * _e130), (((1f - _e100.y) * 0.2f) * _e121)) + _e139);
    let _e141 = _e96.zw;
    let _e144 = textureSample(global_7, global_8, (_e141 + vec2<f32>(0.00048828125f, 0.00048828125f)).xy);
    let _e147 = textureSample(global_7, global_8, (_e141 + vec2<f32>(-0.00048828125f, -0.00048828125f)).xy);
    let _e150 = textureSample(global_7, global_8, (_e141 + vec2<f32>(-0.00048828125f, 0.00048828125f)).xy);
    let _e153 = textureSample(global_7, global_8, (_e141 + vec2<f32>(0.00048828125f, -0.00048828125f)).xy);
    let _e167 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e110.x), _e130), _e140));
    let _e170 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e144.x), _e130), _e140));
    let _e175 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e147.x), _e130), _e140));
    let _e180 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e150.x), _e130), _e140));
    let _e185 = textureSample(global_11, global_2, vec2<f32>(mix(_e126, (_e125 + _e153.x), _e130), _e140));
    let _e190 = global_12;
    let _e192 = textureSample(global_13, global_6, _e190.xy);
    let _e194 = global_10.member_28;
    switch _e194 {
        case 1: {
            phi_19017_ = vec4<f32>(_e192.x, _e192.y, _e192.z, (_e192.w * (1f - max(_e103.x, max(_e103.y, _e103.z)))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e192.x, _e192.y, _e192.z, (_e192.w * (_e103.x * (1f - max(_e103.y, _e103.z)))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e192.x, _e192.y, _e192.z, (_e192.w * (_e103.y * (1f - _e103.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e192.x, _e192.y, _e192.z, (_e192.w * _e103.z));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e192.x, _e192.y, _e192.z, (_e192.w * max(_e103.x, max(_e103.y, _e103.z))));
            break;
        }
        default: {
            phi_19017_ = _e192;
            break;
        }
    }
    let _e253 = phi_19017_;
    let _e256 = global_10.member_3;
    let _e257 = (_e253.w * _e256);
    let _e260 = global_10.member_5;
    let _e261 = (_e253.xyz * _e260);
    let _e265 = vec4<f32>(_e261.x, _e261.y, _e261.z, _e257);
    let _e266 = (_e107.x * _e100.x);
    let _e269 = global_10.member_21;
    let _e271 = ((_e269 * 6f) + 1f);
    let _e275 = global_10.member_6;
    let _e279 = global_10.member_15;
    let _e289 = mix(mix(mix(_e279.x, _e279.y, _e103.x), _e279.z, _e103.y), _e279.w, _e103.z);
    let _e292 = global_10.member_10;
    let _e293 = (_e292 * _e289);
    let _e294 = (0.58f - _e293);
    let _e295 = (0.68f + _e293);
    let _e296 = smoothstep(_e294, _e295, ((((_e100.w + _e266) * _e271) * mix(1f, _e275, _e253.w)) * _e289));
    let _e298 = smoothstep(_e294, _e295, ((_e266 * _e271) * _e275));
    if (_e194 == 0i) {
        phi_21709_ = max(0f, mix(_e296, min(_e296, _e298), _e257));
    } else {
        phi_21709_ = _e296;
    }
    let _e304 = phi_21709_;
    let _e306 = global_10.member_29;
    phi_19287_ = _e265;
    if (_e306 == 4i) {
        phi_19287_ = vec4<f32>(_e265.x, _e265.y, _e265.z, (_e257 * clamp((1f - _e298), 0f, 1f)));
    }
    let _e317 = phi_19287_;
    let _e319 = textureSample(global_14, global_6, _e105.zw);
    let _e326 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e319, vec4(((pow((1f - _e100.x), 4f) * 0.25f) + (0.75f * _e269))));
    let _e328 = global_10.member_20;
    let _e335 = mix(mix(mix(_e328.x, _e328.y, _e103.x), _e328.z, _e103.y), _e328.w, _e103.z);
    let _e337 = global_10.member;
    if (_e337 != 0i) {
        let _e339 = textureSample(global_15, global_2, _e99);
        let _e350 = global_10.member_17;
        if (_e350 != 0i) {
            let _e353 = global_10.member_18;
            phi_21710_ = mix(mix(mix(_e353.x, _e353.y, _e103.x), _e353.z, _e103.y), _e353.w, _e103.z);
        } else {
            let _e362 = global_10.member_16;
            phi_21710_ = _e362;
        }
        let _e364 = phi_21710_;
        let _e366 = global_10.member_4;
        let _e367 = (((1f - _e298) * _e317.w) * _e366);
        let _e369 = global_10.member_7;
        let _e372 = global_10.member_8;
        let _e373 = mix(_e335, _e372, _e367);
        let _e383 = mix(vec4<f32>(min(1f, (mix(_e364, _e369, _e367) + ((((1f - _e326.w) * _e269) * _e269) * 0.5f))), _e373, 0f, 1f), vec4<f32>(_e339.x, _e339.y, _e339.z, _e339.w), vec4(_e304));
        let _e386 = global_10.member_9;
        let _e388 = mix((1f - _e304), (_e386 - _e304), _e367);
        let _e395 = global_10.member_19;
        let _e397 = vec4<f32>(_e383.x, _e383.y, _e388, _e383.w).xyz;
        let _e398 = (_e397 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e401 = pow(((_e397 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e383.x <= 0.04045f) {
            phi_21354_ = _e398.x;
        } else {
            phi_21354_ = _e401.x;
        }
        let _e407 = phi_21354_;
        if (_e383.y <= 0.04045f) {
            phi_23035_ = _e398.y;
        } else {
            phi_23035_ = _e401.y;
        }
        let _e413 = phi_23035_;
        if (_e388 <= 0.04045f) {
            phi_19513_ = _e398.z;
        } else {
            phi_19513_ = _e401.z;
        }
        let _e418 = phi_19513_;
        let _e419 = vec4<f32>(_e407, _e413, _e388, min(1f, _e395));
        phi_11711_ = vec4<f32>(_e419.x, _e419.y, _e418, _e419.w);
        phi_10247_ = _e373;
    } else {
        phi_11711_ = vec4<f32>(_e96.xy, 0f, 1f);
        phi_10247_ = _e335;
    }
    let _e426 = phi_11711_;
    let _e428 = phi_10247_;
    phi_22401_ = _e426;
    if (_e337 == 0i) {
        let _e430 = textureSample(global_16, global_2, _e99);
        let _e432 = global_10.member_11;
        let _e434 = (((((_e167.xyzw + _e170.xyzw).xyzw + _e175.xyzw).xyzw + _e180.xyzw).xyzw + _e185.xyzw).xyzw * 0.2f).xyz;
        let _e436 = global_10.member_25;
        let _e442 = global_10.member_12;
        let _e451 = global_10.member_13;
        let _e460 = global_10.member_14;
        let _e466 = mix(mix(mix(mix(_e432.xyz, _e434, vec3(_e436.x)).xyz, mix(_e442.xyz, _e434, vec3(_e436.y)), vec3(_e103.x)).xyz, mix(_e451.xyz, _e434, vec3(_e436.z)), vec3(_e103.y)).xyz, mix(_e460.xyz, _e434, vec3(_e436.w)), vec3(_e103.z));
        switch _e306 {
            case 0: {
                phi_19629_ = mix(_e466.xyz, _e317.xyz, vec3(_e317.w));
                break;
            }
            case 1: {
                let _e476 = _e466.xyz;
                let _e478 = global_10.member_1;
                let _e496 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e317.xyz * _e476).xyz)) * 1.06f);
                let _e498 = _e496.xyz;
                phi_19629_ = mix(_e476, mix(vec3(_e478.x), max(((((_e498 * _e478.x) * 1.732f) / vec3(length(_e498))) / vec3(dot(_e496.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e496 * mix(_e478.x, _e478.z, clamp(pow(max(_e466.x, max(_e466.y, _e466.z)), _e478.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e478.x, dot(clamp((_e476 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e317.w));
                break;
            }
            case 2: {
                let _e519 = _e466.xyz;
                let _e521 = (_e519 * _e317.xyz);
                let _e523 = global_10.member_1;
                let _e543 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e521.xyz)) * 1.06f);
                let _e545 = _e543.xyz;
                phi_19629_ = mix(_e519, mix(vec3(_e523.x), max(((((_e545 * _e523.x) * 1.732f) / vec3(length(_e545))) / vec3(dot(_e543.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e543 * mix(_e523.x, _e523.z, clamp(pow(max(_e521.x, max(_e521.y, _e521.z)), _e523.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e523.x, dot(clamp((_e521.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e317.w));
                break;
            }
            case 3: {
                let _e566 = _e466.xyz;
                let _e568 = (_e566 + _e317.xyz);
                let _e570 = global_10.member_1;
                let _e575 = dot(clamp((_e568.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e591 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e568.xyz)) * 1.06f);
                let _e593 = _e591.xyz;
                let _e604 = max(((((_e593 * _e570.x) * 1.732f) / vec3(length(_e593))) / vec3(dot(_e591.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e591 * mix(_e570.x, _e570.z, clamp(pow((max(_e568.x, max(_e568.y, _e568.z)) * 2f), _e570.y), 0f, 1f)))).xyz;
                let _e611 = global_10.member_2;
                phi_19629_ = mix(_e566, mix(vec3(_e570.x), mix(_e604, min(_e570.zzz, (_e604 + (vec3(_e575) * 2f))), vec3((1f / _e611))).xyz, vec3(pow(smoothstep(0.0003f, _e570.x, _e575), 0.5f))).xyz, vec3(_e317.w));
                break;
            }
            case 4: {
                phi_19629_ = mix(_e466.xyz, _e317.xyz, vec3(_e317.w));
                break;
            }
            default: {
                phi_19629_ = _e466.xyz;
                break;
            }
        }
        let _e631 = phi_19629_;
        let _e632 = _e631.xyz;
        let _e634 = (_e632 * _e326.xyz);
        let _e639 = global_10.member_26;
        let _e641 = global_10.member_27;
        let _e644 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e634.xyz));
        let _e651 = mix(_e639.xyz, _e641.xyz, vec3(_e428));
        let _e673 = mix(mix(_e634, ((_e644.xyz * mix(min(_e651.x, dot(_e632, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e651.z, clamp(pow(max(_e634.x, max(_e634.y, _e634.z)), _e651.y), 0f, 1f))) / vec3(max(_e644.x, max(_e644.y, _e644.z)))).xyz, vec3(_e269)), _e430.xyz, vec3(_e304));
        phi_22401_ = vec4<f32>(_e673.x, _e673.y, _e673.z, 1f);
    }
    let _e679 = phi_22401_;
    let _e680 = textureSample(global_17, global_6, _e99);
    phi_6805_ = _e679;
    if (_e680.w < 0f) {
        let _e688 = vec4<f32>(_e680.x, _e679.y, _e679.z, _e679.w);
        let _e694 = vec4<f32>(_e688.x, _e680.y, _e688.z, _e688.w);
        phi_6805_ = vec4<f32>(_e694.x, _e694.y, _e680.z, _e694.w);
    }
    let _e702 = phi_6805_;
    global_18 = _e702;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_12 = param_2;
    function_();
    let _e7 = global_18;
    return _e7;
}
