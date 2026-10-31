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
    member_18: i32,
    member_19: f32,
    member_20: i32,
    member_21: f32,
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
@group(1) @binding(40) 
var global_11: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_12: type_9;
@group(1) @binding(43) 
var global_13: texture_2d<f32>;
@group(1) @binding(35) 
var global_14: texture_2d<f32>;
@group(1) @binding(36) 
var global_15: texture_2d<f32>;
@group(1) @binding(37) 
var global_16: texture_2d<f32>;
@group(1) @binding(34) 
var global_17: texture_2d<f32>;
@group(1) @binding(38) 
var global_18: texture_2d<f32>;
var<private> global_19: vec4<f32>;

fn function_() {
    var phi_19017_: vec4<f32>;
    var phi_21709_: f32;
    var phi_10021_: f32;
    var phi_21710_: f32;
    var phi_19287_: vec4<f32>;
    var phi_21903_: f32;
    var phi_21711_: vec4<f32>;
    var phi_19018_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_9750_: vec3<f32>;
    var phi_19340_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e101 = global;
    let _e104 = _e101.xy;
    let _e105 = textureSample(global_1, global_2, _e104);
    let _e107 = pow(_e105.x, 1.5f);
    let _e108 = (_e107 * 0.96f);
    let _e110 = textureSample(global_3, global_2, _e104);
    let _e113 = (1f - _e110.x);
    let _e115 = global_4;
    let _e117 = textureSample(global_5, global_6, _e115.xy);
    let _e119 = _e101.zw;
    let _e120 = textureSample(global_7, global_8, _e119);
    let _e121 = global_9;
    let _e123 = textureSample(global_10, global_6, _e121.xy);
    let _e124 = textureSample(global_11, global_6, _e104);
    let _e127 = global_12.member_25;
    phi_19017_ = _e123;
    if (_e127 == 8i) {
        phi_19017_ = vec4<f32>(_e123.x, _e123.y, _e123.z, (_e123.w * _e124.x));
    }
    let _e137 = phi_19017_;
    let _e140 = global_12.member_5;
    let _e141 = (_e137.w * _e140);
    let _e144 = global_12.member_7;
    let _e145 = (_e137.xyz * _e144);
    let _e149 = vec4<f32>(_e145.x, _e145.y, _e145.z, _e141);
    let _e154 = global_12.member_22;
    let _e157 = (_e117.x * mix(smoothstep(0f, 0.72f, pow(_e108, 1.3f)), smoothstep(0f, 0.4f, _e108), pow(_e154, 1.2f)));
    let _e160 = ((_e154 * 6f) + 1f);
    let _e168 = smoothstep(0f, 0.5f, _e120.w);
    let _e169 = (_e127 == 0i);
    if _e169 {
        phi_21709_ = max(0f, _e168);
    } else {
        phi_21709_ = _e168;
    }
    let _e172 = phi_21709_;
    let _e174 = global_12.member_8;
    let _e176 = (_e172 * mix(1f, _e174, _e137.w));
    if (_e127 > 0i) {
        phi_10021_ = max(0f, _e176);
    } else {
        phi_10021_ = _e176;
    }
    let _e180 = phi_10021_;
    let _e181 = ((((min(_e105.w, _e113) + _e157) * _e160) + (smoothstep(0.5f, 0.6f, _e120.w) * smoothstep(1f, 0.9f, _e120.w))) * _e180);
    let _e183 = global_12.member_12;
    let _e184 = (_e183 * _e180);
    let _e188 = (_e110.x > 0.99f);
    let _e190 = mix(smoothstep((0.58f - _e184), (0.68f + _e184), _e181), _e181, select(0f, 1f, _e188));
    let _e194 = smoothstep((0.56f - _e184), (0.74f + _e184), ((_e157 * _e160) * _e174));
    if _e169 {
        phi_21710_ = max(0f, mix(_e190, min(_e190, _e194), _e141));
    } else {
        phi_21710_ = _e190;
    }
    let _e199 = phi_21710_;
    let _e201 = global_12.member_26;
    phi_19287_ = _e149;
    if (_e201 == 4i) {
        phi_19287_ = vec4<f32>(_e149.x, _e149.y, _e149.z, (_e141 * clamp((1f - _e194), 0f, 1f)));
    }
    let _e212 = phi_19287_;
    let _e214 = textureSample(global_13, global_6, _e115.zw);
    let _e233 = smoothstep(0.2f, 0.6f, (((_e117.x * _e105.y) * (_e117.x * smoothstep(0.2f, 0.3f, _e108))) * _e154));
    let _e242 = (smoothstep((0.5f * _e154), 0f, clamp((((_e107 * 11.5199995f) * _e105.y) - ((_e154 * clamp(((_e214.x * _e214.y) * _e214.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e154);
    let _e243 = (1f - _e242);
    let _e247 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e214, vec4(((pow((1f - _e108), 4f) * 0.25f) + (0.75f * _e154)))), vec4(clamp((_e233 * 2f), 0f, 1f)));
    let _e249 = global_12.member;
    if (_e249 != 0i) {
        let _e251 = textureSample(global_14, global_2, _e104);
        let _e253 = (1f - _e199);
        let _e259 = global_12.member_3;
        if (_e259 != 0i) {
            let _e261 = textureSample(global_15, global_6, _e119);
            phi_21903_ = _e261.x;
        } else {
            let _e263 = textureSample(global_15, global_6, _e104);
            phi_21903_ = _e263.x;
        }
        let _e266 = phi_21903_;
        let _e271 = dot(_e247.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e281 = ((1f - _e247.w) * _e154);
        let _e284 = clamp(((((_e266 * mix(1f, 0.9f, _e233)) + (((1f - _e271) * _e154) * 0.05f)) + ((_e242 * 0.15f) * _e154)) + (_e281 * 0.15f)), 0f, 1f);
        let _e294 = mix(mix(1f, pow(((_e243 * _e247.w) * _e271), 0.5f), _e154), 1f, _e233);
        let _e297 = global_12.member_6;
        let _e298 = (((1f - _e194) * _e212.w) * _e297);
        let _e300 = global_12.member_9;
        let _e306 = vec4<f32>(mix(mix(_e251.x, mix(min(1f, (_e284 + ((_e281 * _e154) * 0.5f))), _e284, _e110.x), select(max(0f, _e253), 1f, _e188)), _e300, _e298), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e309 = global_12.member_21;
        let _e313 = global_12.member_10;
        let _e319 = vec4<f32>(_e306.x, mix(mix(mix(_e309, _e251.y, _e199), _e294, _e110.x), _e313, _e298), _e306.z, _e306.w);
        let _e321 = global_12.member_4;
        if (_e321 != 0i) {
            let _e323 = textureSample(global_16, global_6, _e119);
            phi_21711_ = vec4<f32>(_e319.x, _e319.y, (_e253 * _e323.x), _e319.w);
        } else {
            let _e331 = textureSample(global_16, global_6, _e104);
            let _e333 = (_e253 * _e331.x);
            phi_21711_ = vec4<f32>(_e319.x, _e319.y, (_e333 * _e333), _e319.w);
        }
        let _e341 = phi_21711_;
        let _e343 = global_12.member_20;
        phi_19018_ = _e341;
        if (_e343 != 0i) {
            phi_19018_ = vec4<f32>(_e341.x, _e341.y, (_e341.z * _e110.x), _e341.w);
        }
        let _e353 = phi_19018_;
        let _e356 = global_12.member_11;
        let _e358 = mix(_e353.z, (_e356 - _e199), _e298);
        let _e365 = global_12.member_19;
        let _e367 = vec4<f32>(_e353.x, _e353.y, _e358, _e353.w).xyz;
        let _e368 = (_e367 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e371 = pow(((_e367 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e353.x <= 0.04045f) {
            phi_21354_ = _e368.x;
        } else {
            phi_21354_ = _e371.x;
        }
        let _e377 = phi_21354_;
        if (_e353.y <= 0.04045f) {
            phi_23035_ = _e368.y;
        } else {
            phi_23035_ = _e371.y;
        }
        let _e383 = phi_23035_;
        if (_e358 <= 0.04045f) {
            phi_19513_ = _e368.z;
        } else {
            phi_19513_ = _e371.z;
        }
        let _e388 = phi_19513_;
        let _e389 = vec4<f32>(_e377, _e383, _e358, min(1f, _e365));
        phi_11711_ = vec4<f32>(_e389.x, _e389.y, _e388, _e389.w);
        phi_10247_ = _e294;
    } else {
        phi_11711_ = vec4<f32>(_e101.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e396 = phi_11711_;
    let _e398 = phi_10247_;
    phi_22401_ = _e396;
    if (_e249 == 0i) {
        let _e400 = textureSample(global_17, global_2, _e104);
        let _e402 = vec3(_e154);
        let _e404 = global_12.member_14;
        let _e406 = global_12.member_15;
        let _e408 = _e120.xyz;
        let _e410 = global_12.member_17;
        let _e413 = global_12.member_18;
        let _e417 = mix(_e408, (_e408 * _e410), vec3(max(_e110.x, f32(_e413))));
        let _e423 = vec4<f32>(_e417.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e429 = vec4<f32>(_e423.x, _e417.y, _e423.z, _e423.w);
        let _e435 = vec4<f32>(_e429.x, _e429.y, _e417.z, _e429.w);
        let _e439 = global_12.member_16;
        let _e443 = _e435.xyz;
        let _e447 = global_12.member_13;
        let _e450 = mix((mix(mix(_e404, _e439, vec3(pow(_e154, 0.5f))), mix(_e404, _e406, _e402), vec3(_e243)) * _e443), (_e447 * dot(_e435.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e233));
        let _e455 = ((1f - _e194) * _e212.w);
        let _e456 = vec4<f32>(_e212.xyz, _e455);
        switch _e201 {
            case 0: {
                phi_9750_ = mix(_e450.xyz, _e456.xyz, vec3(_e455));
                break;
            }
            case 1: {
                let _e461 = _e450.xyz;
                let _e463 = global_12.member_1;
                let _e484 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e456.xyz * _e461).xyz)) * 1.06f);
                let _e486 = _e484.xyz;
                phi_9750_ = mix(_e461, mix(vec3(_e463.x), max(((((_e486 * _e463.x) * 1.732f) / vec3(length(_e486))) / vec3(dot(_e484.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e484 * mix(_e463.x, _e463.z, clamp(pow(max(_e450.x, max(_e450.y, _e450.z)), _e463.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e463.x, dot(clamp((_e461 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e455));
                break;
            }
            case 2: {
                let _e506 = _e450.xyz;
                let _e508 = (_e506 * _e456.xyz);
                let _e510 = global_12.member_1;
                let _e530 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e508.xyz)) * 1.06f);
                let _e532 = _e530.xyz;
                phi_9750_ = mix(_e506, mix(vec3(_e510.x), max(((((_e532 * _e510.x) * 1.732f) / vec3(length(_e532))) / vec3(dot(_e530.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e530 * mix(_e510.x, _e510.z, clamp(pow(max(_e508.x, max(_e508.y, _e508.z)), _e510.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e510.x, dot(clamp((_e508.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e455));
                break;
            }
            case 3: {
                let _e552 = _e450.xyz;
                let _e554 = (_e552 + _e456.xyz);
                let _e556 = global_12.member_1;
                let _e561 = dot(clamp((_e554.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e577 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e554.xyz)) * 1.06f);
                let _e579 = _e577.xyz;
                let _e590 = max(((((_e579 * _e556.x) * 1.732f) / vec3(length(_e579))) / vec3(dot(_e577.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e577 * mix(_e556.x, _e556.z, clamp(pow((max(_e554.x, max(_e554.y, _e554.z)) * 2f), _e556.y), 0f, 1f)))).xyz;
                let _e597 = global_12.member_2;
                phi_9750_ = mix(_e552, mix(vec3(_e556.x), mix(_e590, min(_e556.zzz, (_e590 + (vec3(_e561) * 2f))), vec3((1f / _e597))).xyz, vec3(pow(smoothstep(0.0003f, _e556.x, _e561), 0.5f))).xyz, vec3(_e455));
                break;
            }
            case 4: {
                phi_9750_ = mix(_e450.xyz, _e456.xyz, vec3(_e455));
                break;
            }
            default: {
                phi_9750_ = _e450.xyz;
                break;
            }
        }
        let _e615 = phi_9750_;
        let _e617 = _e400.xyz;
        let _e619 = mix(clamp(_e443, vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)), _e617, vec3(_e199));
        switch _e201 {
            case 0: {
                phi_19340_ = mix(_e619.xyz, _e212.xyz, vec3(_e212.w));
                break;
            }
            case 1: {
                let _e626 = global_12.member_1;
                let _e627 = _e619.xyz;
                let _e648 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e212.xyz * _e627).xyz)) * 1.06f);
                let _e650 = _e648.xyz;
                phi_19340_ = mix(_e619.xyz, mix(vec3(_e626.x), max(((((_e650 * _e626.x) * 1.732f) / vec3(length(_e650))) / vec3(dot(_e648.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e648 * mix(_e626.x, _e626.z, clamp(pow(max(_e619.x, max(_e619.y, _e619.z)), _e626.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e626.x, dot(clamp((_e627 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e212.w));
                break;
            }
            case 2: {
                let _e670 = _e619.xyz;
                let _e672 = (_e670 * _e212.xyz);
                let _e674 = global_12.member_1;
                let _e694 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e672.xyz)) * 1.06f);
                let _e696 = _e694.xyz;
                phi_19340_ = mix(_e670, mix(vec3(_e674.x), max(((((_e696 * _e674.x) * 1.732f) / vec3(length(_e696))) / vec3(dot(_e694.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e694 * mix(_e674.x, _e674.z, clamp(pow(max(_e672.x, max(_e672.y, _e672.z)), _e674.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e674.x, dot(clamp((_e672.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e212.w));
                break;
            }
            case 3: {
                let _e716 = _e619.xyz;
                let _e718 = (_e716 + _e212.xyz);
                let _e720 = global_12.member_1;
                let _e725 = dot(clamp((_e718.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e741 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e718.xyz)) * 1.06f);
                let _e743 = _e741.xyz;
                let _e754 = max(((((_e743 * _e720.x) * 1.732f) / vec3(length(_e743))) / vec3(dot(_e741.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e741 * mix(_e720.x, _e720.z, clamp(pow((max(_e718.x, max(_e718.y, _e718.z)) * 2f), _e720.y), 0f, 1f)))).xyz;
                let _e761 = global_12.member_2;
                phi_19340_ = mix(_e716, mix(vec3(_e720.x), mix(_e754, min(_e720.zzz, (_e754 + (vec3(_e725) * 2f))), vec3((1f / _e761))).xyz, vec3(pow(smoothstep(0.0003f, _e720.x, _e725), 0.5f))).xyz, vec3(_e212.w));
                break;
            }
            case 4: {
                phi_19340_ = mix(_e619.xyz, _e212.xyz, vec3(_e212.w));
                break;
            }
            default: {
                phi_19340_ = _e619;
                break;
            }
        }
        let _e779 = phi_19340_;
        let _e785 = vec4<f32>(_e779.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e791 = vec4<f32>(_e785.x, _e779.y, _e785.z, _e785.w);
        let _e798 = vec4<f32>(_e791.x, _e791.y, _e779.z, _e791.w).xyz;
        let _e799 = vec3(_e110.x);
        let _e806 = (mix(_e798, _e615, _e799).xyz * _e247.xyz);
        let _e811 = global_12.member_21;
        let _e814 = global_12.member_23;
        let _e816 = global_12.member_24;
        let _e819 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e806.xyz));
        let _e827 = mix(_e814.xyz, _e816.xyz, vec3(mix(_e811, _e398, _e110.x)));
        let _e847 = mix(mix(_e806, ((_e819.xyz * mix(min(_e827.x, dot(mix(_e798, (_e798 * _e404), _e799).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e827.z, clamp(pow(max(_e806.x, max(_e806.y, _e806.z)), _e827.y), 0f, 1f))) / vec3(max(_e819.x, max(_e819.y, _e819.z)))).xyz, _e402), _e617, vec3((_e199 * _e113)));
        phi_22401_ = vec4<f32>(_e847.x, _e847.y, _e847.z, 1f);
    }
    let _e853 = phi_22401_;
    let _e854 = textureSample(global_18, global_6, _e104);
    phi_6805_ = _e853;
    if (_e854.w < 0f) {
        let _e862 = vec4<f32>(_e854.x, _e853.y, _e853.z, _e853.w);
        let _e868 = vec4<f32>(_e862.x, _e854.y, _e862.z, _e862.w);
        phi_6805_ = vec4<f32>(_e868.x, _e868.y, _e854.z, _e868.w);
    }
    let _e876 = phi_6805_;
    global_19 = _e876;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_9 = param_2;
    function_();
    let _e7 = global_19;
    return _e7;
}
