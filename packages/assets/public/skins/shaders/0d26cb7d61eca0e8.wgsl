struct type_8 {
    member: i32,
    member_1: f32,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: vec4<f32>,
    member_7: f32,
    member_8: i32,
    member_9: vec4<f32>,
    member_10: f32,
    member_11: vec4<f32>,
    member_12: f32,
    member_13: f32,
    member_14: f32,
    member_15: f32,
    member_16: vec4<f32>,
    member_17: vec3<f32>,
    member_18: vec3<f32>,
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
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(41) 
var global_11: texture_2d<f32>;
@group(1) @binding(40) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(34) 
var global_14: texture_2d<f32>;
@group(1) @binding(37) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e77 = global;
    let _e80 = _e77.xy;
    let _e81 = textureSample(global_1, global_2, _e80);
    let _e84 = textureSample(global_3, global_2, _e80);
    let _e86 = global_4;
    let _e88 = textureSample(global_5, global_6, _e86.xy);
    let _e91 = textureSample(global_7, global_8, _e77.zw);
    let _e92 = textureSample(global_9, global_6, _e80);
    let _e95 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e92, (vec4<f32>(1f, 1f, 1f, 1f) - _e92)));
    let _e102 = global_10.member_14;
    let _e106 = (mix(0.5f, pow(_e81.x, 0.85f), _e102) * mix(1f, (_e81.y * (min(_e95.x, _e95.y) * 2f)), _e102));
    let _e107 = (_e106 * 2f);
    let _e111 = global_10.member_13;
    let _e120 = global_10.member_15;
    let _e121 = (max((_e91.y * _e111), (((1f - _e81.y) * 0.2f) * _e102)) + _e120);
    let _e122 = _e77.zw;
    let _e125 = textureSample(global_7, global_8, (_e122 + vec2<f32>(0.00048828125f, 0.00048828125f)).xy);
    let _e128 = textureSample(global_7, global_8, (_e122 + vec2<f32>(-0.00048828125f, -0.00048828125f)).xy);
    let _e131 = textureSample(global_7, global_8, (_e122 + vec2<f32>(-0.00048828125f, 0.00048828125f)).xy);
    let _e134 = textureSample(global_7, global_8, (_e122 + vec2<f32>(0.00048828125f, -0.00048828125f)).xy);
    let _e148 = textureSample(global_11, global_2, vec2<f32>(mix(_e107, (_e106 + _e91.x), _e111), _e121));
    let _e151 = textureSample(global_11, global_2, vec2<f32>(mix(_e107, (_e106 + _e125.x), _e111), _e121));
    let _e156 = textureSample(global_11, global_2, vec2<f32>(mix(_e107, (_e106 + _e128.x), _e111), _e121));
    let _e161 = textureSample(global_11, global_2, vec2<f32>(mix(_e107, (_e106 + _e131.x), _e111), _e121));
    let _e166 = textureSample(global_11, global_2, vec2<f32>(mix(_e107, (_e106 + _e134.x), _e111), _e121));
    let _e174 = global_10.member_12;
    let _e179 = global_10.member_6;
    let _e189 = mix(mix(mix(_e179.x, _e179.y, _e84.x), _e179.z, _e84.y), _e179.w, _e84.z);
    let _e192 = global_10.member_1;
    let _e193 = (_e192 * _e189);
    let _e196 = smoothstep((0.58f - _e193), (0.68f + _e193), (((_e81.w + (_e88.x * _e81.x)) * ((_e174 * 6f) + 1f)) * _e189));
    let _e198 = textureSample(global_12, global_6, _e86.zw);
    let _e205 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e198, vec4(((pow((1f - _e81.x), 4f) * 0.25f) + (0.75f * _e174))));
    let _e207 = global_10.member_11;
    let _e214 = mix(mix(mix(_e207.x, _e207.y, _e84.x), _e207.z, _e84.y), _e207.w, _e84.z);
    let _e216 = global_10.member;
    phi_7078_ = vec4<f32>(_e77.xy, 0f, 1f);
    if (_e216 != 0i) {
        let _e218 = textureSample(global_13, global_2, _e80);
        let _e226 = global_10.member_8;
        if (_e226 != 0i) {
            let _e229 = global_10.member_9;
            phi_20271_ = mix(mix(mix(_e229.x, _e229.y, _e84.x), _e229.z, _e84.y), _e229.w, _e84.z);
        } else {
            let _e238 = global_10.member_7;
            phi_20271_ = _e238;
        }
        let _e240 = phi_20271_;
        let _e250 = mix(vec4<f32>(min(1f, (_e240 + ((((1f - _e205.w) * _e174) * _e174) * 0.5f))), _e214, 0f, 1f), vec4<f32>(_e218.x, _e218.y, _e218.z, _e218.w), vec4(_e196));
        let _e251 = (1f - _e196);
        let _e258 = global_10.member_10;
        let _e260 = vec4<f32>(_e250.x, _e250.y, _e251, _e250.w).xyz;
        let _e261 = (_e260 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e264 = pow(((_e260 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e250.x <= 0.04045f) {
            phi_21354_ = _e261.x;
        } else {
            phi_21354_ = _e264.x;
        }
        let _e270 = phi_21354_;
        if (_e250.y <= 0.04045f) {
            phi_23035_ = _e261.y;
        } else {
            phi_23035_ = _e264.y;
        }
        let _e276 = phi_23035_;
        if (_e251 <= 0.04045f) {
            phi_19513_ = _e261.z;
        } else {
            phi_19513_ = _e264.z;
        }
        let _e281 = phi_19513_;
        let _e282 = vec4<f32>(_e270, _e276, _e251, min(1f, _e258));
        phi_7078_ = vec4<f32>(_e282.x, _e282.y, _e281, _e282.w);
    }
    let _e289 = phi_7078_;
    phi_22401_ = _e289;
    if (_e216 == 0i) {
        let _e291 = textureSample(global_14, global_2, _e80);
        let _e293 = global_10.member_2;
        let _e295 = (((((_e148.xyzw + _e151.xyzw).xyzw + _e156.xyzw).xyzw + _e161.xyzw).xyzw + _e166.xyzw).xyzw * 0.2f).xyz;
        let _e297 = global_10.member_16;
        let _e303 = global_10.member_3;
        let _e312 = global_10.member_4;
        let _e321 = global_10.member_5;
        let _e327 = mix(mix(mix(mix(_e293.xyz, _e295, vec3(_e297.x)).xyz, mix(_e303.xyz, _e295, vec3(_e297.y)), vec3(_e84.x)).xyz, mix(_e312.xyz, _e295, vec3(_e297.z)), vec3(_e84.y)).xyz, mix(_e321.xyz, _e295, vec3(_e297.w)), vec3(_e84.z));
        let _e330 = (_e327.xyz * _e205.xyz);
        let _e335 = global_10.member_17;
        let _e337 = global_10.member_18;
        let _e340 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e330.xyz));
        let _e348 = mix(_e335.xyz, _e337.xyz, vec3(_e214));
        let _e370 = mix(mix(_e330, ((_e340.xyz * mix(min(_e348.x, dot(_e327.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e348.z, clamp(pow(max(_e330.x, max(_e330.y, _e330.z)), _e348.y), 0f, 1f))) / vec3(max(_e340.x, max(_e340.y, _e340.z)))).xyz, vec3(_e174)), _e291.xyz, vec3(_e196));
        phi_22401_ = vec4<f32>(_e370.x, _e370.y, _e370.z, 1f);
    }
    let _e376 = phi_22401_;
    let _e377 = textureSample(global_15, global_6, _e80);
    phi_6805_ = _e376;
    if (_e377.w < 0f) {
        let _e385 = vec4<f32>(_e377.x, _e376.y, _e376.z, _e376.w);
        let _e391 = vec4<f32>(_e385.x, _e377.y, _e385.z, _e385.w);
        phi_6805_ = vec4<f32>(_e391.x, _e391.y, _e377.z, _e391.w);
    }
    let _e399 = phi_6805_;
    global_16 = _e399;
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
