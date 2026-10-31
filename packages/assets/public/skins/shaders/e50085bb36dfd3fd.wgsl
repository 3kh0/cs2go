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
@group(1) @binding(39) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(38) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(0) 
var<storage> global_9: type_8;
@group(1) @binding(40) 
var global_10: texture_2d<f32>;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(34) 
var global_12: texture_2d<f32>;
@group(1) @binding(36) 
var global_13: texture_2d<f32>;
@group(1) @binding(37) 
var global_14: texture_2d<f32>;
var<private> global_15: vec4<f32>;

fn function_() {
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e71 = global;
    let _e74 = _e71.xy;
    let _e75 = textureSample(global_1, global_2, _e74);
    let _e77 = textureSample(global_3, global_2, _e74);
    let _e79 = global_4;
    let _e81 = textureSample(global_5, global_6, _e79.xy);
    let _e84 = textureSample(global_7, global_8, _e71.zw);
    let _e88 = global_9.member_10;
    let _e95 = (smoothstep(0.5f, 0.6f, _e84.w) * smoothstep(1f, 0.9f, _e84.w));
    let _e98 = global_9.member_7;
    let _e112 = mix(mix(mix(mix(mix(_e98.x, _e98.y, _e84.x), _e98.z, _e84.y), _e98.w, _e84.z), _e98.z, _e77.y), _e98.w, _e77.z);
    let _e115 = global_9.member_1;
    let _e116 = (_e115 * _e112);
    let _e119 = smoothstep((0.58f - _e116), (0.68f + _e116), ((((_e75.w + (_e81.x * _e75.x)) * ((_e88 * 6f) + 1f)) + _e95) * _e112));
    let _e125 = max((1f - _e77.x), _e119);
    let _e126 = ((smoothstep(0f, 0.01f, _e119) * (1f - _e95)) * _e77.x);
    let _e128 = textureSample(global_10, global_6, _e79.zw);
    let _e135 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e128, vec4(((pow((1f - _e75.x), 4f) * 0.25f) + (0.75f * _e88))));
    let _e137 = global_9.member;
    phi_7078_ = vec4<f32>(_e71.xy, 0f, 1f);
    if (_e137 != 0i) {
        let _e139 = textureSample(global_11, global_2, _e74);
        let _e141 = (1f - _e125);
        let _e145 = (1f - min(1f, (_e84.w * 2f)));
        let _e152 = global_9.member_8;
        let _e164 = mix(_e139.x, min(1f, (mix(mix(mix((((_e145 * _e145) * 0.85f) + 0.15f), _e152, select(0f, 1f, (_e84.w >= 0.5f))), _e152, max(max(_e77.y, _e77.z), _e125)), 0.35f, _e126) + ((1f - dot(_e135.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))) * 0.2f))), max(0f, _e141));
        let _e166 = mix(_e77.x, _e139.y, _e125);
        let _e168 = global_9.member_9;
        let _e170 = vec4<f32>(_e164, _e166, _e141, min(1f, _e168));
        let _e171 = _e170.xyz;
        let _e172 = (_e171 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e175 = pow(((_e171 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e164 <= 0.04045f) {
            phi_23035_ = _e172.x;
        } else {
            phi_23035_ = _e175.x;
        }
        let _e180 = phi_23035_;
        if (_e166 <= 0.04045f) {
            phi_23036_ = _e172.y;
        } else {
            phi_23036_ = _e175.y;
        }
        let _e185 = phi_23036_;
        if (_e141 <= 0.04045f) {
            phi_19167_ = _e172.z;
        } else {
            phi_19167_ = _e175.z;
        }
        let _e190 = phi_19167_;
        let _e195 = vec4<f32>(_e180, _e170.y, _e170.z, _e170.w);
        let _e200 = vec4<f32>(_e195.x, _e185, _e195.z, _e195.w);
        phi_7078_ = vec4<f32>(_e200.x, _e200.y, _e190, _e200.w);
    }
    let _e207 = phi_7078_;
    phi_22401_ = _e207;
    if (_e137 == 0i) {
        let _e209 = textureSample(global_12, global_2, _e74);
        let _e213 = global_9.member_2;
        let _e215 = global_9.member_3;
        let _e220 = global_9.member_4;
        let _e225 = global_9.member_5;
        let _e231 = _e209.xyz;
        let _e235 = vec3(_e126);
        let _e238 = global_9.member_6;
        let _e239 = mix(_e238, 1f, _e126);
        let _e243 = clamp((clamp((mix(mix(_e231, mix(mix(mix(mix(mix(_e213, _e215, vec3((_e84.x * _e77.x))), _e220, vec3((_e84.y * _e77.x))), _e225, vec3((_e84.z * _e77.x))), _e220, vec3(_e77.y)), _e225, vec3(_e77.z)).xyz, vec3(_e77.x)), vec3<f32>(0.38f, 0.37f, 0.35f), _e235) * _e239), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)) * _e239), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e245 = mix(_e135.xyz, vec3<f32>(1f, 1f, 1f), _e235);
        let _e251 = vec4<f32>(_e245.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e257 = vec4<f32>(_e251.x, _e245.y, _e251.z, _e251.w);
        let _e266 = (_e243.xyz * vec4<f32>(_e257.x, _e257.y, _e245.z, _e257.w).xyz);
        let _e271 = global_9.member_11;
        let _e274 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e266.xyz));
        let _e299 = mix(mix(_e266, ((_e274.xyz * mix(min(_e271.x, dot(_e243.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e271.z, clamp(pow(max(_e266.x, max(_e266.y, _e266.z)), _e271.y), 0f, 1f))) / vec3(max(_e274.x, max(_e274.y, _e274.z)))).xyz, vec3(_e88)), _e231, vec3(_e125));
        phi_22401_ = vec4<f32>(_e299.x, _e299.y, _e299.z, 1f);
    }
    let _e305 = phi_22401_;
    let _e306 = textureSample(global_13, global_6, _e74);
    phi_22402_ = _e305;
    if (_e306.w < 0f) {
        let _e314 = vec4<f32>(_e306.x, _e305.y, _e305.z, _e305.w);
        let _e320 = vec4<f32>(_e314.x, _e306.y, _e314.z, _e314.w);
        phi_22402_ = vec4<f32>(_e320.x, _e320.y, _e306.z, _e320.w);
    }
    let _e328 = phi_22402_;
    let _e329 = textureSample(global_14, global_6, _e74);
    phi_6805_ = _e328;
    if (_e329.w < 0f) {
        let _e337 = vec4<f32>(_e329.x, _e328.y, _e328.z, _e328.w);
        let _e343 = vec4<f32>(_e337.x, _e329.y, _e337.z, _e337.w);
        phi_6805_ = vec4<f32>(_e343.x, _e343.y, _e329.z, _e343.w);
    }
    let _e351 = phi_6805_;
    global_15 = _e351;
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
