struct type_8 {
    member: i32,
    member_1: i32,
    member_2: i32,
    member_3: i32,
    member_4: f32,
    member_5: vec3<f32>,
    member_6: vec3<f32>,
    member_7: vec3<f32>,
    member_8: vec3<f32>,
    member_9: f32,
    member_10: i32,
    member_11: f32,
    member_12: i32,
    member_13: f32,
    member_14: f32,
    member_15: f32,
    member_16: f32,
    member_17: vec3<f32>,
    member_18: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(42) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(41) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(44) 
var global_11: texture_2d<f32>;
@group(1) @binding(43) 
var global_12: texture_2d<f32>;
@group(1) @binding(39) 
var global_13: texture_2d<f32>;
@group(1) @binding(35) 
var global_14: texture_2d<f32>;
@group(1) @binding(37) 
var global_15: texture_2d<f32>;
@group(1) @binding(38) 
var global_16: texture_2d<f32>;
@group(1) @binding(34) 
var global_17: texture_2d<f32>;
@group(1) @binding(40) 
var global_18: texture_2d<f32>;
var<private> global_19: vec4<f32>;

fn function_() {
    var phi_21709_: f32;
    var phi_20940_: f32;
    var phi_21710_: vec4<f32>;
    var phi_21711_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e94 = global;
    let _e97 = _e94.xy;
    let _e98 = textureSample(global_1, global_2, _e97);
    let _e100 = pow(_e98.x, 1.5f);
    let _e101 = (_e100 * 0.96f);
    let _e103 = textureSample(global_3, global_2, _e97);
    let _e106 = (1f - _e103.x);
    let _e108 = global_4;
    let _e110 = textureSample(global_5, global_6, _e108.xy);
    let _e112 = _e94.zw;
    let _e113 = textureSample(global_7, global_8, _e112);
    let _e114 = textureSample(global_9, global_6, _e97);
    let _e117 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e114, (vec4<f32>(1f, 1f, 1f, 1f) - _e114)));
    let _e124 = global_10.member_15;
    let _e128 = (mix(0.5f, pow(_e101, 0.85f), _e124) * mix(1f, (_e98.y * (min(_e117.x, _e117.y) * 2f)), _e124));
    let _e129 = (_e128 * 2f);
    let _e133 = global_10.member_14;
    let _e142 = global_10.member_16;
    let _e143 = (max((_e113.y * _e133), (((1f - _e98.y) * 0.2f) * _e124)) + _e142);
    let _e144 = _e94.zw;
    let _e147 = textureSample(global_7, global_8, (_e144 + vec2<f32>(0.00048828125f, 0.00048828125f)).xy);
    let _e150 = textureSample(global_7, global_8, (_e144 + vec2<f32>(-0.00048828125f, -0.00048828125f)).xy);
    let _e153 = textureSample(global_7, global_8, (_e144 + vec2<f32>(-0.00048828125f, 0.00048828125f)).xy);
    let _e156 = textureSample(global_7, global_8, (_e144 + vec2<f32>(0.00048828125f, -0.00048828125f)).xy);
    let _e170 = textureSample(global_11, global_2, vec2<f32>(mix(_e129, (_e128 + _e113.x), _e133), _e143));
    let _e173 = textureSample(global_11, global_2, vec2<f32>(mix(_e129, (_e128 + _e147.x), _e133), _e143));
    let _e178 = textureSample(global_11, global_2, vec2<f32>(mix(_e129, (_e128 + _e150.x), _e133), _e143));
    let _e183 = textureSample(global_11, global_2, vec2<f32>(mix(_e129, (_e128 + _e153.x), _e133), _e143));
    let _e188 = textureSample(global_11, global_2, vec2<f32>(mix(_e129, (_e128 + _e156.x), _e133), _e143));
    let _e197 = mix(_e113.xyzw, (((((_e170.xyzw + _e173.xyzw).xyzw + _e178.xyzw).xyzw + _e183.xyzw).xyzw + _e188.xyzw).xyzw * 0.2f).xyzw, vec4(_e103.y));
    let _e199 = mix(1f, _e197.w, _e103.y);
    let _e204 = global_10.member_13;
    let _e217 = max(0f, smoothstep(0f, 0.5f, _e197.w));
    let _e218 = ((((min(_e98.w, _e106) + (_e110.x * mix(smoothstep(0f, 0.72f, pow(_e101, 1.3f)), smoothstep(0f, 0.4f, _e101), pow(_e204, 1.2f)))) * ((_e204 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e197.w) * smoothstep(1f, 0.9f, _e197.w))) * _e217);
    let _e220 = global_10.member_4;
    let _e221 = (_e220 * _e217);
    let _e225 = (_e103.x > 0.99f);
    let _e227 = mix(smoothstep((0.58f - _e221), (0.68f + _e221), _e218), _e218, select(0f, 1f, _e225));
    let _e229 = textureSample(global_12, global_6, _e108.zw);
    let _e248 = smoothstep(0.2f, 0.6f, (((_e110.x * _e98.y) * (_e110.x * smoothstep(0.2f, 0.3f, _e101))) * _e204));
    let _e257 = (smoothstep((0.5f * _e204), 0f, clamp((((_e100 * 11.5199995f) * _e98.y) - ((_e204 * clamp(((_e229.x * _e229.y) * _e229.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e204);
    let _e258 = (1f - _e257);
    let _e262 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e229, vec4(((pow((1f - _e101), 4f) * 0.25f) + (0.75f * _e204)))), vec4(clamp((_e248 * 2f), 0f, 1f)));
    let _e264 = global_10.member_3;
    if (_e264 != 0i) {
        let _e266 = textureSample(global_13, global_6, _e112);
        phi_21709_ = _e266.x;
    } else {
        let _e268 = textureSample(global_13, global_6, _e97);
        phi_21709_ = _e268.x;
    }
    let _e271 = phi_21709_;
    let _e273 = global_10.member;
    if (_e273 != 0i) {
        let _e275 = textureSample(global_14, global_2, _e97);
        let _e277 = (1f - _e227);
        let _e280 = global_10.member_1;
        if (_e280 != 0i) {
            let _e282 = textureSample(global_15, global_6, _e112);
            phi_20940_ = _e282.x;
        } else {
            let _e284 = textureSample(global_15, global_6, _e97);
            phi_20940_ = _e284.x;
        }
        let _e287 = phi_20940_;
        let _e298 = dot(_e262.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e308 = ((1f - _e262.w) * _e204);
        let _e311 = clamp(((((mix(_e287, (_e287 * (1f - (0.25f * dot(_e197.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))))), _e103.y) * mix(1f, 0.9f, _e248)) + (((1f - _e298) * _e204) * 0.05f)) + ((_e257 * 0.15f) * _e204)) + (_e308 * 0.15f)), 0f, 1f);
        let _e322 = mix((_e199 * mix(1f, pow(((_e258 * _e262.w) * _e298), 0.5f), _e204)), 1f, _e248);
        let _e328 = vec4<f32>(mix(_e275.x, mix(min(1f, (_e311 + ((_e308 * _e204) * 0.5f))), _e311, _e103.x), select(max(0f, _e277), 1f, _e225)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e336 = vec4<f32>(_e328.x, mix(mix(_e271, _e275.y, _e227), _e322, _e103.x), _e328.z, _e328.w);
        let _e338 = global_10.member_2;
        if (_e338 != 0i) {
            let _e340 = textureSample(global_16, global_6, _e112);
            phi_21710_ = vec4<f32>(_e336.x, _e336.y, (_e277 * _e340.x), _e336.w);
        } else {
            let _e348 = textureSample(global_16, global_6, _e97);
            let _e350 = (_e277 * _e348.x);
            phi_21710_ = vec4<f32>(_e336.x, _e336.y, (_e350 * _e350), _e336.w);
        }
        let _e358 = phi_21710_;
        let _e360 = global_10.member_12;
        phi_21711_ = _e358;
        if (_e360 != 0i) {
            phi_21711_ = vec4<f32>(_e358.x, _e358.y, (_e358.z * _e103.x), _e358.w);
        }
        let _e370 = phi_21711_;
        let _e372 = global_10.member_11;
        let _e374 = _e370.xyz;
        let _e375 = (_e374 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e378 = pow(((_e374 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e370.x <= 0.04045f) {
            phi_21354_ = _e375.x;
        } else {
            phi_21354_ = _e378.x;
        }
        let _e384 = phi_21354_;
        if (_e370.y <= 0.04045f) {
            phi_21355_ = _e375.y;
        } else {
            phi_21355_ = _e378.y;
        }
        let _e390 = phi_21355_;
        if (_e370.z <= 0.04045f) {
            phi_22686_ = _e375.z;
        } else {
            phi_22686_ = _e378.z;
        }
        let _e396 = phi_22686_;
        phi_11711_ = vec4<f32>(_e384, _e390, _e396, min(1f, _e372));
        phi_10247_ = _e322;
    } else {
        phi_11711_ = vec4<f32>(_e94.xy, 0f, 1f);
        phi_10247_ = _e199;
    }
    let _e399 = phi_11711_;
    let _e401 = phi_10247_;
    phi_22401_ = _e399;
    if (_e273 == 0i) {
        let _e403 = textureSample(global_17, global_2, _e97);
        let _e405 = vec3(_e204);
        let _e407 = global_10.member_6;
        let _e409 = global_10.member_7;
        let _e411 = _e197.xyz;
        let _e413 = global_10.member_9;
        let _e416 = global_10.member_10;
        let _e420 = mix(_e411, (_e411 * _e413), vec3(max(_e103.x, f32(_e416))));
        let _e426 = vec4<f32>(_e420.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e432 = vec4<f32>(_e426.x, _e420.y, _e426.z, _e426.w);
        let _e438 = vec4<f32>(_e432.x, _e432.y, _e420.z, _e432.w);
        let _e442 = global_10.member_8;
        let _e446 = _e438.xyz;
        let _e450 = global_10.member_5;
        let _e454 = vec3(_e103.x);
        let _e461 = (mix(_e446, mix((mix(mix(_e407, _e442, vec3(pow(_e204, 0.5f))), mix(_e407, _e409, _e405), vec3(_e258)) * _e446), (_e450 * dot(_e438.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e248)), _e454).xyz * _e262.xyz);
        let _e467 = global_10.member_17;
        let _e469 = global_10.member_18;
        let _e472 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e461.xyz));
        let _e480 = mix(_e467.xyz, _e469.xyz, vec3(mix(_e271, _e401, _e103.x)));
        let _e501 = mix(mix(_e461, ((_e472.xyz * mix(min(_e480.x, dot(mix(_e446, (_e446 * _e407), _e454).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e480.z, clamp(pow(max(_e461.x, max(_e461.y, _e461.z)), _e480.y), 0f, 1f))) / vec3(max(_e472.x, max(_e472.y, _e472.z)))).xyz, _e405), _e403.xyz, vec3((_e227 * _e106)));
        phi_22401_ = vec4<f32>(_e501.x, _e501.y, _e501.z, 1f);
    }
    let _e507 = phi_22401_;
    let _e508 = textureSample(global_18, global_6, _e97);
    phi_6805_ = _e507;
    if (_e508.w < 0f) {
        let _e516 = vec4<f32>(_e508.x, _e507.y, _e507.z, _e507.w);
        let _e522 = vec4<f32>(_e516.x, _e508.y, _e516.z, _e516.w);
        phi_6805_ = vec4<f32>(_e522.x, _e522.y, _e508.z, _e522.w);
    }
    let _e530 = phi_6805_;
    global_19 = _e530;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_19;
    return _e5;
}
