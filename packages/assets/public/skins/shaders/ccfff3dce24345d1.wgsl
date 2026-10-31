struct type_8 {
    member: i32,
    member_1: vec3<f32>,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: f32,
    member_6: i32,
    member_7: f32,
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
@group(1) @binding(39) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(38) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(40) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
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
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e62 = global;
    let _e65 = _e62.xy;
    let _e66 = textureSample(global_1, global_2, _e65);
    let _e69 = textureSample(global_3, global_2, _e65);
    let _e71 = global_4;
    let _e73 = textureSample(global_5, global_6, _e71.xy);
    let _e76 = textureSample(global_7, global_8, _e62.zw);
    let _e78 = textureSample(global_9, global_6, _e71.zw);
    let _e90 = global_10.member_9;
    let _e94 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e78, vec4(((pow((1f - _e66.x), 4f) * 0.25f) + (0.75f * _e90))));
    let _e99 = smoothstep(0.1f, 0.2f, (((_e73.x * _e66.y) * (_e66.x * _e66.x)) * _e90));
    let _e106 = smoothstep(0f, 0.15f, ((clamp(((_e66.x * _e66.y) - (_e90 * 0.1f)), 0f, 1f) - (clamp(((_e78.x * _e78.y) * _e78.z), 0f, 1f) * 0.23f)) + 0.08f));
    let _e108 = global_10.member;
    if (_e108 != 0i) {
        let _e110 = textureSample(global_11, global_2, _e65);
        let _e117 = global_10.member_7;
        let _e120 = dot(_e94.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e131 = ((1f - _e94.w) * _e90);
        let _e134 = clamp(((((_e117 * mix(1f, 0.9f, _e99)) + (((1f - _e120) * _e90) * 0.05f)) + (((1f - _e106) * 0.15f) * _e90)) + (_e131 * 0.15f)), 0f, 1f);
        let _e144 = mix(mix(1f, pow(((_e106 * _e94.w) * _e120), 0.5f), _e90), 1f, _e99);
        let _e145 = mix(_e110.x, mix(min(1f, (_e134 + ((_e131 * _e90) * 0.5f))), _e134, _e69.x), (step(_e66.w, 0.996f) * _e69.x));
        let _e147 = mix(_e110.y, _e144, _e69.x);
        let _e148 = (1f - _e66.w);
        let _e150 = global_10.member_8;
        let _e152 = vec4<f32>(_e145, _e147, _e148, min(1f, _e150));
        let _e153 = _e152.xyz;
        let _e154 = (_e153 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e157 = pow(((_e153 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e145 <= 0.04045f) {
            phi_23035_ = _e154.x;
        } else {
            phi_23035_ = _e157.x;
        }
        let _e162 = phi_23035_;
        if (_e147 <= 0.04045f) {
            phi_23036_ = _e154.y;
        } else {
            phi_23036_ = _e157.y;
        }
        let _e167 = phi_23036_;
        if (_e148 <= 0.04045f) {
            phi_19167_ = _e154.z;
        } else {
            phi_19167_ = _e157.z;
        }
        let _e172 = phi_19167_;
        let _e177 = vec4<f32>(_e162, _e152.y, _e152.z, _e152.w);
        let _e182 = vec4<f32>(_e177.x, _e167, _e177.z, _e177.w);
        phi_11711_ = vec4<f32>(_e182.x, _e182.y, _e172, _e182.w);
        phi_10247_ = _e144;
    } else {
        phi_11711_ = vec4<f32>(_e62.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e189 = phi_11711_;
    let _e191 = phi_10247_;
    phi_22401_ = _e189;
    if (_e108 == 0i) {
        let _e193 = textureSample(global_12, global_2, _e65);
        let _e195 = vec3(_e90);
        let _e197 = global_10.member_2;
        let _e199 = global_10.member_3;
        let _e201 = _e76.xyz;
        let _e203 = global_10.member_5;
        let _e207 = global_10.member_6;
        let _e211 = mix(_e201, (_e201 * _e203), vec3(max(_e69.x, f32(_e207))));
        let _e217 = vec4<f32>(_e211.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e223 = vec4<f32>(_e217.x, _e211.y, _e217.z, _e217.w);
        let _e229 = vec4<f32>(_e223.x, _e223.y, _e211.z, _e223.w);
        let _e233 = global_10.member_4;
        let _e237 = _e229.xyz;
        let _e241 = global_10.member_1;
        let _e249 = (mix((mix(mix(_e197, _e233, vec3(pow(_e90, 0.5f))), mix(_e197, _e199, _e195), vec3(_e106)) * _e237), (_e241 * dot(_e229.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e99)).xyz * _e94.xyz);
        let _e254 = global_10.member_10;
        let _e256 = global_10.member_11;
        let _e259 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e249.xyz));
        let _e267 = mix(_e254.xyz, _e256.xyz, vec3(_e191));
        let _e288 = mix(mix(_e249, ((_e259.xyz * mix(min(_e267.x, dot((_e237 * _e197).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e267.z, clamp(pow(max(_e249.x, max(_e249.y, _e249.z)), _e267.y), 0f, 1f))) / vec3(max(_e259.x, max(_e259.y, _e259.z)))).xyz, _e195), _e193.xyz, vec3((1f - _e69.x)));
        phi_22401_ = vec4<f32>(_e288.x, _e288.y, _e288.z, 1f);
    }
    let _e294 = phi_22401_;
    let _e295 = textureSample(global_13, global_6, _e65);
    phi_22402_ = _e294;
    if (_e295.w < 0f) {
        let _e303 = vec4<f32>(_e295.x, _e294.y, _e294.z, _e294.w);
        let _e309 = vec4<f32>(_e303.x, _e295.y, _e303.z, _e303.w);
        phi_22402_ = vec4<f32>(_e309.x, _e309.y, _e295.z, _e309.w);
    }
    let _e317 = phi_22402_;
    let _e318 = textureSample(global_14, global_6, _e65);
    phi_6805_ = _e317;
    if (_e318.w < 0f) {
        let _e326 = vec4<f32>(_e318.x, _e317.y, _e317.z, _e317.w);
        let _e332 = vec4<f32>(_e326.x, _e318.y, _e326.z, _e326.w);
        phi_6805_ = vec4<f32>(_e332.x, _e332.y, _e318.z, _e332.w);
    }
    let _e340 = phi_6805_;
    global_15 = _e340;
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
