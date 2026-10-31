struct type_8 {
    member: i32,
    member_1: i32,
    member_2: i32,
    member_3: vec3<f32>,
    member_4: vec3<f32>,
    member_5: vec3<f32>,
    member_6: vec3<f32>,
    member_7: f32,
    member_8: i32,
    member_9: f32,
    member_10: f32,
    member_11: f32,
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
@group(1) @binding(41) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(40) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(43) 
var global_11: texture_2d<f32>;
@group(1) @binding(42) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(37) 
var global_14: texture_2d<f32>;
@group(1) @binding(38) 
var global_15: texture_2d<f32>;
@group(1) @binding(34) 
var global_16: texture_2d<f32>;
@group(1) @binding(39) 
var global_17: texture_2d<f32>;
var<private> global_18: vec4<f32>;

fn function_() {
    var phi_20940_: f32;
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e76 = global;
    let _e79 = _e76.xy;
    let _e80 = textureSample(global_1, global_2, _e79);
    let _e82 = pow(_e80.x, 1.5f);
    let _e83 = (_e82 * 0.96f);
    let _e85 = textureSample(global_3, global_2, _e79);
    let _e87 = global_4;
    let _e89 = textureSample(global_5, global_6, _e87.xy);
    let _e91 = _e76.zw;
    let _e92 = textureSample(global_7, global_8, _e91);
    let _e93 = textureSample(global_9, global_6, _e79);
    let _e96 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e93, (vec4<f32>(1f, 1f, 1f, 1f) - _e93)));
    let _e103 = global_10.member_12;
    let _e107 = (mix(0.5f, pow(_e83, 0.85f), _e103) * mix(1f, (_e80.y * (min(_e96.x, _e96.y) * 2f)), _e103));
    let _e112 = global_10.member_11;
    let _e121 = global_10.member_13;
    let _e124 = textureSample(global_11, global_2, vec2<f32>(mix((_e107 * 2f), (_e107 + _e92.x), _e112), (max((_e92.y * _e112), (((1f - _e80.y) * 0.2f) * _e103)) + _e121)));
    let _e127 = textureSample(global_12, global_6, _e87.zw);
    let _e138 = global_10.member_10;
    let _e148 = smoothstep(0.2f, 0.6f, (((_e89.x * _e80.y) * (_e89.x * smoothstep(0.2f, 0.3f, _e83))) * _e138));
    let _e157 = (smoothstep((0.5f * _e138), 0f, clamp((((_e82 * 11.5199995f) * _e80.y) - ((_e138 * clamp(((_e127.x * _e127.y) * _e127.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e138);
    let _e158 = (1f - _e157);
    let _e162 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e127, vec4(((pow((1f - _e83), 4f) * 0.25f) + (0.75f * _e138)))), vec4(clamp((_e148 * 2f), 0f, 1f)));
    let _e164 = global_10.member;
    if (_e164 != 0i) {
        let _e166 = textureSample(global_13, global_2, _e79);
        let _e169 = global_10.member_1;
        if (_e169 != 0i) {
            let _e171 = textureSample(global_14, global_6, _e91);
            phi_20940_ = _e171.x;
        } else {
            let _e173 = textureSample(global_14, global_6, _e79);
            phi_20940_ = _e173.x;
        }
        let _e176 = phi_20940_;
        let _e188 = dot(_e162.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e198 = ((1f - _e162.w) * _e138);
        let _e201 = clamp((((((_e176 * (1f - (0.25f * dot(_e124.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))))) * mix(1f, 0.9f, _e148)) + (((1f - _e188) * _e138) * 0.05f)) + ((_e157 * 0.15f) * _e138)) + (_e198 * 0.15f)), 0f, 1f);
        let _e212 = mix((_e124.w * mix(1f, pow(((_e158 * _e162.w) * _e188), 0.5f), _e138)), 1f, _e148);
        let _e218 = vec4<f32>(mix(_e166.x, mix(min(1f, (_e201 + ((_e198 * _e138) * 0.5f))), _e201, _e85.x), (step(_e80.w, 0.996f) * _e85.x)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e225 = vec4<f32>(_e218.x, mix(_e166.y, _e212, _e85.x), _e218.z, _e218.w);
        let _e226 = (1f - _e80.w);
        let _e228 = global_10.member_2;
        if (_e228 != 0i) {
            let _e230 = textureSample(global_15, global_6, _e91);
            phi_21709_ = vec4<f32>(_e225.x, _e225.y, (_e226 * _e230.x), _e225.w);
        } else {
            let _e238 = textureSample(global_15, global_6, _e79);
            let _e240 = (_e226 * _e238.x);
            phi_21709_ = vec4<f32>(_e225.x, _e225.y, (_e240 * _e240), _e225.w);
        }
        let _e248 = phi_21709_;
        let _e250 = global_10.member_9;
        let _e252 = _e248.xyz;
        let _e253 = (_e252 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e256 = pow(((_e252 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e248.x <= 0.04045f) {
            phi_21354_ = _e253.x;
        } else {
            phi_21354_ = _e256.x;
        }
        let _e262 = phi_21354_;
        if (_e248.y <= 0.04045f) {
            phi_21355_ = _e253.y;
        } else {
            phi_21355_ = _e256.y;
        }
        let _e268 = phi_21355_;
        if (_e248.z <= 0.04045f) {
            phi_22686_ = _e253.z;
        } else {
            phi_22686_ = _e256.z;
        }
        let _e274 = phi_22686_;
        phi_11711_ = vec4<f32>(_e262, _e268, _e274, min(1f, _e250));
        phi_10247_ = _e212;
    } else {
        phi_11711_ = vec4<f32>(_e76.xy, 0f, 1f);
        phi_10247_ = _e124.w;
    }
    let _e277 = phi_11711_;
    let _e279 = phi_10247_;
    phi_22401_ = _e277;
    if (_e164 == 0i) {
        let _e281 = textureSample(global_16, global_2, _e79);
        let _e283 = vec3(_e138);
        let _e285 = global_10.member_4;
        let _e287 = global_10.member_5;
        let _e289 = _e124.xyz;
        let _e291 = global_10.member_7;
        let _e295 = global_10.member_8;
        let _e299 = mix(_e289, (_e289 * _e291), vec3(max(_e85.x, f32(_e295))));
        let _e305 = vec4<f32>(_e299.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e311 = vec4<f32>(_e305.x, _e299.y, _e305.z, _e305.w);
        let _e317 = vec4<f32>(_e311.x, _e311.y, _e299.z, _e311.w);
        let _e321 = global_10.member_6;
        let _e325 = _e317.xyz;
        let _e329 = global_10.member_3;
        let _e337 = (mix((mix(mix(_e285, _e321, vec3(pow(_e138, 0.5f))), mix(_e285, _e287, _e283), vec3(_e158)) * _e325), (_e329 * dot(_e317.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e148)).xyz * _e162.xyz);
        let _e342 = global_10.member_14;
        let _e344 = global_10.member_15;
        let _e347 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e337.xyz));
        let _e355 = mix(_e342.xyz, _e344.xyz, vec3(_e279));
        let _e376 = mix(mix(_e337, ((_e347.xyz * mix(min(_e355.x, dot((_e325 * _e285).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e355.z, clamp(pow(max(_e337.x, max(_e337.y, _e337.z)), _e355.y), 0f, 1f))) / vec3(max(_e347.x, max(_e347.y, _e347.z)))).xyz, _e283), _e281.xyz, vec3((1f - _e85.x)));
        phi_22401_ = vec4<f32>(_e376.x, _e376.y, _e376.z, 1f);
    }
    let _e382 = phi_22401_;
    let _e383 = textureSample(global_17, global_6, _e79);
    phi_6805_ = _e382;
    if (_e383.w < 0f) {
        let _e391 = vec4<f32>(_e383.x, _e382.y, _e382.z, _e382.w);
        let _e397 = vec4<f32>(_e391.x, _e383.y, _e391.z, _e391.w);
        phi_6805_ = vec4<f32>(_e397.x, _e397.y, _e383.z, _e397.w);
    }
    let _e405 = phi_6805_;
    global_18 = _e405;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_18;
    return _e5;
}
