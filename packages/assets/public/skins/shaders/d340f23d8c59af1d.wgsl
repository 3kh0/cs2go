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
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(37) 
var global_14: texture_2d<f32>;
var<private> global_15: vec4<f32>;

fn function_() {
    var phi_21903_: f32;
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e69 = global;
    let _e72 = _e69.xy;
    let _e73 = textureSample(global_1, global_2, _e72);
    let _e76 = textureSample(global_3, global_2, _e72);
    let _e79 = (1f - _e76.x);
    let _e81 = global_4;
    let _e83 = textureSample(global_5, global_6, _e81.xy);
    let _e85 = _e69.zw;
    let _e86 = textureSample(global_7, global_8, _e85);
    let _e90 = global_9.member_12;
    let _e100 = max(0f, smoothstep(0f, 0.5f, _e86.w));
    let _e101 = ((((min(_e73.w, _e79) + (_e83.x * _e73.x)) * ((_e90 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e86.w) * smoothstep(1f, 0.9f, _e86.w))) * _e100);
    let _e103 = global_9.member_2;
    let _e104 = (_e103 * _e100);
    let _e108 = (_e76.x > 0.99f);
    let _e110 = mix(smoothstep((0.58f - _e104), (0.68f + _e104), _e101), _e101, select(0f, 1f, _e108));
    let _e112 = textureSample(global_10, global_6, _e81.zw);
    let _e126 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e112, vec4(((pow((1f - _e73.x), 4f) * 0.25f) + (0.75f * _e90))));
    let _e131 = smoothstep(0.1f, 0.2f, (((_e83.x * _e73.y) * (_e73.x * _e73.x)) * _e90));
    let _e138 = smoothstep(0f, 0.15f, ((clamp(((_e73.x * _e73.y) - (_e90 * 0.1f)), 0f, 1f) - (clamp(((_e112.x * _e112.y) * _e112.z), 0f, 1f) * 0.23f)) + 0.08f));
    let _e140 = global_9.member;
    if (_e140 != 0i) {
        let _e142 = textureSample(global_11, global_2, _e72);
        let _e144 = (1f - _e110);
        let _e147 = global_9.member_1;
        if (_e147 != 0i) {
            let _e149 = textureSample(global_12, global_6, _e85);
            phi_21903_ = _e149.x;
        } else {
            let _e151 = textureSample(global_12, global_6, _e72);
            phi_21903_ = _e151.x;
        }
        let _e154 = phi_21903_;
        let _e159 = dot(_e126.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e170 = ((1f - _e126.w) * _e90);
        let _e173 = clamp(((((_e154 * mix(1f, 0.9f, _e131)) + (((1f - _e159) * _e90) * 0.05f)) + (((1f - _e138) * 0.15f) * _e90)) + (_e170 * 0.15f)), 0f, 1f);
        let _e183 = mix(mix(1f, pow(((_e138 * _e126.w) * _e159), 0.5f), _e90), 1f, _e131);
        let _e189 = vec4<f32>(mix(_e142.x, mix(min(1f, (_e173 + ((_e170 * _e90) * 0.5f))), _e173, _e76.x), select(max(0f, _e144), 1f, _e108)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e192 = global_9.member_11;
        let _e199 = vec4<f32>(_e189.x, mix(mix(_e192, _e142.y, _e110), _e183, _e76.x), _e189.z, _e189.w);
        let _e204 = vec4<f32>(_e199.x, _e199.y, _e144, _e199.w);
        let _e206 = global_9.member_10;
        phi_21709_ = _e204;
        if (_e206 != 0i) {
            phi_21709_ = vec4<f32>(_e204.x, _e204.y, (_e144 * _e76.x), _e204.w);
        }
        let _e215 = phi_21709_;
        let _e217 = global_9.member_9;
        let _e219 = _e215.xyz;
        let _e220 = (_e219 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e223 = pow(((_e219 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e215.x <= 0.04045f) {
            phi_21354_ = _e220.x;
        } else {
            phi_21354_ = _e223.x;
        }
        let _e229 = phi_21354_;
        if (_e215.y <= 0.04045f) {
            phi_21355_ = _e220.y;
        } else {
            phi_21355_ = _e223.y;
        }
        let _e235 = phi_21355_;
        if (_e215.z <= 0.04045f) {
            phi_22686_ = _e220.z;
        } else {
            phi_22686_ = _e223.z;
        }
        let _e241 = phi_22686_;
        phi_11711_ = vec4<f32>(_e229, _e235, _e241, min(1f, _e217));
        phi_10247_ = _e183;
    } else {
        phi_11711_ = vec4<f32>(_e69.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e244 = phi_11711_;
    let _e246 = phi_10247_;
    phi_22401_ = _e244;
    if (_e140 == 0i) {
        let _e248 = textureSample(global_13, global_2, _e72);
        let _e250 = vec3(_e90);
        let _e252 = global_9.member_4;
        let _e254 = global_9.member_5;
        let _e256 = _e86.xyz;
        let _e258 = global_9.member_7;
        let _e261 = global_9.member_8;
        let _e265 = mix(_e256, (_e256 * _e258), vec3(max(_e76.x, f32(_e261))));
        let _e271 = vec4<f32>(_e265.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e277 = vec4<f32>(_e271.x, _e265.y, _e271.z, _e271.w);
        let _e283 = vec4<f32>(_e277.x, _e277.y, _e265.z, _e277.w);
        let _e287 = global_9.member_6;
        let _e291 = _e283.xyz;
        let _e295 = global_9.member_3;
        let _e299 = vec3(_e76.x);
        let _e306 = (mix(_e291, mix((mix(mix(_e252, _e287, vec3(pow(_e90, 0.5f))), mix(_e252, _e254, _e250), vec3(_e138)) * _e291), (_e295 * dot(_e283.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e131)), _e299).xyz * _e126.xyz);
        let _e311 = global_9.member_11;
        let _e314 = global_9.member_13;
        let _e316 = global_9.member_14;
        let _e319 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e306.xyz));
        let _e327 = mix(_e314.xyz, _e316.xyz, vec3(mix(_e311, _e246, _e76.x)));
        let _e348 = mix(mix(_e306, ((_e319.xyz * mix(min(_e327.x, dot(mix(_e291, (_e291 * _e252), _e299).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e327.z, clamp(pow(max(_e306.x, max(_e306.y, _e306.z)), _e327.y), 0f, 1f))) / vec3(max(_e319.x, max(_e319.y, _e319.z)))).xyz, _e250), _e248.xyz, vec3((_e110 * _e79)));
        phi_22401_ = vec4<f32>(_e348.x, _e348.y, _e348.z, 1f);
    }
    let _e354 = phi_22401_;
    let _e355 = textureSample(global_14, global_6, _e72);
    phi_6805_ = _e354;
    if (_e355.w < 0f) {
        let _e363 = vec4<f32>(_e355.x, _e354.y, _e354.z, _e354.w);
        let _e369 = vec4<f32>(_e363.x, _e355.y, _e363.z, _e363.w);
        phi_6805_ = vec4<f32>(_e369.x, _e369.y, _e355.z, _e369.w);
    }
    let _e377 = phi_6805_;
    global_15 = _e377;
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
