struct type_8 {
    member: i32,
    member_1: i32,
    member_2: i32,
    member_3: i32,
    member_4: f32,
    member_5: f32,
    member_6: f32,
    member_7: f32,
    member_8: vec3<f32>,
    member_9: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
var<private> global_3: vec4<f32>;
@group(1) @binding(42) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(41) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
@group(1) @binding(0) 
var<storage> global_8: type_8;
@group(1) @binding(43) 
var global_9: texture_2d<f32>;
@group(1) @binding(39) 
var global_10: texture_2d<f32>;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(37) 
var global_12: texture_2d<f32>;
@group(1) @binding(38) 
var global_13: texture_2d<f32>;
@group(1) @binding(34) 
var global_14: texture_2d<f32>;
@group(1) @binding(36) 
var global_15: texture_2d<f32>;
@group(1) @binding(40) 
var global_16: texture_2d<f32>;
var<private> global_17: vec4<f32>;

fn function_() {
    var phi_21709_: f32;
    var phi_20271_: f32;
    var phi_21710_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e66 = global;
    let _e69 = _e66.xy;
    let _e70 = textureSample(global_1, global_2, _e69);
    let _e73 = (pow(_e70.x, 1.5f) * 0.96f);
    let _e75 = global_3;
    let _e77 = textureSample(global_4, global_5, _e75.xy);
    let _e79 = _e66.zw;
    let _e80 = textureSample(global_6, global_7, _e79);
    let _e85 = global_8.member_7;
    let _e99 = max(0f, smoothstep(0f, 0.5f, _e80.w));
    let _e102 = global_8.member_4;
    let _e103 = (_e102 * _e99);
    let _e106 = smoothstep((0.56f - _e103), (0.74f + _e103), ((((_e70.w + (_e77.x * mix(smoothstep(0f, 0.72f, pow(_e73, 1.3f)), smoothstep(0f, 0.4f, _e73), pow(_e85, 1.2f)))) * ((_e85 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e80.w) * smoothstep(1f, 0.9f, _e80.w))) * _e99));
    let _e108 = textureSample(global_9, global_5, _e75.zw);
    let _e115 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e108, vec4(((pow((1f - _e73), 4f) * 0.25f) + (0.75f * _e85))));
    let _e117 = global_8.member_3;
    if (_e117 != 0i) {
        let _e119 = textureSample(global_10, global_5, _e79);
        phi_21709_ = _e119.x;
    } else {
        let _e121 = textureSample(global_10, global_5, _e69);
        phi_21709_ = _e121.x;
    }
    let _e124 = phi_21709_;
    let _e126 = global_8.member;
    phi_7078_ = vec4<f32>(_e66.xy, 0f, 1f);
    if (_e126 != 0i) {
        let _e128 = textureSample(global_11, global_2, _e69);
        let _e136 = global_8.member_1;
        if (_e136 != 0i) {
            let _e138 = textureSample(global_12, global_5, _e79);
            phi_20271_ = _e138.x;
        } else {
            let _e140 = textureSample(global_12, global_5, _e69);
            phi_20271_ = _e140.x;
        }
        let _e143 = phi_20271_;
        let _e153 = mix(vec4<f32>(min(1f, (_e143 + ((((1f - _e115.w) * _e85) * _e85) * 0.5f))), _e124, 0f, 1f), vec4<f32>(_e128.x, _e128.y, _e128.z, _e128.w), vec4(_e106));
        let _e154 = (1f - _e106);
        let _e156 = global_8.member_2;
        if (_e156 != 0i) {
            let _e158 = textureSample(global_13, global_5, _e79);
            phi_21710_ = vec4<f32>(_e153.x, _e153.y, (_e154 * _e158.x), _e153.w);
        } else {
            let _e166 = textureSample(global_13, global_5, _e69);
            let _e168 = (_e154 * _e166.x);
            phi_21710_ = vec4<f32>(_e153.x, _e153.y, (_e168 * _e168), _e153.w);
        }
        let _e176 = phi_21710_;
        let _e178 = global_8.member_6;
        let _e180 = _e176.xyz;
        let _e181 = (_e180 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e184 = pow(((_e180 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e176.x <= 0.04045f) {
            phi_21354_ = _e181.x;
        } else {
            phi_21354_ = _e184.x;
        }
        let _e190 = phi_21354_;
        if (_e176.y <= 0.04045f) {
            phi_21355_ = _e181.y;
        } else {
            phi_21355_ = _e184.y;
        }
        let _e196 = phi_21355_;
        if (_e176.z <= 0.04045f) {
            phi_22686_ = _e181.z;
        } else {
            phi_22686_ = _e184.z;
        }
        let _e202 = phi_22686_;
        phi_7078_ = vec4<f32>(_e190, _e196, _e202, min(1f, _e178));
    }
    let _e205 = phi_7078_;
    phi_22401_ = _e205;
    if (_e126 == 0i) {
        let _e207 = textureSample(global_14, global_2, _e69);
        let _e210 = global_8.member_5;
        let _e212 = clamp((_e80.xyz * _e210), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e215 = (_e212.xyz * _e115.xyz);
        let _e220 = global_8.member_8;
        let _e222 = global_8.member_9;
        let _e225 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e215.xyz));
        let _e233 = mix(_e220.xyz, _e222.xyz, vec3(_e124));
        let _e255 = mix(mix(_e215, ((_e225.xyz * mix(min(_e233.x, dot(_e212.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e233.z, clamp(pow(max(_e215.x, max(_e215.y, _e215.z)), _e233.y), 0f, 1f))) / vec3(max(_e225.x, max(_e225.y, _e225.z)))).xyz, vec3(_e85)), _e207.xyz, vec3(_e106));
        phi_22401_ = vec4<f32>(_e255.x, _e255.y, _e255.z, 1f);
    }
    let _e261 = phi_22401_;
    let _e262 = textureSample(global_15, global_5, _e69);
    phi_22402_ = _e261;
    if (_e262.w < 0f) {
        let _e270 = vec4<f32>(_e262.x, _e261.y, _e261.z, _e261.w);
        let _e276 = vec4<f32>(_e270.x, _e262.y, _e270.z, _e270.w);
        phi_22402_ = vec4<f32>(_e276.x, _e276.y, _e262.z, _e276.w);
    }
    let _e284 = phi_22402_;
    let _e285 = textureSample(global_16, global_5, _e69);
    phi_6805_ = _e284;
    if (_e285.w < 0f) {
        let _e293 = vec4<f32>(_e285.x, _e284.y, _e284.z, _e284.w);
        let _e299 = vec4<f32>(_e293.x, _e285.y, _e293.z, _e293.w);
        phi_6805_ = vec4<f32>(_e299.x, _e299.y, _e285.z, _e299.w);
    }
    let _e307 = phi_6805_;
    global_17 = _e307;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_17;
    return _e5;
}
