struct type_8 {
    member: i32,
    member_1: f32,
    member_2: vec3<f32>,
    member_3: f32,
    member_4: f32,
    member_5: f32,
    member_6: f32,
    member_7: vec3<f32>,
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
@group(1) @binding(0) 
var<storage> global_7: type_8;
@group(1) @binding(39) 
var global_8: texture_2d<f32>;
@group(1) @binding(35) 
var global_9: texture_2d<f32>;
@group(1) @binding(34) 
var global_10: texture_2d<f32>;
@group(1) @binding(36) 
var global_11: texture_2d<f32>;
var<private> global_12: vec4<f32>;

fn function_() {
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e67 = global;
    let _e70 = _e67.xy;
    let _e71 = textureSample(global_1, global_2, _e70);
    let _e74 = (pow(_e71.x, 1.5f) * 0.96f);
    let _e75 = textureSample(global_3, global_2, _e70);
    let _e77 = global_4;
    let _e79 = textureSample(global_5, global_6, _e77.xy);
    let _e85 = global_7.member_6;
    let _e92 = ((_e71.w + (_e79.x * mix(smoothstep(0f, 0.72f, pow(_e74, 1.3f)), smoothstep(0f, 0.4f, _e74), pow(_e85, 1.2f)))) * ((_e85 * 6f) + 1f));
    let _e94 = global_7.member_1;
    let _e108 = max((1f - _e75.x), smoothstep((0.56f - _e94), (0.74f + _e94), _e92));
    let _e109 = ((smoothstep((0.53f - _e94), (0.72f + _e94), _e92) * (1f - (smoothstep(0.5f, 0.6f, 1f) * smoothstep(1f, 0.9f, 1f)))) * _e75.x);
    let _e111 = textureSample(global_8, global_6, _e77.zw);
    let _e118 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e111, vec4(((pow((1f - _e74), 4f) * 0.25f) + (0.75f * _e85))));
    let _e120 = global_7.member;
    phi_7078_ = vec4<f32>(_e67.xy, 0f, 1f);
    if (_e120 != 0i) {
        let _e122 = textureSample(global_9, global_2, _e70);
        let _e124 = (1f - _e108);
        let _e127 = global_7.member_4;
        let _e135 = mix(_e122.x, min(1f, (mix(_e127, 0.35f, _e109) + ((1f - dot(_e118.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))) * 0.2f))), max(0f, _e124));
        let _e137 = mix(_e75.x, _e122.y, _e108);
        let _e139 = global_7.member_5;
        let _e141 = vec4<f32>(_e135, _e137, _e124, min(1f, _e139));
        let _e142 = _e141.xyz;
        let _e143 = (_e142 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e146 = pow(((_e142 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e135 <= 0.04045f) {
            phi_23035_ = _e143.x;
        } else {
            phi_23035_ = _e146.x;
        }
        let _e151 = phi_23035_;
        if (_e137 <= 0.04045f) {
            phi_23036_ = _e143.y;
        } else {
            phi_23036_ = _e146.y;
        }
        let _e156 = phi_23036_;
        if (_e124 <= 0.04045f) {
            phi_19167_ = _e143.z;
        } else {
            phi_19167_ = _e146.z;
        }
        let _e161 = phi_19167_;
        let _e166 = vec4<f32>(_e151, _e141.y, _e141.z, _e141.w);
        let _e171 = vec4<f32>(_e166.x, _e156, _e166.z, _e166.w);
        phi_7078_ = vec4<f32>(_e171.x, _e171.y, _e161, _e171.w);
    }
    let _e178 = phi_7078_;
    phi_22401_ = _e178;
    if (_e120 == 0i) {
        let _e180 = textureSample(global_10, global_2, _e70);
        let _e182 = global_7.member_2;
        let _e183 = _e180.xyz;
        let _e187 = vec3(_e109);
        let _e190 = global_7.member_3;
        let _e191 = mix(_e190, 1f, _e109);
        let _e195 = clamp((clamp((mix(mix(_e183, _e182.xyz, vec3(_e75.x)), vec3<f32>(0.38f, 0.37f, 0.35f), _e187) * _e191), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)) * _e191), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e197 = mix(_e118.xyz, vec3<f32>(1f, 1f, 1f), _e187);
        let _e203 = vec4<f32>(_e197.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e209 = vec4<f32>(_e203.x, _e197.y, _e203.z, _e203.w);
        let _e218 = (_e195.xyz * vec4<f32>(_e209.x, _e209.y, _e197.z, _e209.w).xyz);
        let _e223 = global_7.member_7;
        let _e226 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e218.xyz));
        let _e251 = mix(mix(_e218, ((_e226.xyz * mix(min(_e223.x, dot(_e195.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e223.z, clamp(pow(max(_e218.x, max(_e218.y, _e218.z)), _e223.y), 0f, 1f))) / vec3(max(_e226.x, max(_e226.y, _e226.z)))).xyz, vec3(_e85)), _e183, vec3(_e108));
        phi_22401_ = vec4<f32>(_e251.x, _e251.y, _e251.z, 1f);
    }
    let _e257 = phi_22401_;
    let _e258 = textureSample(global_11, global_6, _e70);
    phi_6805_ = _e257;
    if (_e258.w < 0f) {
        let _e266 = vec4<f32>(_e258.x, _e257.y, _e257.z, _e257.w);
        let _e272 = vec4<f32>(_e266.x, _e258.y, _e266.z, _e266.w);
        phi_6805_ = vec4<f32>(_e272.x, _e272.y, _e258.z, _e272.w);
    }
    let _e280 = phi_6805_;
    global_12 = _e280;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_12;
    return _e5;
}
