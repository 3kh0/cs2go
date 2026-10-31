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
    member_9: vec4<f32>,
    member_10: i32,
    member_11: vec4<f32>,
    member_12: f32,
    member_13: vec4<f32>,
    member_14: f32,
    member_15: vec3<f32>,
    member_16: vec3<f32>,
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
    var phi_21709_: f32;
    var phi_12885_: f32;
    var phi_20271_: f32;
    var phi_15784_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e73 = global;
    let _e76 = _e73.xy;
    let _e77 = textureSample(global_1, global_2, _e76);
    let _e79 = textureSample(global_3, global_2, _e76);
    let _e81 = global_4;
    let _e83 = textureSample(global_5, global_6, _e81.xy);
    let _e85 = _e73.zw;
    let _e86 = textureSample(global_7, global_8, _e85);
    let _e90 = global_9.member_14;
    let _e101 = (smoothstep(0.5f, 0.6f, _e86.w) * smoothstep(1f, 0.9f, _e86.w));
    let _e107 = global_9.member_9;
    let _e119 = mix(mix(mix(mix(mix(_e107.x, _e107.y, _e86.x), _e107.z, _e86.y), _e107.w, _e86.z), _e107.z, _e79.y), _e107.w, _e79.z);
    let _e120 = (((((_e77.w + (_e83.x * _e77.x)) * ((_e90 * 6f) + 1f)) + _e101) * max(clamp((_e79.y + _e79.z), 0f, 1f), smoothstep(0f, 0.5f, _e86.w))) * _e119);
    let _e122 = global_9.member_3;
    let _e123 = (_e122 * _e119);
    let _e128 = (0.56f - (0.06f * _e90));
    let _e132 = (0.54f - (_e90 * 0.12f));
    let _e142 = (_e86.xyz * vec3<f32>(smoothstep((0.58f + _e123), (_e128 - _e123), _e120), smoothstep((_e128 + _e123), (_e132 - _e123), _e120), smoothstep((_e132 + _e123), ((0.52f - (_e90 * 0.17999999f)) - _e123), _e120)).xyz);
    let _e148 = smoothstep((0.58f - _e123), (0.68f + _e123), _e120);
    let _e153 = textureSample(global_10, global_6, _e81.zw);
    let _e160 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e153, vec4(((pow((1f - _e77.x), 4f) * 0.25f) + (0.75f * _e90))));
    let _e162 = global_9.member_13;
    let _e171 = mix(mix(mix(mix(mix(_e162.x, _e162.y, _e142.x), _e162.z, _e142.y), _e162.w, _e142.z), _e162.z, _e79.y), _e162.w, _e79.z);
    let _e173 = global_9.member;
    phi_7078_ = vec4<f32>(_e73.xy, 0f, 1f);
    if (_e173 != 0i) {
        let _e175 = textureSample(global_11, global_2, _e76);
        let _e183 = global_9.member_1;
        if (_e183 != 0i) {
            let _e185 = textureSample(global_12, global_6, _e85);
            phi_21709_ = _e185.x;
        } else {
            let _e187 = textureSample(global_12, global_6, _e76);
            phi_21709_ = _e187.x;
        }
        let _e190 = phi_21709_;
        let _e192 = global_9.member_10;
        let _e193 = (_e192 != 0i);
        phi_12885_ = _e190;
        if _e193 {
            let _e195 = global_9.member_11;
            phi_12885_ = mix(mix(mix(_e195.x, _e195.y, _e142.x), _e195.z, _e142.y), _e195.w, _e142.z);
        }
        let _e204 = phi_12885_;
        phi_20271_ = _e204;
        if _e193 {
            let _e206 = global_9.member_11;
            phi_20271_ = mix(mix(_e204, _e206.z, _e79.y), _e206.w, _e79.z);
        }
        let _e212 = phi_20271_;
        let _e222 = mix(vec4<f32>(min(1f, (_e212 + ((((1f - _e160.w) * _e90) * _e90) * 0.5f))), _e171, 0f, 1f), vec4<f32>(_e175.x, _e175.y, _e175.z, _e175.w), vec4(_e148));
        let _e223 = (1f - _e148);
        let _e225 = global_9.member_2;
        if (_e225 != 0i) {
            let _e227 = textureSample(global_13, global_6, _e85);
            phi_15784_ = vec4<f32>(_e222.x, _e222.y, (_e223 * _e227.x), _e222.w);
        } else {
            let _e235 = textureSample(global_13, global_6, _e76);
            let _e237 = (_e223 * _e235.x);
            phi_15784_ = vec4<f32>(_e222.x, _e222.y, (_e237 * _e237), _e222.w);
        }
        let _e245 = phi_15784_;
        let _e249 = (_e245.z * (1f - max(_e79.y, _e79.z)));
        let _e256 = global_9.member_12;
        let _e258 = vec4<f32>(_e245.x, _e245.y, _e249, _e245.w).xyz;
        let _e259 = (_e258 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e262 = pow(((_e258 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e245.x <= 0.04045f) {
            phi_21354_ = _e259.x;
        } else {
            phi_21354_ = _e262.x;
        }
        let _e268 = phi_21354_;
        if (_e245.y <= 0.04045f) {
            phi_23035_ = _e259.y;
        } else {
            phi_23035_ = _e262.y;
        }
        let _e274 = phi_23035_;
        if (_e249 <= 0.04045f) {
            phi_19513_ = _e259.z;
        } else {
            phi_19513_ = _e262.z;
        }
        let _e279 = phi_19513_;
        let _e280 = vec4<f32>(_e268, _e274, _e249, min(1f, _e256));
        phi_7078_ = vec4<f32>(_e280.x, _e280.y, _e279, _e280.w);
    }
    let _e287 = phi_7078_;
    phi_22401_ = _e287;
    if (_e173 == 0i) {
        let _e289 = textureSample(global_14, global_2, _e76);
        let _e292 = global_9.member_4;
        let _e294 = global_9.member_5;
        let _e298 = global_9.member_6;
        let _e302 = global_9.member_7;
        let _e309 = global_9.member_8;
        let _e312 = clamp((mix(mix(mix(mix(mix(_e292, _e294, vec3(_e142.x)), _e298, vec3(_e142.y)), _e302, vec3(_e142.z)), _e298, vec3(_e79.y)), _e302, vec3(_e79.z)) * mix(_e309, 1f, (smoothstep(0f, 0.01f, _e148) * (1f - _e101)))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e315 = (_e312.xyz * _e160.xyz);
        let _e320 = global_9.member_15;
        let _e322 = global_9.member_16;
        let _e325 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e315.xyz));
        let _e333 = mix(_e320.xyz, _e322.xyz, vec3(_e171));
        let _e355 = mix(mix(_e315, ((_e325.xyz * mix(min(_e333.x, dot(_e312.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e333.z, clamp(pow(max(_e315.x, max(_e315.y, _e315.z)), _e333.y), 0f, 1f))) / vec3(max(_e325.x, max(_e325.y, _e325.z)))).xyz, vec3(_e90)), _e289.xyz, vec3(_e148));
        phi_22401_ = vec4<f32>(_e355.x, _e355.y, _e355.z, 1f);
    }
    let _e361 = phi_22401_;
    let _e362 = textureSample(global_15, global_6, _e76);
    phi_6805_ = _e361;
    if (_e362.w < 0f) {
        let _e370 = vec4<f32>(_e362.x, _e361.y, _e361.z, _e361.w);
        let _e376 = vec4<f32>(_e370.x, _e362.y, _e370.z, _e370.w);
        phi_6805_ = vec4<f32>(_e376.x, _e376.y, _e362.z, _e376.w);
    }
    let _e384 = phi_6805_;
    global_16 = _e384;
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
