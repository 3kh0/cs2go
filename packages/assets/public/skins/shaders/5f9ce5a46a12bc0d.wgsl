struct type_8 {
    member: i32,
    member_1: vec3<f32>,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: f32,
    member_6: i32,
    member_7: f32,
    member_8: f32,
    member_9: f32,
    member_10: vec3<f32>,
    member_11: vec3<f32>,
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
@group(1) @binding(37) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(39) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(34) 
var global_12: texture_2d<f32>;
@group(1) @binding(36) 
var global_13: texture_2d<f32>;
var<private> global_14: vec4<f32>;

fn function_() {
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e64 = global;
    let _e67 = _e64.xy;
    let _e68 = textureSample(global_1, global_2, _e67);
    let _e70 = pow(_e68.x, 1.5f);
    let _e71 = (_e70 * 0.96f);
    let _e73 = textureSample(global_3, global_2, _e67);
    let _e75 = global_4;
    let _e77 = textureSample(global_5, global_6, _e75.xy);
    let _e80 = textureSample(global_7, global_8, _e64.zw);
    let _e82 = textureSample(global_9, global_6, _e75.zw);
    let _e93 = global_10.member_9;
    let _e103 = smoothstep(0.2f, 0.6f, (((_e77.x * _e68.y) * (_e77.x * smoothstep(0.2f, 0.3f, _e71))) * _e93));
    let _e112 = (smoothstep((0.5f * _e93), 0f, clamp((((_e70 * 11.5199995f) * _e68.y) - ((_e93 * clamp(((_e82.x * _e82.y) * _e82.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e93);
    let _e113 = (1f - _e112);
    let _e117 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e82, vec4(((pow((1f - _e71), 4f) * 0.25f) + (0.75f * _e93)))), vec4(clamp((_e103 * 2f), 0f, 1f)));
    let _e119 = global_10.member;
    if (_e119 != 0i) {
        let _e121 = textureSample(global_11, global_2, _e67);
        let _e128 = global_10.member_7;
        let _e131 = dot(_e117.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e141 = ((1f - _e117.w) * _e93);
        let _e144 = clamp(((((_e128 * mix(1f, 0.9f, _e103)) + (((1f - _e131) * _e93) * 0.05f)) + ((_e112 * 0.15f) * _e93)) + (_e141 * 0.15f)), 0f, 1f);
        let _e154 = mix(mix(1f, pow(((_e113 * _e117.w) * _e131), 0.5f), _e93), 1f, _e103);
        let _e155 = mix(_e121.x, mix(min(1f, (_e144 + ((_e141 * _e93) * 0.5f))), _e144, _e73.x), (step(_e68.w, 0.996f) * _e73.x));
        let _e157 = mix(_e121.y, _e154, _e73.x);
        let _e158 = (1f - _e68.w);
        let _e160 = global_10.member_8;
        let _e162 = vec4<f32>(_e155, _e157, _e158, min(1f, _e160));
        let _e163 = _e162.xyz;
        let _e164 = (_e163 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e167 = pow(((_e163 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e155 <= 0.04045f) {
            phi_23035_ = _e164.x;
        } else {
            phi_23035_ = _e167.x;
        }
        let _e172 = phi_23035_;
        if (_e157 <= 0.04045f) {
            phi_23036_ = _e164.y;
        } else {
            phi_23036_ = _e167.y;
        }
        let _e177 = phi_23036_;
        if (_e158 <= 0.04045f) {
            phi_19167_ = _e164.z;
        } else {
            phi_19167_ = _e167.z;
        }
        let _e182 = phi_19167_;
        let _e187 = vec4<f32>(_e172, _e162.y, _e162.z, _e162.w);
        let _e192 = vec4<f32>(_e187.x, _e177, _e187.z, _e187.w);
        phi_11711_ = vec4<f32>(_e192.x, _e192.y, _e182, _e192.w);
        phi_10247_ = _e154;
    } else {
        phi_11711_ = vec4<f32>(_e64.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e199 = phi_11711_;
    let _e201 = phi_10247_;
    phi_22401_ = _e199;
    if (_e119 == 0i) {
        let _e203 = textureSample(global_12, global_2, _e67);
        let _e205 = vec3(_e93);
        let _e207 = global_10.member_2;
        let _e209 = global_10.member_3;
        let _e211 = _e80.xyz;
        let _e213 = global_10.member_5;
        let _e217 = global_10.member_6;
        let _e221 = mix(_e211, (_e211 * _e213), vec3(max(_e73.x, f32(_e217))));
        let _e227 = vec4<f32>(_e221.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e233 = vec4<f32>(_e227.x, _e221.y, _e227.z, _e227.w);
        let _e239 = vec4<f32>(_e233.x, _e233.y, _e221.z, _e233.w);
        let _e243 = global_10.member_4;
        let _e247 = _e239.xyz;
        let _e251 = global_10.member_1;
        let _e259 = (mix((mix(mix(_e207, _e243, vec3(pow(_e93, 0.5f))), mix(_e207, _e209, _e205), vec3(_e113)) * _e247), (_e251 * dot(_e239.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e103)).xyz * _e117.xyz);
        let _e264 = global_10.member_10;
        let _e266 = global_10.member_11;
        let _e269 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e259.xyz));
        let _e277 = mix(_e264.xyz, _e266.xyz, vec3(_e201));
        let _e298 = mix(mix(_e259, ((_e269.xyz * mix(min(_e277.x, dot((_e247 * _e207).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e277.z, clamp(pow(max(_e259.x, max(_e259.y, _e259.z)), _e277.y), 0f, 1f))) / vec3(max(_e269.x, max(_e269.y, _e269.z)))).xyz, _e205), _e203.xyz, vec3((1f - _e73.x)));
        phi_22401_ = vec4<f32>(_e298.x, _e298.y, _e298.z, 1f);
    }
    let _e304 = phi_22401_;
    let _e305 = textureSample(global_13, global_6, _e67);
    phi_6805_ = _e304;
    if (_e305.w < 0f) {
        let _e313 = vec4<f32>(_e305.x, _e304.y, _e304.z, _e304.w);
        let _e319 = vec4<f32>(_e313.x, _e305.y, _e313.z, _e313.w);
        phi_6805_ = vec4<f32>(_e319.x, _e319.y, _e305.z, _e319.w);
    }
    let _e327 = phi_6805_;
    global_14 = _e327;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_14;
    return _e5;
}
