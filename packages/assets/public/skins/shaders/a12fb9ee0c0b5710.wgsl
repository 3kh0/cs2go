struct type_8 {
    member: i32,
    member_1: f32,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: vec4<f32>,
    member_7: i32,
    member_8: vec4<f32>,
    member_9: f32,
    member_10: vec4<f32>,
    member_11: f32,
    member_12: f32,
    member_13: f32,
    member_14: f32,
    member_15: vec4<f32>,
    member_16: vec3<f32>,
    member_17: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(41) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(40) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(43) 
var global_11: texture_2d<f32>;
@group(1) @binding(42) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(37) 
var global_14: texture_2d<f32>;
@group(1) @binding(38) 
var global_15: texture_2d<f32>;
@group(1) @binding(34) 
var global_16: texture_2d<f32>;
@group(1) @binding(39) 
var global_17: texture_2d<f32>;
var<private> global_18: vec4<f32>;

fn function_() {
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e78 = global;
    let _e81 = _e78.xy;
    let _e82 = textureSample(global_1, global_2, _e81);
    let _e85 = textureSample(global_3, global_2, _e81);
    let _e87 = global_4;
    let _e89 = textureSample(global_5, global_6, _e87.xy);
    let _e92 = textureSample(global_7, global_8, _e78.zw);
    let _e93 = textureSample(global_9, global_6, _e81);
    let _e96 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e93, (vec4<f32>(1f, 1f, 1f, 1f) - _e93)));
    let _e103 = global_10.member_13;
    let _e107 = (mix(0.5f, pow(_e82.x, 0.85f), _e103) * mix(1f, (_e82.y * (min(_e96.x, _e96.y) * 2f)), _e103));
    let _e108 = (_e107 * 2f);
    let _e112 = global_10.member_12;
    let _e121 = global_10.member_14;
    let _e122 = (max((_e92.y * _e112), (((1f - _e82.y) * 0.2f) * _e103)) + _e121);
    let _e123 = _e78.zw;
    let _e126 = textureSample(global_7, global_8, (_e123 + vec2<f32>(0.00048828125f, 0.00048828125f)).xy);
    let _e129 = textureSample(global_7, global_8, (_e123 + vec2<f32>(-0.00048828125f, -0.00048828125f)).xy);
    let _e132 = textureSample(global_7, global_8, (_e123 + vec2<f32>(-0.00048828125f, 0.00048828125f)).xy);
    let _e135 = textureSample(global_7, global_8, (_e123 + vec2<f32>(0.00048828125f, -0.00048828125f)).xy);
    let _e149 = textureSample(global_11, global_2, vec2<f32>(mix(_e108, (_e107 + _e92.x), _e112), _e122));
    let _e152 = textureSample(global_11, global_2, vec2<f32>(mix(_e108, (_e107 + _e126.x), _e112), _e122));
    let _e157 = textureSample(global_11, global_2, vec2<f32>(mix(_e108, (_e107 + _e129.x), _e112), _e122));
    let _e162 = textureSample(global_11, global_2, vec2<f32>(mix(_e108, (_e107 + _e132.x), _e112), _e122));
    let _e167 = textureSample(global_11, global_2, vec2<f32>(mix(_e108, (_e107 + _e135.x), _e112), _e122));
    let _e175 = global_10.member_11;
    let _e180 = global_10.member_6;
    let _e190 = mix(mix(mix(_e180.x, _e180.y, _e85.x), _e180.z, _e85.y), _e180.w, _e85.z);
    let _e193 = global_10.member_1;
    let _e194 = (_e193 * _e190);
    let _e197 = smoothstep((0.58f - _e194), (0.68f + _e194), (((_e82.w + (_e89.x * _e82.x)) * ((_e175 * 6f) + 1f)) * _e190));
    let _e199 = textureSample(global_12, global_6, _e87.zw);
    let _e206 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e199, vec4(((pow((1f - _e82.x), 4f) * 0.25f) + (0.75f * _e175))));
    let _e208 = global_10.member_10;
    let _e215 = mix(mix(mix(_e208.x, _e208.y, _e85.x), _e208.z, _e85.y), _e208.w, _e85.z);
    let _e217 = global_10.member;
    phi_7078_ = vec4<f32>(_e78.xy, 0f, 1f);
    if (_e217 != 0i) {
        let _e219 = textureSample(global_13, global_2, _e81);
        let _e226 = textureSample(global_14, global_6, _e81);
        let _e229 = global_10.member_7;
        if (_e229 != 0i) {
            let _e232 = global_10.member_8;
            phi_20271_ = mix(mix(mix(_e232.x, _e232.y, _e85.x), _e232.z, _e85.y), _e232.w, _e85.z);
        } else {
            phi_20271_ = _e226.x;
        }
        let _e241 = phi_20271_;
        let _e251 = mix(vec4<f32>(min(1f, (_e241 + ((((1f - _e206.w) * _e175) * _e175) * 0.5f))), _e215, 0f, 1f), vec4<f32>(_e219.x, _e219.y, _e219.z, _e219.w), vec4(_e197));
        let _e253 = textureSample(global_15, global_6, _e81);
        let _e255 = ((1f - _e197) * _e253.x);
        let _e262 = global_10.member_9;
        let _e264 = vec4<f32>(_e251.x, _e251.y, _e255, _e251.w).xyz;
        let _e265 = (_e264 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e268 = pow(((_e264 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e251.x <= 0.04045f) {
            phi_21354_ = _e265.x;
        } else {
            phi_21354_ = _e268.x;
        }
        let _e274 = phi_21354_;
        if (_e251.y <= 0.04045f) {
            phi_23035_ = _e265.y;
        } else {
            phi_23035_ = _e268.y;
        }
        let _e280 = phi_23035_;
        if (_e255 <= 0.04045f) {
            phi_19513_ = _e265.z;
        } else {
            phi_19513_ = _e268.z;
        }
        let _e285 = phi_19513_;
        let _e286 = vec4<f32>(_e274, _e280, _e255, min(1f, _e262));
        phi_7078_ = vec4<f32>(_e286.x, _e286.y, _e285, _e286.w);
    }
    let _e293 = phi_7078_;
    phi_22401_ = _e293;
    if (_e217 == 0i) {
        let _e295 = textureSample(global_16, global_2, _e81);
        let _e297 = global_10.member_2;
        let _e299 = (((((_e149.xyzw + _e152.xyzw).xyzw + _e157.xyzw).xyzw + _e162.xyzw).xyzw + _e167.xyzw).xyzw * 0.2f).xyz;
        let _e301 = global_10.member_15;
        let _e307 = global_10.member_3;
        let _e316 = global_10.member_4;
        let _e325 = global_10.member_5;
        let _e331 = mix(mix(mix(mix(_e297.xyz, _e299, vec3(_e301.x)).xyz, mix(_e307.xyz, _e299, vec3(_e301.y)), vec3(_e85.x)).xyz, mix(_e316.xyz, _e299, vec3(_e301.z)), vec3(_e85.y)).xyz, mix(_e325.xyz, _e299, vec3(_e301.w)), vec3(_e85.z));
        let _e334 = (_e331.xyz * _e206.xyz);
        let _e339 = global_10.member_16;
        let _e341 = global_10.member_17;
        let _e344 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e334.xyz));
        let _e352 = mix(_e339.xyz, _e341.xyz, vec3(_e215));
        let _e374 = mix(mix(_e334, ((_e344.xyz * mix(min(_e352.x, dot(_e331.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e352.z, clamp(pow(max(_e334.x, max(_e334.y, _e334.z)), _e352.y), 0f, 1f))) / vec3(max(_e344.x, max(_e344.y, _e344.z)))).xyz, vec3(_e175)), _e295.xyz, vec3(_e197));
        phi_22401_ = vec4<f32>(_e374.x, _e374.y, _e374.z, 1f);
    }
    let _e380 = phi_22401_;
    let _e381 = textureSample(global_17, global_6, _e81);
    phi_6805_ = _e380;
    if (_e381.w < 0f) {
        let _e389 = vec4<f32>(_e381.x, _e380.y, _e380.z, _e380.w);
        let _e395 = vec4<f32>(_e389.x, _e381.y, _e389.z, _e389.w);
        phi_6805_ = vec4<f32>(_e395.x, _e395.y, _e381.z, _e395.w);
    }
    let _e403 = phi_6805_;
    global_18 = _e403;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_18;
    return _e5;
}
