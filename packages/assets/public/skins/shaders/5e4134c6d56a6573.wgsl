struct type_8 {
    member: i32,
    member_1: i32,
    member_2: f32,
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
@group(1) @binding(39) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(38) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
@group(1) @binding(0) 
var<storage> global_8: type_8;
@group(1) @binding(40) 
var global_9: texture_2d<f32>;
@group(1) @binding(35) 
var global_10: texture_2d<f32>;
@group(1) @binding(36) 
var global_11: texture_2d<f32>;
@group(1) @binding(34) 
var global_12: texture_2d<f32>;
@group(1) @binding(37) 
var global_13: texture_2d<f32>;
var<private> global_14: vec4<f32>;

fn function_() {
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e56 = global;
    let _e59 = _e56.xy;
    let _e60 = textureSample(global_1, global_2, _e59);
    let _e63 = global_3;
    let _e65 = textureSample(global_4, global_5, _e63.xy);
    let _e67 = _e56.zw;
    let _e68 = textureSample(global_6, global_7, _e67);
    let _e72 = global_8.member_6;
    let _e82 = max(0f, smoothstep(0f, 0.5f, _e68.w));
    let _e85 = global_8.member_2;
    let _e86 = (_e85 * _e82);
    let _e89 = smoothstep((0.58f - _e86), (0.68f + _e86), ((((_e60.w + (_e65.x * _e60.x)) * ((_e72 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e68.w) * smoothstep(1f, 0.9f, _e68.w))) * _e82));
    let _e91 = textureSample(global_9, global_5, _e63.zw);
    let _e98 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e91, vec4(((pow((1f - _e60.x), 4f) * 0.25f) + (0.75f * _e72))));
    let _e100 = global_8.member;
    phi_7078_ = vec4<f32>(_e56.xy, 0f, 1f);
    if (_e100 != 0i) {
        let _e102 = textureSample(global_10, global_2, _e59);
        let _e110 = global_8.member_1;
        if (_e110 != 0i) {
            let _e112 = textureSample(global_11, global_5, _e67);
            phi_20271_ = _e112.x;
        } else {
            let _e114 = textureSample(global_11, global_5, _e59);
            phi_20271_ = _e114.x;
        }
        let _e117 = phi_20271_;
        let _e126 = global_8.member_5;
        let _e129 = mix(vec4<f32>(min(1f, (_e117 + ((((1f - _e98.w) * _e72) * _e72) * 0.5f))), _e126, 0f, 1f), vec4<f32>(_e102.x, _e102.y, _e102.z, _e102.w), vec4(_e89));
        let _e130 = (1f - _e89);
        let _e137 = global_8.member_4;
        let _e139 = vec4<f32>(_e129.x, _e129.y, _e130, _e129.w).xyz;
        let _e140 = (_e139 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e143 = pow(((_e139 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e129.x <= 0.04045f) {
            phi_21354_ = _e140.x;
        } else {
            phi_21354_ = _e143.x;
        }
        let _e149 = phi_21354_;
        if (_e129.y <= 0.04045f) {
            phi_23035_ = _e140.y;
        } else {
            phi_23035_ = _e143.y;
        }
        let _e155 = phi_23035_;
        if (_e130 <= 0.04045f) {
            phi_19513_ = _e140.z;
        } else {
            phi_19513_ = _e143.z;
        }
        let _e160 = phi_19513_;
        let _e161 = vec4<f32>(_e149, _e155, _e130, min(1f, _e137));
        phi_7078_ = vec4<f32>(_e161.x, _e161.y, _e160, _e161.w);
    }
    let _e168 = phi_7078_;
    phi_22401_ = _e168;
    if (_e100 == 0i) {
        let _e170 = textureSample(global_12, global_2, _e59);
        let _e173 = global_8.member_3;
        let _e175 = clamp((_e68.xyz * _e173), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e178 = (_e175.xyz * _e98.xyz);
        let _e183 = global_8.member_5;
        let _e185 = global_8.member_7;
        let _e187 = global_8.member_8;
        let _e190 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e178.xyz));
        let _e198 = mix(_e185.xyz, _e187.xyz, vec3(_e183));
        let _e220 = mix(mix(_e178, ((_e190.xyz * mix(min(_e198.x, dot(_e175.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e198.z, clamp(pow(max(_e178.x, max(_e178.y, _e178.z)), _e198.y), 0f, 1f))) / vec3(max(_e190.x, max(_e190.y, _e190.z)))).xyz, vec3(_e72)), _e170.xyz, vec3(_e89));
        phi_22401_ = vec4<f32>(_e220.x, _e220.y, _e220.z, 1f);
    }
    let _e226 = phi_22401_;
    let _e227 = textureSample(global_13, global_5, _e59);
    phi_6805_ = _e226;
    if (_e227.w < 0f) {
        let _e235 = vec4<f32>(_e227.x, _e226.y, _e226.z, _e226.w);
        let _e241 = vec4<f32>(_e235.x, _e227.y, _e235.z, _e235.w);
        phi_6805_ = vec4<f32>(_e241.x, _e241.y, _e227.z, _e241.w);
    }
    let _e249 = phi_6805_;
    global_14 = _e249;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_14;
    return _e5;
}
