struct type_8 {
    member: i32,
    member_1: f32,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: f32,
    member_7: vec4<f32>,
    member_8: f32,
    member_9: f32,
    member_10: f32,
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
@group(1) @binding(0) 
var<storage> global_9: type_8;
@group(1) @binding(39) 
var global_10: texture_2d<f32>;
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
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e70 = global;
    let _e73 = _e70.xy;
    let _e74 = textureSample(global_1, global_2, _e73);
    let _e76 = textureSample(global_3, global_2, _e73);
    let _e78 = global_4;
    let _e80 = textureSample(global_5, global_6, _e78.xy);
    let _e83 = textureSample(global_7, global_8, _e70.zw);
    let _e87 = global_9.member_10;
    let _e94 = (smoothstep(0.5f, 0.6f, _e83.w) * smoothstep(1f, 0.9f, _e83.w));
    let _e97 = global_9.member_7;
    let _e111 = mix(mix(mix(mix(mix(_e97.x, _e97.y, _e83.x), _e97.z, _e83.y), _e97.w, _e83.z), _e97.z, _e76.y), _e97.w, _e76.z);
    let _e114 = global_9.member_1;
    let _e115 = (_e114 * _e111);
    let _e118 = smoothstep((0.58f - _e115), (0.68f + _e115), ((((_e74.w + (_e80.x * _e74.x)) * ((_e87 * 6f) + 1f)) + _e94) * _e111));
    let _e124 = max((1f - _e76.x), _e118);
    let _e125 = ((smoothstep(0f, 0.01f, _e118) * (1f - _e94)) * _e76.x);
    let _e127 = textureSample(global_10, global_6, _e78.zw);
    let _e134 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e127, vec4(((pow((1f - _e74.x), 4f) * 0.25f) + (0.75f * _e87))));
    let _e136 = global_9.member;
    phi_7078_ = vec4<f32>(_e70.xy, 0f, 1f);
    if (_e136 != 0i) {
        let _e138 = textureSample(global_11, global_2, _e73);
        let _e140 = (1f - _e124);
        let _e144 = (1f - min(1f, (_e83.w * 2f)));
        let _e151 = global_9.member_8;
        let _e163 = mix(_e138.x, min(1f, (mix(mix(mix((((_e144 * _e144) * 0.85f) + 0.15f), _e151, select(0f, 1f, (_e83.w >= 0.5f))), _e151, max(max(_e76.y, _e76.z), _e124)), 0.35f, _e125) + ((1f - dot(_e134.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))) * 0.2f))), max(0f, _e140));
        let _e165 = mix(_e76.x, _e138.y, _e124);
        let _e167 = global_9.member_9;
        let _e169 = vec4<f32>(_e163, _e165, _e140, min(1f, _e167));
        let _e170 = _e169.xyz;
        let _e171 = (_e170 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e174 = pow(((_e170 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e163 <= 0.04045f) {
            phi_23035_ = _e171.x;
        } else {
            phi_23035_ = _e174.x;
        }
        let _e179 = phi_23035_;
        if (_e165 <= 0.04045f) {
            phi_23036_ = _e171.y;
        } else {
            phi_23036_ = _e174.y;
        }
        let _e184 = phi_23036_;
        if (_e140 <= 0.04045f) {
            phi_19167_ = _e171.z;
        } else {
            phi_19167_ = _e174.z;
        }
        let _e189 = phi_19167_;
        let _e194 = vec4<f32>(_e179, _e169.y, _e169.z, _e169.w);
        let _e199 = vec4<f32>(_e194.x, _e184, _e194.z, _e194.w);
        phi_7078_ = vec4<f32>(_e199.x, _e199.y, _e189, _e199.w);
    }
    let _e206 = phi_7078_;
    phi_22401_ = _e206;
    if (_e136 == 0i) {
        let _e208 = textureSample(global_12, global_2, _e73);
        let _e212 = global_9.member_2;
        let _e214 = global_9.member_3;
        let _e219 = global_9.member_4;
        let _e224 = global_9.member_5;
        let _e230 = _e208.xyz;
        let _e234 = vec3(_e125);
        let _e237 = global_9.member_6;
        let _e238 = mix(_e237, 1f, _e125);
        let _e242 = clamp((clamp((mix(mix(_e230, mix(mix(mix(mix(mix(_e212, _e214, vec3((_e83.x * _e76.x))), _e219, vec3((_e83.y * _e76.x))), _e224, vec3((_e83.z * _e76.x))), _e219, vec3(_e76.y)), _e224, vec3(_e76.z)).xyz, vec3(_e76.x)), vec3<f32>(0.38f, 0.37f, 0.35f), _e234) * _e238), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)) * _e238), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e244 = mix(_e134.xyz, vec3<f32>(1f, 1f, 1f), _e234);
        let _e250 = vec4<f32>(_e244.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e256 = vec4<f32>(_e250.x, _e244.y, _e250.z, _e250.w);
        let _e265 = (_e242.xyz * vec4<f32>(_e256.x, _e256.y, _e244.z, _e256.w).xyz);
        let _e270 = global_9.member_11;
        let _e273 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e265.xyz));
        let _e298 = mix(mix(_e265, ((_e273.xyz * mix(min(_e270.x, dot(_e242.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e270.z, clamp(pow(max(_e265.x, max(_e265.y, _e265.z)), _e270.y), 0f, 1f))) / vec3(max(_e273.x, max(_e273.y, _e273.z)))).xyz, vec3(_e87)), _e230, vec3(_e124));
        phi_22401_ = vec4<f32>(_e298.x, _e298.y, _e298.z, 1f);
    }
    let _e304 = phi_22401_;
    let _e305 = textureSample(global_13, global_6, _e73);
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
