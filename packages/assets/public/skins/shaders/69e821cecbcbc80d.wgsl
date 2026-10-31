struct type_8 {
    member: i32,
    member_1: i32,
    member_2: f32,
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
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e58 = global;
    let _e61 = _e58.xy;
    let _e62 = textureSample(global_1, global_2, _e61);
    let _e65 = global_3;
    let _e67 = textureSample(global_4, global_5, _e65.xy);
    let _e69 = _e58.zw;
    let _e70 = textureSample(global_6, global_7, _e69);
    let _e74 = global_8.member_7;
    let _e84 = max(0f, smoothstep(0f, 0.5f, _e70.w));
    let _e87 = global_8.member_2;
    let _e88 = (_e87 * _e84);
    let _e91 = smoothstep((0.58f - _e88), (0.68f + _e88), ((((_e62.w + (_e67.x * _e62.x)) * ((_e74 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e70.w) * smoothstep(1f, 0.9f, _e70.w))) * _e84));
    let _e93 = textureSample(global_9, global_5, _e65.zw);
    let _e100 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e93, vec4(((pow((1f - _e62.x), 4f) * 0.25f) + (0.75f * _e74))));
    let _e102 = global_8.member;
    phi_7078_ = vec4<f32>(_e58.xy, 0f, 1f);
    if (_e102 != 0i) {
        let _e104 = textureSample(global_10, global_2, _e61);
        let _e117 = global_8.member_4;
        let _e121 = global_8.member_6;
        let _e124 = mix(vec4<f32>(min(1f, (_e117 + ((((1f - _e100.w) * _e74) * _e74) * 0.5f))), _e121, 0f, 1f), vec4<f32>(_e104.x, _e104.y, _e104.z, _e104.w), vec4(_e91));
        let _e125 = (1f - _e91);
        let _e127 = global_8.member_1;
        if (_e127 != 0i) {
            let _e129 = textureSample(global_11, global_5, _e69);
            phi_21709_ = vec4<f32>(_e124.x, _e124.y, (_e125 * _e129.x), _e124.w);
        } else {
            let _e137 = textureSample(global_11, global_5, _e61);
            let _e139 = (_e125 * _e137.x);
            phi_21709_ = vec4<f32>(_e124.x, _e124.y, (_e139 * _e139), _e124.w);
        }
        let _e147 = phi_21709_;
        let _e149 = global_8.member_5;
        let _e151 = _e147.xyz;
        let _e152 = (_e151 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e155 = pow(((_e151 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e147.x <= 0.04045f) {
            phi_21354_ = _e152.x;
        } else {
            phi_21354_ = _e155.x;
        }
        let _e161 = phi_21354_;
        if (_e147.y <= 0.04045f) {
            phi_21355_ = _e152.y;
        } else {
            phi_21355_ = _e155.y;
        }
        let _e167 = phi_21355_;
        if (_e147.z <= 0.04045f) {
            phi_22686_ = _e152.z;
        } else {
            phi_22686_ = _e155.z;
        }
        let _e173 = phi_22686_;
        phi_7078_ = vec4<f32>(_e161, _e167, _e173, min(1f, _e149));
    }
    let _e176 = phi_7078_;
    phi_22401_ = _e176;
    if (_e102 == 0i) {
        let _e178 = textureSample(global_12, global_2, _e61);
        let _e181 = global_8.member_3;
        let _e183 = clamp((_e70.xyz * _e181), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e186 = (_e183.xyz * _e100.xyz);
        let _e191 = global_8.member_6;
        let _e193 = global_8.member_8;
        let _e195 = global_8.member_9;
        let _e198 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e186.xyz));
        let _e206 = mix(_e193.xyz, _e195.xyz, vec3(_e191));
        let _e228 = mix(mix(_e186, ((_e198.xyz * mix(min(_e206.x, dot(_e183.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e206.z, clamp(pow(max(_e186.x, max(_e186.y, _e186.z)), _e206.y), 0f, 1f))) / vec3(max(_e198.x, max(_e198.y, _e198.z)))).xyz, vec3(_e74)), _e178.xyz, vec3(_e91));
        phi_22401_ = vec4<f32>(_e228.x, _e228.y, _e228.z, 1f);
    }
    let _e234 = phi_22401_;
    let _e235 = textureSample(global_13, global_5, _e61);
    phi_22402_ = _e234;
    if (_e235.w < 0f) {
        let _e243 = vec4<f32>(_e235.x, _e234.y, _e234.z, _e234.w);
        let _e249 = vec4<f32>(_e243.x, _e235.y, _e243.z, _e243.w);
        phi_22402_ = vec4<f32>(_e249.x, _e249.y, _e235.z, _e249.w);
    }
    let _e257 = phi_22402_;
    let _e258 = textureSample(global_14, global_5, _e61);
    phi_6805_ = _e257;
    if (_e258.w < 0f) {
        let _e266 = vec4<f32>(_e258.x, _e257.y, _e257.z, _e257.w);
        let _e272 = vec4<f32>(_e266.x, _e258.y, _e266.z, _e266.w);
        phi_6805_ = vec4<f32>(_e272.x, _e272.y, _e258.z, _e272.w);
    }
    let _e280 = phi_6805_;
    global_15 = _e280;
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
