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
@group(1) @binding(40) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(39) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(42) 
var global_11: texture_2d<f32>;
@group(1) @binding(41) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(37) 
var global_14: texture_2d<f32>;
@group(1) @binding(34) 
var global_15: texture_2d<f32>;
@group(1) @binding(38) 
var global_16: texture_2d<f32>;
var<private> global_17: vec4<f32>;

fn function_() {
    var phi_20940_: f32;
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e74 = global;
    let _e77 = _e74.xy;
    let _e78 = textureSample(global_1, global_2, _e77);
    let _e80 = pow(_e78.x, 1.5f);
    let _e81 = (_e80 * 0.96f);
    let _e83 = textureSample(global_3, global_2, _e77);
    let _e85 = global_4;
    let _e87 = textureSample(global_5, global_6, _e85.xy);
    let _e89 = _e74.zw;
    let _e90 = textureSample(global_7, global_8, _e89);
    let _e91 = textureSample(global_9, global_6, _e77);
    let _e94 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e91, (vec4<f32>(1f, 1f, 1f, 1f) - _e91)));
    let _e101 = global_10.member_11;
    let _e105 = (mix(0.5f, pow(_e81, 0.85f), _e101) * mix(1f, (_e78.y * (min(_e94.x, _e94.y) * 2f)), _e101));
    let _e110 = global_10.member_10;
    let _e119 = global_10.member_12;
    let _e122 = textureSample(global_11, global_2, vec2<f32>(mix((_e105 * 2f), (_e105 + _e90.x), _e110), (max((_e90.y * _e110), (((1f - _e78.y) * 0.2f) * _e101)) + _e119)));
    let _e125 = textureSample(global_12, global_6, _e85.zw);
    let _e136 = global_10.member_9;
    let _e146 = smoothstep(0.2f, 0.6f, (((_e87.x * _e78.y) * (_e87.x * smoothstep(0.2f, 0.3f, _e81))) * _e136));
    let _e155 = (smoothstep((0.5f * _e136), 0f, clamp((((_e80 * 11.5199995f) * _e78.y) - ((_e136 * clamp(((_e125.x * _e125.y) * _e125.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e136);
    let _e156 = (1f - _e155);
    let _e160 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e125, vec4(((pow((1f - _e81), 4f) * 0.25f) + (0.75f * _e136)))), vec4(clamp((_e146 * 2f), 0f, 1f)));
    let _e162 = global_10.member;
    if (_e162 != 0i) {
        let _e164 = textureSample(global_13, global_2, _e77);
        let _e167 = global_10.member_1;
        if (_e167 != 0i) {
            let _e169 = textureSample(global_14, global_6, _e89);
            phi_20940_ = _e169.x;
        } else {
            let _e171 = textureSample(global_14, global_6, _e77);
            phi_20940_ = _e171.x;
        }
        let _e174 = phi_20940_;
        let _e186 = dot(_e160.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e196 = ((1f - _e160.w) * _e136);
        let _e199 = clamp((((((_e174 * (1f - (0.25f * dot(_e122.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))))) * mix(1f, 0.9f, _e146)) + (((1f - _e186) * _e136) * 0.05f)) + ((_e155 * 0.15f) * _e136)) + (_e196 * 0.15f)), 0f, 1f);
        let _e210 = mix((_e122.w * mix(1f, pow(((_e156 * _e160.w) * _e186), 0.5f), _e136)), 1f, _e146);
        let _e211 = mix(_e164.x, mix(min(1f, (_e199 + ((_e196 * _e136) * 0.5f))), _e199, _e83.x), (step(_e78.w, 0.996f) * _e83.x));
        let _e213 = mix(_e164.y, _e210, _e83.x);
        let _e214 = (1f - _e78.w);
        let _e216 = global_10.member_8;
        let _e218 = vec4<f32>(_e211, _e213, _e214, min(1f, _e216));
        let _e219 = _e218.xyz;
        let _e220 = (_e219 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e223 = pow(((_e219 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e211 <= 0.04045f) {
            phi_23035_ = _e220.x;
        } else {
            phi_23035_ = _e223.x;
        }
        let _e228 = phi_23035_;
        if (_e213 <= 0.04045f) {
            phi_23036_ = _e220.y;
        } else {
            phi_23036_ = _e223.y;
        }
        let _e233 = phi_23036_;
        if (_e214 <= 0.04045f) {
            phi_19167_ = _e220.z;
        } else {
            phi_19167_ = _e223.z;
        }
        let _e238 = phi_19167_;
        let _e243 = vec4<f32>(_e228, _e218.y, _e218.z, _e218.w);
        let _e248 = vec4<f32>(_e243.x, _e233, _e243.z, _e243.w);
        phi_11711_ = vec4<f32>(_e248.x, _e248.y, _e238, _e248.w);
        phi_10247_ = _e210;
    } else {
        phi_11711_ = vec4<f32>(_e74.xy, 0f, 1f);
        phi_10247_ = _e122.w;
    }
    let _e255 = phi_11711_;
    let _e257 = phi_10247_;
    phi_22401_ = _e255;
    if (_e162 == 0i) {
        let _e259 = textureSample(global_15, global_2, _e77);
        let _e261 = vec3(_e136);
        let _e263 = global_10.member_3;
        let _e265 = global_10.member_4;
        let _e267 = _e122.xyz;
        let _e269 = global_10.member_6;
        let _e273 = global_10.member_7;
        let _e277 = mix(_e267, (_e267 * _e269), vec3(max(_e83.x, f32(_e273))));
        let _e283 = vec4<f32>(_e277.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e289 = vec4<f32>(_e283.x, _e277.y, _e283.z, _e283.w);
        let _e295 = vec4<f32>(_e289.x, _e289.y, _e277.z, _e289.w);
        let _e299 = global_10.member_5;
        let _e303 = _e295.xyz;
        let _e307 = global_10.member_2;
        let _e315 = (mix((mix(mix(_e263, _e299, vec3(pow(_e136, 0.5f))), mix(_e263, _e265, _e261), vec3(_e156)) * _e303), (_e307 * dot(_e295.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e146)).xyz * _e160.xyz);
        let _e320 = global_10.member_13;
        let _e322 = global_10.member_14;
        let _e325 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e315.xyz));
        let _e333 = mix(_e320.xyz, _e322.xyz, vec3(_e257));
        let _e354 = mix(mix(_e315, ((_e325.xyz * mix(min(_e333.x, dot((_e303 * _e263).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e333.z, clamp(pow(max(_e315.x, max(_e315.y, _e315.z)), _e333.y), 0f, 1f))) / vec3(max(_e325.x, max(_e325.y, _e325.z)))).xyz, _e261), _e259.xyz, vec3((1f - _e83.x)));
        phi_22401_ = vec4<f32>(_e354.x, _e354.y, _e354.z, 1f);
    }
    let _e360 = phi_22401_;
    let _e361 = textureSample(global_16, global_6, _e77);
    phi_6805_ = _e360;
    if (_e361.w < 0f) {
        let _e369 = vec4<f32>(_e361.x, _e360.y, _e360.z, _e360.w);
        let _e375 = vec4<f32>(_e369.x, _e361.y, _e369.z, _e369.w);
        phi_6805_ = vec4<f32>(_e375.x, _e375.y, _e361.z, _e375.w);
    }
    let _e383 = phi_6805_;
    global_17 = _e383;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_17;
    return _e5;
}
