struct type_8 {
    member: i32,
    member_1: i32,
    member_2: f32,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: vec3<f32>,
    member_7: f32,
    member_8: i32,
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
@group(1) @binding(40) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(39) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(0) 
var<storage> global_9: type_8;
@group(1) @binding(41) 
var global_10: texture_2d<f32>;
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
    var phi_21903_: f32;
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e70 = global;
    let _e73 = _e70.xy;
    let _e74 = textureSample(global_1, global_2, _e73);
    let _e77 = textureSample(global_3, global_2, _e73);
    let _e80 = (1f - _e77.x);
    let _e82 = global_4;
    let _e84 = textureSample(global_5, global_6, _e82.xy);
    let _e86 = _e70.zw;
    let _e87 = textureSample(global_7, global_8, _e86);
    let _e91 = global_9.member_12;
    let _e101 = max(0f, smoothstep(0f, 0.5f, _e87.w));
    let _e102 = ((((min(_e74.w, _e80) + (_e84.x * _e74.x)) * ((_e91 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e87.w) * smoothstep(1f, 0.9f, _e87.w))) * _e101);
    let _e104 = global_9.member_2;
    let _e105 = (_e104 * _e101);
    let _e109 = (_e77.x > 0.99f);
    let _e111 = mix(smoothstep((0.58f - _e105), (0.68f + _e105), _e102), _e102, select(0f, 1f, _e109));
    let _e113 = textureSample(global_10, global_6, _e82.zw);
    let _e127 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e113, vec4(((pow((1f - _e74.x), 4f) * 0.25f) + (0.75f * _e91))));
    let _e132 = smoothstep(0.1f, 0.2f, (((_e84.x * _e74.y) * (_e74.x * _e74.x)) * _e91));
    let _e139 = smoothstep(0f, 0.15f, ((clamp(((_e74.x * _e74.y) - (_e91 * 0.1f)), 0f, 1f) - (clamp(((_e113.x * _e113.y) * _e113.z), 0f, 1f) * 0.23f)) + 0.08f));
    let _e141 = global_9.member;
    if (_e141 != 0i) {
        let _e143 = textureSample(global_11, global_2, _e73);
        let _e145 = (1f - _e111);
        let _e148 = global_9.member_1;
        if (_e148 != 0i) {
            let _e150 = textureSample(global_12, global_6, _e86);
            phi_21903_ = _e150.x;
        } else {
            let _e152 = textureSample(global_12, global_6, _e73);
            phi_21903_ = _e152.x;
        }
        let _e155 = phi_21903_;
        let _e160 = dot(_e127.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e171 = ((1f - _e127.w) * _e91);
        let _e174 = clamp(((((_e155 * mix(1f, 0.9f, _e132)) + (((1f - _e160) * _e91) * 0.05f)) + (((1f - _e139) * 0.15f) * _e91)) + (_e171 * 0.15f)), 0f, 1f);
        let _e184 = mix(mix(1f, pow(((_e139 * _e127.w) * _e160), 0.5f), _e91), 1f, _e132);
        let _e190 = vec4<f32>(mix(_e143.x, mix(min(1f, (_e174 + ((_e171 * _e91) * 0.5f))), _e174, _e77.x), select(max(0f, _e145), 1f, _e109)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e193 = global_9.member_11;
        let _e200 = vec4<f32>(_e190.x, mix(mix(_e193, _e143.y, _e111), _e184, _e77.x), _e190.z, _e190.w);
        let _e205 = vec4<f32>(_e200.x, _e200.y, _e145, _e200.w);
        let _e207 = global_9.member_10;
        phi_21709_ = _e205;
        if (_e207 != 0i) {
            phi_21709_ = vec4<f32>(_e205.x, _e205.y, (_e145 * _e77.x), _e205.w);
        }
        let _e216 = phi_21709_;
        let _e218 = global_9.member_9;
        let _e220 = _e216.xyz;
        let _e221 = (_e220 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e224 = pow(((_e220 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e216.x <= 0.04045f) {
            phi_21354_ = _e221.x;
        } else {
            phi_21354_ = _e224.x;
        }
        let _e230 = phi_21354_;
        if (_e216.y <= 0.04045f) {
            phi_21355_ = _e221.y;
        } else {
            phi_21355_ = _e224.y;
        }
        let _e236 = phi_21355_;
        if (_e216.z <= 0.04045f) {
            phi_22686_ = _e221.z;
        } else {
            phi_22686_ = _e224.z;
        }
        let _e242 = phi_22686_;
        phi_11711_ = vec4<f32>(_e230, _e236, _e242, min(1f, _e218));
        phi_10247_ = _e184;
    } else {
        phi_11711_ = vec4<f32>(_e70.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e245 = phi_11711_;
    let _e247 = phi_10247_;
    phi_22401_ = _e245;
    if (_e141 == 0i) {
        let _e249 = textureSample(global_13, global_2, _e73);
        let _e251 = vec3(_e91);
        let _e253 = global_9.member_4;
        let _e255 = global_9.member_5;
        let _e257 = _e87.xyz;
        let _e259 = global_9.member_7;
        let _e262 = global_9.member_8;
        let _e266 = mix(_e257, (_e257 * _e259), vec3(max(_e77.x, f32(_e262))));
        let _e272 = vec4<f32>(_e266.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e278 = vec4<f32>(_e272.x, _e266.y, _e272.z, _e272.w);
        let _e284 = vec4<f32>(_e278.x, _e278.y, _e266.z, _e278.w);
        let _e288 = global_9.member_6;
        let _e292 = _e284.xyz;
        let _e296 = global_9.member_3;
        let _e300 = vec3(_e77.x);
        let _e307 = (mix(_e292, mix((mix(mix(_e253, _e288, vec3(pow(_e91, 0.5f))), mix(_e253, _e255, _e251), vec3(_e139)) * _e292), (_e296 * dot(_e284.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e132)), _e300).xyz * _e127.xyz);
        let _e312 = global_9.member_11;
        let _e315 = global_9.member_13;
        let _e317 = global_9.member_14;
        let _e320 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e307.xyz));
        let _e328 = mix(_e315.xyz, _e317.xyz, vec3(mix(_e312, _e247, _e77.x)));
        let _e349 = mix(mix(_e307, ((_e320.xyz * mix(min(_e328.x, dot(mix(_e292, (_e292 * _e253), _e300).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e328.z, clamp(pow(max(_e307.x, max(_e307.y, _e307.z)), _e328.y), 0f, 1f))) / vec3(max(_e320.x, max(_e320.y, _e320.z)))).xyz, _e251), _e249.xyz, vec3((_e111 * _e80)));
        phi_22401_ = vec4<f32>(_e349.x, _e349.y, _e349.z, 1f);
    }
    let _e355 = phi_22401_;
    let _e356 = textureSample(global_14, global_6, _e73);
    phi_22402_ = _e355;
    if (_e356.w < 0f) {
        let _e364 = vec4<f32>(_e356.x, _e355.y, _e355.z, _e355.w);
        let _e370 = vec4<f32>(_e364.x, _e356.y, _e364.z, _e364.w);
        phi_22402_ = vec4<f32>(_e370.x, _e370.y, _e356.z, _e370.w);
    }
    let _e378 = phi_22402_;
    let _e379 = textureSample(global_15, global_6, _e73);
    phi_6805_ = _e378;
    if (_e379.w < 0f) {
        let _e387 = vec4<f32>(_e379.x, _e378.y, _e378.z, _e378.w);
        let _e393 = vec4<f32>(_e387.x, _e379.y, _e387.z, _e387.w);
        phi_6805_ = vec4<f32>(_e393.x, _e393.y, _e379.z, _e393.w);
    }
    let _e401 = phi_6805_;
    global_16 = _e401;
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
