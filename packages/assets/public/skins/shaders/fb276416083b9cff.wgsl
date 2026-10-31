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

    let _e56 = global;
    let _e59 = _e56.xy;
    let _e60 = textureSample(global_1, global_2, _e59);
    let _e62 = textureSample(global_3, global_2, _e59);
    let _e64 = global_4;
    let _e66 = textureSample(global_5, global_6, _e64.xy);
    let _e71 = global_7.member_12;
    let _e76 = global_7.member_6;
    let _e86 = mix(mix(mix(_e76.x, _e76.y, _e62.x), _e76.z, _e62.y), _e76.w, _e62.z);
    let _e89 = global_7.member_1;
    let _e90 = (_e89 * _e86);
    let _e93 = smoothstep((0.58f - _e90), (0.68f + _e90), (((_e60.w + (_e66.x * _e60.x)) * ((_e71 * 6f) + 1f)) * _e86));
    let _e95 = textureSample(global_8, global_6, _e64.zw);
    let _e102 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e95, vec4(((pow((1f - _e60.x), 4f) * 0.25f) + (0.75f * _e71))));
    let _e104 = global_7.member_11;
    let _e111 = mix(mix(mix(_e104.x, _e104.y, _e62.x), _e104.z, _e62.y), _e104.w, _e62.z);
    let _e113 = global_7.member;
    phi_7078_ = vec4<f32>(_e56.xy, 0f, 1f);
    if (_e113 != 0i) {
        let _e115 = textureSample(global_9, global_2, _e59);
        let _e123 = global_7.member_8;
        if (_e123 != 0i) {
            let _e126 = global_7.member_9;
            phi_20271_ = mix(mix(mix(_e126.x, _e126.y, _e62.x), _e126.z, _e62.y), _e126.w, _e62.z);
        } else {
            let _e135 = global_7.member_7;
            phi_20271_ = _e135;
        }
        let _e137 = phi_20271_;
        let _e147 = mix(vec4<f32>(min(1f, (_e137 + ((((1f - _e102.w) * _e71) * _e71) * 0.5f))), _e111, 0f, 1f), vec4<f32>(_e115.x, _e115.y, _e115.z, _e115.w), vec4(_e93));
        let _e148 = (1f - _e93);
        let _e155 = global_7.member_10;
        let _e157 = vec4<f32>(_e147.x, _e147.y, _e148, _e147.w).xyz;
        let _e158 = (_e157 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e161 = pow(((_e157 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e147.x <= 0.04045f) {
            phi_21354_ = _e158.x;
        } else {
            phi_21354_ = _e161.x;
        }
        let _e167 = phi_21354_;
        if (_e147.y <= 0.04045f) {
            phi_23035_ = _e158.y;
        } else {
            phi_23035_ = _e161.y;
        }
        let _e173 = phi_23035_;
        if (_e148 <= 0.04045f) {
            phi_19513_ = _e158.z;
        } else {
            phi_19513_ = _e161.z;
        }
        let _e178 = phi_19513_;
        let _e179 = vec4<f32>(_e167, _e173, _e148, min(1f, _e155));
        phi_7078_ = vec4<f32>(_e179.x, _e179.y, _e178, _e179.w);
    }
    let _e186 = phi_7078_;
    phi_22401_ = _e186;
    if (_e113 == 0i) {
        let _e188 = textureSample(global_10, global_2, _e59);
        let _e190 = global_7.member_2;
        let _e193 = global_7.member_3;
        let _e197 = global_7.member_4;
        let _e201 = global_7.member_5;
        let _e202 = mix(mix(mix(_e190, _e193, vec3(_e62.x)), _e197, vec3(_e62.y)), _e201, vec3(_e62.z));
        let _e205 = (_e202.xyz * _e102.xyz);
        let _e210 = global_7.member_13;
        let _e212 = global_7.member_14;
        let _e215 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e205.xyz));
        let _e223 = mix(_e210.xyz, _e212.xyz, vec3(_e111));
        let _e245 = mix(mix(_e205, ((_e215.xyz * mix(min(_e223.x, dot(_e202.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e223.z, clamp(pow(max(_e205.x, max(_e205.y, _e205.z)), _e223.y), 0f, 1f))) / vec3(max(_e215.x, max(_e215.y, _e215.z)))).xyz, vec3(_e71)), _e188.xyz, vec3(_e93));
        phi_22401_ = vec4<f32>(_e245.x, _e245.y, _e245.z, 1f);
    }
    let _e251 = phi_22401_;
    let _e252 = textureSample(global_11, global_6, _e59);
    phi_6805_ = _e251;
    if (_e252.w < 0f) {
        let _e260 = vec4<f32>(_e252.x, _e251.y, _e251.z, _e251.w);
        let _e266 = vec4<f32>(_e260.x, _e252.y, _e260.z, _e260.w);
        phi_6805_ = vec4<f32>(_e266.x, _e266.y, _e252.z, _e266.w);
    }
    let _e274 = phi_6805_;
    global_12 = _e274;
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
