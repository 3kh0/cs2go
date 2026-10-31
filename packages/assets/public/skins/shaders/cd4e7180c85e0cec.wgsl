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
    member_14: i32,
    member_15: f32,
    member_16: f32,
    member_17: f32,
    member_18: f32,
    member_19: f32,
    member_20: f32,
    member_21: f32,
    member_22: f32,
    member_23: vec3<f32>,
    member_24: vec3<f32>,
    member_25: vec3<f32>,
    member_26: vec3<f32>,
    member_27: f32,
    member_28: vec4<f32>,
    member_29: i32,
    member_30: vec4<f32>,
    member_31: f32,
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
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
var<private> global_5: vec2<f32>;
@group(1) @binding(33) 
var global_6: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_7: type_13;
@group(1) @binding(43) 
var global_8: texture_2d<f32>;
@group(1) @binding(22) 
var global_9: sampler;
@group(1) @binding(27) 
var global_10: sampler;
@group(1) @binding(32) 
var global_11: texture_2d<f32>;
@group(1) @binding(42) 
var global_12: texture_2d<f32>;
@group(1) @binding(40) 
var global_13: texture_2d<f32>;
@group(1) @binding(44) 
var global_14: texture_2d<f32>;
@group(1) @binding(38) 
var global_15: texture_2d<f32>;
@group(1) @binding(35) 
var global_16: texture_2d<f32>;
@group(1) @binding(36) 
var global_17: texture_2d<f32>;
@group(1) @binding(37) 
var global_18: texture_2d<f32>;
@group(1) @binding(34) 
var global_19: texture_2d<f32>;
@group(1) @binding(39) 
var global_20: texture_2d<f32>;
var<private> global_21: vec4<f32>;

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
    var phi_12885_: f32;
    var phi_21714_: f32;
    var phi_15785_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_21715_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e153 = global;
    let _e154 = _e153.xy;
    let _e156 = _e153.xy;
    let _e157 = textureSample(global_1, global_2, _e156);
    let _e160 = textureSample(global_3, global_2, _e156);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e162 = phi_13155_;
        let _e164 = phi_16208_;
        local_1 = _e162;
        if (_e164 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e173 = local[_e164];
        let _e177 = textureSample(global_6, global_2, (_e154 + (_e173 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e162 + (_e177 * 0.05882353f));
            phi_16208_ = (_e164 + 1i);
        }
    }
    let _e167 = local_1;
    let _e168 = (_e167 * 2f);
    let _e170 = global_7.member_9;
    let _e171 = (_e170 != 0i);
    phi_18941_ = _e168;
    if _e171 {
        phi_18941_ = vec4<f32>(_e168.x, _e168.y, (_e168.z * -1f), _e168.w);
    }
    let _e189 = phi_18941_;
    let _e191 = global_4;
    let _e193 = textureSample(global_8, global_9, _e191.xy);
    let _e196 = global_7.member;
    let _e198 = global_7.member_1;
    let _e199 = textureSample(global_11, global_2, _e156);
    let _e203 = normalize(((_e199.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e204 = _e189.yz;
    let _e205 = _e196.xy;
    let _e209 = _e198.xy;
    let _e213 = vec2<f32>((dot(_e204, _e205) + _e196.w), (dot(_e204, _e209) + _e198.w));
    let _e214 = textureSample(global_12, global_10, _e213);
    let _e216 = _e189.xz;
    let _e221 = vec2<f32>((dot(_e216, _e205) + _e196.w), (dot(_e216, _e209) + _e198.w));
    let _e222 = textureSample(global_12, global_10, _e221);
    let _e224 = _e189.yx;
    let _e229 = vec2<f32>((dot(_e224, _e205) + _e196.w), (dot(_e224, _e209) + _e198.w));
    let _e230 = textureSample(global_12, global_10, _e229);
    let _e235 = global_7.member_33;
    let _e247 = mix(mix(_e214.xyzw, _e222.xyzw, vec4((_e235.y * pow(abs(_e203.y), 7f)))), _e230.xyzw, vec4((_e235.z * pow(abs(_e203.z), 7f))));
    phi_22743_ = _e247;
    if _e171 {
        let _e249 = global_7.member_2;
        let _e251 = global_7.member_3;
        let _e252 = textureSample(global_11, global_2, _e156);
        let _e256 = normalize(((_e252.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e257 = _e249.xy;
        let _e261 = _e251.xy;
        let _e266 = textureSample(global_12, global_10, vec2<f32>((dot(_e204, _e257) + _e249.w), (dot(_e204, _e261) + _e251.w)));
        let _e273 = textureSample(global_12, global_10, vec2<f32>((dot(_e216, _e257) + _e249.w), (dot(_e216, _e261) + _e251.w)));
        let _e280 = textureSample(global_12, global_10, vec2<f32>((dot(_e224, _e257) + _e249.w), (dot(_e224, _e261) + _e251.w)));
        let _e296 = global_7.member_4;
        let _e298 = global_7.member_5;
        let _e299 = textureSample(global_11, global_2, _e156);
        let _e303 = normalize(((_e299.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e304 = _e296.xy;
        let _e308 = _e298.xy;
        let _e313 = textureSample(global_12, global_10, vec2<f32>((dot(_e204, _e304) + _e296.w), (dot(_e204, _e308) + _e298.w)));
        let _e320 = textureSample(global_12, global_10, vec2<f32>((dot(_e216, _e304) + _e296.w), (dot(_e216, _e308) + _e298.w)));
        let _e327 = textureSample(global_12, global_10, vec2<f32>((dot(_e224, _e304) + _e296.w), (dot(_e224, _e308) + _e298.w)));
        let _e343 = global_7.member_6;
        let _e345 = global_7.member_7;
        let _e346 = textureSample(global_11, global_2, _e156);
        let _e350 = normalize(((_e346.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e351 = _e343.xy;
        let _e355 = _e345.xy;
        let _e360 = textureSample(global_12, global_10, vec2<f32>((dot(_e204, _e351) + _e343.w), (dot(_e204, _e355) + _e345.w)));
        let _e367 = textureSample(global_12, global_10, vec2<f32>((dot(_e216, _e351) + _e343.w), (dot(_e216, _e355) + _e345.w)));
        let _e374 = textureSample(global_12, global_10, vec2<f32>((dot(_e224, _e351) + _e343.w), (dot(_e224, _e355) + _e345.w)));
        let _e390 = global_7.member_37;
        if (_e390 != 0i) {
            let _e450 = global_7.member_35;
            let _e454 = global_7.member_34;
            let _e460 = smoothstep(_e450.x, _e450.z, pow(((min(_e157.x, _e454) * _e157.y) * 2f), _e450.y));
            let _e462 = global_7.member_36;
            if (_e462.x > _e462.y) {
                let _e488 = (_e247.xyz * _e460);
                let _e494 = vec4<f32>(_e488.x, _e247.y, _e247.z, _e247.w);
                let _e500 = vec4<f32>(_e494.x, _e488.y, _e494.z, _e494.w);
                phi_12502_ = vec4<f32>(_e500.x, _e500.y, _e488.z, _e500.w);
            } else {
                let _e468 = (_e247.xyz * (1f - _e460));
                let _e474 = vec4<f32>(_e468.x, _e247.y, _e247.z, _e247.w);
                let _e480 = vec4<f32>(_e474.x, _e468.y, _e474.z, _e474.w);
                phi_12502_ = vec4<f32>(_e480.x, _e480.y, _e468.z, _e480.w);
            }
            let _e508 = phi_12502_;
            phi_21709_ = _e508;
        } else {
            let _e393 = global_7.member_35;
            let _e400 = smoothstep(_e393.x, _e393.z, pow(((_e157.x * _e157.y) * 2f), _e393.y));
            let _e402 = global_7.member_36;
            if (_e402.x > _e402.y) {
                let _e428 = (_e247.xyz * (1f - _e400));
                let _e434 = vec4<f32>(_e428.x, _e247.y, _e247.z, _e247.w);
                let _e440 = vec4<f32>(_e434.x, _e428.y, _e434.z, _e434.w);
                phi_12501_ = vec4<f32>(_e440.x, _e440.y, _e428.z, _e440.w);
            } else {
                let _e407 = (_e247.xyz * _e400);
                let _e413 = vec4<f32>(_e407.x, _e247.y, _e247.z, _e247.w);
                let _e419 = vec4<f32>(_e413.x, _e407.y, _e413.z, _e413.w);
                phi_12501_ = vec4<f32>(_e419.x, _e419.y, _e407.z, _e419.w);
            }
            let _e448 = phi_12501_;
            phi_21709_ = _e448;
        }
        let _e510 = phi_21709_;
        let _e512 = global_7.member_36;
        let _e520 = smoothstep(vec3(_e512.x), vec3(_e512.y), (_e510.xyz * vec3<f32>(mix(mix(_e266.xyzw, _e273.xyzw, vec4((_e235.y * pow(abs(_e256.y), 7f)))), _e280.xyzw, vec4((_e235.z * pow(abs(_e256.z), 7f)))).w, mix(mix(_e313.xyzw, _e320.xyzw, vec4((_e235.y * pow(abs(_e303.y), 7f)))), _e327.xyzw, vec4((_e235.z * pow(abs(_e303.z), 7f)))).w, mix(mix(_e360.xyzw, _e367.xyzw, vec4((_e235.y * pow(abs(_e350.y), 7f)))), _e374.xyzw, vec4((_e235.z * pow(abs(_e350.z), 7f)))).w)));
        let _e526 = vec4<f32>(_e520.x, _e510.y, _e510.z, _e510.w);
        let _e532 = vec4<f32>(_e526.x, _e520.y, _e526.z, _e526.w);
        phi_22743_ = vec4<f32>(_e532.x, _e532.y, _e520.z, _e532.w);
    }
    let _e540 = phi_22743_;
    let _e541 = global_5;
    let _e543 = textureSample(global_13, global_9, _e541.xy);
    let _e545 = global_7.member_40;
    switch _e545 {
        case 1: {
            phi_19017_ = vec4<f32>(_e543.x, _e543.y, _e543.z, ((_e543.w * (1f - max(_e540.x, max(_e540.y, _e540.z)))) * (1f - max(_e160.y, _e160.z))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e543.x, _e543.y, _e543.z, ((_e543.w * (_e540.x * (1f - max(_e540.y, _e540.z)))) * (1f - max(_e160.y, _e160.z))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e543.x, _e543.y, _e543.z, (_e543.w * (max((_e540.y * (1f - _e540.z)), _e160.y) * (1f - _e160.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e543.x, _e543.y, _e543.z, (_e543.w * max((_e540.z * (1f - _e160.y)), _e160.z)));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e543.x, _e543.y, _e543.z, (_e543.w * max(_e540.x, max(_e540.y, max(_e540.z, max(_e160.y, _e160.z))))));
            break;
        }
        case 7: {
            phi_19017_ = vec4<f32>(_e543.x, _e543.y, _e543.z, (_e543.w * (1f - max(_e160.y, _e160.z))));
            break;
        }
        default: {
            phi_19017_ = _e543;
            break;
        }
    }
    let _e639 = phi_19017_;
    let _e642 = global_7.member_15;
    let _e643 = (_e639.w * _e642);
    let _e646 = global_7.member_17;
    let _e647 = (_e639.xyz * _e646);
    let _e651 = vec4<f32>(_e647.x, _e647.y, _e647.z, _e643);
    let _e652 = (_e193.x * _e157.x);
    let _e655 = global_7.member_32;
    let _e657 = ((_e655 * 6f) + 1f);
    let _e661 = global_7.member_18;
    let _e665 = global_7.member_28;
    let _e679 = mix(mix(mix(mix(mix(_e665.x, _e665.y, _e540.x), _e665.z, _e540.y), _e665.w, _e540.z), _e665.z, _e160.y), _e665.w, _e160.z);
    let _e680 = ((((_e157.w + _e652) * _e657) * mix(1f, _e661, _e639.w)) * _e679);
    let _e682 = global_7.member_22;
    let _e683 = (_e682 * _e679);
    let _e688 = (0.56f - (0.06f * _e655));
    let _e692 = (0.54f - (_e655 * 0.12f));
    let _e702 = (_e540.xyz * vec3<f32>(smoothstep((0.58f + _e683), (_e688 - _e683), _e680), smoothstep((_e688 + _e683), (_e692 - _e683), _e680), smoothstep((_e692 + _e683), ((0.52f - (_e655 * 0.17999999f)) - _e683), _e680)).xyz);
    let _e706 = (0.58f - _e683);
    let _e707 = (0.68f + _e683);
    let _e708 = smoothstep(_e706, _e707, _e680);
    let _e717 = smoothstep(_e706, _e707, ((_e652 * _e657) * _e661));
    if (_e545 == 0i) {
        phi_21710_ = max(0f, mix(_e708, min(_e708, _e717), _e643));
    } else {
        phi_21710_ = _e708;
    }
    let _e723 = phi_21710_;
    let _e725 = global_7.member_41;
    phi_19287_ = _e651;
    if (_e725 == 4i) {
        phi_19287_ = vec4<f32>(_e651.x, _e651.y, _e651.z, (_e643 * clamp((1f - _e717), 0f, 1f)));
    }
    let _e736 = phi_19287_;
    let _e738 = textureSample(global_14, global_9, _e191.zw);
    let _e745 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e738, vec4(((pow((1f - _e157.x), 4f) * 0.25f) + (0.75f * _e655))));
    let _e747 = global_7.member_14;
    if (_e747 != 0i) {
        let _e752 = textureSample(global_15, global_9, _e153.zw);
        phi_21711_ = _e752.x;
    } else {
        let _e749 = textureSample(global_15, global_9, _e156);
        phi_21711_ = _e749.x;
    }
    let _e755 = phi_21711_;
    let _e757 = global_7.member_8;
    phi_11711_ = vec4<f32>(_e154, 0f, 1f);
    phi_10247_ = _e755;
    if (_e757 != 0i) {
        let _e759 = textureSample(global_16, global_2, _e156);
        let _e770 = global_7.member_12;
        if (_e770 != 0i) {
            let _e774 = textureSample(global_11, global_2, _e156);
            let _e778 = normalize(((_e774.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e779 = textureSample(global_17, global_9, _e213);
            let _e781 = textureSample(global_17, global_9, _e221);
            let _e783 = textureSample(global_17, global_9, _e229);
            phi_21712_ = mix(mix(_e779.xyzw, _e781.xyzw, vec4((_e235.y * pow(abs(_e778.y), 7f)))), _e783.xyzw, vec4((_e235.z * pow(abs(_e778.z), 7f)))).x;
        } else {
            let _e772 = textureSample(global_17, global_9, _e156);
            phi_21712_ = _e772.x;
        }
        let _e799 = phi_21712_;
        let _e801 = global_7.member_29;
        let _e802 = (_e801 != 0i);
        phi_12885_ = _e799;
        if _e802 {
            let _e804 = global_7.member_30;
            phi_12885_ = mix(mix(mix(_e804.x, _e804.y, _e702.x), _e804.z, _e702.y), _e804.w, _e702.z);
        }
        let _e813 = phi_12885_;
        phi_21714_ = _e813;
        if _e802 {
            let _e815 = global_7.member_30;
            phi_21714_ = mix(mix(_e813, _e815.z, _e160.y), _e815.w, _e160.z);
        }
        let _e821 = phi_21714_;
        let _e823 = global_7.member_16;
        let _e824 = (((1f - _e717) * _e736.w) * _e823);
        let _e826 = global_7.member_19;
        let _e829 = global_7.member_20;
        let _e830 = mix(_e755, _e829, _e824);
        let _e840 = mix(vec4<f32>(min(1f, (mix(_e821, _e826, _e824) + ((((1f - _e745.w) * _e655) * _e655) * 0.5f))), _e830, 0f, 1f), vec4<f32>(_e759.x, _e759.y, _e759.z, _e759.w), vec4(_e723));
        let _e841 = (1f - _e723);
        let _e843 = global_7.member_13;
        if (_e843 != 0i) {
            let _e854 = textureSample(global_11, global_2, _e156);
            let _e858 = normalize(((_e854.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e859 = textureSample(global_18, global_9, _e213);
            let _e861 = textureSample(global_18, global_9, _e221);
            let _e863 = textureSample(global_18, global_9, _e229);
            phi_15785_ = vec4<f32>(_e840.x, _e840.y, (_e841 * mix(mix(_e859.xyzw, _e861.xyzw, vec4((_e235.y * pow(abs(_e858.y), 7f)))), _e863.xyzw, vec4((_e235.z * pow(abs(_e858.z), 7f)))).x), _e840.w);
        } else {
            let _e845 = textureSample(global_18, global_9, _e156);
            let _e847 = (_e841 * _e845.x);
            phi_15785_ = vec4<f32>(_e840.x, _e840.y, (_e847 * _e847), _e840.w);
        }
        let _e885 = phi_15785_;
        let _e891 = global_7.member_21;
        let _e893 = mix((_e885.z * (1f - max(_e160.y, _e160.z))), (_e891 - _e723), _e824);
        let _e900 = global_7.member_31;
        let _e902 = vec4<f32>(_e885.x, _e885.y, _e893, _e885.w).xyz;
        let _e903 = (_e902 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e906 = pow(((_e902 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e885.x <= 0.04045f) {
            phi_21354_ = _e903.x;
        } else {
            phi_21354_ = _e906.x;
        }
        let _e912 = phi_21354_;
        if (_e885.y <= 0.04045f) {
            phi_23035_ = _e903.y;
        } else {
            phi_23035_ = _e906.y;
        }
        let _e918 = phi_23035_;
        if (_e893 <= 0.04045f) {
            phi_19513_ = _e903.z;
        } else {
            phi_19513_ = _e906.z;
        }
        let _e923 = phi_19513_;
        let _e924 = vec4<f32>(_e912, _e918, _e893, min(1f, _e900));
        phi_11711_ = vec4<f32>(_e924.x, _e924.y, _e923, _e924.w);
        phi_10247_ = _e830;
    }
    let _e931 = phi_11711_;
    let _e933 = phi_10247_;
    phi_22401_ = _e931;
    if (_e757 == 0i) {
        let _e935 = textureSample(global_19, global_2, _e156);
        let _e938 = global_7.member_23;
        let _e940 = global_7.member_24;
        let _e944 = global_7.member_25;
        let _e948 = global_7.member_26;
        let _e955 = _e935.xyz;
        let _e956 = vec3(_e723);
        let _e957 = mix(mix(mix(mix(mix(mix(_e938, _e940, vec3(_e702.x)), _e944, vec3(_e702.y)), _e948, vec3(_e702.z)), _e944, vec3(_e160.y)), _e948, vec3(_e160.z)).xyz, _e955, _e956);
        switch _e725 {
            case 0: {
                phi_21715_ = mix(_e957.xyz, _e736.xyz, vec3(_e736.w));
                break;
            }
            case 1: {
                let _e1071 = global_7.member_10;
                let _e1072 = _e957.xyz;
                let _e1093 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e736.xyz * _e1072).xyz)) * 1.06f);
                let _e1095 = _e1093.xyz;
                phi_21715_ = mix(_e957.xyz, mix(vec3(_e1071.x), max(((((_e1095 * _e1071.x) * 1.732f) / vec3(length(_e1095))) / vec3(dot(_e1093.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e1093 * mix(_e1071.x, _e1071.z, clamp(pow(max(_e957.x, max(_e957.y, _e957.z)), _e1071.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e1071.x, dot(clamp((_e1072 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e736.w));
                break;
            }
            case 2: {
                let _e1022 = _e957.xyz;
                let _e1024 = (_e1022 * _e736.xyz);
                let _e1026 = global_7.member_10;
                let _e1046 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e1024.xyz)) * 1.06f);
                let _e1048 = _e1046.xyz;
                phi_21715_ = mix(_e1022, mix(vec3(_e1026.x), max(((((_e1048 * _e1026.x) * 1.732f) / vec3(length(_e1048))) / vec3(dot(_e1046.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e1046 * mix(_e1026.x, _e1026.z, clamp(pow(max(_e1024.x, max(_e1024.y, _e1024.z)), _e1026.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e1026.x, dot(clamp((_e1024.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e736.w));
                break;
            }
            case 3: {
                let _e963 = _e957.xyz;
                let _e965 = (_e963 + _e736.xyz);
                let _e967 = global_7.member_10;
                let _e972 = dot(clamp((_e965.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e988 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e965.xyz)) * 1.06f);
                let _e990 = _e988.xyz;
                let _e1001 = max(((((_e990 * _e967.x) * 1.732f) / vec3(length(_e990))) / vec3(dot(_e988.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e988 * mix(_e967.x, _e967.z, clamp(pow((max(_e965.x, max(_e965.y, _e965.z)) * 2f), _e967.y), 0f, 1f)))).xyz;
                let _e1008 = global_7.member_11;
                phi_21715_ = mix(_e963, mix(vec3(_e967.x), mix(_e1001, min(_e967.zzz, (_e1001 + (vec3(_e972) * 2f))), vec3((1f / _e1008))).xyz, vec3(pow(smoothstep(0.0003f, _e967.x, _e972), 0.5f))).xyz, vec3(_e736.w));
                break;
            }
            case 4: {
                phi_21715_ = mix(_e957.xyz, _e736.xyz, vec3(_e736.w));
                break;
            }
            default: {
                phi_21715_ = _e957;
                break;
            }
        }
        let _e1122 = phi_21715_;
        let _e1124 = global_7.member_27;
        let _e1127 = clamp((_e1122 * mix(_e1124, 1f, (smoothstep(0f, 0.01f, _e708) * (1f - (smoothstep(0.5f, 0.6f, _e540.w) * smoothstep(1f, 0.9f, _e540.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e1130 = (_e1127.xyz * _e745.xyz);
        let _e1135 = global_7.member_38;
        let _e1137 = global_7.member_39;
        let _e1140 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e1130.xyz));
        let _e1148 = mix(_e1135.xyz, _e1137.xyz, vec3(_e933));
        let _e1168 = mix(mix(_e1130, ((_e1140.xyz * mix(min(_e1148.x, dot(_e1127.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e1148.z, clamp(pow(max(_e1130.x, max(_e1130.y, _e1130.z)), _e1148.y), 0f, 1f))) / vec3(max(_e1140.x, max(_e1140.y, _e1140.z)))).xyz, vec3(_e655)), _e955, _e956);
        phi_22401_ = vec4<f32>(_e1168.x, _e1168.y, _e1168.z, 1f);
    }
    let _e1174 = phi_22401_;
    let _e1175 = textureSample(global_20, global_9, _e156);
    phi_6805_ = _e1174;
    if (_e1175.w < 0f) {
        let _e1183 = vec4<f32>(_e1175.x, _e1174.y, _e1174.z, _e1174.w);
        let _e1189 = vec4<f32>(_e1183.x, _e1175.y, _e1183.z, _e1183.w);
        phi_6805_ = vec4<f32>(_e1189.x, _e1189.y, _e1175.z, _e1189.w);
    }
    let _e1197 = phi_6805_;
    global_21 = _e1197;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_5 = param_2;
    function_();
    let _e7 = global_21;
    return _e7;
}
