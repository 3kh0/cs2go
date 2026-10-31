struct type_8 {
    member: i32,
    member_1: f32,
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
@group(1) @binding(34) 
var global_11: texture_2d<f32>;
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
@group(1) @binding(37) 
var global_13: texture_2d<f32>;
var<private> global_14: vec4<f32>;

fn function_() {
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e56 = global;
    let _e59 = _e56.xy;
    let _e60 = textureSample(global_1, global_2, _e59);
    let _e63 = global_3;
    let _e65 = textureSample(global_4, global_5, _e63.xy);
    let _e68 = textureSample(global_6, global_7, _e56.zw);
    let _e72 = global_8.member_6;
    let _e82 = max(0f, smoothstep(0f, 0.5f, _e68.w));
    let _e85 = global_8.member_1;
    let _e86 = (_e85 * _e82);
    let _e89 = smoothstep((0.58f - _e86), (0.68f + _e86), ((((_e60.w + (_e65.x * _e60.x)) * ((_e72 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e68.w) * smoothstep(1f, 0.9f, _e68.w))) * _e82));
    let _e91 = textureSample(global_9, global_5, _e63.zw);
    let _e98 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e91, vec4(((pow((1f - _e60.x), 4f) * 0.25f) + (0.75f * _e72))));
    let _e100 = global_8.member;
    phi_7078_ = vec4<f32>(_e56.xy, 0f, 1f);
    if (_e100 != 0i) {
        let _e102 = textureSample(global_10, global_2, _e59);
        let _e115 = global_8.member_3;
        let _e119 = global_8.member_5;
        let _e122 = mix(vec4<f32>(min(1f, (_e115 + ((((1f - _e98.w) * _e72) * _e72) * 0.5f))), _e119, 0f, 1f), vec4<f32>(_e102.x, _e102.y, _e102.z, _e102.w), vec4(_e89));
        let _e123 = (1f - _e89);
        let _e130 = global_8.member_4;
        let _e132 = vec4<f32>(_e122.x, _e122.y, _e123, _e122.w).xyz;
        let _e133 = (_e132 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e136 = pow(((_e132 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e122.x <= 0.04045f) {
            phi_21354_ = _e133.x;
        } else {
            phi_21354_ = _e136.x;
        }
        let _e142 = phi_21354_;
        if (_e122.y <= 0.04045f) {
            phi_23035_ = _e133.y;
        } else {
            phi_23035_ = _e136.y;
        }
        let _e148 = phi_23035_;
        if (_e123 <= 0.04045f) {
            phi_19513_ = _e133.z;
        } else {
            phi_19513_ = _e136.z;
        }
        let _e153 = phi_19513_;
        let _e154 = vec4<f32>(_e142, _e148, _e123, min(1f, _e130));
        phi_7078_ = vec4<f32>(_e154.x, _e154.y, _e153, _e154.w);
    }
    let _e161 = phi_7078_;
    phi_22401_ = _e161;
    if (_e100 == 0i) {
        let _e163 = textureSample(global_11, global_2, _e59);
        let _e166 = global_8.member_2;
        let _e168 = clamp((_e68.xyz * _e166), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e171 = (_e168.xyz * _e98.xyz);
        let _e176 = global_8.member_5;
        let _e178 = global_8.member_7;
        let _e180 = global_8.member_8;
        let _e183 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e171.xyz));
        let _e191 = mix(_e178.xyz, _e180.xyz, vec3(_e176));
        let _e213 = mix(mix(_e171, ((_e183.xyz * mix(min(_e191.x, dot(_e168.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e191.z, clamp(pow(max(_e171.x, max(_e171.y, _e171.z)), _e191.y), 0f, 1f))) / vec3(max(_e183.x, max(_e183.y, _e183.z)))).xyz, vec3(_e72)), _e163.xyz, vec3(_e89));
        phi_22401_ = vec4<f32>(_e213.x, _e213.y, _e213.z, 1f);
    }
    let _e219 = phi_22401_;
    let _e220 = textureSample(global_12, global_5, _e59);
    phi_22402_ = _e219;
    if (_e220.w < 0f) {
        let _e228 = vec4<f32>(_e220.x, _e219.y, _e219.z, _e219.w);
        let _e234 = vec4<f32>(_e228.x, _e220.y, _e228.z, _e228.w);
        phi_22402_ = vec4<f32>(_e234.x, _e234.y, _e220.z, _e234.w);
    }
    let _e242 = phi_22402_;
    let _e243 = textureSample(global_13, global_5, _e59);
    phi_6805_ = _e242;
    if (_e243.w < 0f) {
        let _e251 = vec4<f32>(_e243.x, _e242.y, _e242.z, _e242.w);
        let _e257 = vec4<f32>(_e251.x, _e243.y, _e251.z, _e251.w);
        phi_6805_ = vec4<f32>(_e257.x, _e257.y, _e243.z, _e257.w);
    }
    let _e265 = phi_6805_;
    global_14 = _e265;
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
