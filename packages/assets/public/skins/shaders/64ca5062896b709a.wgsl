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

    let _e70 = global;
    let _e73 = _e70.xy;
    let _e74 = textureSample(global_1, global_2, _e73);
    let _e76 = textureSample(global_3, global_2, _e73);
    let _e78 = global_4;
    let _e80 = textureSample(global_5, global_6, _e78.xy);
    let _e83 = textureSample(global_7, global_8, _e70.zw);
    let _e87 = global_9.member_13;
    let _e98 = (smoothstep(0.5f, 0.6f, _e83.w) * smoothstep(1f, 0.9f, _e83.w));
    let _e104 = global_9.member_7;
    let _e116 = mix(mix(mix(mix(mix(_e104.x, _e104.y, _e83.x), _e104.z, _e83.y), _e104.w, _e83.z), _e104.z, _e76.y), _e104.w, _e76.z);
    let _e117 = (((((_e74.w + (_e80.x * _e74.x)) * ((_e87 * 6f) + 1f)) + _e98) * max(clamp((_e76.y + _e76.z), 0f, 1f), smoothstep(0f, 0.5f, _e83.w))) * _e116);
    let _e119 = global_9.member_1;
    let _e120 = (_e119 * _e116);
    let _e125 = (0.56f - (0.06f * _e87));
    let _e129 = (0.54f - (_e87 * 0.12f));
    let _e139 = (_e83.xyz * vec3<f32>(smoothstep((0.58f + _e120), (_e125 - _e120), _e117), smoothstep((_e125 + _e120), (_e129 - _e120), _e117), smoothstep((_e129 + _e120), ((0.52f - (_e87 * 0.17999999f)) - _e120), _e117)).xyz);
    let _e145 = smoothstep((0.58f - _e120), (0.68f + _e120), _e117);
    let _e150 = textureSample(global_10, global_6, _e78.zw);
    let _e157 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e150, vec4(((pow((1f - _e74.x), 4f) * 0.25f) + (0.75f * _e87))));
    let _e159 = global_9.member_12;
    let _e168 = mix(mix(mix(mix(mix(_e159.x, _e159.y, _e139.x), _e159.z, _e139.y), _e159.w, _e139.z), _e159.z, _e76.y), _e159.w, _e76.z);
    let _e170 = global_9.member;
    phi_7078_ = vec4<f32>(_e70.xy, 0f, 1f);
    if (_e170 != 0i) {
        let _e172 = textureSample(global_11, global_2, _e73);
        let _e180 = global_9.member_9;
        let _e181 = (_e180 != 0i);
        if _e181 {
            let _e183 = global_9.member_10;
            phi_12885_ = mix(mix(mix(_e183.x, _e183.y, _e139.x), _e183.z, _e139.y), _e183.w, _e139.z);
        } else {
            let _e192 = global_9.member_8;
            phi_12885_ = _e192;
        }
        let _e194 = phi_12885_;
        phi_20271_ = _e194;
        if _e181 {
            let _e196 = global_9.member_10;
            phi_20271_ = mix(mix(_e194, _e196.z, _e76.y), _e196.w, _e76.z);
        }
        let _e202 = phi_20271_;
        let _e212 = mix(vec4<f32>(min(1f, (_e202 + ((((1f - _e157.w) * _e87) * _e87) * 0.5f))), _e168, 0f, 1f), vec4<f32>(_e172.x, _e172.y, _e172.z, _e172.w), vec4(_e145));
        let _e213 = (1f - _e145);
        let _e220 = global_9.member_11;
        let _e222 = vec4<f32>(_e212.x, _e212.y, _e213, _e212.w).xyz;
        let _e223 = (_e222 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e226 = pow(((_e222 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e212.x <= 0.04045f) {
            phi_21354_ = _e223.x;
        } else {
            phi_21354_ = _e226.x;
        }
        let _e232 = phi_21354_;
        if (_e212.y <= 0.04045f) {
            phi_23035_ = _e223.y;
        } else {
            phi_23035_ = _e226.y;
        }
        let _e238 = phi_23035_;
        if (_e213 <= 0.04045f) {
            phi_19513_ = _e223.z;
        } else {
            phi_19513_ = _e226.z;
        }
        let _e243 = phi_19513_;
        let _e244 = vec4<f32>(_e232, _e238, _e213, min(1f, _e220));
        phi_7078_ = vec4<f32>(_e244.x, _e244.y, _e243, _e244.w);
    }
    let _e251 = phi_7078_;
    phi_22401_ = _e251;
    if (_e170 == 0i) {
        let _e253 = textureSample(global_12, global_2, _e73);
        let _e256 = global_9.member_2;
        let _e258 = global_9.member_3;
        let _e262 = global_9.member_4;
        let _e266 = global_9.member_5;
        let _e273 = global_9.member_6;
        let _e276 = clamp((mix(mix(mix(mix(mix(_e256, _e258, vec3(_e139.x)), _e262, vec3(_e139.y)), _e266, vec3(_e139.z)), _e262, vec3(_e76.y)), _e266, vec3(_e76.z)) * mix(_e273, 1f, (smoothstep(0f, 0.01f, _e145) * (1f - _e98)))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e279 = (_e276.xyz * _e157.xyz);
        let _e284 = global_9.member_14;
        let _e286 = global_9.member_15;
        let _e289 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e279.xyz));
        let _e297 = mix(_e284.xyz, _e286.xyz, vec3(_e168));
        let _e319 = mix(mix(_e279, ((_e289.xyz * mix(min(_e297.x, dot(_e276.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e297.z, clamp(pow(max(_e279.x, max(_e279.y, _e279.z)), _e297.y), 0f, 1f))) / vec3(max(_e289.x, max(_e289.y, _e289.z)))).xyz, vec3(_e87)), _e253.xyz, vec3(_e145));
        phi_22401_ = vec4<f32>(_e319.x, _e319.y, _e319.z, 1f);
    }
    let _e325 = phi_22401_;
    let _e326 = textureSample(global_13, global_6, _e73);
    phi_6805_ = _e325;
    if (_e326.w < 0f) {
        let _e334 = vec4<f32>(_e326.x, _e325.y, _e325.z, _e325.w);
        let _e340 = vec4<f32>(_e334.x, _e326.y, _e334.z, _e334.w);
        phi_6805_ = vec4<f32>(_e340.x, _e340.y, _e326.z, _e340.w);
    }
    let _e348 = phi_6805_;
    global_14 = _e348;
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
