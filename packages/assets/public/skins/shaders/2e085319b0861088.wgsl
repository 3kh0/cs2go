struct type_13 {
    member: vec4<f32>,
    member_1: vec4<f32>,
    member_2: vec4<f32>,
    member_3: vec4<f32>,
    member_4: vec4<f32>,
    member_5: vec4<f32>,
    member_6: vec4<f32>,
    member_7: vec4<f32>,
    member_8: i32,
    member_9: i32,
    member_10: vec3<f32>,
    member_11: f32,
    member_12: i32,
    member_13: i32,
    member_14: f32,
    member_15: f32,
    member_16: f32,
    member_17: f32,
    member_18: f32,
    member_19: f32,
    member_20: f32,
    member_21: f32,
    member_22: vec3<f32>,
    member_23: vec3<f32>,
    member_24: vec3<f32>,
    member_25: vec3<f32>,
    member_26: f32,
    member_27: vec4<f32>,
    member_28: i32,
    member_29: vec4<f32>,
    member_30: f32,
    member_31: vec4<f32>,
    member_32: f32,
    member_33: vec3<f32>,
    member_34: f32,
    member_35: vec3<f32>,
    member_36: vec2<f32>,
    member_37: i32,
    member_38: vec3<f32>,
    member_39: vec3<f32>,
    member_40: i32,
    member_41: i32,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
var<private> global_3: vec4<f32>;
var<private> global_4: vec2<f32>;
@group(1) @binding(33) 
var global_5: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_6: type_13;
@group(1) @binding(42) 
var global_7: texture_2d<f32>;
@group(1) @binding(22) 
var global_8: sampler;
@group(1) @binding(27) 
var global_9: sampler;
@group(1) @binding(32) 
var global_10: texture_2d<f32>;
@group(1) @binding(41) 
var global_11: texture_2d<f32>;
@group(1) @binding(39) 
var global_12: texture_2d<f32>;
@group(1) @binding(43) 
var global_13: texture_2d<f32>;
@group(1) @binding(35) 
var global_14: texture_2d<f32>;
@group(1) @binding(36) 
var global_15: texture_2d<f32>;
@group(1) @binding(37) 
var global_16: texture_2d<f32>;
@group(1) @binding(34) 
var global_17: texture_2d<f32>;
@group(1) @binding(38) 
var global_18: texture_2d<f32>;
var<private> global_19: vec4<f32>;

fn function_() {
    var local: array<vec2<f32>, 17>;
    var phi_13155_: vec4<f32>;
    var phi_16208_: i32;
    var local_1: vec4<f32>;
    var phi_18941_: vec4<f32>;
    var phi_12501_: vec4<f32>;
    var phi_12502_: vec4<f32>;
    var phi_21709_: vec4<f32>;
    var phi_22743_: vec4<f32>;
    var phi_19017_: vec4<f32>;
    var phi_21710_: f32;
    var phi_19287_: vec4<f32>;
    var phi_21711_: f32;
    var phi_21712_: f32;
    var phi_19018_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_21714_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e151 = global;
    let _e152 = _e151.xy;
    let _e154 = _e151.xy;
    let _e155 = textureSample(global_1, global_2, _e154);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e159 = phi_13155_;
        let _e161 = phi_16208_;
        local_1 = _e159;
        if (_e161 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e170 = local[_e161];
        let _e174 = textureSample(global_5, global_2, (_e152 + (_e170 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e159 + (_e174 * 0.05882353f));
            phi_16208_ = (_e161 + 1i);
        }
    }
    let _e164 = local_1;
    let _e165 = (_e164 * 2f);
    let _e167 = global_6.member_9;
    let _e168 = (_e167 != 0i);
    phi_18941_ = _e165;
    if _e168 {
        phi_18941_ = vec4<f32>(_e165.x, _e165.y, (_e165.z * -1f), _e165.w);
    }
    let _e186 = phi_18941_;
    let _e188 = global_3;
    let _e190 = textureSample(global_7, global_8, _e188.xy);
    let _e193 = global_6.member;
    let _e195 = global_6.member_1;
    let _e196 = textureSample(global_10, global_2, _e154);
    let _e200 = normalize(((_e196.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e201 = _e186.yz;
    let _e202 = _e193.xy;
    let _e206 = _e195.xy;
    let _e210 = vec2<f32>((dot(_e201, _e202) + _e193.w), (dot(_e201, _e206) + _e195.w));
    let _e211 = textureSample(global_11, global_9, _e210);
    let _e213 = _e186.xz;
    let _e218 = vec2<f32>((dot(_e213, _e202) + _e193.w), (dot(_e213, _e206) + _e195.w));
    let _e219 = textureSample(global_11, global_9, _e218);
    let _e221 = _e186.yx;
    let _e226 = vec2<f32>((dot(_e221, _e202) + _e193.w), (dot(_e221, _e206) + _e195.w));
    let _e227 = textureSample(global_11, global_9, _e226);
    let _e232 = global_6.member_33;
    let _e244 = mix(mix(_e211.xyzw, _e219.xyzw, vec4((_e232.y * pow(abs(_e200.y), 7f)))), _e227.xyzw, vec4((_e232.z * pow(abs(_e200.z), 7f))));
    phi_22743_ = _e244;
    if _e168 {
        let _e246 = global_6.member_2;
        let _e248 = global_6.member_3;
        let _e249 = textureSample(global_10, global_2, _e154);
        let _e253 = normalize(((_e249.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e254 = _e246.xy;
        let _e258 = _e248.xy;
        let _e263 = textureSample(global_11, global_9, vec2<f32>((dot(_e201, _e254) + _e246.w), (dot(_e201, _e258) + _e248.w)));
        let _e270 = textureSample(global_11, global_9, vec2<f32>((dot(_e213, _e254) + _e246.w), (dot(_e213, _e258) + _e248.w)));
        let _e277 = textureSample(global_11, global_9, vec2<f32>((dot(_e221, _e254) + _e246.w), (dot(_e221, _e258) + _e248.w)));
        let _e293 = global_6.member_4;
        let _e295 = global_6.member_5;
        let _e296 = textureSample(global_10, global_2, _e154);
        let _e300 = normalize(((_e296.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e301 = _e293.xy;
        let _e305 = _e295.xy;
        let _e310 = textureSample(global_11, global_9, vec2<f32>((dot(_e201, _e301) + _e293.w), (dot(_e201, _e305) + _e295.w)));
        let _e317 = textureSample(global_11, global_9, vec2<f32>((dot(_e213, _e301) + _e293.w), (dot(_e213, _e305) + _e295.w)));
        let _e324 = textureSample(global_11, global_9, vec2<f32>((dot(_e221, _e301) + _e293.w), (dot(_e221, _e305) + _e295.w)));
        let _e340 = global_6.member_6;
        let _e342 = global_6.member_7;
        let _e343 = textureSample(global_10, global_2, _e154);
        let _e347 = normalize(((_e343.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e348 = _e340.xy;
        let _e352 = _e342.xy;
        let _e357 = textureSample(global_11, global_9, vec2<f32>((dot(_e201, _e348) + _e340.w), (dot(_e201, _e352) + _e342.w)));
        let _e364 = textureSample(global_11, global_9, vec2<f32>((dot(_e213, _e348) + _e340.w), (dot(_e213, _e352) + _e342.w)));
        let _e371 = textureSample(global_11, global_9, vec2<f32>((dot(_e221, _e348) + _e340.w), (dot(_e221, _e352) + _e342.w)));
        let _e387 = global_6.member_37;
        if (_e387 != 0i) {
            let _e447 = global_6.member_35;
            let _e451 = global_6.member_34;
            let _e457 = smoothstep(_e447.x, _e447.z, pow(((min(_e155.x, _e451) * _e155.y) * 2f), _e447.y));
            let _e459 = global_6.member_36;
            if (_e459.x > _e459.y) {
                let _e485 = (_e244.xyz * _e457);
                let _e491 = vec4<f32>(_e485.x, _e244.y, _e244.z, _e244.w);
                let _e497 = vec4<f32>(_e491.x, _e485.y, _e491.z, _e491.w);
                phi_12502_ = vec4<f32>(_e497.x, _e497.y, _e485.z, _e497.w);
            } else {
                let _e465 = (_e244.xyz * (1f - _e457));
                let _e471 = vec4<f32>(_e465.x, _e244.y, _e244.z, _e244.w);
                let _e477 = vec4<f32>(_e471.x, _e465.y, _e471.z, _e471.w);
                phi_12502_ = vec4<f32>(_e477.x, _e477.y, _e465.z, _e477.w);
            }
            let _e505 = phi_12502_;
            phi_21709_ = _e505;
        } else {
            let _e390 = global_6.member_35;
            let _e397 = smoothstep(_e390.x, _e390.z, pow(((_e155.x * _e155.y) * 2f), _e390.y));
            let _e399 = global_6.member_36;
            if (_e399.x > _e399.y) {
                let _e425 = (_e244.xyz * (1f - _e397));
                let _e431 = vec4<f32>(_e425.x, _e244.y, _e244.z, _e244.w);
                let _e437 = vec4<f32>(_e431.x, _e425.y, _e431.z, _e431.w);
                phi_12501_ = vec4<f32>(_e437.x, _e437.y, _e425.z, _e437.w);
            } else {
                let _e404 = (_e244.xyz * _e397);
                let _e410 = vec4<f32>(_e404.x, _e244.y, _e244.z, _e244.w);
                let _e416 = vec4<f32>(_e410.x, _e404.y, _e410.z, _e410.w);
                phi_12501_ = vec4<f32>(_e416.x, _e416.y, _e404.z, _e416.w);
            }
            let _e445 = phi_12501_;
            phi_21709_ = _e445;
        }
        let _e507 = phi_21709_;
        let _e509 = global_6.member_36;
        let _e517 = smoothstep(vec3(_e509.x), vec3(_e509.y), (_e507.xyz * vec3<f32>(mix(mix(_e263.xyzw, _e270.xyzw, vec4((_e232.y * pow(abs(_e253.y), 7f)))), _e277.xyzw, vec4((_e232.z * pow(abs(_e253.z), 7f)))).w, mix(mix(_e310.xyzw, _e317.xyzw, vec4((_e232.y * pow(abs(_e300.y), 7f)))), _e324.xyzw, vec4((_e232.z * pow(abs(_e300.z), 7f)))).w, mix(mix(_e357.xyzw, _e364.xyzw, vec4((_e232.y * pow(abs(_e347.y), 7f)))), _e371.xyzw, vec4((_e232.z * pow(abs(_e347.z), 7f)))).w)));
        let _e523 = vec4<f32>(_e517.x, _e507.y, _e507.z, _e507.w);
        let _e529 = vec4<f32>(_e523.x, _e517.y, _e523.z, _e523.w);
        phi_22743_ = vec4<f32>(_e529.x, _e529.y, _e517.z, _e529.w);
    }
    let _e537 = phi_22743_;
    let _e538 = global_4;
    let _e540 = textureSample(global_12, global_8, _e538.xy);
    let _e542 = global_6.member_40;
    switch _e542 {
        case 1: {
            phi_19017_ = vec4<f32>(_e540.x, _e540.y, _e540.z, (_e540.w * (1f - max(_e537.x, max(_e537.y, _e537.z)))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e540.x, _e540.y, _e540.z, (_e540.w * (_e537.x * (1f - max(_e537.y, _e537.z)))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e540.x, _e540.y, _e540.z, (_e540.w * (_e537.y * (1f - _e537.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e540.x, _e540.y, _e540.z, (_e540.w * _e537.z));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e540.x, _e540.y, _e540.z, (_e540.w * max(_e537.x, max(_e537.y, _e537.z))));
            break;
        }
        case 7: {
            phi_19017_ = _e540;
            break;
        }
        default: {
            phi_19017_ = _e540;
            break;
        }
    }
    let _e601 = phi_19017_;
    let _e604 = global_6.member_14;
    let _e605 = (_e601.w * _e604);
    let _e608 = global_6.member_16;
    let _e609 = (_e601.xyz * _e608);
    let _e613 = vec4<f32>(_e609.x, _e609.y, _e609.z, _e605);
    let _e614 = (_e190.x * _e155.x);
    let _e617 = global_6.member_32;
    let _e619 = ((_e617 * 6f) + 1f);
    let _e623 = global_6.member_17;
    let _e627 = global_6.member_27;
    let _e637 = mix(mix(mix(_e627.x, _e627.y, _e537.x), _e627.z, _e537.y), _e627.w, _e537.z);
    let _e638 = ((((_e155.w + _e614) * _e619) * mix(1f, _e623, _e601.w)) * _e637);
    let _e640 = global_6.member_21;
    let _e641 = (_e640 * _e637);
    let _e646 = (0.56f - (0.06f * _e617));
    let _e650 = (0.54f - (_e617 * 0.12f));
    let _e660 = (_e537.xyz * vec3<f32>(smoothstep((0.58f + _e641), (_e646 - _e641), _e638), smoothstep((_e646 + _e641), (_e650 - _e641), _e638), smoothstep((_e650 + _e641), ((0.52f - (_e617 * 0.17999999f)) - _e641), _e638)).xyz);
    let _e664 = (0.58f - _e641);
    let _e665 = (0.68f + _e641);
    let _e666 = smoothstep(_e664, _e665, _e638);
    let _e675 = smoothstep(_e664, _e665, ((_e614 * _e619) * _e623));
    if (_e542 == 0i) {
        phi_21710_ = max(0f, mix(_e666, min(_e666, _e675), _e605));
    } else {
        phi_21710_ = _e666;
    }
    let _e681 = phi_21710_;
    let _e683 = global_6.member_41;
    phi_19287_ = _e613;
    if (_e683 == 4i) {
        phi_19287_ = vec4<f32>(_e613.x, _e613.y, _e613.z, (_e605 * clamp((1f - _e675), 0f, 1f)));
    }
    let _e694 = phi_19287_;
    let _e696 = textureSample(global_13, global_8, _e188.zw);
    let _e703 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e696, vec4(((pow((1f - _e155.x), 4f) * 0.25f) + (0.75f * _e617))));
    let _e705 = global_6.member_31;
    let _e712 = mix(mix(mix(_e705.x, _e705.y, _e660.x), _e705.z, _e660.y), _e705.w, _e660.z);
    let _e714 = global_6.member_8;
    if (_e714 != 0i) {
        let _e716 = textureSample(global_14, global_2, _e154);
        let _e727 = global_6.member_12;
        if (_e727 != 0i) {
            let _e731 = textureSample(global_10, global_2, _e154);
            let _e735 = normalize(((_e731.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e736 = textureSample(global_15, global_8, _e210);
            let _e738 = textureSample(global_15, global_8, _e218);
            let _e740 = textureSample(global_15, global_8, _e226);
            phi_21711_ = mix(mix(_e736.xyzw, _e738.xyzw, vec4((_e232.y * pow(abs(_e735.y), 7f)))), _e740.xyzw, vec4((_e232.z * pow(abs(_e735.z), 7f)))).x;
        } else {
            let _e729 = textureSample(global_15, global_8, _e154);
            phi_21711_ = _e729.x;
        }
        let _e756 = phi_21711_;
        let _e758 = global_6.member_28;
        phi_21712_ = _e756;
        if (_e758 != 0i) {
            let _e761 = global_6.member_29;
            phi_21712_ = mix(mix(mix(_e761.x, _e761.y, _e660.x), _e761.z, _e660.y), _e761.w, _e660.z);
        }
        let _e770 = phi_21712_;
        let _e772 = global_6.member_15;
        let _e773 = (((1f - _e675) * _e694.w) * _e772);
        let _e775 = global_6.member_18;
        let _e778 = global_6.member_19;
        let _e779 = mix(_e712, _e778, _e773);
        let _e789 = mix(vec4<f32>(min(1f, (mix(_e770, _e775, _e773) + ((((1f - _e703.w) * _e617) * _e617) * 0.5f))), _e779, 0f, 1f), vec4<f32>(_e716.x, _e716.y, _e716.z, _e716.w), vec4(_e681));
        let _e790 = (1f - _e681);
        let _e792 = global_6.member_13;
        if (_e792 != 0i) {
            let _e803 = textureSample(global_10, global_2, _e154);
            let _e807 = normalize(((_e803.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e808 = textureSample(global_16, global_8, _e210);
            let _e810 = textureSample(global_16, global_8, _e218);
            let _e812 = textureSample(global_16, global_8, _e226);
            phi_19018_ = vec4<f32>(_e789.x, _e789.y, (_e790 * mix(mix(_e808.xyzw, _e810.xyzw, vec4((_e232.y * pow(abs(_e807.y), 7f)))), _e812.xyzw, vec4((_e232.z * pow(abs(_e807.z), 7f)))).x), _e789.w);
        } else {
            let _e794 = textureSample(global_16, global_8, _e154);
            let _e796 = (_e790 * _e794.x);
            phi_19018_ = vec4<f32>(_e789.x, _e789.y, (_e796 * _e796), _e789.w);
        }
        let _e834 = phi_19018_;
        let _e837 = global_6.member_20;
        let _e839 = mix(_e834.z, (_e837 - _e681), _e773);
        let _e846 = global_6.member_30;
        let _e848 = vec4<f32>(_e834.x, _e834.y, _e839, _e834.w).xyz;
        let _e849 = (_e848 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e852 = pow(((_e848 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e834.x <= 0.04045f) {
            phi_21354_ = _e849.x;
        } else {
            phi_21354_ = _e852.x;
        }
        let _e858 = phi_21354_;
        if (_e834.y <= 0.04045f) {
            phi_23035_ = _e849.y;
        } else {
            phi_23035_ = _e852.y;
        }
        let _e864 = phi_23035_;
        if (_e839 <= 0.04045f) {
            phi_19513_ = _e849.z;
        } else {
            phi_19513_ = _e852.z;
        }
        let _e869 = phi_19513_;
        let _e870 = vec4<f32>(_e858, _e864, _e839, min(1f, _e846));
        phi_11711_ = vec4<f32>(_e870.x, _e870.y, _e869, _e870.w);
        phi_10247_ = _e779;
    } else {
        phi_11711_ = vec4<f32>(_e152, 0f, 1f);
        phi_10247_ = _e712;
    }
    let _e877 = phi_11711_;
    let _e879 = phi_10247_;
    phi_22401_ = _e877;
    if (_e714 == 0i) {
        let _e881 = textureSample(global_17, global_2, _e154);
        let _e884 = global_6.member_22;
        let _e886 = global_6.member_23;
        let _e890 = global_6.member_24;
        let _e894 = global_6.member_25;
        let _e897 = _e881.xyz;
        let _e898 = vec3(_e681);
        let _e899 = mix(mix(mix(mix(_e884, _e886, vec3(_e660.x)), _e890, vec3(_e660.y)), _e894, vec3(_e660.z)).xyz, _e897, _e898);
        switch _e683 {
            case 0: {
                phi_21714_ = mix(_e899.xyz, _e694.xyz, vec3(_e694.w));
                break;
            }
            case 1: {
                let _e1013 = global_6.member_10;
                let _e1014 = _e899.xyz;
                let _e1035 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e694.xyz * _e1014).xyz)) * 1.06f);
                let _e1037 = _e1035.xyz;
                phi_21714_ = mix(_e899.xyz, mix(vec3(_e1013.x), max(((((_e1037 * _e1013.x) * 1.732f) / vec3(length(_e1037))) / vec3(dot(_e1035.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e1035 * mix(_e1013.x, _e1013.z, clamp(pow(max(_e899.x, max(_e899.y, _e899.z)), _e1013.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e1013.x, dot(clamp((_e1014 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e694.w));
                break;
            }
            case 2: {
                let _e964 = _e899.xyz;
                let _e966 = (_e964 * _e694.xyz);
                let _e968 = global_6.member_10;
                let _e988 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e966.xyz)) * 1.06f);
                let _e990 = _e988.xyz;
                phi_21714_ = mix(_e964, mix(vec3(_e968.x), max(((((_e990 * _e968.x) * 1.732f) / vec3(length(_e990))) / vec3(dot(_e988.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e988 * mix(_e968.x, _e968.z, clamp(pow(max(_e966.x, max(_e966.y, _e966.z)), _e968.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e968.x, dot(clamp((_e966.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e694.w));
                break;
            }
            case 3: {
                let _e905 = _e899.xyz;
                let _e907 = (_e905 + _e694.xyz);
                let _e909 = global_6.member_10;
                let _e914 = dot(clamp((_e907.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e930 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e907.xyz)) * 1.06f);
                let _e932 = _e930.xyz;
                let _e943 = max(((((_e932 * _e909.x) * 1.732f) / vec3(length(_e932))) / vec3(dot(_e930.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e930 * mix(_e909.x, _e909.z, clamp(pow((max(_e907.x, max(_e907.y, _e907.z)) * 2f), _e909.y), 0f, 1f)))).xyz;
                let _e950 = global_6.member_11;
                phi_21714_ = mix(_e905, mix(vec3(_e909.x), mix(_e943, min(_e909.zzz, (_e943 + (vec3(_e914) * 2f))), vec3((1f / _e950))).xyz, vec3(pow(smoothstep(0.0003f, _e909.x, _e914), 0.5f))).xyz, vec3(_e694.w));
                break;
            }
            case 4: {
                phi_21714_ = mix(_e899.xyz, _e694.xyz, vec3(_e694.w));
                break;
            }
            default: {
                phi_21714_ = _e899;
                break;
            }
        }
        let _e1064 = phi_21714_;
        let _e1066 = global_6.member_26;
        let _e1069 = clamp((_e1064 * mix(_e1066, 1f, (smoothstep(0f, 0.01f, _e666) * (1f - (smoothstep(0.5f, 0.6f, _e537.w) * smoothstep(1f, 0.9f, _e537.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e1072 = (_e1069.xyz * _e703.xyz);
        let _e1077 = global_6.member_38;
        let _e1079 = global_6.member_39;
        let _e1082 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e1072.xyz));
        let _e1090 = mix(_e1077.xyz, _e1079.xyz, vec3(_e879));
        let _e1110 = mix(mix(_e1072, ((_e1082.xyz * mix(min(_e1090.x, dot(_e1069.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e1090.z, clamp(pow(max(_e1072.x, max(_e1072.y, _e1072.z)), _e1090.y), 0f, 1f))) / vec3(max(_e1082.x, max(_e1082.y, _e1082.z)))).xyz, vec3(_e617)), _e897, _e898);
        phi_22401_ = vec4<f32>(_e1110.x, _e1110.y, _e1110.z, 1f);
    }
    let _e1116 = phi_22401_;
    let _e1117 = textureSample(global_18, global_8, _e154);
    phi_6805_ = _e1116;
    if (_e1117.w < 0f) {
        let _e1125 = vec4<f32>(_e1117.x, _e1116.y, _e1116.z, _e1116.w);
        let _e1131 = vec4<f32>(_e1125.x, _e1117.y, _e1125.z, _e1125.w);
        phi_6805_ = vec4<f32>(_e1131.x, _e1131.y, _e1117.z, _e1131.w);
    }
    let _e1139 = phi_6805_;
    global_19 = _e1139;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    global_4 = param_2;
    function_();
    let _e7 = global_19;
    return _e7;
}
