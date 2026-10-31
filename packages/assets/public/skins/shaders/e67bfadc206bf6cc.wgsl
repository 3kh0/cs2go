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

    let _e65 = global;
    let _e68 = _e65.xy;
    let _e69 = textureSample(global_1, global_2, _e68);
    let _e71 = pow(_e69.x, 1.5f);
    let _e72 = (_e71 * 0.96f);
    let _e74 = textureSample(global_3, global_2, _e68);
    let _e76 = global_4;
    let _e78 = textureSample(global_5, global_6, _e76.xy);
    let _e80 = _e65.zw;
    let _e81 = textureSample(global_7, global_8, _e80);
    let _e83 = textureSample(global_9, global_6, _e76.zw);
    let _e94 = global_10.member_9;
    let _e104 = smoothstep(0.2f, 0.6f, (((_e78.x * _e69.y) * (_e78.x * smoothstep(0.2f, 0.3f, _e72))) * _e94));
    let _e113 = (smoothstep((0.5f * _e94), 0f, clamp((((_e71 * 11.5199995f) * _e69.y) - ((_e94 * clamp(((_e83.x * _e83.y) * _e83.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e94);
    let _e114 = (1f - _e113);
    let _e118 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e83, vec4(((pow((1f - _e72), 4f) * 0.25f) + (0.75f * _e94)))), vec4(clamp((_e104 * 2f), 0f, 1f)));
    let _e120 = global_10.member;
    if (_e120 != 0i) {
        let _e122 = textureSample(global_11, global_2, _e68);
        let _e125 = global_10.member_1;
        if (_e125 != 0i) {
            let _e127 = textureSample(global_12, global_6, _e80);
            phi_7735_ = _e127.x;
        } else {
            let _e129 = textureSample(global_12, global_6, _e68);
            phi_7735_ = _e129.x;
        }
        let _e132 = phi_7735_;
        let _e139 = dot(_e118.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e149 = ((1f - _e118.w) * _e94);
        let _e152 = clamp(((((_e132 * mix(1f, 0.9f, _e104)) + (((1f - _e139) * _e94) * 0.05f)) + ((_e113 * 0.15f) * _e94)) + (_e149 * 0.15f)), 0f, 1f);
        let _e162 = mix(mix(1f, pow(((_e114 * _e118.w) * _e139), 0.5f), _e94), 1f, _e104);
        let _e163 = mix(_e122.x, mix(min(1f, (_e152 + ((_e149 * _e94) * 0.5f))), _e152, _e74.x), (step(_e69.w, 0.996f) * _e74.x));
        let _e165 = mix(_e122.y, _e162, _e74.x);
        let _e166 = (1f - _e69.w);
        let _e168 = global_10.member_8;
        let _e170 = vec4<f32>(_e163, _e165, _e166, min(1f, _e168));
        let _e171 = _e170.xyz;
        let _e172 = (_e171 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e175 = pow(((_e171 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e163 <= 0.04045f) {
            phi_23035_ = _e172.x;
        } else {
            phi_23035_ = _e175.x;
        }
        let _e180 = phi_23035_;
        if (_e165 <= 0.04045f) {
            phi_23036_ = _e172.y;
        } else {
            phi_23036_ = _e175.y;
        }
        let _e185 = phi_23036_;
        if (_e166 <= 0.04045f) {
            phi_19167_ = _e172.z;
        } else {
            phi_19167_ = _e175.z;
        }
        let _e190 = phi_19167_;
        let _e195 = vec4<f32>(_e180, _e170.y, _e170.z, _e170.w);
        let _e200 = vec4<f32>(_e195.x, _e185, _e195.z, _e195.w);
        phi_11711_ = vec4<f32>(_e200.x, _e200.y, _e190, _e200.w);
        phi_10247_ = _e162;
    } else {
        phi_11711_ = vec4<f32>(_e65.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e207 = phi_11711_;
    let _e209 = phi_10247_;
    phi_22401_ = _e207;
    if (_e120 == 0i) {
        let _e211 = textureSample(global_13, global_2, _e68);
        let _e213 = vec3(_e94);
        let _e215 = global_10.member_3;
        let _e217 = global_10.member_4;
        let _e219 = _e81.xyz;
        let _e221 = global_10.member_6;
        let _e225 = global_10.member_7;
        let _e229 = mix(_e219, (_e219 * _e221), vec3(max(_e74.x, f32(_e225))));
        let _e235 = vec4<f32>(_e229.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e241 = vec4<f32>(_e235.x, _e229.y, _e235.z, _e235.w);
        let _e247 = vec4<f32>(_e241.x, _e241.y, _e229.z, _e241.w);
        let _e251 = global_10.member_5;
        let _e255 = _e247.xyz;
        let _e259 = global_10.member_2;
        let _e267 = (mix((mix(mix(_e215, _e251, vec3(pow(_e94, 0.5f))), mix(_e215, _e217, _e213), vec3(_e114)) * _e255), (_e259 * dot(_e247.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e104)).xyz * _e118.xyz);
        let _e272 = global_10.member_10;
        let _e274 = global_10.member_11;
        let _e277 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e267.xyz));
        let _e285 = mix(_e272.xyz, _e274.xyz, vec3(_e209));
        let _e306 = mix(mix(_e267, ((_e277.xyz * mix(min(_e285.x, dot((_e255 * _e215).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e285.z, clamp(pow(max(_e267.x, max(_e267.y, _e267.z)), _e285.y), 0f, 1f))) / vec3(max(_e277.x, max(_e277.y, _e277.z)))).xyz, _e213), _e211.xyz, vec3((1f - _e74.x)));
        phi_22401_ = vec4<f32>(_e306.x, _e306.y, _e306.z, 1f);
    }
    let _e312 = phi_22401_;
    let _e313 = textureSample(global_14, global_6, _e68);
    phi_6805_ = _e312;
    if (_e313.w < 0f) {
        let _e321 = vec4<f32>(_e313.x, _e312.y, _e312.z, _e312.w);
        let _e327 = vec4<f32>(_e321.x, _e313.y, _e321.z, _e321.w);
        phi_6805_ = vec4<f32>(_e327.x, _e327.y, _e313.z, _e327.w);
    }
    let _e335 = phi_6805_;
    global_15 = _e335;
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
