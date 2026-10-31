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

    let _e62 = global;
    let _e65 = _e62.xy;
    let _e66 = textureSample(global_1, global_2, _e65);
    let _e69 = (pow(_e66.x, 1.5f) * 0.96f);
    let _e71 = global_3;
    let _e73 = textureSample(global_4, global_5, _e71.xy);
    let _e76 = textureSample(global_6, global_7, _e62.zw);
    let _e81 = global_8.member_6;
    let _e95 = max(0f, smoothstep(0f, 0.5f, _e76.w));
    let _e98 = global_8.member_1;
    let _e99 = (_e98 * _e95);
    let _e102 = smoothstep((0.56f - _e99), (0.74f + _e99), ((((_e66.w + (_e73.x * mix(smoothstep(0f, 0.72f, pow(_e69, 1.3f)), smoothstep(0f, 0.4f, _e69), pow(_e81, 1.2f)))) * ((_e81 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e76.w) * smoothstep(1f, 0.9f, _e76.w))) * _e95));
    let _e104 = textureSample(global_9, global_5, _e71.zw);
    let _e111 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e104, vec4(((pow((1f - _e69), 4f) * 0.25f) + (0.75f * _e81))));
    let _e113 = global_8.member;
    phi_7078_ = vec4<f32>(_e62.xy, 0f, 1f);
    if (_e113 != 0i) {
        let _e115 = textureSample(global_10, global_2, _e65);
        let _e128 = global_8.member_3;
        let _e132 = global_8.member_5;
        let _e135 = mix(vec4<f32>(min(1f, (_e128 + ((((1f - _e111.w) * _e81) * _e81) * 0.5f))), _e132, 0f, 1f), vec4<f32>(_e115.x, _e115.y, _e115.z, _e115.w), vec4(_e102));
        let _e136 = (1f - _e102);
        let _e143 = global_8.member_4;
        let _e145 = vec4<f32>(_e135.x, _e135.y, _e136, _e135.w).xyz;
        let _e146 = (_e145 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e149 = pow(((_e145 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e135.x <= 0.04045f) {
            phi_21354_ = _e146.x;
        } else {
            phi_21354_ = _e149.x;
        }
        let _e155 = phi_21354_;
        if (_e135.y <= 0.04045f) {
            phi_23035_ = _e146.y;
        } else {
            phi_23035_ = _e149.y;
        }
        let _e161 = phi_23035_;
        if (_e136 <= 0.04045f) {
            phi_19513_ = _e146.z;
        } else {
            phi_19513_ = _e149.z;
        }
        let _e166 = phi_19513_;
        let _e167 = vec4<f32>(_e155, _e161, _e136, min(1f, _e143));
        phi_7078_ = vec4<f32>(_e167.x, _e167.y, _e166, _e167.w);
    }
    let _e174 = phi_7078_;
    phi_22401_ = _e174;
    if (_e113 == 0i) {
        let _e176 = textureSample(global_11, global_2, _e65);
        let _e179 = global_8.member_2;
        let _e181 = clamp((_e76.xyz * _e179), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e184 = (_e181.xyz * _e111.xyz);
        let _e189 = global_8.member_5;
        let _e191 = global_8.member_7;
        let _e193 = global_8.member_8;
        let _e196 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e184.xyz));
        let _e204 = mix(_e191.xyz, _e193.xyz, vec3(_e189));
        let _e226 = mix(mix(_e184, ((_e196.xyz * mix(min(_e204.x, dot(_e181.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e204.z, clamp(pow(max(_e184.x, max(_e184.y, _e184.z)), _e204.y), 0f, 1f))) / vec3(max(_e196.x, max(_e196.y, _e196.z)))).xyz, vec3(_e81)), _e176.xyz, vec3(_e102));
        phi_22401_ = vec4<f32>(_e226.x, _e226.y, _e226.z, 1f);
    }
    let _e232 = phi_22401_;
    let _e233 = textureSample(global_12, global_5, _e65);
    phi_22402_ = _e232;
    if (_e233.w < 0f) {
        let _e241 = vec4<f32>(_e233.x, _e232.y, _e232.z, _e232.w);
        let _e247 = vec4<f32>(_e241.x, _e233.y, _e241.z, _e241.w);
        phi_22402_ = vec4<f32>(_e247.x, _e247.y, _e233.z, _e247.w);
    }
    let _e255 = phi_22402_;
    let _e256 = textureSample(global_13, global_5, _e65);
    phi_6805_ = _e255;
    if (_e256.w < 0f) {
        let _e264 = vec4<f32>(_e256.x, _e255.y, _e255.z, _e255.w);
        let _e270 = vec4<f32>(_e264.x, _e256.y, _e264.z, _e264.w);
        phi_6805_ = vec4<f32>(_e270.x, _e270.y, _e256.z, _e270.w);
    }
    let _e278 = phi_6805_;
    global_14 = _e278;
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
