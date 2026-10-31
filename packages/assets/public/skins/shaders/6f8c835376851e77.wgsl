struct type_8 {
    member: i32,
    member_1: i32,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: f32,
    member_7: i32,
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
@group(1) @binding(39) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(38) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(40) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(37) 
var global_14: texture_2d<f32>;
var<private> global_15: vec4<f32>;

fn function_() {
    var phi_7735_: f32;
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e62 = global;
    let _e65 = _e62.xy;
    let _e66 = textureSample(global_1, global_2, _e65);
    let _e69 = textureSample(global_3, global_2, _e65);
    let _e71 = global_4;
    let _e73 = textureSample(global_5, global_6, _e71.xy);
    let _e75 = _e62.zw;
    let _e76 = textureSample(global_7, global_8, _e75);
    let _e78 = textureSample(global_9, global_6, _e71.zw);
    let _e90 = global_10.member_9;
    let _e94 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e78, vec4(((pow((1f - _e66.x), 4f) * 0.25f) + (0.75f * _e90))));
    let _e99 = smoothstep(0.1f, 0.2f, (((_e73.x * _e66.y) * (_e66.x * _e66.x)) * _e90));
    let _e106 = smoothstep(0f, 0.15f, ((clamp(((_e66.x * _e66.y) - (_e90 * 0.1f)), 0f, 1f) - (clamp(((_e78.x * _e78.y) * _e78.z), 0f, 1f) * 0.23f)) + 0.08f));
    let _e108 = global_10.member;
    if (_e108 != 0i) {
        let _e110 = textureSample(global_11, global_2, _e65);
        let _e113 = global_10.member_1;
        if (_e113 != 0i) {
            let _e115 = textureSample(global_12, global_6, _e75);
            phi_7735_ = _e115.x;
        } else {
            let _e117 = textureSample(global_12, global_6, _e65);
            phi_7735_ = _e117.x;
        }
        let _e120 = phi_7735_;
        let _e127 = dot(_e94.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e138 = ((1f - _e94.w) * _e90);
        let _e141 = clamp(((((_e120 * mix(1f, 0.9f, _e99)) + (((1f - _e127) * _e90) * 0.05f)) + (((1f - _e106) * 0.15f) * _e90)) + (_e138 * 0.15f)), 0f, 1f);
        let _e151 = mix(mix(1f, pow(((_e106 * _e94.w) * _e127), 0.5f), _e90), 1f, _e99);
        let _e152 = mix(_e110.x, mix(min(1f, (_e141 + ((_e138 * _e90) * 0.5f))), _e141, _e69.x), (step(_e66.w, 0.996f) * _e69.x));
        let _e154 = mix(_e110.y, _e151, _e69.x);
        let _e155 = (1f - _e66.w);
        let _e157 = global_10.member_8;
        let _e159 = vec4<f32>(_e152, _e154, _e155, min(1f, _e157));
        let _e160 = _e159.xyz;
        let _e161 = (_e160 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e164 = pow(((_e160 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e152 <= 0.04045f) {
            phi_23035_ = _e161.x;
        } else {
            phi_23035_ = _e164.x;
        }
        let _e169 = phi_23035_;
        if (_e154 <= 0.04045f) {
            phi_23036_ = _e161.y;
        } else {
            phi_23036_ = _e164.y;
        }
        let _e174 = phi_23036_;
        if (_e155 <= 0.04045f) {
            phi_19167_ = _e161.z;
        } else {
            phi_19167_ = _e164.z;
        }
        let _e179 = phi_19167_;
        let _e184 = vec4<f32>(_e169, _e159.y, _e159.z, _e159.w);
        let _e189 = vec4<f32>(_e184.x, _e174, _e184.z, _e184.w);
        phi_11711_ = vec4<f32>(_e189.x, _e189.y, _e179, _e189.w);
        phi_10247_ = _e151;
    } else {
        phi_11711_ = vec4<f32>(_e62.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e196 = phi_11711_;
    let _e198 = phi_10247_;
    phi_22401_ = _e196;
    if (_e108 == 0i) {
        let _e200 = textureSample(global_13, global_2, _e65);
        let _e202 = vec3(_e90);
        let _e204 = global_10.member_3;
        let _e206 = global_10.member_4;
        let _e208 = _e76.xyz;
        let _e210 = global_10.member_6;
        let _e214 = global_10.member_7;
        let _e218 = mix(_e208, (_e208 * _e210), vec3(max(_e69.x, f32(_e214))));
        let _e224 = vec4<f32>(_e218.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e230 = vec4<f32>(_e224.x, _e218.y, _e224.z, _e224.w);
        let _e236 = vec4<f32>(_e230.x, _e230.y, _e218.z, _e230.w);
        let _e240 = global_10.member_5;
        let _e244 = _e236.xyz;
        let _e248 = global_10.member_2;
        let _e256 = (mix((mix(mix(_e204, _e240, vec3(pow(_e90, 0.5f))), mix(_e204, _e206, _e202), vec3(_e106)) * _e244), (_e248 * dot(_e236.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e99)).xyz * _e94.xyz);
        let _e261 = global_10.member_10;
        let _e263 = global_10.member_11;
        let _e266 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e256.xyz));
        let _e274 = mix(_e261.xyz, _e263.xyz, vec3(_e198));
        let _e295 = mix(mix(_e256, ((_e266.xyz * mix(min(_e274.x, dot((_e244 * _e204).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e274.z, clamp(pow(max(_e256.x, max(_e256.y, _e256.z)), _e274.y), 0f, 1f))) / vec3(max(_e266.x, max(_e266.y, _e266.z)))).xyz, _e202), _e200.xyz, vec3((1f - _e69.x)));
        phi_22401_ = vec4<f32>(_e295.x, _e295.y, _e295.z, 1f);
    }
    let _e301 = phi_22401_;
    let _e302 = textureSample(global_14, global_6, _e65);
    phi_6805_ = _e301;
    if (_e302.w < 0f) {
        let _e310 = vec4<f32>(_e302.x, _e301.y, _e301.z, _e301.w);
        let _e316 = vec4<f32>(_e310.x, _e302.y, _e310.z, _e310.w);
        phi_6805_ = vec4<f32>(_e316.x, _e316.y, _e302.z, _e316.w);
    }
    let _e324 = phi_6805_;
    global_15 = _e324;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_15;
    return _e5;
}
