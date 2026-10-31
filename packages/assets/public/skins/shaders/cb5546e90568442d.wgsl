struct type_8 {
    member: i32,
    member_1: i32,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: f32,
    member_7: i32,
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
@group(1) @binding(40) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(39) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(41) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(35) 
var global_11: texture_2d<f32>;
@group(1) @binding(37) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
@group(1) @binding(38) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_7735_: f32;
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e63 = global;
    let _e66 = _e63.xy;
    let _e67 = textureSample(global_1, global_2, _e66);
    let _e70 = textureSample(global_3, global_2, _e66);
    let _e72 = global_4;
    let _e74 = textureSample(global_5, global_6, _e72.xy);
    let _e76 = _e63.zw;
    let _e77 = textureSample(global_7, global_8, _e76);
    let _e79 = textureSample(global_9, global_6, _e72.zw);
    let _e91 = global_10.member_9;
    let _e95 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e79, vec4(((pow((1f - _e67.x), 4f) * 0.25f) + (0.75f * _e91))));
    let _e100 = smoothstep(0.1f, 0.2f, (((_e74.x * _e67.y) * (_e67.x * _e67.x)) * _e91));
    let _e107 = smoothstep(0f, 0.15f, ((clamp(((_e67.x * _e67.y) - (_e91 * 0.1f)), 0f, 1f) - (clamp(((_e79.x * _e79.y) * _e79.z), 0f, 1f) * 0.23f)) + 0.08f));
    let _e109 = global_10.member;
    if (_e109 != 0i) {
        let _e111 = textureSample(global_11, global_2, _e66);
        let _e114 = global_10.member_1;
        if (_e114 != 0i) {
            let _e116 = textureSample(global_12, global_6, _e76);
            phi_7735_ = _e116.x;
        } else {
            let _e118 = textureSample(global_12, global_6, _e66);
            phi_7735_ = _e118.x;
        }
        let _e121 = phi_7735_;
        let _e128 = dot(_e95.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e139 = ((1f - _e95.w) * _e91);
        let _e142 = clamp(((((_e121 * mix(1f, 0.9f, _e100)) + (((1f - _e128) * _e91) * 0.05f)) + (((1f - _e107) * 0.15f) * _e91)) + (_e139 * 0.15f)), 0f, 1f);
        let _e152 = mix(mix(1f, pow(((_e107 * _e95.w) * _e128), 0.5f), _e91), 1f, _e100);
        let _e153 = mix(_e111.x, mix(min(1f, (_e142 + ((_e139 * _e91) * 0.5f))), _e142, _e70.x), (step(_e67.w, 0.996f) * _e70.x));
        let _e155 = mix(_e111.y, _e152, _e70.x);
        let _e156 = (1f - _e67.w);
        let _e158 = global_10.member_8;
        let _e160 = vec4<f32>(_e153, _e155, _e156, min(1f, _e158));
        let _e161 = _e160.xyz;
        let _e162 = (_e161 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e165 = pow(((_e161 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e153 <= 0.04045f) {
            phi_23035_ = _e162.x;
        } else {
            phi_23035_ = _e165.x;
        }
        let _e170 = phi_23035_;
        if (_e155 <= 0.04045f) {
            phi_23036_ = _e162.y;
        } else {
            phi_23036_ = _e165.y;
        }
        let _e175 = phi_23036_;
        if (_e156 <= 0.04045f) {
            phi_19167_ = _e162.z;
        } else {
            phi_19167_ = _e165.z;
        }
        let _e180 = phi_19167_;
        let _e185 = vec4<f32>(_e170, _e160.y, _e160.z, _e160.w);
        let _e190 = vec4<f32>(_e185.x, _e175, _e185.z, _e185.w);
        phi_11711_ = vec4<f32>(_e190.x, _e190.y, _e180, _e190.w);
        phi_10247_ = _e152;
    } else {
        phi_11711_ = vec4<f32>(_e63.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e197 = phi_11711_;
    let _e199 = phi_10247_;
    phi_22401_ = _e197;
    if (_e109 == 0i) {
        let _e201 = textureSample(global_13, global_2, _e66);
        let _e203 = vec3(_e91);
        let _e205 = global_10.member_3;
        let _e207 = global_10.member_4;
        let _e209 = _e77.xyz;
        let _e211 = global_10.member_6;
        let _e215 = global_10.member_7;
        let _e219 = mix(_e209, (_e209 * _e211), vec3(max(_e70.x, f32(_e215))));
        let _e225 = vec4<f32>(_e219.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e231 = vec4<f32>(_e225.x, _e219.y, _e225.z, _e225.w);
        let _e237 = vec4<f32>(_e231.x, _e231.y, _e219.z, _e231.w);
        let _e241 = global_10.member_5;
        let _e245 = _e237.xyz;
        let _e249 = global_10.member_2;
        let _e257 = (mix((mix(mix(_e205, _e241, vec3(pow(_e91, 0.5f))), mix(_e205, _e207, _e203), vec3(_e107)) * _e245), (_e249 * dot(_e237.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e100)).xyz * _e95.xyz);
        let _e262 = global_10.member_10;
        let _e264 = global_10.member_11;
        let _e267 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e257.xyz));
        let _e275 = mix(_e262.xyz, _e264.xyz, vec3(_e199));
        let _e296 = mix(mix(_e257, ((_e267.xyz * mix(min(_e275.x, dot((_e245 * _e205).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e275.z, clamp(pow(max(_e257.x, max(_e257.y, _e257.z)), _e275.y), 0f, 1f))) / vec3(max(_e267.x, max(_e267.y, _e267.z)))).xyz, _e203), _e201.xyz, vec3((1f - _e70.x)));
        phi_22401_ = vec4<f32>(_e296.x, _e296.y, _e296.z, 1f);
    }
    let _e302 = phi_22401_;
    let _e303 = textureSample(global_14, global_6, _e66);
    phi_22402_ = _e302;
    if (_e303.w < 0f) {
        let _e311 = vec4<f32>(_e303.x, _e302.y, _e302.z, _e302.w);
        let _e317 = vec4<f32>(_e311.x, _e303.y, _e311.z, _e311.w);
        phi_22402_ = vec4<f32>(_e317.x, _e317.y, _e303.z, _e317.w);
    }
    let _e325 = phi_22402_;
    let _e326 = textureSample(global_15, global_6, _e66);
    phi_6805_ = _e325;
    if (_e326.w < 0f) {
        let _e334 = vec4<f32>(_e326.x, _e325.y, _e325.z, _e325.w);
        let _e340 = vec4<f32>(_e334.x, _e326.y, _e334.z, _e334.w);
        phi_6805_ = vec4<f32>(_e340.x, _e340.y, _e326.z, _e340.w);
    }
    let _e348 = phi_6805_;
    global_16 = _e348;
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
