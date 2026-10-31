struct type_8 {
    member: i32,
    member_1: i32,
    member_2: i32,
    member_3: f32,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: vec3<f32>,
    member_7: vec3<f32>,
    member_8: f32,
    member_9: i32,
    member_10: f32,
    member_11: i32,
    member_12: f32,
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
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
@group(1) @binding(37) 
var global_13: texture_2d<f32>;
@group(1) @binding(34) 
var global_14: texture_2d<f32>;
@group(1) @binding(38) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_21903_: f32;
    var phi_21709_: vec4<f32>;
    var phi_21710_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e71 = global;
    let _e74 = _e71.xy;
    let _e75 = textureSample(global_1, global_2, _e74);
    let _e78 = textureSample(global_3, global_2, _e74);
    let _e81 = (1f - _e78.x);
    let _e83 = global_4;
    let _e85 = textureSample(global_5, global_6, _e83.xy);
    let _e87 = _e71.zw;
    let _e88 = textureSample(global_7, global_8, _e87);
    let _e92 = global_9.member_13;
    let _e102 = max(0f, smoothstep(0f, 0.5f, _e88.w));
    let _e103 = ((((min(_e75.w, _e81) + (_e85.x * _e75.x)) * ((_e92 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e88.w) * smoothstep(1f, 0.9f, _e88.w))) * _e102);
    let _e105 = global_9.member_3;
    let _e106 = (_e105 * _e102);
    let _e110 = (_e78.x > 0.99f);
    let _e112 = mix(smoothstep((0.58f - _e106), (0.68f + _e106), _e103), _e103, select(0f, 1f, _e110));
    let _e114 = textureSample(global_10, global_6, _e83.zw);
    let _e128 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e114, vec4(((pow((1f - _e75.x), 4f) * 0.25f) + (0.75f * _e92))));
    let _e133 = smoothstep(0.1f, 0.2f, (((_e85.x * _e75.y) * (_e75.x * _e75.x)) * _e92));
    let _e140 = smoothstep(0f, 0.15f, ((clamp(((_e75.x * _e75.y) - (_e92 * 0.1f)), 0f, 1f) - (clamp(((_e114.x * _e114.y) * _e114.z), 0f, 1f) * 0.23f)) + 0.08f));
    let _e142 = global_9.member;
    if (_e142 != 0i) {
        let _e144 = textureSample(global_11, global_2, _e74);
        let _e146 = (1f - _e112);
        let _e149 = global_9.member_1;
        if (_e149 != 0i) {
            let _e151 = textureSample(global_12, global_6, _e87);
            phi_21903_ = _e151.x;
        } else {
            let _e153 = textureSample(global_12, global_6, _e74);
            phi_21903_ = _e153.x;
        }
        let _e156 = phi_21903_;
        let _e161 = dot(_e128.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e172 = ((1f - _e128.w) * _e92);
        let _e175 = clamp(((((_e156 * mix(1f, 0.9f, _e133)) + (((1f - _e161) * _e92) * 0.05f)) + (((1f - _e140) * 0.15f) * _e92)) + (_e172 * 0.15f)), 0f, 1f);
        let _e185 = mix(mix(1f, pow(((_e140 * _e128.w) * _e161), 0.5f), _e92), 1f, _e133);
        let _e191 = vec4<f32>(mix(_e144.x, mix(min(1f, (_e175 + ((_e172 * _e92) * 0.5f))), _e175, _e78.x), select(max(0f, _e146), 1f, _e110)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e194 = global_9.member_12;
        let _e201 = vec4<f32>(_e191.x, mix(mix(_e194, _e144.y, _e112), _e185, _e78.x), _e191.z, _e191.w);
        let _e203 = global_9.member_2;
        if (_e203 != 0i) {
            let _e205 = textureSample(global_13, global_6, _e87);
            phi_21709_ = vec4<f32>(_e201.x, _e201.y, (_e146 * _e205.x), _e201.w);
        } else {
            let _e213 = textureSample(global_13, global_6, _e74);
            let _e215 = (_e146 * _e213.x);
            phi_21709_ = vec4<f32>(_e201.x, _e201.y, (_e215 * _e215), _e201.w);
        }
        let _e223 = phi_21709_;
        let _e225 = global_9.member_11;
        phi_21710_ = _e223;
        if (_e225 != 0i) {
            phi_21710_ = vec4<f32>(_e223.x, _e223.y, (_e223.z * _e78.x), _e223.w);
        }
        let _e235 = phi_21710_;
        let _e237 = global_9.member_10;
        let _e239 = _e235.xyz;
        let _e240 = (_e239 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e243 = pow(((_e239 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e235.x <= 0.04045f) {
            phi_21354_ = _e240.x;
        } else {
            phi_21354_ = _e243.x;
        }
        let _e249 = phi_21354_;
        if (_e235.y <= 0.04045f) {
            phi_21355_ = _e240.y;
        } else {
            phi_21355_ = _e243.y;
        }
        let _e255 = phi_21355_;
        if (_e235.z <= 0.04045f) {
            phi_22686_ = _e240.z;
        } else {
            phi_22686_ = _e243.z;
        }
        let _e261 = phi_22686_;
        phi_11711_ = vec4<f32>(_e249, _e255, _e261, min(1f, _e237));
        phi_10247_ = _e185;
    } else {
        phi_11711_ = vec4<f32>(_e71.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e264 = phi_11711_;
    let _e266 = phi_10247_;
    phi_22401_ = _e264;
    if (_e142 == 0i) {
        let _e268 = textureSample(global_14, global_2, _e74);
        let _e270 = vec3(_e92);
        let _e272 = global_9.member_5;
        let _e274 = global_9.member_6;
        let _e276 = _e88.xyz;
        let _e278 = global_9.member_8;
        let _e281 = global_9.member_9;
        let _e285 = mix(_e276, (_e276 * _e278), vec3(max(_e78.x, f32(_e281))));
        let _e291 = vec4<f32>(_e285.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e297 = vec4<f32>(_e291.x, _e285.y, _e291.z, _e291.w);
        let _e303 = vec4<f32>(_e297.x, _e297.y, _e285.z, _e297.w);
        let _e307 = global_9.member_7;
        let _e311 = _e303.xyz;
        let _e315 = global_9.member_4;
        let _e319 = vec3(_e78.x);
        let _e326 = (mix(_e311, mix((mix(mix(_e272, _e307, vec3(pow(_e92, 0.5f))), mix(_e272, _e274, _e270), vec3(_e140)) * _e311), (_e315 * dot(_e303.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e133)), _e319).xyz * _e128.xyz);
        let _e331 = global_9.member_12;
        let _e334 = global_9.member_14;
        let _e336 = global_9.member_15;
        let _e339 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e326.xyz));
        let _e347 = mix(_e334.xyz, _e336.xyz, vec3(mix(_e331, _e266, _e78.x)));
        let _e368 = mix(mix(_e326, ((_e339.xyz * mix(min(_e347.x, dot(mix(_e311, (_e311 * _e272), _e319).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e347.z, clamp(pow(max(_e326.x, max(_e326.y, _e326.z)), _e347.y), 0f, 1f))) / vec3(max(_e339.x, max(_e339.y, _e339.z)))).xyz, _e270), _e268.xyz, vec3((_e112 * _e81)));
        phi_22401_ = vec4<f32>(_e368.x, _e368.y, _e368.z, 1f);
    }
    let _e374 = phi_22401_;
    let _e375 = textureSample(global_15, global_6, _e74);
    phi_6805_ = _e374;
    if (_e375.w < 0f) {
        let _e383 = vec4<f32>(_e375.x, _e374.y, _e374.z, _e374.w);
        let _e389 = vec4<f32>(_e383.x, _e375.y, _e383.z, _e383.w);
        phi_6805_ = vec4<f32>(_e389.x, _e389.y, _e375.z, _e389.w);
    }
    let _e397 = phi_6805_;
    global_16 = _e397;
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
