struct type_8 {
    member: i32,
    member_1: i32,
    member_2: i32,
    member_3: f32,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: vec3<f32>,
    member_7: vec3<f32>,
    member_8: f32,
    member_9: i32,
    member_10: f32,
    member_11: i32,
    member_12: f32,
    member_13: f32,
    member_14: vec3<f32>,
    member_15: vec3<f32>,
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
@group(1) @binding(0) 
var<storage> global_9: type_8;
@group(1) @binding(41) 
var global_10: texture_2d<f32>;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
@group(1) @binding(37) 
var global_13: texture_2d<f32>;
@group(1) @binding(34) 
var global_14: texture_2d<f32>;
@group(1) @binding(38) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_21903_: f32;
    var phi_21709_: vec4<f32>;
    var phi_21710_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e77 = global;
    let _e80 = _e77.xy;
    let _e81 = textureSample(global_1, global_2, _e80);
    let _e83 = pow(_e81.x, 1.5f);
    let _e84 = (_e83 * 0.96f);
    let _e86 = textureSample(global_3, global_2, _e80);
    let _e89 = (1f - _e86.x);
    let _e91 = global_4;
    let _e93 = textureSample(global_5, global_6, _e91.xy);
    let _e95 = _e77.zw;
    let _e96 = textureSample(global_7, global_8, _e95);
    let _e101 = global_9.member_13;
    let _e115 = max(0f, smoothstep(0f, 0.5f, _e96.w));
    let _e116 = ((((min(_e81.w, _e89) + (_e93.x * mix(smoothstep(0f, 0.72f, pow(_e84, 1.3f)), smoothstep(0f, 0.4f, _e84), pow(_e101, 1.2f)))) * ((_e101 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e96.w) * smoothstep(1f, 0.9f, _e96.w))) * _e115);
    let _e118 = global_9.member_3;
    let _e119 = (_e118 * _e115);
    let _e123 = (_e86.x > 0.99f);
    let _e125 = mix(smoothstep((0.58f - _e119), (0.68f + _e119), _e116), _e116, select(0f, 1f, _e123));
    let _e127 = textureSample(global_10, global_6, _e91.zw);
    let _e146 = smoothstep(0.2f, 0.6f, (((_e93.x * _e81.y) * (_e93.x * smoothstep(0.2f, 0.3f, _e84))) * _e101));
    let _e155 = (smoothstep((0.5f * _e101), 0f, clamp((((_e83 * 11.5199995f) * _e81.y) - ((_e101 * clamp(((_e127.x * _e127.y) * _e127.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e101);
    let _e156 = (1f - _e155);
    let _e160 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e127, vec4(((pow((1f - _e84), 4f) * 0.25f) + (0.75f * _e101)))), vec4(clamp((_e146 * 2f), 0f, 1f)));
    let _e162 = global_9.member;
    if (_e162 != 0i) {
        let _e164 = textureSample(global_11, global_2, _e80);
        let _e166 = (1f - _e125);
        let _e169 = global_9.member_1;
        if (_e169 != 0i) {
            let _e171 = textureSample(global_12, global_6, _e95);
            phi_21903_ = _e171.x;
        } else {
            let _e173 = textureSample(global_12, global_6, _e80);
            phi_21903_ = _e173.x;
        }
        let _e176 = phi_21903_;
        let _e181 = dot(_e160.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e191 = ((1f - _e160.w) * _e101);
        let _e194 = clamp(((((_e176 * mix(1f, 0.9f, _e146)) + (((1f - _e181) * _e101) * 0.05f)) + ((_e155 * 0.15f) * _e101)) + (_e191 * 0.15f)), 0f, 1f);
        let _e204 = mix(mix(1f, pow(((_e156 * _e160.w) * _e181), 0.5f), _e101), 1f, _e146);
        let _e210 = vec4<f32>(mix(_e164.x, mix(min(1f, (_e194 + ((_e191 * _e101) * 0.5f))), _e194, _e86.x), select(max(0f, _e166), 1f, _e123)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e213 = global_9.member_12;
        let _e220 = vec4<f32>(_e210.x, mix(mix(_e213, _e164.y, _e125), _e204, _e86.x), _e210.z, _e210.w);
        let _e222 = global_9.member_2;
        if (_e222 != 0i) {
            let _e224 = textureSample(global_13, global_6, _e95);
            phi_21709_ = vec4<f32>(_e220.x, _e220.y, (_e166 * _e224.x), _e220.w);
        } else {
            let _e232 = textureSample(global_13, global_6, _e80);
            let _e234 = (_e166 * _e232.x);
            phi_21709_ = vec4<f32>(_e220.x, _e220.y, (_e234 * _e234), _e220.w);
        }
        let _e242 = phi_21709_;
        let _e244 = global_9.member_11;
        phi_21710_ = _e242;
        if (_e244 != 0i) {
            phi_21710_ = vec4<f32>(_e242.x, _e242.y, (_e242.z * _e86.x), _e242.w);
        }
        let _e254 = phi_21710_;
        let _e256 = global_9.member_10;
        let _e258 = _e254.xyz;
        let _e259 = (_e258 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e262 = pow(((_e258 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e254.x <= 0.04045f) {
            phi_21354_ = _e259.x;
        } else {
            phi_21354_ = _e262.x;
        }
        let _e268 = phi_21354_;
        if (_e254.y <= 0.04045f) {
            phi_21355_ = _e259.y;
        } else {
            phi_21355_ = _e262.y;
        }
        let _e274 = phi_21355_;
        if (_e254.z <= 0.04045f) {
            phi_22686_ = _e259.z;
        } else {
            phi_22686_ = _e262.z;
        }
        let _e280 = phi_22686_;
        phi_11711_ = vec4<f32>(_e268, _e274, _e280, min(1f, _e256));
        phi_10247_ = _e204;
    } else {
        phi_11711_ = vec4<f32>(_e77.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e283 = phi_11711_;
    let _e285 = phi_10247_;
    phi_22401_ = _e283;
    if (_e162 == 0i) {
        let _e287 = textureSample(global_14, global_2, _e80);
        let _e289 = vec3(_e101);
        let _e291 = global_9.member_5;
        let _e293 = global_9.member_6;
        let _e295 = _e96.xyz;
        let _e297 = global_9.member_8;
        let _e300 = global_9.member_9;
        let _e304 = mix(_e295, (_e295 * _e297), vec3(max(_e86.x, f32(_e300))));
        let _e310 = vec4<f32>(_e304.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e316 = vec4<f32>(_e310.x, _e304.y, _e310.z, _e310.w);
        let _e322 = vec4<f32>(_e316.x, _e316.y, _e304.z, _e316.w);
        let _e326 = global_9.member_7;
        let _e330 = _e322.xyz;
        let _e334 = global_9.member_4;
        let _e338 = vec3(_e86.x);
        let _e345 = (mix(_e330, mix((mix(mix(_e291, _e326, vec3(pow(_e101, 0.5f))), mix(_e291, _e293, _e289), vec3(_e156)) * _e330), (_e334 * dot(_e322.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e146)), _e338).xyz * _e160.xyz);
        let _e350 = global_9.member_12;
        let _e353 = global_9.member_14;
        let _e355 = global_9.member_15;
        let _e358 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e345.xyz));
        let _e366 = mix(_e353.xyz, _e355.xyz, vec3(mix(_e350, _e285, _e86.x)));
        let _e387 = mix(mix(_e345, ((_e358.xyz * mix(min(_e366.x, dot(mix(_e330, (_e330 * _e291), _e338).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e366.z, clamp(pow(max(_e345.x, max(_e345.y, _e345.z)), _e366.y), 0f, 1f))) / vec3(max(_e358.x, max(_e358.y, _e358.z)))).xyz, _e289), _e287.xyz, vec3((_e125 * _e89)));
        phi_22401_ = vec4<f32>(_e387.x, _e387.y, _e387.z, 1f);
    }
    let _e393 = phi_22401_;
    let _e394 = textureSample(global_15, global_6, _e80);
    phi_6805_ = _e393;
    if (_e394.w < 0f) {
        let _e402 = vec4<f32>(_e394.x, _e393.y, _e393.z, _e393.w);
        let _e408 = vec4<f32>(_e402.x, _e394.y, _e402.z, _e402.w);
        phi_6805_ = vec4<f32>(_e408.x, _e408.y, _e394.z, _e408.w);
    }
    let _e416 = phi_6805_;
    global_16 = _e416;
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
