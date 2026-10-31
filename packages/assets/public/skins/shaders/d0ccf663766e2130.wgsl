struct type_8 {
    member: i32,
    member_1: f32,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: f32,
    member_7: i32,
    member_8: f32,
    member_9: f32,
    member_10: i32,
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
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e75 = global;
    let _e78 = _e75.xy;
    let _e79 = textureSample(global_1, global_2, _e78);
    let _e81 = pow(_e79.x, 1.5f);
    let _e82 = (_e81 * 0.96f);
    let _e84 = textureSample(global_3, global_2, _e78);
    let _e87 = (1f - _e84.x);
    let _e89 = global_4;
    let _e91 = textureSample(global_5, global_6, _e89.xy);
    let _e94 = textureSample(global_7, global_8, _e75.zw);
    let _e99 = global_9.member_12;
    let _e113 = max(0f, smoothstep(0f, 0.5f, _e94.w));
    let _e114 = ((((min(_e79.w, _e87) + (_e91.x * mix(smoothstep(0f, 0.72f, pow(_e82, 1.3f)), smoothstep(0f, 0.4f, _e82), pow(_e99, 1.2f)))) * ((_e99 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e94.w) * smoothstep(1f, 0.9f, _e94.w))) * _e113);
    let _e116 = global_9.member_1;
    let _e117 = (_e116 * _e113);
    let _e121 = (_e84.x > 0.99f);
    let _e123 = mix(smoothstep((0.58f - _e117), (0.68f + _e117), _e114), _e114, select(0f, 1f, _e121));
    let _e125 = textureSample(global_10, global_6, _e89.zw);
    let _e144 = smoothstep(0.2f, 0.6f, (((_e91.x * _e79.y) * (_e91.x * smoothstep(0.2f, 0.3f, _e82))) * _e99));
    let _e153 = (smoothstep((0.5f * _e99), 0f, clamp((((_e81 * 11.5199995f) * _e79.y) - ((_e99 * clamp(((_e125.x * _e125.y) * _e125.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e99);
    let _e154 = (1f - _e153);
    let _e158 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e125, vec4(((pow((1f - _e82), 4f) * 0.25f) + (0.75f * _e99)))), vec4(clamp((_e144 * 2f), 0f, 1f)));
    let _e160 = global_9.member;
    if (_e160 != 0i) {
        let _e162 = textureSample(global_11, global_2, _e78);
        let _e164 = (1f - _e123);
        let _e168 = (1f - min(1f, (_e94.w * 2f)));
        let _e175 = global_9.member_8;
        let _e182 = dot(_e158.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e192 = ((1f - _e158.w) * _e99);
        let _e195 = clamp(((((mix(_e175, mix((((_e168 * _e168) * 0.85f) + 0.15f), _e175, select(0f, 1f, (_e94.w >= 0.5f))), _e84.x) * mix(1f, 0.9f, _e144)) + (((1f - _e182) * _e99) * 0.05f)) + ((_e153 * 0.15f) * _e99)) + (_e192 * 0.15f)), 0f, 1f);
        let _e205 = mix(mix(1f, pow(((_e154 * _e158.w) * _e182), 0.5f), _e99), 1f, _e144);
        let _e211 = vec4<f32>(mix(_e162.x, mix(min(1f, (_e195 + ((_e192 * _e99) * 0.5f))), _e195, _e84.x), select(max(0f, _e164), 1f, _e121)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e214 = global_9.member_11;
        let _e221 = vec4<f32>(_e211.x, mix(mix(_e214, _e162.y, _e123), _e205, _e84.x), _e211.z, _e211.w);
        let _e226 = vec4<f32>(_e221.x, _e221.y, _e164, _e221.w);
        let _e228 = global_9.member_10;
        phi_21709_ = _e226;
        if (_e228 != 0i) {
            phi_21709_ = vec4<f32>(_e226.x, _e226.y, (_e164 * _e84.x), _e226.w);
        }
        let _e237 = phi_21709_;
        let _e239 = global_9.member_9;
        let _e241 = _e237.xyz;
        let _e242 = (_e241 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e245 = pow(((_e241 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e237.x <= 0.04045f) {
            phi_21354_ = _e242.x;
        } else {
            phi_21354_ = _e245.x;
        }
        let _e251 = phi_21354_;
        if (_e237.y <= 0.04045f) {
            phi_21355_ = _e242.y;
        } else {
            phi_21355_ = _e245.y;
        }
        let _e257 = phi_21355_;
        if (_e237.z <= 0.04045f) {
            phi_22686_ = _e242.z;
        } else {
            phi_22686_ = _e245.z;
        }
        let _e263 = phi_22686_;
        phi_11711_ = vec4<f32>(_e251, _e257, _e263, min(1f, _e239));
        phi_10247_ = _e205;
    } else {
        phi_11711_ = vec4<f32>(_e75.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e266 = phi_11711_;
    let _e268 = phi_10247_;
    phi_22401_ = _e266;
    if (_e160 == 0i) {
        let _e270 = textureSample(global_12, global_2, _e78);
        let _e272 = vec3(_e99);
        let _e274 = global_9.member_3;
        let _e276 = global_9.member_4;
        let _e278 = _e94.xyz;
        let _e280 = global_9.member_6;
        let _e283 = global_9.member_7;
        let _e287 = mix(_e278, (_e278 * _e280), vec3(max(_e84.x, f32(_e283))));
        let _e293 = vec4<f32>(_e287.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e299 = vec4<f32>(_e293.x, _e287.y, _e293.z, _e293.w);
        let _e305 = vec4<f32>(_e299.x, _e299.y, _e287.z, _e299.w);
        let _e309 = global_9.member_5;
        let _e313 = _e305.xyz;
        let _e317 = global_9.member_2;
        let _e321 = vec3(_e84.x);
        let _e328 = (mix(_e313, mix((mix(mix(_e274, _e309, vec3(pow(_e99, 0.5f))), mix(_e274, _e276, _e272), vec3(_e154)) * _e313), (_e317 * dot(_e305.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e144)), _e321).xyz * _e158.xyz);
        let _e333 = global_9.member_11;
        let _e336 = global_9.member_13;
        let _e338 = global_9.member_14;
        let _e341 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e328.xyz));
        let _e349 = mix(_e336.xyz, _e338.xyz, vec3(mix(_e333, _e268, _e84.x)));
        let _e370 = mix(mix(_e328, ((_e341.xyz * mix(min(_e349.x, dot(mix(_e313, (_e313 * _e274), _e321).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e349.z, clamp(pow(max(_e328.x, max(_e328.y, _e328.z)), _e349.y), 0f, 1f))) / vec3(max(_e341.x, max(_e341.y, _e341.z)))).xyz, _e272), _e270.xyz, vec3((_e123 * _e87)));
        phi_22401_ = vec4<f32>(_e370.x, _e370.y, _e370.z, 1f);
    }
    let _e376 = phi_22401_;
    let _e377 = textureSample(global_13, global_6, _e78);
    phi_6805_ = _e376;
    if (_e377.w < 0f) {
        let _e385 = vec4<f32>(_e377.x, _e376.y, _e376.z, _e376.w);
        let _e391 = vec4<f32>(_e385.x, _e377.y, _e385.z, _e385.w);
        phi_6805_ = vec4<f32>(_e391.x, _e391.y, _e377.z, _e391.w);
    }
    let _e399 = phi_6805_;
    global_14 = _e399;
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
