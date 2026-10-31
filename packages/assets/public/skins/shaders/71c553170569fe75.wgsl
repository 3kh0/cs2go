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

    let _e76 = global;
    let _e79 = _e76.xy;
    let _e80 = textureSample(global_1, global_2, _e79);
    let _e82 = pow(_e80.x, 1.5f);
    let _e83 = (_e82 * 0.96f);
    let _e85 = textureSample(global_3, global_2, _e79);
    let _e88 = (1f - _e85.x);
    let _e90 = global_4;
    let _e92 = textureSample(global_5, global_6, _e90.xy);
    let _e95 = textureSample(global_7, global_8, _e76.zw);
    let _e100 = global_9.member_12;
    let _e114 = max(0f, smoothstep(0f, 0.5f, _e95.w));
    let _e115 = ((((min(_e80.w, _e88) + (_e92.x * mix(smoothstep(0f, 0.72f, pow(_e83, 1.3f)), smoothstep(0f, 0.4f, _e83), pow(_e100, 1.2f)))) * ((_e100 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e95.w) * smoothstep(1f, 0.9f, _e95.w))) * _e114);
    let _e117 = global_9.member_1;
    let _e118 = (_e117 * _e114);
    let _e122 = (_e85.x > 0.99f);
    let _e124 = mix(smoothstep((0.58f - _e118), (0.68f + _e118), _e115), _e115, select(0f, 1f, _e122));
    let _e126 = textureSample(global_10, global_6, _e90.zw);
    let _e145 = smoothstep(0.2f, 0.6f, (((_e92.x * _e80.y) * (_e92.x * smoothstep(0.2f, 0.3f, _e83))) * _e100));
    let _e154 = (smoothstep((0.5f * _e100), 0f, clamp((((_e82 * 11.5199995f) * _e80.y) - ((_e100 * clamp(((_e126.x * _e126.y) * _e126.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e100);
    let _e155 = (1f - _e154);
    let _e159 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e126, vec4(((pow((1f - _e83), 4f) * 0.25f) + (0.75f * _e100)))), vec4(clamp((_e145 * 2f), 0f, 1f)));
    let _e161 = global_9.member;
    if (_e161 != 0i) {
        let _e163 = textureSample(global_11, global_2, _e79);
        let _e165 = (1f - _e124);
        let _e169 = (1f - min(1f, (_e95.w * 2f)));
        let _e176 = global_9.member_8;
        let _e183 = dot(_e159.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e193 = ((1f - _e159.w) * _e100);
        let _e196 = clamp(((((mix(_e176, mix((((_e169 * _e169) * 0.85f) + 0.15f), _e176, select(0f, 1f, (_e95.w >= 0.5f))), _e85.x) * mix(1f, 0.9f, _e145)) + (((1f - _e183) * _e100) * 0.05f)) + ((_e154 * 0.15f) * _e100)) + (_e193 * 0.15f)), 0f, 1f);
        let _e206 = mix(mix(1f, pow(((_e155 * _e159.w) * _e183), 0.5f), _e100), 1f, _e145);
        let _e212 = vec4<f32>(mix(_e163.x, mix(min(1f, (_e196 + ((_e193 * _e100) * 0.5f))), _e196, _e85.x), select(max(0f, _e165), 1f, _e122)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e215 = global_9.member_11;
        let _e222 = vec4<f32>(_e212.x, mix(mix(_e215, _e163.y, _e124), _e206, _e85.x), _e212.z, _e212.w);
        let _e227 = vec4<f32>(_e222.x, _e222.y, _e165, _e222.w);
        let _e229 = global_9.member_10;
        phi_21709_ = _e227;
        if (_e229 != 0i) {
            phi_21709_ = vec4<f32>(_e227.x, _e227.y, (_e165 * _e85.x), _e227.w);
        }
        let _e238 = phi_21709_;
        let _e240 = global_9.member_9;
        let _e242 = _e238.xyz;
        let _e243 = (_e242 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e246 = pow(((_e242 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e238.x <= 0.04045f) {
            phi_21354_ = _e243.x;
        } else {
            phi_21354_ = _e246.x;
        }
        let _e252 = phi_21354_;
        if (_e238.y <= 0.04045f) {
            phi_21355_ = _e243.y;
        } else {
            phi_21355_ = _e246.y;
        }
        let _e258 = phi_21355_;
        if (_e238.z <= 0.04045f) {
            phi_22686_ = _e243.z;
        } else {
            phi_22686_ = _e246.z;
        }
        let _e264 = phi_22686_;
        phi_11711_ = vec4<f32>(_e252, _e258, _e264, min(1f, _e240));
        phi_10247_ = _e206;
    } else {
        phi_11711_ = vec4<f32>(_e76.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e267 = phi_11711_;
    let _e269 = phi_10247_;
    phi_22401_ = _e267;
    if (_e161 == 0i) {
        let _e271 = textureSample(global_12, global_2, _e79);
        let _e273 = vec3(_e100);
        let _e275 = global_9.member_3;
        let _e277 = global_9.member_4;
        let _e279 = _e95.xyz;
        let _e281 = global_9.member_6;
        let _e284 = global_9.member_7;
        let _e288 = mix(_e279, (_e279 * _e281), vec3(max(_e85.x, f32(_e284))));
        let _e294 = vec4<f32>(_e288.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e300 = vec4<f32>(_e294.x, _e288.y, _e294.z, _e294.w);
        let _e306 = vec4<f32>(_e300.x, _e300.y, _e288.z, _e300.w);
        let _e310 = global_9.member_5;
        let _e314 = _e306.xyz;
        let _e318 = global_9.member_2;
        let _e322 = vec3(_e85.x);
        let _e329 = (mix(_e314, mix((mix(mix(_e275, _e310, vec3(pow(_e100, 0.5f))), mix(_e275, _e277, _e273), vec3(_e155)) * _e314), (_e318 * dot(_e306.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e145)), _e322).xyz * _e159.xyz);
        let _e334 = global_9.member_11;
        let _e337 = global_9.member_13;
        let _e339 = global_9.member_14;
        let _e342 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e329.xyz));
        let _e350 = mix(_e337.xyz, _e339.xyz, vec3(mix(_e334, _e269, _e85.x)));
        let _e371 = mix(mix(_e329, ((_e342.xyz * mix(min(_e350.x, dot(mix(_e314, (_e314 * _e275), _e322).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e350.z, clamp(pow(max(_e329.x, max(_e329.y, _e329.z)), _e350.y), 0f, 1f))) / vec3(max(_e342.x, max(_e342.y, _e342.z)))).xyz, _e273), _e271.xyz, vec3((_e124 * _e88)));
        phi_22401_ = vec4<f32>(_e371.x, _e371.y, _e371.z, 1f);
    }
    let _e377 = phi_22401_;
    let _e378 = textureSample(global_13, global_6, _e79);
    phi_22402_ = _e377;
    if (_e378.w < 0f) {
        let _e386 = vec4<f32>(_e378.x, _e377.y, _e377.z, _e377.w);
        let _e392 = vec4<f32>(_e386.x, _e378.y, _e386.z, _e386.w);
        phi_22402_ = vec4<f32>(_e392.x, _e392.y, _e378.z, _e392.w);
    }
    let _e400 = phi_22402_;
    let _e401 = textureSample(global_14, global_6, _e79);
    phi_6805_ = _e400;
    if (_e401.w < 0f) {
        let _e409 = vec4<f32>(_e401.x, _e400.y, _e400.z, _e400.w);
        let _e415 = vec4<f32>(_e409.x, _e401.y, _e409.z, _e409.w);
        phi_6805_ = vec4<f32>(_e415.x, _e415.y, _e401.z, _e415.w);
    }
    let _e423 = phi_6805_;
    global_15 = _e423;
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
