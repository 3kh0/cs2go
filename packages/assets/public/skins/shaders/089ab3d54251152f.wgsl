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
    member_9: i32,
    member_10: vec4<f32>,
    member_11: f32,
    member_12: vec4<f32>,
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
    var phi_12885_: f32;
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
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
    let _e88 = global_9.member_13;
    let _e99 = (smoothstep(0.5f, 0.6f, _e84.w) * smoothstep(1f, 0.9f, _e84.w));
    let _e105 = global_9.member_7;
    let _e117 = mix(mix(mix(mix(mix(_e105.x, _e105.y, _e84.x), _e105.z, _e84.y), _e105.w, _e84.z), _e105.z, _e77.y), _e105.w, _e77.z);
    let _e118 = (((((_e75.w + (_e81.x * _e75.x)) * ((_e88 * 6f) + 1f)) + _e99) * max(clamp((_e77.y + _e77.z), 0f, 1f), smoothstep(0f, 0.5f, _e84.w))) * _e117);
    let _e120 = global_9.member_1;
    let _e121 = (_e120 * _e117);
    let _e126 = (0.56f - (0.06f * _e88));
    let _e130 = (0.54f - (_e88 * 0.12f));
    let _e140 = (_e84.xyz * vec3<f32>(smoothstep((0.58f + _e121), (_e126 - _e121), _e118), smoothstep((_e126 + _e121), (_e130 - _e121), _e118), smoothstep((_e130 + _e121), ((0.52f - (_e88 * 0.17999999f)) - _e121), _e118)).xyz);
    let _e146 = smoothstep((0.58f - _e121), (0.68f + _e121), _e118);
    let _e151 = textureSample(global_10, global_6, _e79.zw);
    let _e158 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e151, vec4(((pow((1f - _e75.x), 4f) * 0.25f) + (0.75f * _e88))));
    let _e160 = global_9.member_12;
    let _e169 = mix(mix(mix(mix(mix(_e160.x, _e160.y, _e140.x), _e160.z, _e140.y), _e160.w, _e140.z), _e160.z, _e77.y), _e160.w, _e77.z);
    let _e171 = global_9.member;
    phi_7078_ = vec4<f32>(_e71.xy, 0f, 1f);
    if (_e171 != 0i) {
        let _e173 = textureSample(global_11, global_2, _e74);
        let _e181 = global_9.member_9;
        let _e182 = (_e181 != 0i);
        if _e182 {
            let _e184 = global_9.member_10;
            phi_12885_ = mix(mix(mix(_e184.x, _e184.y, _e140.x), _e184.z, _e140.y), _e184.w, _e140.z);
        } else {
            let _e193 = global_9.member_8;
            phi_12885_ = _e193;
        }
        let _e195 = phi_12885_;
        phi_20271_ = _e195;
        if _e182 {
            let _e197 = global_9.member_10;
            phi_20271_ = mix(mix(_e195, _e197.z, _e77.y), _e197.w, _e77.z);
        }
        let _e203 = phi_20271_;
        let _e213 = mix(vec4<f32>(min(1f, (_e203 + ((((1f - _e158.w) * _e88) * _e88) * 0.5f))), _e169, 0f, 1f), vec4<f32>(_e173.x, _e173.y, _e173.z, _e173.w), vec4(_e146));
        let _e214 = (1f - _e146);
        let _e221 = global_9.member_11;
        let _e223 = vec4<f32>(_e213.x, _e213.y, _e214, _e213.w).xyz;
        let _e224 = (_e223 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e227 = pow(((_e223 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e213.x <= 0.04045f) {
            phi_21354_ = _e224.x;
        } else {
            phi_21354_ = _e227.x;
        }
        let _e233 = phi_21354_;
        if (_e213.y <= 0.04045f) {
            phi_23035_ = _e224.y;
        } else {
            phi_23035_ = _e227.y;
        }
        let _e239 = phi_23035_;
        if (_e214 <= 0.04045f) {
            phi_19513_ = _e224.z;
        } else {
            phi_19513_ = _e227.z;
        }
        let _e244 = phi_19513_;
        let _e245 = vec4<f32>(_e233, _e239, _e214, min(1f, _e221));
        phi_7078_ = vec4<f32>(_e245.x, _e245.y, _e244, _e245.w);
    }
    let _e252 = phi_7078_;
    phi_22401_ = _e252;
    if (_e171 == 0i) {
        let _e254 = textureSample(global_12, global_2, _e74);
        let _e257 = global_9.member_2;
        let _e259 = global_9.member_3;
        let _e263 = global_9.member_4;
        let _e267 = global_9.member_5;
        let _e274 = global_9.member_6;
        let _e277 = clamp((mix(mix(mix(mix(mix(_e257, _e259, vec3(_e140.x)), _e263, vec3(_e140.y)), _e267, vec3(_e140.z)), _e263, vec3(_e77.y)), _e267, vec3(_e77.z)) * mix(_e274, 1f, (smoothstep(0f, 0.01f, _e146) * (1f - _e99)))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e280 = (_e277.xyz * _e158.xyz);
        let _e285 = global_9.member_14;
        let _e287 = global_9.member_15;
        let _e290 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e280.xyz));
        let _e298 = mix(_e285.xyz, _e287.xyz, vec3(_e169));
        let _e320 = mix(mix(_e280, ((_e290.xyz * mix(min(_e298.x, dot(_e277.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e298.z, clamp(pow(max(_e280.x, max(_e280.y, _e280.z)), _e298.y), 0f, 1f))) / vec3(max(_e290.x, max(_e290.y, _e290.z)))).xyz, vec3(_e88)), _e254.xyz, vec3(_e146));
        phi_22401_ = vec4<f32>(_e320.x, _e320.y, _e320.z, 1f);
    }
    let _e326 = phi_22401_;
    let _e327 = textureSample(global_13, global_6, _e74);
    phi_22402_ = _e326;
    if (_e327.w < 0f) {
        let _e335 = vec4<f32>(_e327.x, _e326.y, _e326.z, _e326.w);
        let _e341 = vec4<f32>(_e335.x, _e327.y, _e335.z, _e335.w);
        phi_22402_ = vec4<f32>(_e341.x, _e341.y, _e327.z, _e341.w);
    }
    let _e349 = phi_22402_;
    let _e350 = textureSample(global_14, global_6, _e74);
    phi_6805_ = _e349;
    if (_e350.w < 0f) {
        let _e358 = vec4<f32>(_e350.x, _e349.y, _e349.z, _e349.w);
        let _e364 = vec4<f32>(_e358.x, _e350.y, _e358.z, _e358.w);
        phi_6805_ = vec4<f32>(_e364.x, _e364.y, _e350.z, _e364.w);
    }
    let _e372 = phi_6805_;
    global_15 = _e372;
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
