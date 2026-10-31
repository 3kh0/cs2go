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
@group(1) @binding(38) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(37) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(39) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(34) 
var global_12: texture_2d<f32>;
@group(1) @binding(36) 
var global_13: texture_2d<f32>;
var<private> global_14: vec4<f32>;

fn function_() {
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e61 = global;
    let _e64 = _e61.xy;
    let _e65 = textureSample(global_1, global_2, _e64);
    let _e68 = textureSample(global_3, global_2, _e64);
    let _e70 = global_4;
    let _e72 = textureSample(global_5, global_6, _e70.xy);
    let _e75 = textureSample(global_7, global_8, _e61.zw);
    let _e77 = textureSample(global_9, global_6, _e70.zw);
    let _e89 = global_10.member_9;
    let _e93 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e77, vec4(((pow((1f - _e65.x), 4f) * 0.25f) + (0.75f * _e89))));
    let _e98 = smoothstep(0.1f, 0.2f, (((_e72.x * _e65.y) * (_e65.x * _e65.x)) * _e89));
    let _e105 = smoothstep(0f, 0.15f, ((clamp(((_e65.x * _e65.y) - (_e89 * 0.1f)), 0f, 1f) - (clamp(((_e77.x * _e77.y) * _e77.z), 0f, 1f) * 0.23f)) + 0.08f));
    let _e107 = global_10.member;
    if (_e107 != 0i) {
        let _e109 = textureSample(global_11, global_2, _e64);
        let _e116 = global_10.member_7;
        let _e119 = dot(_e93.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e130 = ((1f - _e93.w) * _e89);
        let _e133 = clamp(((((_e116 * mix(1f, 0.9f, _e98)) + (((1f - _e119) * _e89) * 0.05f)) + (((1f - _e105) * 0.15f) * _e89)) + (_e130 * 0.15f)), 0f, 1f);
        let _e143 = mix(mix(1f, pow(((_e105 * _e93.w) * _e119), 0.5f), _e89), 1f, _e98);
        let _e144 = mix(_e109.x, mix(min(1f, (_e133 + ((_e130 * _e89) * 0.5f))), _e133, _e68.x), (step(_e65.w, 0.996f) * _e68.x));
        let _e146 = mix(_e109.y, _e143, _e68.x);
        let _e147 = (1f - _e65.w);
        let _e149 = global_10.member_8;
        let _e151 = vec4<f32>(_e144, _e146, _e147, min(1f, _e149));
        let _e152 = _e151.xyz;
        let _e153 = (_e152 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e156 = pow(((_e152 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e144 <= 0.04045f) {
            phi_23035_ = _e153.x;
        } else {
            phi_23035_ = _e156.x;
        }
        let _e161 = phi_23035_;
        if (_e146 <= 0.04045f) {
            phi_23036_ = _e153.y;
        } else {
            phi_23036_ = _e156.y;
        }
        let _e166 = phi_23036_;
        if (_e147 <= 0.04045f) {
            phi_19167_ = _e153.z;
        } else {
            phi_19167_ = _e156.z;
        }
        let _e171 = phi_19167_;
        let _e176 = vec4<f32>(_e161, _e151.y, _e151.z, _e151.w);
        let _e181 = vec4<f32>(_e176.x, _e166, _e176.z, _e176.w);
        phi_11711_ = vec4<f32>(_e181.x, _e181.y, _e171, _e181.w);
        phi_10247_ = _e143;
    } else {
        phi_11711_ = vec4<f32>(_e61.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e188 = phi_11711_;
    let _e190 = phi_10247_;
    phi_22401_ = _e188;
    if (_e107 == 0i) {
        let _e192 = textureSample(global_12, global_2, _e64);
        let _e194 = vec3(_e89);
        let _e196 = global_10.member_2;
        let _e198 = global_10.member_3;
        let _e200 = _e75.xyz;
        let _e202 = global_10.member_5;
        let _e206 = global_10.member_6;
        let _e210 = mix(_e200, (_e200 * _e202), vec3(max(_e68.x, f32(_e206))));
        let _e216 = vec4<f32>(_e210.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e222 = vec4<f32>(_e216.x, _e210.y, _e216.z, _e216.w);
        let _e228 = vec4<f32>(_e222.x, _e222.y, _e210.z, _e222.w);
        let _e232 = global_10.member_4;
        let _e236 = _e228.xyz;
        let _e240 = global_10.member_1;
        let _e248 = (mix((mix(mix(_e196, _e232, vec3(pow(_e89, 0.5f))), mix(_e196, _e198, _e194), vec3(_e105)) * _e236), (_e240 * dot(_e228.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e98)).xyz * _e93.xyz);
        let _e253 = global_10.member_10;
        let _e255 = global_10.member_11;
        let _e258 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e248.xyz));
        let _e266 = mix(_e253.xyz, _e255.xyz, vec3(_e190));
        let _e287 = mix(mix(_e248, ((_e258.xyz * mix(min(_e266.x, dot((_e236 * _e196).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e266.z, clamp(pow(max(_e248.x, max(_e248.y, _e248.z)), _e266.y), 0f, 1f))) / vec3(max(_e258.x, max(_e258.y, _e258.z)))).xyz, _e194), _e192.xyz, vec3((1f - _e68.x)));
        phi_22401_ = vec4<f32>(_e287.x, _e287.y, _e287.z, 1f);
    }
    let _e293 = phi_22401_;
    let _e294 = textureSample(global_13, global_6, _e64);
    phi_6805_ = _e293;
    if (_e294.w < 0f) {
        let _e302 = vec4<f32>(_e294.x, _e293.y, _e293.z, _e293.w);
        let _e308 = vec4<f32>(_e302.x, _e294.y, _e302.z, _e302.w);
        phi_6805_ = vec4<f32>(_e308.x, _e308.y, _e294.z, _e308.w);
    }
    let _e316 = phi_6805_;
    global_14 = _e316;
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
