struct type_8 {
    member: i32,
    member_1: i32,
    member_2: i32,
    member_3: f32,
    member_4: f32,
    member_5: f32,
    member_6: f32,
    member_7: vec3<f32>,
    member_8: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
var<private> global_3: vec4<f32>;
@group(1) @binding(41) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(40) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
@group(1) @binding(0) 
var<storage> global_8: type_8;
@group(1) @binding(42) 
var global_9: texture_2d<f32>;
@group(1) @binding(38) 
var global_10: texture_2d<f32>;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(37) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
@group(1) @binding(39) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_21709_: f32;
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e64 = global;
    let _e67 = _e64.xy;
    let _e68 = textureSample(global_1, global_2, _e67);
    let _e71 = (pow(_e68.x, 1.5f) * 0.96f);
    let _e73 = global_3;
    let _e75 = textureSample(global_4, global_5, _e73.xy);
    let _e77 = _e64.zw;
    let _e78 = textureSample(global_6, global_7, _e77);
    let _e83 = global_8.member_6;
    let _e97 = max(0f, smoothstep(0f, 0.5f, _e78.w));
    let _e100 = global_8.member_3;
    let _e101 = (_e100 * _e97);
    let _e104 = smoothstep((0.56f - _e101), (0.74f + _e101), ((((_e68.w + (_e75.x * mix(smoothstep(0f, 0.72f, pow(_e71, 1.3f)), smoothstep(0f, 0.4f, _e71), pow(_e83, 1.2f)))) * ((_e83 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e78.w) * smoothstep(1f, 0.9f, _e78.w))) * _e97));
    let _e106 = textureSample(global_9, global_5, _e73.zw);
    let _e113 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e106, vec4(((pow((1f - _e71), 4f) * 0.25f) + (0.75f * _e83))));
    let _e115 = global_8.member_2;
    if (_e115 != 0i) {
        let _e117 = textureSample(global_10, global_5, _e77);
        phi_21709_ = _e117.x;
    } else {
        let _e119 = textureSample(global_10, global_5, _e67);
        phi_21709_ = _e119.x;
    }
    let _e122 = phi_21709_;
    let _e124 = global_8.member;
    phi_7078_ = vec4<f32>(_e64.xy, 0f, 1f);
    if (_e124 != 0i) {
        let _e126 = textureSample(global_11, global_2, _e67);
        let _e134 = global_8.member_1;
        if (_e134 != 0i) {
            let _e136 = textureSample(global_12, global_5, _e77);
            phi_20271_ = _e136.x;
        } else {
            let _e138 = textureSample(global_12, global_5, _e67);
            phi_20271_ = _e138.x;
        }
        let _e141 = phi_20271_;
        let _e151 = mix(vec4<f32>(min(1f, (_e141 + ((((1f - _e113.w) * _e83) * _e83) * 0.5f))), _e122, 0f, 1f), vec4<f32>(_e126.x, _e126.y, _e126.z, _e126.w), vec4(_e104));
        let _e152 = (1f - _e104);
        let _e159 = global_8.member_5;
        let _e161 = vec4<f32>(_e151.x, _e151.y, _e152, _e151.w).xyz;
        let _e162 = (_e161 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e165 = pow(((_e161 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e151.x <= 0.04045f) {
            phi_21354_ = _e162.x;
        } else {
            phi_21354_ = _e165.x;
        }
        let _e171 = phi_21354_;
        if (_e151.y <= 0.04045f) {
            phi_23035_ = _e162.y;
        } else {
            phi_23035_ = _e165.y;
        }
        let _e177 = phi_23035_;
        if (_e152 <= 0.04045f) {
            phi_19513_ = _e162.z;
        } else {
            phi_19513_ = _e165.z;
        }
        let _e182 = phi_19513_;
        let _e183 = vec4<f32>(_e171, _e177, _e152, min(1f, _e159));
        phi_7078_ = vec4<f32>(_e183.x, _e183.y, _e182, _e183.w);
    }
    let _e190 = phi_7078_;
    phi_22401_ = _e190;
    if (_e124 == 0i) {
        let _e192 = textureSample(global_13, global_2, _e67);
        let _e195 = global_8.member_4;
        let _e197 = clamp((_e78.xyz * _e195), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e200 = (_e197.xyz * _e113.xyz);
        let _e205 = global_8.member_7;
        let _e207 = global_8.member_8;
        let _e210 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e200.xyz));
        let _e218 = mix(_e205.xyz, _e207.xyz, vec3(_e122));
        let _e240 = mix(mix(_e200, ((_e210.xyz * mix(min(_e218.x, dot(_e197.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e218.z, clamp(pow(max(_e200.x, max(_e200.y, _e200.z)), _e218.y), 0f, 1f))) / vec3(max(_e210.x, max(_e210.y, _e210.z)))).xyz, vec3(_e83)), _e192.xyz, vec3(_e104));
        phi_22401_ = vec4<f32>(_e240.x, _e240.y, _e240.z, 1f);
    }
    let _e246 = phi_22401_;
    let _e247 = textureSample(global_14, global_5, _e67);
    phi_22402_ = _e246;
    if (_e247.w < 0f) {
        let _e255 = vec4<f32>(_e247.x, _e246.y, _e246.z, _e246.w);
        let _e261 = vec4<f32>(_e255.x, _e247.y, _e255.z, _e255.w);
        phi_22402_ = vec4<f32>(_e261.x, _e261.y, _e247.z, _e261.w);
    }
    let _e269 = phi_22402_;
    let _e270 = textureSample(global_15, global_5, _e67);
    phi_6805_ = _e269;
    if (_e270.w < 0f) {
        let _e278 = vec4<f32>(_e270.x, _e269.y, _e269.z, _e269.w);
        let _e284 = vec4<f32>(_e278.x, _e270.y, _e278.z, _e278.w);
        phi_6805_ = vec4<f32>(_e284.x, _e284.y, _e270.z, _e284.w);
    }
    let _e292 = phi_6805_;
    global_16 = _e292;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_16;
    return _e5;
}
