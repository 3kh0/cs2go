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
    member_12: vec3<f32>,
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
@group(1) @binding(0) 
var<storage> global_7: type_8;
@group(1) @binding(41) 
var global_8: texture_2d<f32>;
@group(1) @binding(35) 
var global_9: texture_2d<f32>;
@group(1) @binding(36) 
var global_10: texture_2d<f32>;
@group(1) @binding(37) 
var global_11: texture_2d<f32>;
@group(1) @binding(34) 
var global_12: texture_2d<f32>;
@group(1) @binding(38) 
var global_13: texture_2d<f32>;
var<private> global_14: vec4<f32>;

fn function_() {
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e57 = global;
    let _e60 = _e57.xy;
    let _e61 = textureSample(global_1, global_2, _e60);
    let _e63 = textureSample(global_3, global_2, _e60);
    let _e65 = global_4;
    let _e67 = textureSample(global_5, global_6, _e65.xy);
    let _e72 = global_7.member_11;
    let _e77 = global_7.member_6;
    let _e87 = mix(mix(mix(_e77.x, _e77.y, _e63.x), _e77.z, _e63.y), _e77.w, _e63.z);
    let _e90 = global_7.member_1;
    let _e91 = (_e90 * _e87);
    let _e94 = smoothstep((0.58f - _e91), (0.68f + _e91), (((_e61.w + (_e67.x * _e61.x)) * ((_e72 * 6f) + 1f)) * _e87));
    let _e96 = textureSample(global_8, global_6, _e65.zw);
    let _e103 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e96, vec4(((pow((1f - _e61.x), 4f) * 0.25f) + (0.75f * _e72))));
    let _e105 = global_7.member_10;
    let _e112 = mix(mix(mix(_e105.x, _e105.y, _e63.x), _e105.z, _e63.y), _e105.w, _e63.z);
    let _e114 = global_7.member;
    phi_7078_ = vec4<f32>(_e57.xy, 0f, 1f);
    if (_e114 != 0i) {
        let _e116 = textureSample(global_9, global_2, _e60);
        let _e123 = textureSample(global_10, global_6, _e60);
        let _e126 = global_7.member_7;
        if (_e126 != 0i) {
            let _e129 = global_7.member_8;
            phi_20271_ = mix(mix(mix(_e129.x, _e129.y, _e63.x), _e129.z, _e63.y), _e129.w, _e63.z);
        } else {
            phi_20271_ = _e123.x;
        }
        let _e138 = phi_20271_;
        let _e148 = mix(vec4<f32>(min(1f, (_e138 + ((((1f - _e103.w) * _e72) * _e72) * 0.5f))), _e112, 0f, 1f), vec4<f32>(_e116.x, _e116.y, _e116.z, _e116.w), vec4(_e94));
        let _e150 = textureSample(global_11, global_6, _e60);
        let _e152 = ((1f - _e94) * _e150.x);
        let _e159 = global_7.member_9;
        let _e161 = vec4<f32>(_e148.x, _e148.y, _e152, _e148.w).xyz;
        let _e162 = (_e161 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e165 = pow(((_e161 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e148.x <= 0.04045f) {
            phi_21354_ = _e162.x;
        } else {
            phi_21354_ = _e165.x;
        }
        let _e171 = phi_21354_;
        if (_e148.y <= 0.04045f) {
            phi_23035_ = _e162.y;
        } else {
            phi_23035_ = _e165.y;
        }
        let _e177 = phi_23035_;
        if (_e152 <= 0.04045f) {
            phi_19513_ = _e162.z;
        } else {
            phi_19513_ = _e165.z;
        }
        let _e182 = phi_19513_;
        let _e183 = vec4<f32>(_e171, _e177, _e152, min(1f, _e159));
        phi_7078_ = vec4<f32>(_e183.x, _e183.y, _e182, _e183.w);
    }
    let _e190 = phi_7078_;
    phi_22401_ = _e190;
    if (_e114 == 0i) {
        let _e192 = textureSample(global_12, global_2, _e60);
        let _e194 = global_7.member_2;
        let _e197 = global_7.member_3;
        let _e201 = global_7.member_4;
        let _e205 = global_7.member_5;
        let _e206 = mix(mix(mix(_e194, _e197, vec3(_e63.x)), _e201, vec3(_e63.y)), _e205, vec3(_e63.z));
        let _e209 = (_e206.xyz * _e103.xyz);
        let _e214 = global_7.member_12;
        let _e216 = global_7.member_13;
        let _e219 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e209.xyz));
        let _e227 = mix(_e214.xyz, _e216.xyz, vec3(_e112));
        let _e249 = mix(mix(_e209, ((_e219.xyz * mix(min(_e227.x, dot(_e206.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e227.z, clamp(pow(max(_e209.x, max(_e209.y, _e209.z)), _e227.y), 0f, 1f))) / vec3(max(_e219.x, max(_e219.y, _e219.z)))).xyz, vec3(_e72)), _e192.xyz, vec3(_e94));
        phi_22401_ = vec4<f32>(_e249.x, _e249.y, _e249.z, 1f);
    }
    let _e255 = phi_22401_;
    let _e256 = textureSample(global_13, global_6, _e60);
    phi_6805_ = _e255;
    if (_e256.w < 0f) {
        let _e264 = vec4<f32>(_e256.x, _e255.y, _e255.z, _e255.w);
        let _e270 = vec4<f32>(_e264.x, _e256.y, _e264.z, _e264.w);
        phi_6805_ = vec4<f32>(_e270.x, _e270.y, _e256.z, _e270.w);
    }
    let _e278 = phi_6805_;
    global_14 = _e278;
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
