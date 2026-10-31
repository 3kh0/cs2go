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
    member_9: i32,
    member_10: vec4<f32>,
    member_11: f32,
    member_12: vec4<f32>,
    member_13: f32,
    member_14: vec3<f32>,
    member_15: vec3<f32>,
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
    var phi_12885_: f32;
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
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
    let _e96 = global_9.member_13;
    let _e111 = (smoothstep(0.5f, 0.6f, _e91.w) * smoothstep(1f, 0.9f, _e91.w));
    let _e117 = global_9.member_7;
    let _e129 = mix(mix(mix(mix(mix(_e117.x, _e117.y, _e91.x), _e117.z, _e91.y), _e117.w, _e91.z), _e117.z, _e84.y), _e117.w, _e84.z);
    let _e130 = (((((_e80.w + (_e88.x * mix(smoothstep(0f, 0.72f, pow(_e83, 1.3f)), smoothstep(0f, 0.4f, _e83), pow(_e96, 1.2f)))) * ((_e96 * 6f) + 1f)) + _e111) * max(clamp((_e84.y + _e84.z), 0f, 1f), smoothstep(0f, 0.5f, _e91.w))) * _e129);
    let _e132 = global_9.member_1;
    let _e133 = (_e132 * _e129);
    let _e138 = (0.56f - (0.06f * _e96));
    let _e142 = (0.54f - (_e96 * 0.12f));
    let _e152 = (_e91.xyz * vec3<f32>(smoothstep((0.58f + _e133), (_e138 - _e133), _e130), smoothstep((_e138 + _e133), (_e142 - _e133), _e130), smoothstep((_e142 + _e133), ((0.52f - (_e96 * 0.17999999f)) - _e133), _e130)).xyz);
    let _e161 = smoothstep((0.56f - _e133), (0.74f + _e133), _e130);
    let _e165 = textureSample(global_10, global_6, _e86.zw);
    let _e172 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e165, vec4(((pow((1f - _e83), 4f) * 0.25f) + (0.75f * _e96))));
    let _e174 = global_9.member_12;
    let _e183 = mix(mix(mix(mix(mix(_e174.x, _e174.y, _e152.x), _e174.z, _e152.y), _e174.w, _e152.z), _e174.z, _e84.y), _e174.w, _e84.z);
    let _e185 = global_9.member;
    phi_7078_ = vec4<f32>(_e76.xy, 0f, 1f);
    if (_e185 != 0i) {
        let _e187 = textureSample(global_11, global_2, _e79);
        let _e195 = global_9.member_9;
        let _e196 = (_e195 != 0i);
        if _e196 {
            let _e198 = global_9.member_10;
            phi_12885_ = mix(mix(mix(_e198.x, _e198.y, _e152.x), _e198.z, _e152.y), _e198.w, _e152.z);
        } else {
            let _e207 = global_9.member_8;
            phi_12885_ = _e207;
        }
        let _e209 = phi_12885_;
        phi_20271_ = _e209;
        if _e196 {
            let _e211 = global_9.member_10;
            phi_20271_ = mix(mix(_e209, _e211.z, _e84.y), _e211.w, _e84.z);
        }
        let _e217 = phi_20271_;
        let _e227 = mix(vec4<f32>(min(1f, (_e217 + ((((1f - _e172.w) * _e96) * _e96) * 0.5f))), _e183, 0f, 1f), vec4<f32>(_e187.x, _e187.y, _e187.z, _e187.w), vec4(_e161));
        let _e228 = (1f - _e161);
        let _e235 = global_9.member_11;
        let _e237 = vec4<f32>(_e227.x, _e227.y, _e228, _e227.w).xyz;
        let _e238 = (_e237 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e241 = pow(((_e237 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e227.x <= 0.04045f) {
            phi_21354_ = _e238.x;
        } else {
            phi_21354_ = _e241.x;
        }
        let _e247 = phi_21354_;
        if (_e227.y <= 0.04045f) {
            phi_23035_ = _e238.y;
        } else {
            phi_23035_ = _e241.y;
        }
        let _e253 = phi_23035_;
        if (_e228 <= 0.04045f) {
            phi_19513_ = _e238.z;
        } else {
            phi_19513_ = _e241.z;
        }
        let _e258 = phi_19513_;
        let _e259 = vec4<f32>(_e247, _e253, _e228, min(1f, _e235));
        phi_7078_ = vec4<f32>(_e259.x, _e259.y, _e258, _e259.w);
    }
    let _e266 = phi_7078_;
    phi_22401_ = _e266;
    if (_e185 == 0i) {
        let _e268 = textureSample(global_12, global_2, _e79);
        let _e271 = global_9.member_2;
        let _e273 = global_9.member_3;
        let _e277 = global_9.member_4;
        let _e281 = global_9.member_5;
        let _e288 = global_9.member_6;
        let _e291 = clamp((mix(mix(mix(mix(mix(_e271, _e273, vec3(_e152.x)), _e277, vec3(_e152.y)), _e281, vec3(_e152.z)), _e277, vec3(_e84.y)), _e281, vec3(_e84.z)) * mix(_e288, 1f, (smoothstep((0.53f - _e133), (0.72f + _e133), _e130) * (1f - _e111)))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e294 = (_e291.xyz * _e172.xyz);
        let _e299 = global_9.member_14;
        let _e301 = global_9.member_15;
        let _e304 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e294.xyz));
        let _e312 = mix(_e299.xyz, _e301.xyz, vec3(_e183));
        let _e334 = mix(mix(_e294, ((_e304.xyz * mix(min(_e312.x, dot(_e291.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e312.z, clamp(pow(max(_e294.x, max(_e294.y, _e294.z)), _e312.y), 0f, 1f))) / vec3(max(_e304.x, max(_e304.y, _e304.z)))).xyz, vec3(_e96)), _e268.xyz, vec3(_e161));
        phi_22401_ = vec4<f32>(_e334.x, _e334.y, _e334.z, 1f);
    }
    let _e340 = phi_22401_;
    let _e341 = textureSample(global_13, global_6, _e79);
    phi_6805_ = _e340;
    if (_e341.w < 0f) {
        let _e349 = vec4<f32>(_e341.x, _e340.y, _e340.z, _e340.w);
        let _e355 = vec4<f32>(_e349.x, _e341.y, _e349.z, _e349.w);
        phi_6805_ = vec4<f32>(_e355.x, _e355.y, _e341.z, _e355.w);
    }
    let _e363 = phi_6805_;
    global_14 = _e363;
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
