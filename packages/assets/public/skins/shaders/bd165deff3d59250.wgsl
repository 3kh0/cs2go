struct type_8 {
    member: i32,
    member_1: i32,
    member_2: i32,
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
@group(1) @binding(41) 
var global_4: texture_2d<f32>;
@group(1) @binding(22) 
var global_5: sampler;
@group(1) @binding(40) 
var global_6: texture_2d<f32>;
@group(1) @binding(27) 
var global_7: sampler;
@group(1) @binding(0) 
var<storage> global_8: type_8;
@group(1) @binding(42) 
var global_9: texture_2d<f32>;
@group(1) @binding(35) 
var global_10: texture_2d<f32>;
@group(1) @binding(37) 
var global_11: texture_2d<f32>;
@group(1) @binding(38) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
@group(1) @binding(39) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

fn function_() {
    var phi_20271_: f32;
    var phi_21709_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e65 = global;
    let _e68 = _e65.xy;
    let _e69 = textureSample(global_1, global_2, _e68);
    let _e72 = (pow(_e69.x, 1.5f) * 0.96f);
    let _e74 = global_3;
    let _e76 = textureSample(global_4, global_5, _e74.xy);
    let _e78 = _e65.zw;
    let _e79 = textureSample(global_6, global_7, _e78);
    let _e84 = global_8.member_7;
    let _e98 = max(0f, smoothstep(0f, 0.5f, _e79.w));
    let _e101 = global_8.member_3;
    let _e102 = (_e101 * _e98);
    let _e105 = smoothstep((0.56f - _e102), (0.74f + _e102), ((((_e69.w + (_e76.x * mix(smoothstep(0f, 0.72f, pow(_e72, 1.3f)), smoothstep(0f, 0.4f, _e72), pow(_e84, 1.2f)))) * ((_e84 * 6f) + 1f)) + (smoothstep(0.5f, 0.6f, _e79.w) * smoothstep(1f, 0.9f, _e79.w))) * _e98));
    let _e107 = textureSample(global_9, global_5, _e74.zw);
    let _e114 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e107, vec4(((pow((1f - _e72), 4f) * 0.25f) + (0.75f * _e84))));
    let _e116 = global_8.member;
    phi_7078_ = vec4<f32>(_e65.xy, 0f, 1f);
    if (_e116 != 0i) {
        let _e118 = textureSample(global_10, global_2, _e68);
        let _e126 = global_8.member_1;
        if (_e126 != 0i) {
            let _e128 = textureSample(global_11, global_5, _e78);
            phi_20271_ = _e128.x;
        } else {
            let _e130 = textureSample(global_11, global_5, _e68);
            phi_20271_ = _e130.x;
        }
        let _e133 = phi_20271_;
        let _e142 = global_8.member_6;
        let _e145 = mix(vec4<f32>(min(1f, (_e133 + ((((1f - _e114.w) * _e84) * _e84) * 0.5f))), _e142, 0f, 1f), vec4<f32>(_e118.x, _e118.y, _e118.z, _e118.w), vec4(_e105));
        let _e146 = (1f - _e105);
        let _e148 = global_8.member_2;
        if (_e148 != 0i) {
            let _e150 = textureSample(global_12, global_5, _e78);
            phi_21709_ = vec4<f32>(_e145.x, _e145.y, (_e146 * _e150.x), _e145.w);
        } else {
            let _e158 = textureSample(global_12, global_5, _e68);
            let _e160 = (_e146 * _e158.x);
            phi_21709_ = vec4<f32>(_e145.x, _e145.y, (_e160 * _e160), _e145.w);
        }
        let _e168 = phi_21709_;
        let _e170 = global_8.member_5;
        let _e172 = _e168.xyz;
        let _e173 = (_e172 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e176 = pow(((_e172 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e168.x <= 0.04045f) {
            phi_21354_ = _e173.x;
        } else {
            phi_21354_ = _e176.x;
        }
        let _e182 = phi_21354_;
        if (_e168.y <= 0.04045f) {
            phi_21355_ = _e173.y;
        } else {
            phi_21355_ = _e176.y;
        }
        let _e188 = phi_21355_;
        if (_e168.z <= 0.04045f) {
            phi_22686_ = _e173.z;
        } else {
            phi_22686_ = _e176.z;
        }
        let _e194 = phi_22686_;
        phi_7078_ = vec4<f32>(_e182, _e188, _e194, min(1f, _e170));
    }
    let _e197 = phi_7078_;
    phi_22401_ = _e197;
    if (_e116 == 0i) {
        let _e199 = textureSample(global_13, global_2, _e68);
        let _e202 = global_8.member_4;
        let _e204 = clamp((_e79.xyz * _e202), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e207 = (_e204.xyz * _e114.xyz);
        let _e212 = global_8.member_6;
        let _e214 = global_8.member_8;
        let _e216 = global_8.member_9;
        let _e219 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e207.xyz));
        let _e227 = mix(_e214.xyz, _e216.xyz, vec3(_e212));
        let _e249 = mix(mix(_e207, ((_e219.xyz * mix(min(_e227.x, dot(_e204.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e227.z, clamp(pow(max(_e207.x, max(_e207.y, _e207.z)), _e227.y), 0f, 1f))) / vec3(max(_e219.x, max(_e219.y, _e219.z)))).xyz, vec3(_e84)), _e199.xyz, vec3(_e105));
        phi_22401_ = vec4<f32>(_e249.x, _e249.y, _e249.z, 1f);
    }
    let _e255 = phi_22401_;
    let _e256 = textureSample(global_14, global_5, _e68);
    phi_22402_ = _e255;
    if (_e256.w < 0f) {
        let _e264 = vec4<f32>(_e256.x, _e255.y, _e255.z, _e255.w);
        let _e270 = vec4<f32>(_e264.x, _e256.y, _e264.z, _e264.w);
        phi_22402_ = vec4<f32>(_e270.x, _e270.y, _e256.z, _e270.w);
    }
    let _e278 = phi_22402_;
    let _e279 = textureSample(global_15, global_5, _e68);
    phi_6805_ = _e278;
    if (_e279.w < 0f) {
        let _e287 = vec4<f32>(_e279.x, _e278.y, _e278.z, _e278.w);
        let _e293 = vec4<f32>(_e287.x, _e279.y, _e287.z, _e287.w);
        phi_6805_ = vec4<f32>(_e293.x, _e293.y, _e279.z, _e293.w);
    }
    let _e301 = phi_6805_;
    global_16 = _e301;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_16;
    return _e5;
}
