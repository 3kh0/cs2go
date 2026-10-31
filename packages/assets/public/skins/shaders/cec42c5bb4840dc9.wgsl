struct type_8 {
    member: i32,
    member_1: f32,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: vec4<f32>,
    member_7: f32,
    member_8: i32,
    member_9: vec4<f32>,
    member_10: f32,
    member_11: vec4<f32>,
    member_12: f32,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(38) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(0) 
var<storage> global_7: type_8;
@group(1) @binding(39) 
var global_8: texture_2d<f32>;
@group(1) @binding(35) 
var global_9: texture_2d<f32>;
@group(1) @binding(34) 
var global_10: texture_2d<f32>;
@group(1) @binding(36) 
var global_11: texture_2d<f32>;
var<private> global_12: vec4<f32>;

fn function_() {
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e62 = global;
    let _e65 = _e62.xy;
    let _e66 = textureSample(global_1, global_2, _e65);
    let _e69 = (pow(_e66.x, 1.5f) * 0.96f);
    let _e70 = textureSample(global_3, global_2, _e65);
    let _e72 = global_4;
    let _e74 = textureSample(global_5, global_6, _e72.xy);
    let _e80 = global_7.member_12;
    let _e89 = global_7.member_6;
    let _e99 = mix(mix(mix(_e89.x, _e89.y, _e70.x), _e89.z, _e70.y), _e89.w, _e70.z);
    let _e102 = global_7.member_1;
    let _e103 = (_e102 * _e99);
    let _e106 = smoothstep((0.56f - _e103), (0.74f + _e103), (((_e66.w + (_e74.x * mix(smoothstep(0f, 0.72f, pow(_e69, 1.3f)), smoothstep(0f, 0.4f, _e69), pow(_e80, 1.2f)))) * ((_e80 * 6f) + 1f)) * _e99));
    let _e108 = textureSample(global_8, global_6, _e72.zw);
    let _e115 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e108, vec4(((pow((1f - _e69), 4f) * 0.25f) + (0.75f * _e80))));
    let _e117 = global_7.member_11;
    let _e124 = mix(mix(mix(_e117.x, _e117.y, _e70.x), _e117.z, _e70.y), _e117.w, _e70.z);
    let _e126 = global_7.member;
    phi_7078_ = vec4<f32>(_e62.xy, 0f, 1f);
    if (_e126 != 0i) {
        let _e128 = textureSample(global_9, global_2, _e65);
        let _e136 = global_7.member_8;
        if (_e136 != 0i) {
            let _e139 = global_7.member_9;
            phi_20271_ = mix(mix(mix(_e139.x, _e139.y, _e70.x), _e139.z, _e70.y), _e139.w, _e70.z);
        } else {
            let _e148 = global_7.member_7;
            phi_20271_ = _e148;
        }
        let _e150 = phi_20271_;
        let _e160 = mix(vec4<f32>(min(1f, (_e150 + ((((1f - _e115.w) * _e80) * _e80) * 0.5f))), _e124, 0f, 1f), vec4<f32>(_e128.x, _e128.y, _e128.z, _e128.w), vec4(_e106));
        let _e161 = (1f - _e106);
        let _e168 = global_7.member_10;
        let _e170 = vec4<f32>(_e160.x, _e160.y, _e161, _e160.w).xyz;
        let _e171 = (_e170 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e174 = pow(((_e170 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e160.x <= 0.04045f) {
            phi_21354_ = _e171.x;
        } else {
            phi_21354_ = _e174.x;
        }
        let _e180 = phi_21354_;
        if (_e160.y <= 0.04045f) {
            phi_23035_ = _e171.y;
        } else {
            phi_23035_ = _e174.y;
        }
        let _e186 = phi_23035_;
        if (_e161 <= 0.04045f) {
            phi_19513_ = _e171.z;
        } else {
            phi_19513_ = _e174.z;
        }
        let _e191 = phi_19513_;
        let _e192 = vec4<f32>(_e180, _e186, _e161, min(1f, _e168));
        phi_7078_ = vec4<f32>(_e192.x, _e192.y, _e191, _e192.w);
    }
    let _e199 = phi_7078_;
    phi_22401_ = _e199;
    if (_e126 == 0i) {
        let _e201 = textureSample(global_10, global_2, _e65);
        let _e203 = global_7.member_2;
        let _e206 = global_7.member_3;
        let _e210 = global_7.member_4;
        let _e214 = global_7.member_5;
        let _e215 = mix(mix(mix(_e203, _e206, vec3(_e70.x)), _e210, vec3(_e70.y)), _e214, vec3(_e70.z));
        let _e218 = (_e215.xyz * _e115.xyz);
        let _e223 = global_7.member_13;
        let _e225 = global_7.member_14;
        let _e228 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e218.xyz));
        let _e236 = mix(_e223.xyz, _e225.xyz, vec3(_e124));
        let _e258 = mix(mix(_e218, ((_e228.xyz * mix(min(_e236.x, dot(_e215.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e236.z, clamp(pow(max(_e218.x, max(_e218.y, _e218.z)), _e236.y), 0f, 1f))) / vec3(max(_e228.x, max(_e228.y, _e228.z)))).xyz, vec3(_e80)), _e201.xyz, vec3(_e106));
        phi_22401_ = vec4<f32>(_e258.x, _e258.y, _e258.z, 1f);
    }
    let _e264 = phi_22401_;
    let _e265 = textureSample(global_11, global_6, _e65);
    phi_6805_ = _e264;
    if (_e265.w < 0f) {
        let _e273 = vec4<f32>(_e265.x, _e264.y, _e264.z, _e264.w);
        let _e279 = vec4<f32>(_e273.x, _e265.y, _e273.z, _e273.w);
        phi_6805_ = vec4<f32>(_e279.x, _e279.y, _e265.z, _e279.w);
    }
    let _e287 = phi_6805_;
    global_12 = _e287;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_12;
    return _e5;
}
