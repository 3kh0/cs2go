struct type_8 {
    member: i32,
    member_1: i32,
    member_2: i32,
    member_3: f32,
    member_4: f32,
    member_5: f32,
    member_6: f32,
    member_7: f32,
    member_8: vec3<f32>,
    member_9: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
var<private> global_3: vec4<f32>;
@group(1) @binding(41) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(40) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
@group(1) @binding(0) 
var<storage> global_8: type_8;
@group(1) @binding(42) 
var global_9: texture_2d<f32>;
@group(1) @binding(35) 
var global_10: texture_2d<f32>;
@group(1) @binding(37) 
var global_11: texture_2d<f32>;
@group(1) @binding(38) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
@group(1) @binding(39) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_20271_: f32;
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e59 = global;
    let _e62 = _e59.xy;
    let _e63 = textureSample(global_1, global_2, _e62);
    let _e66 = global_3;
    let _e68 = textureSample(global_4, global_5, _e66.xy);
    let _e70 = _e59.zw;
    let _e71 = textureSample(global_6, global_7, _e70);
    let _e75 = global_8.member_7;
    let _e85 = max(0f, smoothstep(0f, 0.5f, _e71.w));
    let _e88 = global_8.member_3;
    let _e89 = (_e88 * _e85);
    let _e92 = smoothstep((0.58f - _e89), (0.68f + _e89), ((((_e63.w + (_e68.x * _e63.x)) * ((_e75 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e71.w) * smoothstep(1f, 0.9f, _e71.w))) * _e85));
    let _e94 = textureSample(global_9, global_5, _e66.zw);
    let _e101 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e94, vec4(((pow((1f - _e63.x), 4f) * 0.25f) + (0.75f * _e75))));
    let _e103 = global_8.member;
    phi_7078_ = vec4<f32>(_e59.xy, 0f, 1f);
    if (_e103 != 0i) {
        let _e105 = textureSample(global_10, global_2, _e62);
        let _e113 = global_8.member_1;
        if (_e113 != 0i) {
            let _e115 = textureSample(global_11, global_5, _e70);
            phi_20271_ = _e115.x;
        } else {
            let _e117 = textureSample(global_11, global_5, _e62);
            phi_20271_ = _e117.x;
        }
        let _e120 = phi_20271_;
        let _e129 = global_8.member_6;
        let _e132 = mix(vec4<f32>(min(1f, (_e120 + ((((1f - _e101.w) * _e75) * _e75) * 0.5f))), _e129, 0f, 1f), vec4<f32>(_e105.x, _e105.y, _e105.z, _e105.w), vec4(_e92));
        let _e133 = (1f - _e92);
        let _e135 = global_8.member_2;
        if (_e135 != 0i) {
            let _e137 = textureSample(global_12, global_5, _e70);
            phi_21709_ = vec4<f32>(_e132.x, _e132.y, (_e133 * _e137.x), _e132.w);
        } else {
            let _e145 = textureSample(global_12, global_5, _e62);
            let _e147 = (_e133 * _e145.x);
            phi_21709_ = vec4<f32>(_e132.x, _e132.y, (_e147 * _e147), _e132.w);
        }
        let _e155 = phi_21709_;
        let _e157 = global_8.member_5;
        let _e159 = _e155.xyz;
        let _e160 = (_e159 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e163 = pow(((_e159 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e155.x <= 0.04045f) {
            phi_21354_ = _e160.x;
        } else {
            phi_21354_ = _e163.x;
        }
        let _e169 = phi_21354_;
        if (_e155.y <= 0.04045f) {
            phi_21355_ = _e160.y;
        } else {
            phi_21355_ = _e163.y;
        }
        let _e175 = phi_21355_;
        if (_e155.z <= 0.04045f) {
            phi_22686_ = _e160.z;
        } else {
            phi_22686_ = _e163.z;
        }
        let _e181 = phi_22686_;
        phi_7078_ = vec4<f32>(_e169, _e175, _e181, min(1f, _e157));
    }
    let _e184 = phi_7078_;
    phi_22401_ = _e184;
    if (_e103 == 0i) {
        let _e186 = textureSample(global_13, global_2, _e62);
        let _e189 = global_8.member_4;
        let _e191 = clamp((_e71.xyz * _e189), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e194 = (_e191.xyz * _e101.xyz);
        let _e199 = global_8.member_6;
        let _e201 = global_8.member_8;
        let _e203 = global_8.member_9;
        let _e206 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e194.xyz));
        let _e214 = mix(_e201.xyz, _e203.xyz, vec3(_e199));
        let _e236 = mix(mix(_e194, ((_e206.xyz * mix(min(_e214.x, dot(_e191.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e214.z, clamp(pow(max(_e194.x, max(_e194.y, _e194.z)), _e214.y), 0f, 1f))) / vec3(max(_e206.x, max(_e206.y, _e206.z)))).xyz, vec3(_e75)), _e186.xyz, vec3(_e92));
        phi_22401_ = vec4<f32>(_e236.x, _e236.y, _e236.z, 1f);
    }
    let _e242 = phi_22401_;
    let _e243 = textureSample(global_14, global_5, _e62);
    phi_22402_ = _e242;
    if (_e243.w < 0f) {
        let _e251 = vec4<f32>(_e243.x, _e242.y, _e242.z, _e242.w);
        let _e257 = vec4<f32>(_e251.x, _e243.y, _e251.z, _e251.w);
        phi_22402_ = vec4<f32>(_e257.x, _e257.y, _e243.z, _e257.w);
    }
    let _e265 = phi_22402_;
    let _e266 = textureSample(global_15, global_5, _e62);
    phi_6805_ = _e265;
    if (_e266.w < 0f) {
        let _e274 = vec4<f32>(_e266.x, _e265.y, _e265.z, _e265.w);
        let _e280 = vec4<f32>(_e274.x, _e266.y, _e274.z, _e274.w);
        phi_6805_ = vec4<f32>(_e280.x, _e280.y, _e266.z, _e280.w);
    }
    let _e288 = phi_6805_;
    global_16 = _e288;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_16;
    return _e5;
}
