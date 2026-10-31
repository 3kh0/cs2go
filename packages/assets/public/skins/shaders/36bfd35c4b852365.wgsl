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
    member_12: f32,
    member_13: f32,
    member_14: f32,
    member_15: f32,
    member_16: f32,
    member_17: f32,
    member_18: f32,
    member_19: f32,
    member_20: vec3<f32>,
    member_21: vec3<f32>,
    member_22: vec3<f32>,
    member_23: vec3<f32>,
    member_24: f32,
    member_25: vec4<f32>,
    member_26: f32,
    member_27: i32,
    member_28: vec4<f32>,
    member_29: f32,
    member_30: vec4<f32>,
    member_31: f32,
    member_32: vec3<f32>,
    member_33: f32,
    member_34: vec3<f32>,
    member_35: vec2<f32>,
    member_36: i32,
    member_37: vec3<f32>,
    member_38: vec3<f32>,
    member_39: i32,
    member_40: i32,
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
@group(1) @binding(40) 
var global_8: texture_2d<f32>;
@group(1) @binding(22) 
var global_9: sampler;
@group(1) @binding(27) 
var global_10: sampler;
@group(1) @binding(32) 
var global_11: texture_2d<f32>;
@group(1) @binding(39) 
var global_12: texture_2d<f32>;
@group(1) @binding(37) 
var global_13: texture_2d<f32>;
@group(1) @binding(41) 
var global_14: texture_2d<f32>;
@group(1) @binding(35) 
var global_15: texture_2d<f32>;
@group(1) @binding(34) 
var global_16: texture_2d<f32>;
@group(1) @binding(36) 
var global_17: texture_2d<f32>;
var<private> global_18: vec4<f32>;

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
    var phi_12885_: f32;
    var phi_21711_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_21712_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e149 = global;
    let _e150 = _e149.xy;
    let _e152 = _e149.xy;
    let _e153 = textureSample(global_1, global_2, _e152);
    let _e156 = textureSample(global_3, global_2, _e152);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e158 = phi_13155_;
        let _e160 = phi_16208_;
        local_1 = _e158;
        if (_e160 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e169 = local[_e160];
        let _e173 = textureSample(global_6, global_2, (_e150 + (_e169 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e158 + (_e173 * 0.05882353f));
            phi_16208_ = (_e160 + 1i);
        }
    }
    let _e163 = local_1;
    let _e164 = (_e163 * 2f);
    let _e166 = global_7.member_9;
    let _e167 = (_e166 != 0i);
    phi_18941_ = _e164;
    if _e167 {
        phi_18941_ = vec4<f32>(_e164.x, _e164.y, (_e164.z * -1f), _e164.w);
    }
    let _e185 = phi_18941_;
    let _e187 = global_4;
    let _e189 = textureSample(global_8, global_9, _e187.xy);
    let _e192 = global_7.member;
    let _e194 = global_7.member_1;
    let _e195 = textureSample(global_11, global_2, _e152);
    let _e199 = normalize(((_e195.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e200 = _e185.yz;
    let _e201 = _e192.xy;
    let _e205 = _e194.xy;
    let _e210 = textureSample(global_12, global_10, vec2<f32>((dot(_e200, _e201) + _e192.w), (dot(_e200, _e205) + _e194.w)));
    let _e212 = _e185.xz;
    let _e218 = textureSample(global_12, global_10, vec2<f32>((dot(_e212, _e201) + _e192.w), (dot(_e212, _e205) + _e194.w)));
    let _e220 = _e185.yx;
    let _e226 = textureSample(global_12, global_10, vec2<f32>((dot(_e220, _e201) + _e192.w), (dot(_e220, _e205) + _e194.w)));
    let _e231 = global_7.member_32;
    let _e243 = mix(mix(_e210.xyzw, _e218.xyzw, vec4((_e231.y * pow(abs(_e199.y), 7f)))), _e226.xyzw, vec4((_e231.z * pow(abs(_e199.z), 7f))));
    phi_22743_ = _e243;
    if _e167 {
        let _e245 = global_7.member_2;
        let _e247 = global_7.member_3;
        let _e248 = textureSample(global_11, global_2, _e152);
        let _e252 = normalize(((_e248.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e253 = _e245.xy;
        let _e257 = _e247.xy;
        let _e262 = textureSample(global_12, global_10, vec2<f32>((dot(_e200, _e253) + _e245.w), (dot(_e200, _e257) + _e247.w)));
        let _e269 = textureSample(global_12, global_10, vec2<f32>((dot(_e212, _e253) + _e245.w), (dot(_e212, _e257) + _e247.w)));
        let _e276 = textureSample(global_12, global_10, vec2<f32>((dot(_e220, _e253) + _e245.w), (dot(_e220, _e257) + _e247.w)));
        let _e292 = global_7.member_4;
        let _e294 = global_7.member_5;
        let _e295 = textureSample(global_11, global_2, _e152);
        let _e299 = normalize(((_e295.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e300 = _e292.xy;
        let _e304 = _e294.xy;
        let _e309 = textureSample(global_12, global_10, vec2<f32>((dot(_e200, _e300) + _e292.w), (dot(_e200, _e304) + _e294.w)));
        let _e316 = textureSample(global_12, global_10, vec2<f32>((dot(_e212, _e300) + _e292.w), (dot(_e212, _e304) + _e294.w)));
        let _e323 = textureSample(global_12, global_10, vec2<f32>((dot(_e220, _e300) + _e292.w), (dot(_e220, _e304) + _e294.w)));
        let _e339 = global_7.member_6;
        let _e341 = global_7.member_7;
        let _e342 = textureSample(global_11, global_2, _e152);
        let _e346 = normalize(((_e342.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e347 = _e339.xy;
        let _e351 = _e341.xy;
        let _e356 = textureSample(global_12, global_10, vec2<f32>((dot(_e200, _e347) + _e339.w), (dot(_e200, _e351) + _e341.w)));
        let _e363 = textureSample(global_12, global_10, vec2<f32>((dot(_e212, _e347) + _e339.w), (dot(_e212, _e351) + _e341.w)));
        let _e370 = textureSample(global_12, global_10, vec2<f32>((dot(_e220, _e347) + _e339.w), (dot(_e220, _e351) + _e341.w)));
        let _e386 = global_7.member_36;
        if (_e386 != 0i) {
            let _e446 = global_7.member_34;
            let _e450 = global_7.member_33;
            let _e456 = smoothstep(_e446.x, _e446.z, pow(((min(_e153.x, _e450) * _e153.y) * 2f), _e446.y));
            let _e458 = global_7.member_35;
            if (_e458.x > _e458.y) {
                let _e484 = (_e243.xyz * _e456);
                let _e490 = vec4<f32>(_e484.x, _e243.y, _e243.z, _e243.w);
                let _e496 = vec4<f32>(_e490.x, _e484.y, _e490.z, _e490.w);
                phi_12502_ = vec4<f32>(_e496.x, _e496.y, _e484.z, _e496.w);
            } else {
                let _e464 = (_e243.xyz * (1f - _e456));
                let _e470 = vec4<f32>(_e464.x, _e243.y, _e243.z, _e243.w);
                let _e476 = vec4<f32>(_e470.x, _e464.y, _e470.z, _e470.w);
                phi_12502_ = vec4<f32>(_e476.x, _e476.y, _e464.z, _e476.w);
            }
            let _e504 = phi_12502_;
            phi_21709_ = _e504;
        } else {
            let _e389 = global_7.member_34;
            let _e396 = smoothstep(_e389.x, _e389.z, pow(((_e153.x * _e153.y) * 2f), _e389.y));
            let _e398 = global_7.member_35;
            if (_e398.x > _e398.y) {
                let _e424 = (_e243.xyz * (1f - _e396));
                let _e430 = vec4<f32>(_e424.x, _e243.y, _e243.z, _e243.w);
                let _e436 = vec4<f32>(_e430.x, _e424.y, _e430.z, _e430.w);
                phi_12501_ = vec4<f32>(_e436.x, _e436.y, _e424.z, _e436.w);
            } else {
                let _e403 = (_e243.xyz * _e396);
                let _e409 = vec4<f32>(_e403.x, _e243.y, _e243.z, _e243.w);
                let _e415 = vec4<f32>(_e409.x, _e403.y, _e409.z, _e409.w);
                phi_12501_ = vec4<f32>(_e415.x, _e415.y, _e403.z, _e415.w);
            }
            let _e444 = phi_12501_;
            phi_21709_ = _e444;
        }
        let _e506 = phi_21709_;
        let _e508 = global_7.member_35;
        let _e516 = smoothstep(vec3(_e508.x), vec3(_e508.y), (_e506.xyz * vec3<f32>(mix(mix(_e262.xyzw, _e269.xyzw, vec4((_e231.y * pow(abs(_e252.y), 7f)))), _e276.xyzw, vec4((_e231.z * pow(abs(_e252.z), 7f)))).w, mix(mix(_e309.xyzw, _e316.xyzw, vec4((_e231.y * pow(abs(_e299.y), 7f)))), _e323.xyzw, vec4((_e231.z * pow(abs(_e299.z), 7f)))).w, mix(mix(_e356.xyzw, _e363.xyzw, vec4((_e231.y * pow(abs(_e346.y), 7f)))), _e370.xyzw, vec4((_e231.z * pow(abs(_e346.z), 7f)))).w)));
        let _e522 = vec4<f32>(_e516.x, _e506.y, _e506.z, _e506.w);
        let _e528 = vec4<f32>(_e522.x, _e516.y, _e522.z, _e522.w);
        phi_22743_ = vec4<f32>(_e528.x, _e528.y, _e516.z, _e528.w);
    }
    let _e536 = phi_22743_;
    let _e537 = global_5;
    let _e539 = textureSample(global_13, global_9, _e537.xy);
    let _e541 = global_7.member_39;
    switch _e541 {
        case 1: {
            phi_19017_ = vec4<f32>(_e539.x, _e539.y, _e539.z, ((_e539.w * (1f - max(_e536.x, max(_e536.y, _e536.z)))) * (1f - max(_e156.y, _e156.z))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e539.x, _e539.y, _e539.z, ((_e539.w * (_e536.x * (1f - max(_e536.y, _e536.z)))) * (1f - max(_e156.y, _e156.z))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e539.x, _e539.y, _e539.z, (_e539.w * (max((_e536.y * (1f - _e536.z)), _e156.y) * (1f - _e156.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e539.x, _e539.y, _e539.z, (_e539.w * max((_e536.z * (1f - _e156.y)), _e156.z)));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e539.x, _e539.y, _e539.z, (_e539.w * max(_e536.x, max(_e536.y, max(_e536.z, max(_e156.y, _e156.z))))));
            break;
        }
        case 7: {
            phi_19017_ = vec4<f32>(_e539.x, _e539.y, _e539.z, (_e539.w * (1f - max(_e156.y, _e156.z))));
            break;
        }
        default: {
            phi_19017_ = _e539;
            break;
        }
    }
    let _e635 = phi_19017_;
    let _e638 = global_7.member_12;
    let _e639 = (_e635.w * _e638);
    let _e642 = global_7.member_14;
    let _e643 = (_e635.xyz * _e642);
    let _e647 = vec4<f32>(_e643.x, _e643.y, _e643.z, _e639);
    let _e648 = (_e189.x * _e153.x);
    let _e651 = global_7.member_31;
    let _e653 = ((_e651 * 6f) + 1f);
    let _e657 = global_7.member_15;
    let _e661 = global_7.member_25;
    let _e675 = mix(mix(mix(mix(mix(_e661.x, _e661.y, _e536.x), _e661.z, _e536.y), _e661.w, _e536.z), _e661.z, _e156.y), _e661.w, _e156.z);
    let _e676 = ((((_e153.w + _e648) * _e653) * mix(1f, _e657, _e635.w)) * _e675);
    let _e678 = global_7.member_19;
    let _e679 = (_e678 * _e675);
    let _e684 = (0.56f - (0.06f * _e651));
    let _e688 = (0.54f - (_e651 * 0.12f));
    let _e698 = (_e536.xyz * vec3<f32>(smoothstep((0.58f + _e679), (_e684 - _e679), _e676), smoothstep((_e684 + _e679), (_e688 - _e679), _e676), smoothstep((_e688 + _e679), ((0.52f - (_e651 * 0.17999999f)) - _e679), _e676)).xyz);
    let _e702 = (0.58f - _e679);
    let _e703 = (0.68f + _e679);
    let _e704 = smoothstep(_e702, _e703, _e676);
    let _e713 = smoothstep(_e702, _e703, ((_e648 * _e653) * _e657));
    if (_e541 == 0i) {
        phi_21710_ = max(0f, mix(_e704, min(_e704, _e713), _e639));
    } else {
        phi_21710_ = _e704;
    }
    let _e719 = phi_21710_;
    let _e721 = global_7.member_40;
    phi_19287_ = _e647;
    if (_e721 == 4i) {
        phi_19287_ = vec4<f32>(_e647.x, _e647.y, _e647.z, (_e639 * clamp((1f - _e713), 0f, 1f)));
    }
    let _e732 = phi_19287_;
    let _e734 = textureSample(global_14, global_9, _e187.zw);
    let _e741 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e734, vec4(((pow((1f - _e153.x), 4f) * 0.25f) + (0.75f * _e651))));
    let _e743 = global_7.member_30;
    let _e752 = mix(mix(mix(mix(mix(_e743.x, _e743.y, _e698.x), _e743.z, _e698.y), _e743.w, _e698.z), _e743.z, _e156.y), _e743.w, _e156.z);
    let _e754 = global_7.member_8;
    if (_e754 != 0i) {
        let _e756 = textureSample(global_15, global_2, _e152);
        let _e767 = global_7.member_27;
        let _e768 = (_e767 != 0i);
        if _e768 {
            let _e772 = global_7.member_28;
            phi_12885_ = mix(mix(mix(_e772.x, _e772.y, _e698.x), _e772.z, _e698.y), _e772.w, _e698.z);
        } else {
            let _e770 = global_7.member_26;
            phi_12885_ = _e770;
        }
        let _e781 = phi_12885_;
        phi_21711_ = _e781;
        if _e768 {
            let _e783 = global_7.member_28;
            phi_21711_ = mix(mix(_e781, _e783.z, _e156.y), _e783.w, _e156.z);
        }
        let _e789 = phi_21711_;
        let _e791 = global_7.member_13;
        let _e792 = (((1f - _e713) * _e732.w) * _e791);
        let _e794 = global_7.member_16;
        let _e797 = global_7.member_17;
        let _e798 = mix(_e752, _e797, _e792);
        let _e808 = mix(vec4<f32>(min(1f, (mix(_e789, _e794, _e792) + ((((1f - _e741.w) * _e651) * _e651) * 0.5f))), _e798, 0f, 1f), vec4<f32>(_e756.x, _e756.y, _e756.z, _e756.w), vec4(_e719));
        let _e811 = global_7.member_18;
        let _e813 = mix((1f - _e719), (_e811 - _e719), _e792);
        let _e820 = global_7.member_29;
        let _e822 = vec4<f32>(_e808.x, _e808.y, _e813, _e808.w).xyz;
        let _e823 = (_e822 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e826 = pow(((_e822 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e808.x <= 0.04045f) {
            phi_21354_ = _e823.x;
        } else {
            phi_21354_ = _e826.x;
        }
        let _e832 = phi_21354_;
        if (_e808.y <= 0.04045f) {
            phi_23035_ = _e823.y;
        } else {
            phi_23035_ = _e826.y;
        }
        let _e838 = phi_23035_;
        if (_e813 <= 0.04045f) {
            phi_19513_ = _e823.z;
        } else {
            phi_19513_ = _e826.z;
        }
        let _e843 = phi_19513_;
        let _e844 = vec4<f32>(_e832, _e838, _e813, min(1f, _e820));
        phi_11711_ = vec4<f32>(_e844.x, _e844.y, _e843, _e844.w);
        phi_10247_ = _e798;
    } else {
        phi_11711_ = vec4<f32>(_e150, 0f, 1f);
        phi_10247_ = _e752;
    }
    let _e851 = phi_11711_;
    let _e853 = phi_10247_;
    phi_22401_ = _e851;
    if (_e754 == 0i) {
        let _e855 = textureSample(global_16, global_2, _e152);
        let _e858 = global_7.member_20;
        let _e860 = global_7.member_21;
        let _e864 = global_7.member_22;
        let _e868 = global_7.member_23;
        let _e875 = _e855.xyz;
        let _e876 = vec3(_e719);
        let _e877 = mix(mix(mix(mix(mix(mix(_e858, _e860, vec3(_e698.x)), _e864, vec3(_e698.y)), _e868, vec3(_e698.z)), _e864, vec3(_e156.y)), _e868, vec3(_e156.z)).xyz, _e875, _e876);
        switch _e721 {
            case 0: {
                phi_21712_ = mix(_e877.xyz, _e732.xyz, vec3(_e732.w));
                break;
            }
            case 1: {
                let _e991 = global_7.member_10;
                let _e992 = _e877.xyz;
                let _e1013 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e732.xyz * _e992).xyz)) * 1.06f);
                let _e1015 = _e1013.xyz;
                phi_21712_ = mix(_e877.xyz, mix(vec3(_e991.x), max(((((_e1015 * _e991.x) * 1.732f) / vec3(length(_e1015))) / vec3(dot(_e1013.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e1013 * mix(_e991.x, _e991.z, clamp(pow(max(_e877.x, max(_e877.y, _e877.z)), _e991.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e991.x, dot(clamp((_e992 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e732.w));
                break;
            }
            case 2: {
                let _e942 = _e877.xyz;
                let _e944 = (_e942 * _e732.xyz);
                let _e946 = global_7.member_10;
                let _e966 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e944.xyz)) * 1.06f);
                let _e968 = _e966.xyz;
                phi_21712_ = mix(_e942, mix(vec3(_e946.x), max(((((_e968 * _e946.x) * 1.732f) / vec3(length(_e968))) / vec3(dot(_e966.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e966 * mix(_e946.x, _e946.z, clamp(pow(max(_e944.x, max(_e944.y, _e944.z)), _e946.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e946.x, dot(clamp((_e944.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e732.w));
                break;
            }
            case 3: {
                let _e883 = _e877.xyz;
                let _e885 = (_e883 + _e732.xyz);
                let _e887 = global_7.member_10;
                let _e892 = dot(clamp((_e885.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e908 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e885.xyz)) * 1.06f);
                let _e910 = _e908.xyz;
                let _e921 = max(((((_e910 * _e887.x) * 1.732f) / vec3(length(_e910))) / vec3(dot(_e908.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e908 * mix(_e887.x, _e887.z, clamp(pow((max(_e885.x, max(_e885.y, _e885.z)) * 2f), _e887.y), 0f, 1f)))).xyz;
                let _e928 = global_7.member_11;
                phi_21712_ = mix(_e883, mix(vec3(_e887.x), mix(_e921, min(_e887.zzz, (_e921 + (vec3(_e892) * 2f))), vec3((1f / _e928))).xyz, vec3(pow(smoothstep(0.0003f, _e887.x, _e892), 0.5f))).xyz, vec3(_e732.w));
                break;
            }
            case 4: {
                phi_21712_ = mix(_e877.xyz, _e732.xyz, vec3(_e732.w));
                break;
            }
            default: {
                phi_21712_ = _e877;
                break;
            }
        }
        let _e1042 = phi_21712_;
        let _e1044 = global_7.member_24;
        let _e1047 = clamp((_e1042 * mix(_e1044, 1f, (smoothstep(0f, 0.01f, _e704) * (1f - (smoothstep(0.5f, 0.6f, _e536.w) * smoothstep(1f, 0.9f, _e536.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e1050 = (_e1047.xyz * _e741.xyz);
        let _e1055 = global_7.member_37;
        let _e1057 = global_7.member_38;
        let _e1060 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e1050.xyz));
        let _e1068 = mix(_e1055.xyz, _e1057.xyz, vec3(_e853));
        let _e1088 = mix(mix(_e1050, ((_e1060.xyz * mix(min(_e1068.x, dot(_e1047.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e1068.z, clamp(pow(max(_e1050.x, max(_e1050.y, _e1050.z)), _e1068.y), 0f, 1f))) / vec3(max(_e1060.x, max(_e1060.y, _e1060.z)))).xyz, vec3(_e651)), _e875, _e876);
        phi_22401_ = vec4<f32>(_e1088.x, _e1088.y, _e1088.z, 1f);
    }
    let _e1094 = phi_22401_;
    let _e1095 = textureSample(global_17, global_9, _e152);
    phi_6805_ = _e1094;
    if (_e1095.w < 0f) {
        let _e1103 = vec4<f32>(_e1095.x, _e1094.y, _e1094.z, _e1094.w);
        let _e1109 = vec4<f32>(_e1103.x, _e1095.y, _e1103.z, _e1103.w);
        phi_6805_ = vec4<f32>(_e1109.x, _e1109.y, _e1095.z, _e1109.w);
    }
    let _e1117 = phi_6805_;
    global_18 = _e1117;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_5 = param_2;
    function_();
    let _e7 = global_18;
    return _e7;
}
