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
@group(1) @binding(40) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(39) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(41) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(37) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
@group(1) @binding(38) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_7735_: f32;
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e66 = global;
    let _e69 = _e66.xy;
    let _e70 = textureSample(global_1, global_2, _e69);
    let _e72 = pow(_e70.x, 1.5f);
    let _e73 = (_e72 * 0.96f);
    let _e75 = textureSample(global_3, global_2, _e69);
    let _e77 = global_4;
    let _e79 = textureSample(global_5, global_6, _e77.xy);
    let _e81 = _e66.zw;
    let _e82 = textureSample(global_7, global_8, _e81);
    let _e84 = textureSample(global_9, global_6, _e77.zw);
    let _e95 = global_10.member_9;
    let _e105 = smoothstep(0.2f, 0.6f, (((_e79.x * _e70.y) * (_e79.x * smoothstep(0.2f, 0.3f, _e73))) * _e95));
    let _e114 = (smoothstep((0.5f * _e95), 0f, clamp((((_e72 * 11.5199995f) * _e70.y) - ((_e95 * clamp(((_e84.x * _e84.y) * _e84.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e95);
    let _e115 = (1f - _e114);
    let _e119 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e84, vec4(((pow((1f - _e73), 4f) * 0.25f) + (0.75f * _e95)))), vec4(clamp((_e105 * 2f), 0f, 1f)));
    let _e121 = global_10.member;
    if (_e121 != 0i) {
        let _e123 = textureSample(global_11, global_2, _e69);
        let _e126 = global_10.member_1;
        if (_e126 != 0i) {
            let _e128 = textureSample(global_12, global_6, _e81);
            phi_7735_ = _e128.x;
        } else {
            let _e130 = textureSample(global_12, global_6, _e69);
            phi_7735_ = _e130.x;
        }
        let _e133 = phi_7735_;
        let _e140 = dot(_e119.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e150 = ((1f - _e119.w) * _e95);
        let _e153 = clamp(((((_e133 * mix(1f, 0.9f, _e105)) + (((1f - _e140) * _e95) * 0.05f)) + ((_e114 * 0.15f) * _e95)) + (_e150 * 0.15f)), 0f, 1f);
        let _e163 = mix(mix(1f, pow(((_e115 * _e119.w) * _e140), 0.5f), _e95), 1f, _e105);
        let _e164 = mix(_e123.x, mix(min(1f, (_e153 + ((_e150 * _e95) * 0.5f))), _e153, _e75.x), (step(_e70.w, 0.996f) * _e75.x));
        let _e166 = mix(_e123.y, _e163, _e75.x);
        let _e167 = (1f - _e70.w);
        let _e169 = global_10.member_8;
        let _e171 = vec4<f32>(_e164, _e166, _e167, min(1f, _e169));
        let _e172 = _e171.xyz;
        let _e173 = (_e172 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e176 = pow(((_e172 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e164 <= 0.04045f) {
            phi_23035_ = _e173.x;
        } else {
            phi_23035_ = _e176.x;
        }
        let _e181 = phi_23035_;
        if (_e166 <= 0.04045f) {
            phi_23036_ = _e173.y;
        } else {
            phi_23036_ = _e176.y;
        }
        let _e186 = phi_23036_;
        if (_e167 <= 0.04045f) {
            phi_19167_ = _e173.z;
        } else {
            phi_19167_ = _e176.z;
        }
        let _e191 = phi_19167_;
        let _e196 = vec4<f32>(_e181, _e171.y, _e171.z, _e171.w);
        let _e201 = vec4<f32>(_e196.x, _e186, _e196.z, _e196.w);
        phi_11711_ = vec4<f32>(_e201.x, _e201.y, _e191, _e201.w);
        phi_10247_ = _e163;
    } else {
        phi_11711_ = vec4<f32>(_e66.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e208 = phi_11711_;
    let _e210 = phi_10247_;
    phi_22401_ = _e208;
    if (_e121 == 0i) {
        let _e212 = textureSample(global_13, global_2, _e69);
        let _e214 = vec3(_e95);
        let _e216 = global_10.member_3;
        let _e218 = global_10.member_4;
        let _e220 = _e82.xyz;
        let _e222 = global_10.member_6;
        let _e226 = global_10.member_7;
        let _e230 = mix(_e220, (_e220 * _e222), vec3(max(_e75.x, f32(_e226))));
        let _e236 = vec4<f32>(_e230.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e242 = vec4<f32>(_e236.x, _e230.y, _e236.z, _e236.w);
        let _e248 = vec4<f32>(_e242.x, _e242.y, _e230.z, _e242.w);
        let _e252 = global_10.member_5;
        let _e256 = _e248.xyz;
        let _e260 = global_10.member_2;
        let _e268 = (mix((mix(mix(_e216, _e252, vec3(pow(_e95, 0.5f))), mix(_e216, _e218, _e214), vec3(_e115)) * _e256), (_e260 * dot(_e248.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e105)).xyz * _e119.xyz);
        let _e273 = global_10.member_10;
        let _e275 = global_10.member_11;
        let _e278 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e268.xyz));
        let _e286 = mix(_e273.xyz, _e275.xyz, vec3(_e210));
        let _e307 = mix(mix(_e268, ((_e278.xyz * mix(min(_e286.x, dot((_e256 * _e216).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e286.z, clamp(pow(max(_e268.x, max(_e268.y, _e268.z)), _e286.y), 0f, 1f))) / vec3(max(_e278.x, max(_e278.y, _e278.z)))).xyz, _e214), _e212.xyz, vec3((1f - _e75.x)));
        phi_22401_ = vec4<f32>(_e307.x, _e307.y, _e307.z, 1f);
    }
    let _e313 = phi_22401_;
    let _e314 = textureSample(global_14, global_6, _e69);
    phi_22402_ = _e313;
    if (_e314.w < 0f) {
        let _e322 = vec4<f32>(_e314.x, _e313.y, _e313.z, _e313.w);
        let _e328 = vec4<f32>(_e322.x, _e314.y, _e322.z, _e322.w);
        phi_22402_ = vec4<f32>(_e328.x, _e328.y, _e314.z, _e328.w);
    }
    let _e336 = phi_22402_;
    let _e337 = textureSample(global_15, global_6, _e69);
    phi_6805_ = _e336;
    if (_e337.w < 0f) {
        let _e345 = vec4<f32>(_e337.x, _e336.y, _e336.z, _e336.w);
        let _e351 = vec4<f32>(_e345.x, _e337.y, _e345.z, _e345.w);
        phi_6805_ = vec4<f32>(_e351.x, _e351.y, _e337.z, _e351.w);
    }
    let _e359 = phi_6805_;
    global_16 = _e359;
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
