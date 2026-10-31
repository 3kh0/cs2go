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
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e70 = global;
    let _e73 = _e70.xy;
    let _e74 = textureSample(global_1, global_2, _e73);
    let _e77 = textureSample(global_3, global_2, _e73);
    let _e80 = (1f - _e77.x);
    let _e82 = global_4;
    let _e84 = textureSample(global_5, global_6, _e82.xy);
    let _e87 = textureSample(global_7, global_8, _e70.zw);
    let _e91 = global_9.member_12;
    let _e101 = max(0f, smoothstep(0f, 0.5f, _e87.w));
    let _e102 = ((((min(_e74.w, _e80) + (_e84.x * _e74.x)) * ((_e91 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e87.w) * smoothstep(1f, 0.9f, _e87.w))) * _e101);
    let _e104 = global_9.member_1;
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
        let _e149 = (1f - min(1f, (_e87.w * 2f)));
        let _e156 = global_9.member_8;
        let _e163 = dot(_e127.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e174 = ((1f - _e127.w) * _e91);
        let _e177 = clamp(((((mix(_e156, mix((((_e149 * _e149) * 0.85f) + 0.15f), _e156, select(0f, 1f, (_e87.w >= 0.5f))), _e77.x) * mix(1f, 0.9f, _e132)) + (((1f - _e163) * _e91) * 0.05f)) + (((1f - _e139) * 0.15f) * _e91)) + (_e174 * 0.15f)), 0f, 1f);
        let _e187 = mix(mix(1f, pow(((_e139 * _e127.w) * _e163), 0.5f), _e91), 1f, _e132);
        let _e193 = vec4<f32>(mix(_e143.x, mix(min(1f, (_e177 + ((_e174 * _e91) * 0.5f))), _e177, _e77.x), select(max(0f, _e145), 1f, _e109)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e196 = global_9.member_11;
        let _e203 = vec4<f32>(_e193.x, mix(mix(_e196, _e143.y, _e111), _e187, _e77.x), _e193.z, _e193.w);
        let _e208 = vec4<f32>(_e203.x, _e203.y, _e145, _e203.w);
        let _e210 = global_9.member_10;
        phi_21709_ = _e208;
        if (_e210 != 0i) {
            phi_21709_ = vec4<f32>(_e208.x, _e208.y, (_e145 * _e77.x), _e208.w);
        }
        let _e219 = phi_21709_;
        let _e221 = global_9.member_9;
        let _e223 = _e219.xyz;
        let _e224 = (_e223 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e227 = pow(((_e223 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e219.x <= 0.04045f) {
            phi_21354_ = _e224.x;
        } else {
            phi_21354_ = _e227.x;
        }
        let _e233 = phi_21354_;
        if (_e219.y <= 0.04045f) {
            phi_21355_ = _e224.y;
        } else {
            phi_21355_ = _e227.y;
        }
        let _e239 = phi_21355_;
        if (_e219.z <= 0.04045f) {
            phi_22686_ = _e224.z;
        } else {
            phi_22686_ = _e227.z;
        }
        let _e245 = phi_22686_;
        phi_11711_ = vec4<f32>(_e233, _e239, _e245, min(1f, _e221));
        phi_10247_ = _e187;
    } else {
        phi_11711_ = vec4<f32>(_e70.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e248 = phi_11711_;
    let _e250 = phi_10247_;
    phi_22401_ = _e248;
    if (_e141 == 0i) {
        let _e252 = textureSample(global_12, global_2, _e73);
        let _e254 = vec3(_e91);
        let _e256 = global_9.member_3;
        let _e258 = global_9.member_4;
        let _e260 = _e87.xyz;
        let _e262 = global_9.member_6;
        let _e265 = global_9.member_7;
        let _e269 = mix(_e260, (_e260 * _e262), vec3(max(_e77.x, f32(_e265))));
        let _e275 = vec4<f32>(_e269.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e281 = vec4<f32>(_e275.x, _e269.y, _e275.z, _e275.w);
        let _e287 = vec4<f32>(_e281.x, _e281.y, _e269.z, _e281.w);
        let _e291 = global_9.member_5;
        let _e295 = _e287.xyz;
        let _e299 = global_9.member_2;
        let _e303 = vec3(_e77.x);
        let _e310 = (mix(_e295, mix((mix(mix(_e256, _e291, vec3(pow(_e91, 0.5f))), mix(_e256, _e258, _e254), vec3(_e139)) * _e295), (_e299 * dot(_e287.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e132)), _e303).xyz * _e127.xyz);
        let _e315 = global_9.member_11;
        let _e318 = global_9.member_13;
        let _e320 = global_9.member_14;
        let _e323 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e310.xyz));
        let _e331 = mix(_e318.xyz, _e320.xyz, vec3(mix(_e315, _e250, _e77.x)));
        let _e352 = mix(mix(_e310, ((_e323.xyz * mix(min(_e331.x, dot(mix(_e295, (_e295 * _e256), _e303).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e331.z, clamp(pow(max(_e310.x, max(_e310.y, _e310.z)), _e331.y), 0f, 1f))) / vec3(max(_e323.x, max(_e323.y, _e323.z)))).xyz, _e254), _e252.xyz, vec3((_e111 * _e80)));
        phi_22401_ = vec4<f32>(_e352.x, _e352.y, _e352.z, 1f);
    }
    let _e358 = phi_22401_;
    let _e359 = textureSample(global_13, global_6, _e73);
    phi_6805_ = _e358;
    if (_e359.w < 0f) {
        let _e367 = vec4<f32>(_e359.x, _e358.y, _e358.z, _e358.w);
        let _e373 = vec4<f32>(_e367.x, _e359.y, _e367.z, _e367.w);
        phi_6805_ = vec4<f32>(_e373.x, _e373.y, _e359.z, _e373.w);
    }
    let _e381 = phi_6805_;
    global_14 = _e381;
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
