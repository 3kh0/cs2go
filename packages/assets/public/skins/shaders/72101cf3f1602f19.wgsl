struct type_8 {
    member: i32,
    member_1: i32,
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
@group(1) @binding(40) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(39) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
@group(1) @binding(0) 
var<storage> global_8: type_8;
@group(1) @binding(41) 
var global_9: texture_2d<f32>;
@group(1) @binding(35) 
var global_10: texture_2d<f32>;
@group(1) @binding(37) 
var global_11: texture_2d<f32>;
@group(1) @binding(34) 
var global_12: texture_2d<f32>;
@group(1) @binding(36) 
var global_13: texture_2d<f32>;
@group(1) @binding(38) 
var global_14: texture_2d<f32>;
var<private> global_15: vec4<f32>;

fn function_() {
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e57 = global;
    let _e60 = _e57.xy;
    let _e61 = textureSample(global_1, global_2, _e60);
    let _e64 = global_3;
    let _e66 = textureSample(global_4, global_5, _e64.xy);
    let _e68 = _e57.zw;
    let _e69 = textureSample(global_6, global_7, _e68);
    let _e73 = global_8.member_6;
    let _e83 = max(0f, smoothstep(0f, 0.5f, _e69.w));
    let _e86 = global_8.member_2;
    let _e87 = (_e86 * _e83);
    let _e90 = smoothstep((0.58f - _e87), (0.68f + _e87), ((((_e61.w + (_e66.x * _e61.x)) * ((_e73 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e69.w) * smoothstep(1f, 0.9f, _e69.w))) * _e83));
    let _e92 = textureSample(global_9, global_5, _e64.zw);
    let _e99 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e92, vec4(((pow((1f - _e61.x), 4f) * 0.25f) + (0.75f * _e73))));
    let _e101 = global_8.member;
    phi_7078_ = vec4<f32>(_e57.xy, 0f, 1f);
    if (_e101 != 0i) {
        let _e103 = textureSample(global_10, global_2, _e60);
        let _e111 = global_8.member_1;
        if (_e111 != 0i) {
            let _e113 = textureSample(global_11, global_5, _e68);
            phi_20271_ = _e113.x;
        } else {
            let _e115 = textureSample(global_11, global_5, _e60);
            phi_20271_ = _e115.x;
        }
        let _e118 = phi_20271_;
        let _e127 = global_8.member_5;
        let _e130 = mix(vec4<f32>(min(1f, (_e118 + ((((1f - _e99.w) * _e73) * _e73) * 0.5f))), _e127, 0f, 1f), vec4<f32>(_e103.x, _e103.y, _e103.z, _e103.w), vec4(_e90));
        let _e131 = (1f - _e90);
        let _e138 = global_8.member_4;
        let _e140 = vec4<f32>(_e130.x, _e130.y, _e131, _e130.w).xyz;
        let _e141 = (_e140 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e144 = pow(((_e140 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e130.x <= 0.04045f) {
            phi_21354_ = _e141.x;
        } else {
            phi_21354_ = _e144.x;
        }
        let _e150 = phi_21354_;
        if (_e130.y <= 0.04045f) {
            phi_23035_ = _e141.y;
        } else {
            phi_23035_ = _e144.y;
        }
        let _e156 = phi_23035_;
        if (_e131 <= 0.04045f) {
            phi_19513_ = _e141.z;
        } else {
            phi_19513_ = _e144.z;
        }
        let _e161 = phi_19513_;
        let _e162 = vec4<f32>(_e150, _e156, _e131, min(1f, _e138));
        phi_7078_ = vec4<f32>(_e162.x, _e162.y, _e161, _e162.w);
    }
    let _e169 = phi_7078_;
    phi_22401_ = _e169;
    if (_e101 == 0i) {
        let _e171 = textureSample(global_12, global_2, _e60);
        let _e174 = global_8.member_3;
        let _e176 = clamp((_e69.xyz * _e174), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e179 = (_e176.xyz * _e99.xyz);
        let _e184 = global_8.member_5;
        let _e186 = global_8.member_7;
        let _e188 = global_8.member_8;
        let _e191 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e179.xyz));
        let _e199 = mix(_e186.xyz, _e188.xyz, vec3(_e184));
        let _e221 = mix(mix(_e179, ((_e191.xyz * mix(min(_e199.x, dot(_e176.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e199.z, clamp(pow(max(_e179.x, max(_e179.y, _e179.z)), _e199.y), 0f, 1f))) / vec3(max(_e191.x, max(_e191.y, _e191.z)))).xyz, vec3(_e73)), _e171.xyz, vec3(_e90));
        phi_22401_ = vec4<f32>(_e221.x, _e221.y, _e221.z, 1f);
    }
    let _e227 = phi_22401_;
    let _e228 = textureSample(global_13, global_5, _e60);
    phi_22402_ = _e227;
    if (_e228.w < 0f) {
        let _e236 = vec4<f32>(_e228.x, _e227.y, _e227.z, _e227.w);
        let _e242 = vec4<f32>(_e236.x, _e228.y, _e236.z, _e236.w);
        phi_22402_ = vec4<f32>(_e242.x, _e242.y, _e228.z, _e242.w);
    }
    let _e250 = phi_22402_;
    let _e251 = textureSample(global_14, global_5, _e60);
    phi_6805_ = _e250;
    if (_e251.w < 0f) {
        let _e259 = vec4<f32>(_e251.x, _e250.y, _e250.z, _e250.w);
        let _e265 = vec4<f32>(_e259.x, _e251.y, _e259.z, _e259.w);
        phi_6805_ = vec4<f32>(_e265.x, _e265.y, _e251.z, _e265.w);
    }
    let _e273 = phi_6805_;
    global_15 = _e273;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_15;
    return _e5;
}
