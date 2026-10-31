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
    member_10: f32,
    member_11: f32,
    member_12: f32,
    member_13: vec3<f32>,
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
    var phi_9051_: f32;
    var phi_10671_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e74 = global;
    let _e77 = _e74.xy;
    let _e78 = textureSample(global_1, global_2, _e77);
    let _e80 = textureSample(global_3, global_2, _e77);
    let _e82 = global_4;
    let _e84 = textureSample(global_5, global_6, _e82.xy);
    let _e86 = _e74.zw;
    let _e87 = textureSample(global_7, global_8, _e86);
    let _e91 = global_9.member_12;
    let _e98 = (smoothstep(0.5f, 0.6f, _e87.w) * smoothstep(1f, 0.9f, _e87.w));
    let _e101 = global_9.member_9;
    let _e115 = mix(mix(mix(mix(mix(_e101.x, _e101.y, _e87.x), _e101.z, _e87.y), _e101.w, _e87.z), _e101.z, _e80.y), _e101.w, _e80.z);
    let _e118 = global_9.member_3;
    let _e119 = (_e118 * _e115);
    let _e122 = smoothstep((0.58f - _e119), (0.68f + _e119), ((((_e78.w + (_e84.x * _e78.x)) * ((_e91 * 6f) + 1f)) + _e98) * _e115));
    let _e128 = max((1f - _e80.x), _e122);
    let _e129 = ((smoothstep(0f, 0.01f, _e122) * (1f - _e98)) * _e80.x);
    let _e131 = textureSample(global_10, global_6, _e82.zw);
    let _e138 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e131, vec4(((pow((1f - _e78.x), 4f) * 0.25f) + (0.75f * _e91))));
    let _e140 = global_9.member;
    phi_7078_ = vec4<f32>(_e74.xy, 0f, 1f);
    if (_e140 != 0i) {
        let _e142 = textureSample(global_11, global_2, _e77);
        let _e144 = (1f - _e128);
        let _e147 = global_9.member_1;
        if (_e147 != 0i) {
            let _e149 = textureSample(global_12, global_6, _e86);
            phi_9051_ = _e149.x;
        } else {
            let _e151 = textureSample(global_12, global_6, _e77);
            phi_9051_ = _e151.x;
        }
        let _e154 = phi_9051_;
        let _e157 = (1f - min(1f, (_e87.w * 2f)));
        let _e164 = max(_e80.y, _e80.z);
        let _e167 = global_9.member_10;
        let _e181 = vec4<f32>(mix(_e142.x, min(1f, (mix(mix(mix((((_e157 * _e157) * 0.85f) + 0.15f), _e154, select(0f, 1f, (_e87.w >= 0.5f))), _e167, max(_e164, _e128)), 0.35f, _e129) + ((1f - dot(_e138.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))) * 0.2f))), max(0f, _e144)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e188 = vec4<f32>(_e181.x, mix(_e80.x, _e142.y, _e128), _e181.z, _e181.w);
        let _e190 = global_9.member_2;
        if (_e190 != 0i) {
            let _e192 = textureSample(global_13, global_6, _e86);
            phi_10671_ = vec4<f32>(_e188.x, _e188.y, (_e144 * _e192.x), _e188.w);
        } else {
            let _e200 = textureSample(global_13, global_6, _e77);
            let _e202 = (_e144 * _e200.x);
            phi_10671_ = vec4<f32>(_e188.x, _e188.y, (_e202 * _e202), _e188.w);
        }
        let _e210 = phi_10671_;
        let _e213 = (_e210.z * (1f - _e164));
        let _e220 = global_9.member_11;
        let _e222 = vec4<f32>(_e210.x, _e210.y, _e213, _e210.w).xyz;
        let _e223 = (_e222 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e226 = pow(((_e222 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e210.x <= 0.04045f) {
            phi_21354_ = _e223.x;
        } else {
            phi_21354_ = _e226.x;
        }
        let _e232 = phi_21354_;
        if (_e210.y <= 0.04045f) {
            phi_23035_ = _e223.y;
        } else {
            phi_23035_ = _e226.y;
        }
        let _e238 = phi_23035_;
        if (_e213 <= 0.04045f) {
            phi_19513_ = _e223.z;
        } else {
            phi_19513_ = _e226.z;
        }
        let _e243 = phi_19513_;
        let _e244 = vec4<f32>(_e232, _e238, _e213, min(1f, _e220));
        phi_7078_ = vec4<f32>(_e244.x, _e244.y, _e243, _e244.w);
    }
    let _e251 = phi_7078_;
    phi_22401_ = _e251;
    if (_e140 == 0i) {
        let _e253 = textureSample(global_14, global_2, _e77);
        let _e257 = global_9.member_4;
        let _e259 = global_9.member_5;
        let _e264 = global_9.member_6;
        let _e269 = global_9.member_7;
        let _e275 = _e253.xyz;
        let _e279 = vec3(_e129);
        let _e282 = global_9.member_8;
        let _e283 = mix(_e282, 1f, _e129);
        let _e287 = clamp((clamp((mix(mix(_e275, mix(mix(mix(mix(mix(_e257, _e259, vec3((_e87.x * _e80.x))), _e264, vec3((_e87.y * _e80.x))), _e269, vec3((_e87.z * _e80.x))), _e264, vec3(_e80.y)), _e269, vec3(_e80.z)).xyz, vec3(_e80.x)), vec3<f32>(0.38f, 0.37f, 0.35f), _e279) * _e283), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)) * _e283), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e289 = mix(_e138.xyz, vec3<f32>(1f, 1f, 1f), _e279);
        let _e295 = vec4<f32>(_e289.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e301 = vec4<f32>(_e295.x, _e289.y, _e295.z, _e295.w);
        let _e310 = (_e287.xyz * vec4<f32>(_e301.x, _e301.y, _e289.z, _e301.w).xyz);
        let _e315 = global_9.member_13;
        let _e318 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e310.xyz));
        let _e343 = mix(mix(_e310, ((_e318.xyz * mix(min(_e315.x, dot(_e287.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e315.z, clamp(pow(max(_e310.x, max(_e310.y, _e310.z)), _e315.y), 0f, 1f))) / vec3(max(_e318.x, max(_e318.y, _e318.z)))).xyz, vec3(_e91)), _e275, vec3(_e128));
        phi_22401_ = vec4<f32>(_e343.x, _e343.y, _e343.z, 1f);
    }
    let _e349 = phi_22401_;
    let _e350 = textureSample(global_15, global_6, _e77);
    phi_6805_ = _e349;
    if (_e350.w < 0f) {
        let _e358 = vec4<f32>(_e350.x, _e349.y, _e349.z, _e349.w);
        let _e364 = vec4<f32>(_e358.x, _e350.y, _e358.z, _e358.w);
        phi_6805_ = vec4<f32>(_e364.x, _e364.y, _e350.z, _e364.w);
    }
    let _e372 = phi_6805_;
    global_16 = _e372;
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
