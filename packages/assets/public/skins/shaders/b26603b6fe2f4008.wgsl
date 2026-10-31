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
    member_10: f32,
    member_11: f32,
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
@group(1) @binding(39) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(38) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(41) 
var global_11: texture_2d<f32>;
@group(1) @binding(40) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(34) 
var global_14: texture_2d<f32>;
@group(1) @binding(37) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e73 = global;
    let _e76 = _e73.xy;
    let _e77 = textureSample(global_1, global_2, _e76);
    let _e79 = pow(_e77.x, 1.5f);
    let _e80 = (_e79 * 0.96f);
    let _e82 = textureSample(global_3, global_2, _e76);
    let _e84 = global_4;
    let _e86 = textureSample(global_5, global_6, _e84.xy);
    let _e89 = textureSample(global_7, global_8, _e73.zw);
    let _e90 = textureSample(global_9, global_6, _e76);
    let _e93 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e90, (vec4<f32>(1f, 1f, 1f, 1f) - _e90)));
    let _e100 = global_10.member_11;
    let _e104 = (mix(0.5f, pow(_e80, 0.85f), _e100) * mix(1f, (_e77.y * (min(_e93.x, _e93.y) * 2f)), _e100));
    let _e109 = global_10.member_10;
    let _e118 = global_10.member_12;
    let _e121 = textureSample(global_11, global_2, vec2<f32>(mix((_e104 * 2f), (_e104 + _e89.x), _e109), (max((_e89.y * _e109), (((1f - _e77.y) * 0.2f) * _e100)) + _e118)));
    let _e124 = textureSample(global_12, global_6, _e84.zw);
    let _e135 = global_10.member_9;
    let _e145 = smoothstep(0.2f, 0.6f, (((_e86.x * _e77.y) * (_e86.x * smoothstep(0.2f, 0.3f, _e80))) * _e135));
    let _e154 = (smoothstep((0.5f * _e135), 0f, clamp((((_e79 * 11.5199995f) * _e77.y) - ((_e135 * clamp(((_e124.x * _e124.y) * _e124.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e135);
    let _e155 = (1f - _e154);
    let _e159 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e124, vec4(((pow((1f - _e80), 4f) * 0.25f) + (0.75f * _e135)))), vec4(clamp((_e145 * 2f), 0f, 1f)));
    let _e161 = global_10.member;
    if (_e161 != 0i) {
        let _e163 = textureSample(global_13, global_2, _e76);
        let _e170 = global_10.member_7;
        let _e178 = dot(_e159.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e188 = ((1f - _e159.w) * _e135);
        let _e191 = clamp((((((_e170 * (1f - (0.25f * dot(_e121.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))))) * mix(1f, 0.9f, _e145)) + (((1f - _e178) * _e135) * 0.05f)) + ((_e154 * 0.15f) * _e135)) + (_e188 * 0.15f)), 0f, 1f);
        let _e202 = mix((_e121.w * mix(1f, pow(((_e155 * _e159.w) * _e178), 0.5f), _e135)), 1f, _e145);
        let _e203 = mix(_e163.x, mix(min(1f, (_e191 + ((_e188 * _e135) * 0.5f))), _e191, _e82.x), (step(_e77.w, 0.996f) * _e82.x));
        let _e205 = mix(_e163.y, _e202, _e82.x);
        let _e206 = (1f - _e77.w);
        let _e208 = global_10.member_8;
        let _e210 = vec4<f32>(_e203, _e205, _e206, min(1f, _e208));
        let _e211 = _e210.xyz;
        let _e212 = (_e211 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e215 = pow(((_e211 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e203 <= 0.04045f) {
            phi_23035_ = _e212.x;
        } else {
            phi_23035_ = _e215.x;
        }
        let _e220 = phi_23035_;
        if (_e205 <= 0.04045f) {
            phi_23036_ = _e212.y;
        } else {
            phi_23036_ = _e215.y;
        }
        let _e225 = phi_23036_;
        if (_e206 <= 0.04045f) {
            phi_19167_ = _e212.z;
        } else {
            phi_19167_ = _e215.z;
        }
        let _e230 = phi_19167_;
        let _e235 = vec4<f32>(_e220, _e210.y, _e210.z, _e210.w);
        let _e240 = vec4<f32>(_e235.x, _e225, _e235.z, _e235.w);
        phi_11711_ = vec4<f32>(_e240.x, _e240.y, _e230, _e240.w);
        phi_10247_ = _e202;
    } else {
        phi_11711_ = vec4<f32>(_e73.xy, 0f, 1f);
        phi_10247_ = _e121.w;
    }
    let _e247 = phi_11711_;
    let _e249 = phi_10247_;
    phi_22401_ = _e247;
    if (_e161 == 0i) {
        let _e251 = textureSample(global_14, global_2, _e76);
        let _e253 = vec3(_e135);
        let _e255 = global_10.member_2;
        let _e257 = global_10.member_3;
        let _e259 = _e121.xyz;
        let _e261 = global_10.member_5;
        let _e265 = global_10.member_6;
        let _e269 = mix(_e259, (_e259 * _e261), vec3(max(_e82.x, f32(_e265))));
        let _e275 = vec4<f32>(_e269.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e281 = vec4<f32>(_e275.x, _e269.y, _e275.z, _e275.w);
        let _e287 = vec4<f32>(_e281.x, _e281.y, _e269.z, _e281.w);
        let _e291 = global_10.member_4;
        let _e295 = _e287.xyz;
        let _e299 = global_10.member_1;
        let _e307 = (mix((mix(mix(_e255, _e291, vec3(pow(_e135, 0.5f))), mix(_e255, _e257, _e253), vec3(_e155)) * _e295), (_e299 * dot(_e287.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e145)).xyz * _e159.xyz);
        let _e312 = global_10.member_13;
        let _e314 = global_10.member_14;
        let _e317 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e307.xyz));
        let _e325 = mix(_e312.xyz, _e314.xyz, vec3(_e249));
        let _e346 = mix(mix(_e307, ((_e317.xyz * mix(min(_e325.x, dot((_e295 * _e255).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e325.z, clamp(pow(max(_e307.x, max(_e307.y, _e307.z)), _e325.y), 0f, 1f))) / vec3(max(_e317.x, max(_e317.y, _e317.z)))).xyz, _e253), _e251.xyz, vec3((1f - _e82.x)));
        phi_22401_ = vec4<f32>(_e346.x, _e346.y, _e346.z, 1f);
    }
    let _e352 = phi_22401_;
    let _e353 = textureSample(global_15, global_6, _e76);
    phi_6805_ = _e352;
    if (_e353.w < 0f) {
        let _e361 = vec4<f32>(_e353.x, _e352.y, _e352.z, _e352.w);
        let _e367 = vec4<f32>(_e361.x, _e353.y, _e361.z, _e361.w);
        phi_6805_ = vec4<f32>(_e367.x, _e367.y, _e353.z, _e367.w);
    }
    let _e375 = phi_6805_;
    global_16 = _e375;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_16;
    return _e5;
}
