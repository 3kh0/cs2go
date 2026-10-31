struct type_8 {
    member: i32,
    member_1: vec3<f32>,
    member_2: f32,
    member_3: i32,
    member_4: i32,
    member_5: f32,
    member_6: f32,
    member_7: f32,
    member_8: f32,
    member_9: f32,
    member_10: f32,
    member_11: f32,
    member_12: f32,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
    member_15: vec3<f32>,
    member_16: vec3<f32>,
    member_17: f32,
    member_18: i32,
    member_19: f32,
    member_20: i32,
    member_21: f32,
    member_22: f32,
    member_23: f32,
    member_24: f32,
    member_25: f32,
    member_26: vec3<f32>,
    member_27: vec3<f32>,
    member_28: i32,
    member_29: i32,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(43) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(42) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(36) 
var global_9: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_10: type_8;
@group(1) @binding(45) 
var global_11: texture_2d<f32>;
var<private> global_12: vec2<f32>;
@group(1) @binding(40) 
var global_13: texture_2d<f32>;
@group(1) @binding(41) 
var global_14: texture_2d<f32>;
@group(1) @binding(44) 
var global_15: texture_2d<f32>;
@group(1) @binding(35) 
var global_16: texture_2d<f32>;
@group(1) @binding(37) 
var global_17: texture_2d<f32>;
@group(1) @binding(38) 
var global_18: texture_2d<f32>;
@group(1) @binding(34) 
var global_19: texture_2d<f32>;
@group(1) @binding(39) 
var global_20: texture_2d<f32>;
var<private> global_21: vec4<f32>;

fn function_() {
    var phi_19017_: vec4<f32>;
    var phi_21709_: f32;
    var phi_10021_: f32;
    var phi_21710_: f32;
    var phi_19287_: vec4<f32>;
    var phi_20940_: f32;
    var phi_21711_: vec4<f32>;
    var phi_19018_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_9750_: vec3<f32>;
    var phi_19340_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e116 = global;
    let _e119 = _e116.xy;
    let _e120 = textureSample(global_1, global_2, _e119);
    let _e122 = pow(_e120.x, 1.5f);
    let _e123 = (_e122 * 0.96f);
    let _e125 = textureSample(global_3, global_2, _e119);
    let _e128 = (1f - _e125.x);
    let _e130 = global_4;
    let _e132 = textureSample(global_5, global_6, _e130.xy);
    let _e134 = _e116.zw;
    let _e135 = textureSample(global_7, global_8, _e134);
    let _e136 = textureSample(global_9, global_6, _e119);
    let _e139 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e136, (vec4<f32>(1f, 1f, 1f, 1f) - _e136)));
    let _e146 = global_10.member_24;
    let _e150 = (mix(0.5f, pow(_e123, 0.85f), _e146) * mix(1f, (_e120.y * (min(_e139.x, _e139.y) * 2f)), _e146));
    let _e151 = (_e150 * 2f);
    let _e155 = global_10.member_23;
    let _e164 = global_10.member_25;
    let _e165 = (max((_e135.y * _e155), (((1f - _e120.y) * 0.2f) * _e146)) + _e164);
    let _e166 = _e116.zw;
    let _e169 = textureSample(global_7, global_8, (_e166 + vec2<f32>(0.00048828125f, 0.00048828125f)).xy);
    let _e172 = textureSample(global_7, global_8, (_e166 + vec2<f32>(-0.00048828125f, -0.00048828125f)).xy);
    let _e175 = textureSample(global_7, global_8, (_e166 + vec2<f32>(-0.00048828125f, 0.00048828125f)).xy);
    let _e178 = textureSample(global_7, global_8, (_e166 + vec2<f32>(0.00048828125f, -0.00048828125f)).xy);
    let _e192 = textureSample(global_11, global_2, vec2<f32>(mix(_e151, (_e150 + _e135.x), _e155), _e165));
    let _e195 = textureSample(global_11, global_2, vec2<f32>(mix(_e151, (_e150 + _e169.x), _e155), _e165));
    let _e200 = textureSample(global_11, global_2, vec2<f32>(mix(_e151, (_e150 + _e172.x), _e155), _e165));
    let _e205 = textureSample(global_11, global_2, vec2<f32>(mix(_e151, (_e150 + _e175.x), _e155), _e165));
    let _e210 = textureSample(global_11, global_2, vec2<f32>(mix(_e151, (_e150 + _e178.x), _e155), _e165));
    let _e219 = mix(_e135.xyzw, (((((_e192.xyzw + _e195.xyzw).xyzw + _e200.xyzw).xyzw + _e205.xyzw).xyzw + _e210.xyzw).xyzw * 0.2f).xyzw, vec4(_e125.y));
    let _e221 = mix(1f, _e219.w, _e125.y);
    let _e222 = global_12;
    let _e224 = textureSample(global_13, global_6, _e222.xy);
    let _e225 = textureSample(global_14, global_6, _e119);
    let _e228 = global_10.member_28;
    phi_19017_ = _e224;
    if (_e228 == 8i) {
        phi_19017_ = vec4<f32>(_e224.x, _e224.y, _e224.z, (_e224.w * _e225.x));
    }
    let _e238 = phi_19017_;
    let _e241 = global_10.member_5;
    let _e242 = (_e238.w * _e241);
    let _e245 = global_10.member_7;
    let _e246 = (_e238.xyz * _e245);
    let _e250 = vec4<f32>(_e246.x, _e246.y, _e246.z, _e242);
    let _e255 = global_10.member_22;
    let _e258 = (_e132.x * mix(smoothstep(0f, 0.72f, pow(_e123, 1.3f)), smoothstep(0f, 0.4f, _e123), pow(_e255, 1.2f)));
    let _e261 = ((_e255 * 6f) + 1f);
    let _e268 = smoothstep(0f, 0.5f, _e219.w);
    let _e269 = (_e228 == 0i);
    if _e269 {
        phi_21709_ = max(0f, _e268);
    } else {
        phi_21709_ = _e268;
    }
    let _e272 = phi_21709_;
    let _e274 = global_10.member_8;
    let _e276 = (_e272 * mix(1f, _e274, _e238.w));
    if (_e228 > 0i) {
        phi_10021_ = max(0f, _e276);
    } else {
        phi_10021_ = _e276;
    }
    let _e280 = phi_10021_;
    let _e281 = ((((min(_e120.w, _e128) + _e258) * _e261) + (smoothstep(0.5f, 0.6f, _e219.w) * smoothstep(1f, 0.9f, _e219.w))) * _e280);
    let _e283 = global_10.member_12;
    let _e284 = (_e283 * _e280);
    let _e288 = (_e125.x > 0.99f);
    let _e290 = mix(smoothstep((0.58f - _e284), (0.68f + _e284), _e281), _e281, select(0f, 1f, _e288));
    let _e294 = smoothstep((0.56f - _e284), (0.74f + _e284), ((_e258 * _e261) * _e274));
    if _e269 {
        phi_21710_ = max(0f, mix(_e290, min(_e290, _e294), _e242));
    } else {
        phi_21710_ = _e290;
    }
    let _e299 = phi_21710_;
    let _e301 = global_10.member_29;
    phi_19287_ = _e250;
    if (_e301 == 4i) {
        phi_19287_ = vec4<f32>(_e250.x, _e250.y, _e250.z, (_e242 * clamp((1f - _e294), 0f, 1f)));
    }
    let _e312 = phi_19287_;
    let _e314 = textureSample(global_15, global_6, _e130.zw);
    let _e333 = smoothstep(0.2f, 0.6f, (((_e132.x * _e120.y) * (_e132.x * smoothstep(0.2f, 0.3f, _e123))) * _e255));
    let _e342 = (smoothstep((0.5f * _e255), 0f, clamp((((_e122 * 11.5199995f) * _e120.y) - ((_e255 * clamp(((_e314.x * _e314.y) * _e314.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e255);
    let _e343 = (1f - _e342);
    let _e347 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e314, vec4(((pow((1f - _e123), 4f) * 0.25f) + (0.75f * _e255)))), vec4(clamp((_e333 * 2f), 0f, 1f)));
    let _e349 = global_10.member;
    if (_e349 != 0i) {
        let _e351 = textureSample(global_16, global_2, _e119);
        let _e353 = (1f - _e299);
        let _e359 = global_10.member_3;
        if (_e359 != 0i) {
            let _e361 = textureSample(global_17, global_6, _e134);
            phi_20940_ = _e361.x;
        } else {
            let _e363 = textureSample(global_17, global_6, _e119);
            phi_20940_ = _e363.x;
        }
        let _e366 = phi_20940_;
        let _e377 = dot(_e347.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e387 = ((1f - _e347.w) * _e255);
        let _e390 = clamp(((((mix(_e366, (_e366 * (1f - (0.25f * dot(_e219.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))))), _e125.y) * mix(1f, 0.9f, _e333)) + (((1f - _e377) * _e255) * 0.05f)) + ((_e342 * 0.15f) * _e255)) + (_e387 * 0.15f)), 0f, 1f);
        let _e401 = mix((_e221 * mix(1f, pow(((_e343 * _e347.w) * _e377), 0.5f), _e255)), 1f, _e333);
        let _e404 = global_10.member_6;
        let _e405 = (((1f - _e294) * _e312.w) * _e404);
        let _e407 = global_10.member_9;
        let _e413 = vec4<f32>(mix(mix(_e351.x, mix(min(1f, (_e390 + ((_e387 * _e255) * 0.5f))), _e390, _e125.x), select(max(0f, _e353), 1f, _e288)), _e407, _e405), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e416 = global_10.member_21;
        let _e420 = global_10.member_10;
        let _e426 = vec4<f32>(_e413.x, mix(mix(mix(_e416, _e351.y, _e299), _e401, _e125.x), _e420, _e405), _e413.z, _e413.w);
        let _e428 = global_10.member_4;
        if (_e428 != 0i) {
            let _e430 = textureSample(global_18, global_6, _e134);
            phi_21711_ = vec4<f32>(_e426.x, _e426.y, (_e353 * _e430.x), _e426.w);
        } else {
            let _e438 = textureSample(global_18, global_6, _e119);
            let _e440 = (_e353 * _e438.x);
            phi_21711_ = vec4<f32>(_e426.x, _e426.y, (_e440 * _e440), _e426.w);
        }
        let _e448 = phi_21711_;
        let _e450 = global_10.member_20;
        phi_19018_ = _e448;
        if (_e450 != 0i) {
            phi_19018_ = vec4<f32>(_e448.x, _e448.y, (_e448.z * _e125.x), _e448.w);
        }
        let _e460 = phi_19018_;
        let _e463 = global_10.member_11;
        let _e465 = mix(_e460.z, (_e463 - _e299), _e405);
        let _e472 = global_10.member_19;
        let _e474 = vec4<f32>(_e460.x, _e460.y, _e465, _e460.w).xyz;
        let _e475 = (_e474 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e478 = pow(((_e474 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e460.x <= 0.04045f) {
            phi_21354_ = _e475.x;
        } else {
            phi_21354_ = _e478.x;
        }
        let _e484 = phi_21354_;
        if (_e460.y <= 0.04045f) {
            phi_23035_ = _e475.y;
        } else {
            phi_23035_ = _e478.y;
        }
        let _e490 = phi_23035_;
        if (_e465 <= 0.04045f) {
            phi_19513_ = _e475.z;
        } else {
            phi_19513_ = _e478.z;
        }
        let _e495 = phi_19513_;
        let _e496 = vec4<f32>(_e484, _e490, _e465, min(1f, _e472));
        phi_11711_ = vec4<f32>(_e496.x, _e496.y, _e495, _e496.w);
        phi_10247_ = _e401;
    } else {
        phi_11711_ = vec4<f32>(_e116.xy, 0f, 1f);
        phi_10247_ = _e221;
    }
    let _e503 = phi_11711_;
    let _e505 = phi_10247_;
    phi_22401_ = _e503;
    if (_e349 == 0i) {
        let _e507 = textureSample(global_19, global_2, _e119);
        let _e509 = vec3(_e255);
        let _e511 = global_10.member_14;
        let _e513 = global_10.member_15;
        let _e515 = _e219.xyz;
        let _e517 = global_10.member_17;
        let _e520 = global_10.member_18;
        let _e524 = mix(_e515, (_e515 * _e517), vec3(max(_e125.x, f32(_e520))));
        let _e530 = vec4<f32>(_e524.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e536 = vec4<f32>(_e530.x, _e524.y, _e530.z, _e530.w);
        let _e542 = vec4<f32>(_e536.x, _e536.y, _e524.z, _e536.w);
        let _e546 = global_10.member_16;
        let _e550 = _e542.xyz;
        let _e554 = global_10.member_13;
        let _e557 = mix((mix(mix(_e511, _e546, vec3(pow(_e255, 0.5f))), mix(_e511, _e513, _e509), vec3(_e343)) * _e550), (_e554 * dot(_e542.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e333));
        let _e562 = ((1f - _e294) * _e312.w);
        let _e563 = vec4<f32>(_e312.xyz, _e562);
        switch _e301 {
            case 0: {
                phi_9750_ = mix(_e557.xyz, _e563.xyz, vec3(_e562));
                break;
            }
            case 1: {
                let _e568 = _e557.xyz;
                let _e570 = global_10.member_1;
                let _e591 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e563.xyz * _e568).xyz)) * 1.06f);
                let _e593 = _e591.xyz;
                phi_9750_ = mix(_e568, mix(vec3(_e570.x), max(((((_e593 * _e570.x) * 1.732f) / vec3(length(_e593))) / vec3(dot(_e591.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e591 * mix(_e570.x, _e570.z, clamp(pow(max(_e557.x, max(_e557.y, _e557.z)), _e570.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e570.x, dot(clamp((_e568 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e562));
                break;
            }
            case 2: {
                let _e613 = _e557.xyz;
                let _e615 = (_e613 * _e563.xyz);
                let _e617 = global_10.member_1;
                let _e637 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e615.xyz)) * 1.06f);
                let _e639 = _e637.xyz;
                phi_9750_ = mix(_e613, mix(vec3(_e617.x), max(((((_e639 * _e617.x) * 1.732f) / vec3(length(_e639))) / vec3(dot(_e637.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e637 * mix(_e617.x, _e617.z, clamp(pow(max(_e615.x, max(_e615.y, _e615.z)), _e617.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e617.x, dot(clamp((_e615.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e562));
                break;
            }
            case 3: {
                let _e659 = _e557.xyz;
                let _e661 = (_e659 + _e563.xyz);
                let _e663 = global_10.member_1;
                let _e668 = dot(clamp((_e661.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e684 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e661.xyz)) * 1.06f);
                let _e686 = _e684.xyz;
                let _e697 = max(((((_e686 * _e663.x) * 1.732f) / vec3(length(_e686))) / vec3(dot(_e684.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e684 * mix(_e663.x, _e663.z, clamp(pow((max(_e661.x, max(_e661.y, _e661.z)) * 2f), _e663.y), 0f, 1f)))).xyz;
                let _e704 = global_10.member_2;
                phi_9750_ = mix(_e659, mix(vec3(_e663.x), mix(_e697, min(_e663.zzz, (_e697 + (vec3(_e668) * 2f))), vec3((1f / _e704))).xyz, vec3(pow(smoothstep(0.0003f, _e663.x, _e668), 0.5f))).xyz, vec3(_e562));
                break;
            }
            case 4: {
                phi_9750_ = mix(_e557.xyz, _e563.xyz, vec3(_e562));
                break;
            }
            default: {
                phi_9750_ = _e557.xyz;
                break;
            }
        }
        let _e722 = phi_9750_;
        let _e724 = _e507.xyz;
        let _e726 = mix(clamp(_e550, vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)), _e724, vec3(_e299));
        switch _e301 {
            case 0: {
                phi_19340_ = mix(_e726.xyz, _e312.xyz, vec3(_e312.w));
                break;
            }
            case 1: {
                let _e733 = global_10.member_1;
                let _e734 = _e726.xyz;
                let _e755 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e312.xyz * _e734).xyz)) * 1.06f);
                let _e757 = _e755.xyz;
                phi_19340_ = mix(_e726.xyz, mix(vec3(_e733.x), max(((((_e757 * _e733.x) * 1.732f) / vec3(length(_e757))) / vec3(dot(_e755.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e755 * mix(_e733.x, _e733.z, clamp(pow(max(_e726.x, max(_e726.y, _e726.z)), _e733.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e733.x, dot(clamp((_e734 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e312.w));
                break;
            }
            case 2: {
                let _e777 = _e726.xyz;
                let _e779 = (_e777 * _e312.xyz);
                let _e781 = global_10.member_1;
                let _e801 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e779.xyz)) * 1.06f);
                let _e803 = _e801.xyz;
                phi_19340_ = mix(_e777, mix(vec3(_e781.x), max(((((_e803 * _e781.x) * 1.732f) / vec3(length(_e803))) / vec3(dot(_e801.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e801 * mix(_e781.x, _e781.z, clamp(pow(max(_e779.x, max(_e779.y, _e779.z)), _e781.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e781.x, dot(clamp((_e779.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e312.w));
                break;
            }
            case 3: {
                let _e823 = _e726.xyz;
                let _e825 = (_e823 + _e312.xyz);
                let _e827 = global_10.member_1;
                let _e832 = dot(clamp((_e825.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e848 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e825.xyz)) * 1.06f);
                let _e850 = _e848.xyz;
                let _e861 = max(((((_e850 * _e827.x) * 1.732f) / vec3(length(_e850))) / vec3(dot(_e848.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e848 * mix(_e827.x, _e827.z, clamp(pow((max(_e825.x, max(_e825.y, _e825.z)) * 2f), _e827.y), 0f, 1f)))).xyz;
                let _e868 = global_10.member_2;
                phi_19340_ = mix(_e823, mix(vec3(_e827.x), mix(_e861, min(_e827.zzz, (_e861 + (vec3(_e832) * 2f))), vec3((1f / _e868))).xyz, vec3(pow(smoothstep(0.0003f, _e827.x, _e832), 0.5f))).xyz, vec3(_e312.w));
                break;
            }
            case 4: {
                phi_19340_ = mix(_e726.xyz, _e312.xyz, vec3(_e312.w));
                break;
            }
            default: {
                phi_19340_ = _e726;
                break;
            }
        }
        let _e886 = phi_19340_;
        let _e892 = vec4<f32>(_e886.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e898 = vec4<f32>(_e892.x, _e886.y, _e892.z, _e892.w);
        let _e905 = vec4<f32>(_e898.x, _e898.y, _e886.z, _e898.w).xyz;
        let _e906 = vec3(_e125.x);
        let _e913 = (mix(_e905, _e722, _e906).xyz * _e347.xyz);
        let _e918 = global_10.member_21;
        let _e921 = global_10.member_26;
        let _e923 = global_10.member_27;
        let _e926 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e913.xyz));
        let _e934 = mix(_e921.xyz, _e923.xyz, vec3(mix(_e918, _e505, _e125.x)));
        let _e954 = mix(mix(_e913, ((_e926.xyz * mix(min(_e934.x, dot(mix(_e905, (_e905 * _e511), _e906).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e934.z, clamp(pow(max(_e913.x, max(_e913.y, _e913.z)), _e934.y), 0f, 1f))) / vec3(max(_e926.x, max(_e926.y, _e926.z)))).xyz, _e509), _e724, vec3((_e299 * _e128)));
        phi_22401_ = vec4<f32>(_e954.x, _e954.y, _e954.z, 1f);
    }
    let _e960 = phi_22401_;
    let _e961 = textureSample(global_20, global_6, _e119);
    phi_6805_ = _e960;
    if (_e961.w < 0f) {
        let _e969 = vec4<f32>(_e961.x, _e960.y, _e960.z, _e960.w);
        let _e975 = vec4<f32>(_e969.x, _e961.y, _e969.z, _e969.w);
        phi_6805_ = vec4<f32>(_e975.x, _e975.y, _e961.z, _e975.w);
    }
    let _e983 = phi_6805_;
    global_21 = _e983;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_12 = param_2;
    function_();
    let _e7 = global_21;
    return _e7;
}
