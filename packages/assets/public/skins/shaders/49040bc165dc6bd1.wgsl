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
    member_9: f32,
    member_10: f32,
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
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e76 = global;
    let _e79 = _e76.xy;
    let _e80 = textureSample(global_1, global_2, _e79);
    let _e83 = (pow(_e80.x, 1.5f) * 0.96f);
    let _e84 = textureSample(global_3, global_2, _e79);
    let _e86 = global_4;
    let _e88 = textureSample(global_5, global_6, _e86.xy);
    let _e91 = textureSample(global_7, global_8, _e76.zw);
    let _e96 = global_9.member_10;
    let _e107 = (smoothstep(0.5f, 0.6f, _e91.w) * smoothstep(1f, 0.9f, _e91.w));
    let _e110 = global_9.member_7;
    let _e124 = mix(mix(mix(mix(mix(_e110.x, _e110.y, _e91.x), _e110.z, _e91.y), _e110.w, _e91.z), _e110.z, _e84.y), _e110.w, _e84.z);
    let _e125 = ((((_e80.w + (_e88.x * mix(smoothstep(0f, 0.72f, pow(_e83, 1.3f)), smoothstep(0f, 0.4f, _e83), pow(_e96, 1.2f)))) * ((_e96 * 6f) + 1f)) + _e107) * _e124);
    let _e127 = global_9.member_1;
    let _e128 = (_e127 * _e124);
    let _e139 = max((1f - _e84.x), smoothstep((0.56f - _e128), (0.74f + _e128), _e125));
    let _e140 = ((smoothstep((0.53f - _e128), (0.72f + _e128), _e125) * (1f - _e107)) * _e84.x);
    let _e142 = textureSample(global_10, global_6, _e86.zw);
    let _e149 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e142, vec4(((pow((1f - _e83), 4f) * 0.25f) + (0.75f * _e96))));
    let _e151 = global_9.member;
    phi_7078_ = vec4<f32>(_e76.xy, 0f, 1f);
    if (_e151 != 0i) {
        let _e153 = textureSample(global_11, global_2, _e79);
        let _e155 = (1f - _e139);
        let _e159 = (1f - min(1f, (_e91.w * 2f)));
        let _e166 = global_9.member_8;
        let _e178 = mix(_e153.x, min(1f, (mix(mix(mix((((_e159 * _e159) * 0.85f) + 0.15f), _e166, select(0f, 1f, (_e91.w >= 0.5f))), _e166, max(max(_e84.y, _e84.z), _e139)), 0.35f, _e140) + ((1f - dot(_e149.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))) * 0.2f))), max(0f, _e155));
        let _e180 = mix(_e84.x, _e153.y, _e139);
        let _e182 = global_9.member_9;
        let _e184 = vec4<f32>(_e178, _e180, _e155, min(1f, _e182));
        let _e185 = _e184.xyz;
        let _e186 = (_e185 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e189 = pow(((_e185 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e178 <= 0.04045f) {
            phi_23035_ = _e186.x;
        } else {
            phi_23035_ = _e189.x;
        }
        let _e194 = phi_23035_;
        if (_e180 <= 0.04045f) {
            phi_23036_ = _e186.y;
        } else {
            phi_23036_ = _e189.y;
        }
        let _e199 = phi_23036_;
        if (_e155 <= 0.04045f) {
            phi_19167_ = _e186.z;
        } else {
            phi_19167_ = _e189.z;
        }
        let _e204 = phi_19167_;
        let _e209 = vec4<f32>(_e194, _e184.y, _e184.z, _e184.w);
        let _e214 = vec4<f32>(_e209.x, _e199, _e209.z, _e209.w);
        phi_7078_ = vec4<f32>(_e214.x, _e214.y, _e204, _e214.w);
    }
    let _e221 = phi_7078_;
    phi_22401_ = _e221;
    if (_e151 == 0i) {
        let _e223 = textureSample(global_12, global_2, _e79);
        let _e227 = global_9.member_2;
        let _e229 = global_9.member_3;
        let _e234 = global_9.member_4;
        let _e239 = global_9.member_5;
        let _e245 = _e223.xyz;
        let _e249 = vec3(_e140);
        let _e252 = global_9.member_6;
        let _e253 = mix(_e252, 1f, _e140);
        let _e257 = clamp((clamp((mix(mix(_e245, mix(mix(mix(mix(mix(_e227, _e229, vec3((_e91.x * _e84.x))), _e234, vec3((_e91.y * _e84.x))), _e239, vec3((_e91.z * _e84.x))), _e234, vec3(_e84.y)), _e239, vec3(_e84.z)).xyz, vec3(_e84.x)), vec3<f32>(0.38f, 0.37f, 0.35f), _e249) * _e253), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)) * _e253), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e259 = mix(_e149.xyz, vec3<f32>(1f, 1f, 1f), _e249);
        let _e265 = vec4<f32>(_e259.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e271 = vec4<f32>(_e265.x, _e259.y, _e265.z, _e265.w);
        let _e280 = (_e257.xyz * vec4<f32>(_e271.x, _e271.y, _e259.z, _e271.w).xyz);
        let _e285 = global_9.member_11;
        let _e288 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e280.xyz));
        let _e313 = mix(mix(_e280, ((_e288.xyz * mix(min(_e285.x, dot(_e257.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e285.z, clamp(pow(max(_e280.x, max(_e280.y, _e280.z)), _e285.y), 0f, 1f))) / vec3(max(_e288.x, max(_e288.y, _e288.z)))).xyz, vec3(_e96)), _e245, vec3(_e139));
        phi_22401_ = vec4<f32>(_e313.x, _e313.y, _e313.z, 1f);
    }
    let _e319 = phi_22401_;
    let _e320 = textureSample(global_13, global_6, _e79);
    phi_6805_ = _e319;
    if (_e320.w < 0f) {
        let _e328 = vec4<f32>(_e320.x, _e319.y, _e319.z, _e319.w);
        let _e334 = vec4<f32>(_e328.x, _e320.y, _e328.z, _e328.w);
        phi_6805_ = vec4<f32>(_e334.x, _e334.y, _e320.z, _e334.w);
    }
    let _e342 = phi_6805_;
    global_14 = _e342;
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
