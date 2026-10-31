struct type_8 {
    member: i32,
    member_1: f32,
    member_2: vec3<f32>,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: f32,
    member_7: i32,
    member_8: f32,
    member_9: f32,
    member_10: i32,
    member_11: f32,
    member_12: f32,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
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
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e71 = global;
    let _e74 = _e71.xy;
    let _e75 = textureSample(global_1, global_2, _e74);
    let _e78 = textureSample(global_3, global_2, _e74);
    let _e81 = (1f - _e78.x);
    let _e83 = global_4;
    let _e85 = textureSample(global_5, global_6, _e83.xy);
    let _e88 = textureSample(global_7, global_8, _e71.zw);
    let _e92 = global_9.member_12;
    let _e102 = max(0f, smoothstep(0f, 0.5f, _e88.w));
    let _e103 = ((((min(_e75.w, _e81) + (_e85.x * _e75.x)) * ((_e92 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e88.w) * smoothstep(1f, 0.9f, _e88.w))) * _e102);
    let _e105 = global_9.member_1;
    let _e106 = (_e105 * _e102);
    let _e110 = (_e78.x > 0.99f);
    let _e112 = mix(smoothstep((0.58f - _e106), (0.68f + _e106), _e103), _e103, select(0f, 1f, _e110));
    let _e114 = textureSample(global_10, global_6, _e83.zw);
    let _e128 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e114, vec4(((pow((1f - _e75.x), 4f) * 0.25f) + (0.75f * _e92))));
    let _e133 = smoothstep(0.1f, 0.2f, (((_e85.x * _e75.y) * (_e75.x * _e75.x)) * _e92));
    let _e140 = smoothstep(0f, 0.15f, ((clamp(((_e75.x * _e75.y) - (_e92 * 0.1f)), 0f, 1f) - (clamp(((_e114.x * _e114.y) * _e114.z), 0f, 1f) * 0.23f)) + 0.08f));
    let _e142 = global_9.member;
    if (_e142 != 0i) {
        let _e144 = textureSample(global_11, global_2, _e74);
        let _e146 = (1f - _e112);
        let _e150 = (1f - min(1f, (_e88.w * 2f)));
        let _e157 = global_9.member_8;
        let _e164 = dot(_e128.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e175 = ((1f - _e128.w) * _e92);
        let _e178 = clamp(((((mix(_e157, mix((((_e150 * _e150) * 0.85f) + 0.15f), _e157, select(0f, 1f, (_e88.w >= 0.5f))), _e78.x) * mix(1f, 0.9f, _e133)) + (((1f - _e164) * _e92) * 0.05f)) + (((1f - _e140) * 0.15f) * _e92)) + (_e175 * 0.15f)), 0f, 1f);
        let _e188 = mix(mix(1f, pow(((_e140 * _e128.w) * _e164), 0.5f), _e92), 1f, _e133);
        let _e194 = vec4<f32>(mix(_e144.x, mix(min(1f, (_e178 + ((_e175 * _e92) * 0.5f))), _e178, _e78.x), select(max(0f, _e146), 1f, _e110)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e197 = global_9.member_11;
        let _e204 = vec4<f32>(_e194.x, mix(mix(_e197, _e144.y, _e112), _e188, _e78.x), _e194.z, _e194.w);
        let _e209 = vec4<f32>(_e204.x, _e204.y, _e146, _e204.w);
        let _e211 = global_9.member_10;
        phi_21709_ = _e209;
        if (_e211 != 0i) {
            phi_21709_ = vec4<f32>(_e209.x, _e209.y, (_e146 * _e78.x), _e209.w);
        }
        let _e220 = phi_21709_;
        let _e222 = global_9.member_9;
        let _e224 = _e220.xyz;
        let _e225 = (_e224 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e228 = pow(((_e224 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e220.x <= 0.04045f) {
            phi_21354_ = _e225.x;
        } else {
            phi_21354_ = _e228.x;
        }
        let _e234 = phi_21354_;
        if (_e220.y <= 0.04045f) {
            phi_21355_ = _e225.y;
        } else {
            phi_21355_ = _e228.y;
        }
        let _e240 = phi_21355_;
        if (_e220.z <= 0.04045f) {
            phi_22686_ = _e225.z;
        } else {
            phi_22686_ = _e228.z;
        }
        let _e246 = phi_22686_;
        phi_11711_ = vec4<f32>(_e234, _e240, _e246, min(1f, _e222));
        phi_10247_ = _e188;
    } else {
        phi_11711_ = vec4<f32>(_e71.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e249 = phi_11711_;
    let _e251 = phi_10247_;
    phi_22401_ = _e249;
    if (_e142 == 0i) {
        let _e253 = textureSample(global_12, global_2, _e74);
        let _e255 = vec3(_e92);
        let _e257 = global_9.member_3;
        let _e259 = global_9.member_4;
        let _e261 = _e88.xyz;
        let _e263 = global_9.member_6;
        let _e266 = global_9.member_7;
        let _e270 = mix(_e261, (_e261 * _e263), vec3(max(_e78.x, f32(_e266))));
        let _e276 = vec4<f32>(_e270.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e282 = vec4<f32>(_e276.x, _e270.y, _e276.z, _e276.w);
        let _e288 = vec4<f32>(_e282.x, _e282.y, _e270.z, _e282.w);
        let _e292 = global_9.member_5;
        let _e296 = _e288.xyz;
        let _e300 = global_9.member_2;
        let _e304 = vec3(_e78.x);
        let _e311 = (mix(_e296, mix((mix(mix(_e257, _e292, vec3(pow(_e92, 0.5f))), mix(_e257, _e259, _e255), vec3(_e140)) * _e296), (_e300 * dot(_e288.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e133)), _e304).xyz * _e128.xyz);
        let _e316 = global_9.member_11;
        let _e319 = global_9.member_13;
        let _e321 = global_9.member_14;
        let _e324 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e311.xyz));
        let _e332 = mix(_e319.xyz, _e321.xyz, vec3(mix(_e316, _e251, _e78.x)));
        let _e353 = mix(mix(_e311, ((_e324.xyz * mix(min(_e332.x, dot(mix(_e296, (_e296 * _e257), _e304).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e332.z, clamp(pow(max(_e311.x, max(_e311.y, _e311.z)), _e332.y), 0f, 1f))) / vec3(max(_e324.x, max(_e324.y, _e324.z)))).xyz, _e255), _e253.xyz, vec3((_e112 * _e81)));
        phi_22401_ = vec4<f32>(_e353.x, _e353.y, _e353.z, 1f);
    }
    let _e359 = phi_22401_;
    let _e360 = textureSample(global_13, global_6, _e74);
    phi_22402_ = _e359;
    if (_e360.w < 0f) {
        let _e368 = vec4<f32>(_e360.x, _e359.y, _e359.z, _e359.w);
        let _e374 = vec4<f32>(_e368.x, _e360.y, _e368.z, _e368.w);
        phi_22402_ = vec4<f32>(_e374.x, _e374.y, _e360.z, _e374.w);
    }
    let _e382 = phi_22402_;
    let _e383 = textureSample(global_14, global_6, _e74);
    phi_6805_ = _e382;
    if (_e383.w < 0f) {
        let _e391 = vec4<f32>(_e383.x, _e382.y, _e382.z, _e382.w);
        let _e397 = vec4<f32>(_e391.x, _e383.y, _e391.z, _e391.w);
        phi_6805_ = vec4<f32>(_e397.x, _e397.y, _e383.z, _e397.w);
    }
    let _e405 = phi_6805_;
    global_15 = _e405;
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
