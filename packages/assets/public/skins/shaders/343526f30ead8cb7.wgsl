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
@group(1) @binding(38) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(37) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
@group(1) @binding(0) 
var<storage> global_8: type_8;
@group(1) @binding(39) 
var global_9: texture_2d<f32>;
@group(1) @binding(35) 
var global_10: texture_2d<f32>;
@group(1) @binding(34) 
var global_11: texture_2d<f32>;
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
var<private> global_13: vec4<f32>;

fn function_() {
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e55 = global;
    let _e58 = _e55.xy;
    let _e59 = textureSample(global_1, global_2, _e58);
    let _e62 = global_3;
    let _e64 = textureSample(global_4, global_5, _e62.xy);
    let _e67 = textureSample(global_6, global_7, _e55.zw);
    let _e71 = global_8.member_6;
    let _e81 = max(0f, smoothstep(0f, 0.5f, _e67.w));
    let _e84 = global_8.member_1;
    let _e85 = (_e84 * _e81);
    let _e88 = smoothstep((0.58f - _e85), (0.68f + _e85), ((((_e59.w + (_e64.x * _e59.x)) * ((_e71 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e67.w) * smoothstep(1f, 0.9f, _e67.w))) * _e81));
    let _e90 = textureSample(global_9, global_5, _e62.zw);
    let _e97 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e90, vec4(((pow((1f - _e59.x), 4f) * 0.25f) + (0.75f * _e71))));
    let _e99 = global_8.member;
    phi_7078_ = vec4<f32>(_e55.xy, 0f, 1f);
    if (_e99 != 0i) {
        let _e101 = textureSample(global_10, global_2, _e58);
        let _e114 = global_8.member_3;
        let _e118 = global_8.member_5;
        let _e121 = mix(vec4<f32>(min(1f, (_e114 + ((((1f - _e97.w) * _e71) * _e71) * 0.5f))), _e118, 0f, 1f), vec4<f32>(_e101.x, _e101.y, _e101.z, _e101.w), vec4(_e88));
        let _e122 = (1f - _e88);
        let _e129 = global_8.member_4;
        let _e131 = vec4<f32>(_e121.x, _e121.y, _e122, _e121.w).xyz;
        let _e132 = (_e131 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e135 = pow(((_e131 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e121.x <= 0.04045f) {
            phi_21354_ = _e132.x;
        } else {
            phi_21354_ = _e135.x;
        }
        let _e141 = phi_21354_;
        if (_e121.y <= 0.04045f) {
            phi_23035_ = _e132.y;
        } else {
            phi_23035_ = _e135.y;
        }
        let _e147 = phi_23035_;
        if (_e122 <= 0.04045f) {
            phi_19513_ = _e132.z;
        } else {
            phi_19513_ = _e135.z;
        }
        let _e152 = phi_19513_;
        let _e153 = vec4<f32>(_e141, _e147, _e122, min(1f, _e129));
        phi_7078_ = vec4<f32>(_e153.x, _e153.y, _e152, _e153.w);
    }
    let _e160 = phi_7078_;
    phi_22401_ = _e160;
    if (_e99 == 0i) {
        let _e162 = textureSample(global_11, global_2, _e58);
        let _e165 = global_8.member_2;
        let _e167 = clamp((_e67.xyz * _e165), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e170 = (_e167.xyz * _e97.xyz);
        let _e175 = global_8.member_5;
        let _e177 = global_8.member_7;
        let _e179 = global_8.member_8;
        let _e182 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e170.xyz));
        let _e190 = mix(_e177.xyz, _e179.xyz, vec3(_e175));
        let _e212 = mix(mix(_e170, ((_e182.xyz * mix(min(_e190.x, dot(_e167.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e190.z, clamp(pow(max(_e170.x, max(_e170.y, _e170.z)), _e190.y), 0f, 1f))) / vec3(max(_e182.x, max(_e182.y, _e182.z)))).xyz, vec3(_e71)), _e162.xyz, vec3(_e88));
        phi_22401_ = vec4<f32>(_e212.x, _e212.y, _e212.z, 1f);
    }
    let _e218 = phi_22401_;
    let _e219 = textureSample(global_12, global_5, _e58);
    phi_6805_ = _e218;
    if (_e219.w < 0f) {
        let _e227 = vec4<f32>(_e219.x, _e218.y, _e218.z, _e218.w);
        let _e233 = vec4<f32>(_e227.x, _e219.y, _e227.z, _e227.w);
        phi_6805_ = vec4<f32>(_e233.x, _e233.y, _e219.z, _e233.w);
    }
    let _e241 = phi_6805_;
    global_13 = _e241;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_13;
    return _e5;
}
