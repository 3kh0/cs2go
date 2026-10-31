struct type_8 {
    member: i32,
    member_1: f32,
    member_2: f32,
    member_3: f32,
    member_4: f32,
    member_5: f32,
    member_6: f32,
    member_7: vec3<f32>,
    member_8: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
var<private> global_3: vec4<f32>;
@group(1) @binding(38) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(37) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
@group(1) @binding(0) 
var<storage> global_8: type_8;
@group(1) @binding(39) 
var global_9: texture_2d<f32>;
@group(1) @binding(35) 
var global_10: texture_2d<f32>;
@group(1) @binding(34) 
var global_11: texture_2d<f32>;
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
var<private> global_13: vec4<f32>;

fn function_() {
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e61 = global;
    let _e64 = _e61.xy;
    let _e65 = textureSample(global_1, global_2, _e64);
    let _e68 = (pow(_e65.x, 1.5f) * 0.96f);
    let _e70 = global_3;
    let _e72 = textureSample(global_4, global_5, _e70.xy);
    let _e75 = textureSample(global_6, global_7, _e61.zw);
    let _e80 = global_8.member_6;
    let _e94 = max(0f, smoothstep(0f, 0.5f, _e75.w));
    let _e97 = global_8.member_1;
    let _e98 = (_e97 * _e94);
    let _e101 = smoothstep((0.56f - _e98), (0.74f + _e98), ((((_e65.w + (_e72.x * mix(smoothstep(0f, 0.72f, pow(_e68, 1.3f)), smoothstep(0f, 0.4f, _e68), pow(_e80, 1.2f)))) * ((_e80 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e75.w) * smoothstep(1f, 0.9f, _e75.w))) * _e94));
    let _e103 = textureSample(global_9, global_5, _e70.zw);
    let _e110 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e103, vec4(((pow((1f - _e68), 4f) * 0.25f) + (0.75f * _e80))));
    let _e112 = global_8.member;
    phi_7078_ = vec4<f32>(_e61.xy, 0f, 1f);
    if (_e112 != 0i) {
        let _e114 = textureSample(global_10, global_2, _e64);
        let _e127 = global_8.member_3;
        let _e131 = global_8.member_5;
        let _e134 = mix(vec4<f32>(min(1f, (_e127 + ((((1f - _e110.w) * _e80) * _e80) * 0.5f))), _e131, 0f, 1f), vec4<f32>(_e114.x, _e114.y, _e114.z, _e114.w), vec4(_e101));
        let _e135 = (1f - _e101);
        let _e142 = global_8.member_4;
        let _e144 = vec4<f32>(_e134.x, _e134.y, _e135, _e134.w).xyz;
        let _e145 = (_e144 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e148 = pow(((_e144 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e134.x <= 0.04045f) {
            phi_21354_ = _e145.x;
        } else {
            phi_21354_ = _e148.x;
        }
        let _e154 = phi_21354_;
        if (_e134.y <= 0.04045f) {
            phi_23035_ = _e145.y;
        } else {
            phi_23035_ = _e148.y;
        }
        let _e160 = phi_23035_;
        if (_e135 <= 0.04045f) {
            phi_19513_ = _e145.z;
        } else {
            phi_19513_ = _e148.z;
        }
        let _e165 = phi_19513_;
        let _e166 = vec4<f32>(_e154, _e160, _e135, min(1f, _e142));
        phi_7078_ = vec4<f32>(_e166.x, _e166.y, _e165, _e166.w);
    }
    let _e173 = phi_7078_;
    phi_22401_ = _e173;
    if (_e112 == 0i) {
        let _e175 = textureSample(global_11, global_2, _e64);
        let _e178 = global_8.member_2;
        let _e180 = clamp((_e75.xyz * _e178), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e183 = (_e180.xyz * _e110.xyz);
        let _e188 = global_8.member_5;
        let _e190 = global_8.member_7;
        let _e192 = global_8.member_8;
        let _e195 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e183.xyz));
        let _e203 = mix(_e190.xyz, _e192.xyz, vec3(_e188));
        let _e225 = mix(mix(_e183, ((_e195.xyz * mix(min(_e203.x, dot(_e180.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e203.z, clamp(pow(max(_e183.x, max(_e183.y, _e183.z)), _e203.y), 0f, 1f))) / vec3(max(_e195.x, max(_e195.y, _e195.z)))).xyz, vec3(_e80)), _e175.xyz, vec3(_e101));
        phi_22401_ = vec4<f32>(_e225.x, _e225.y, _e225.z, 1f);
    }
    let _e231 = phi_22401_;
    let _e232 = textureSample(global_12, global_5, _e64);
    phi_6805_ = _e231;
    if (_e232.w < 0f) {
        let _e240 = vec4<f32>(_e232.x, _e231.y, _e231.z, _e231.w);
        let _e246 = vec4<f32>(_e240.x, _e232.y, _e240.z, _e240.w);
        phi_6805_ = vec4<f32>(_e246.x, _e246.y, _e232.z, _e246.w);
    }
    let _e254 = phi_6805_;
    global_13 = _e254;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_13;
    return _e5;
}
