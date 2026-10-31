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
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
var<private> global_5: vec2<f32>;
@group(1) @binding(33) 
var global_6: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_7: type_13;
@group(1) @binding(42) 
var global_8: texture_2d<f32>;
@group(1) @binding(22) 
var global_9: sampler;
@group(1) @binding(27) 
var global_10: sampler;
@group(1) @binding(32) 
var global_11: texture_2d<f32>;
@group(1) @binding(41) 
var global_12: texture_2d<f32>;
@group(1) @binding(39) 
var global_13: texture_2d<f32>;
@group(1) @binding(43) 
var global_14: texture_2d<f32>;
@group(1) @binding(35) 
var global_15: texture_2d<f32>;
@group(1) @binding(36) 
var global_16: texture_2d<f32>;
@group(1) @binding(37) 
var global_17: texture_2d<f32>;
@group(1) @binding(34) 
var global_18: texture_2d<f32>;
@group(1) @binding(38) 
var global_19: texture_2d<f32>;
var<private> global_20: vec4<f32>;

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
    var phi_12885_: f32;
    var phi_21712_: f32;
    var phi_15784_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_21714_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e152 = global;
    let _e153 = _e152.xy;
    let _e155 = _e152.xy;
    let _e156 = textureSample(global_1, global_2, _e155);
    let _e159 = textureSample(global_3, global_2, _e155);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e161 = phi_13155_;
        let _e163 = phi_16208_;
        local_1 = _e161;
        if (_e163 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e172 = local[_e163];
        let _e176 = textureSample(global_6, global_2, (_e153 + (_e172 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e161 + (_e176 * 0.05882353f));
            phi_16208_ = (_e163 + 1i);
        }
    }
    let _e166 = local_1;
    let _e167 = (_e166 * 2f);
    let _e169 = global_7.member_9;
    let _e170 = (_e169 != 0i);
    phi_18941_ = _e167;
    if _e170 {
        phi_18941_ = vec4<f32>(_e167.x, _e167.y, (_e167.z * -1f), _e167.w);
    }
    let _e188 = phi_18941_;
    let _e190 = global_4;
    let _e192 = textureSample(global_8, global_9, _e190.xy);
    let _e195 = global_7.member;
    let _e197 = global_7.member_1;
    let _e198 = textureSample(global_11, global_2, _e155);
    let _e202 = normalize(((_e198.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e203 = _e188.yz;
    let _e204 = _e195.xy;
    let _e208 = _e197.xy;
    let _e212 = vec2<f32>((dot(_e203, _e204) + _e195.w), (dot(_e203, _e208) + _e197.w));
    let _e213 = textureSample(global_12, global_10, _e212);
    let _e215 = _e188.xz;
    let _e220 = vec2<f32>((dot(_e215, _e204) + _e195.w), (dot(_e215, _e208) + _e197.w));
    let _e221 = textureSample(global_12, global_10, _e220);
    let _e223 = _e188.yx;
    let _e228 = vec2<f32>((dot(_e223, _e204) + _e195.w), (dot(_e223, _e208) + _e197.w));
    let _e229 = textureSample(global_12, global_10, _e228);
    let _e234 = global_7.member_33;
    let _e246 = mix(mix(_e213.xyzw, _e221.xyzw, vec4((_e234.y * pow(abs(_e202.y), 7f)))), _e229.xyzw, vec4((_e234.z * pow(abs(_e202.z), 7f))));
    phi_22743_ = _e246;
    if _e170 {
        let _e248 = global_7.member_2;
        let _e250 = global_7.member_3;
        let _e251 = textureSample(global_11, global_2, _e155);
        let _e255 = normalize(((_e251.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e256 = _e248.xy;
        let _e260 = _e250.xy;
        let _e265 = textureSample(global_12, global_10, vec2<f32>((dot(_e203, _e256) + _e248.w), (dot(_e203, _e260) + _e250.w)));
        let _e272 = textureSample(global_12, global_10, vec2<f32>((dot(_e215, _e256) + _e248.w), (dot(_e215, _e260) + _e250.w)));
        let _e279 = textureSample(global_12, global_10, vec2<f32>((dot(_e223, _e256) + _e248.w), (dot(_e223, _e260) + _e250.w)));
        let _e295 = global_7.member_4;
        let _e297 = global_7.member_5;
        let _e298 = textureSample(global_11, global_2, _e155);
        let _e302 = normalize(((_e298.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e303 = _e295.xy;
        let _e307 = _e297.xy;
        let _e312 = textureSample(global_12, global_10, vec2<f32>((dot(_e203, _e303) + _e295.w), (dot(_e203, _e307) + _e297.w)));
        let _e319 = textureSample(global_12, global_10, vec2<f32>((dot(_e215, _e303) + _e295.w), (dot(_e215, _e307) + _e297.w)));
        let _e326 = textureSample(global_12, global_10, vec2<f32>((dot(_e223, _e303) + _e295.w), (dot(_e223, _e307) + _e297.w)));
        let _e342 = global_7.member_6;
        let _e344 = global_7.member_7;
        let _e345 = textureSample(global_11, global_2, _e155);
        let _e349 = normalize(((_e345.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e350 = _e342.xy;
        let _e354 = _e344.xy;
        let _e359 = textureSample(global_12, global_10, vec2<f32>((dot(_e203, _e350) + _e342.w), (dot(_e203, _e354) + _e344.w)));
        let _e366 = textureSample(global_12, global_10, vec2<f32>((dot(_e215, _e350) + _e342.w), (dot(_e215, _e354) + _e344.w)));
        let _e373 = textureSample(global_12, global_10, vec2<f32>((dot(_e223, _e350) + _e342.w), (dot(_e223, _e354) + _e344.w)));
        let _e389 = global_7.member_37;
        if (_e389 != 0i) {
            let _e449 = global_7.member_35;
            let _e453 = global_7.member_34;
            let _e459 = smoothstep(_e449.x, _e449.z, pow(((min(_e156.x, _e453) * _e156.y) * 2f), _e449.y));
            let _e461 = global_7.member_36;
            if (_e461.x > _e461.y) {
                let _e487 = (_e246.xyz * _e459);
                let _e493 = vec4<f32>(_e487.x, _e246.y, _e246.z, _e246.w);
                let _e499 = vec4<f32>(_e493.x, _e487.y, _e493.z, _e493.w);
                phi_12502_ = vec4<f32>(_e499.x, _e499.y, _e487.z, _e499.w);
            } else {
                let _e467 = (_e246.xyz * (1f - _e459));
                let _e473 = vec4<f32>(_e467.x, _e246.y, _e246.z, _e246.w);
                let _e479 = vec4<f32>(_e473.x, _e467.y, _e473.z, _e473.w);
                phi_12502_ = vec4<f32>(_e479.x, _e479.y, _e467.z, _e479.w);
            }
            let _e507 = phi_12502_;
            phi_21709_ = _e507;
        } else {
            let _e392 = global_7.member_35;
            let _e399 = smoothstep(_e392.x, _e392.z, pow(((_e156.x * _e156.y) * 2f), _e392.y));
            let _e401 = global_7.member_36;
            if (_e401.x > _e401.y) {
                let _e427 = (_e246.xyz * (1f - _e399));
                let _e433 = vec4<f32>(_e427.x, _e246.y, _e246.z, _e246.w);
                let _e439 = vec4<f32>(_e433.x, _e427.y, _e433.z, _e433.w);
                phi_12501_ = vec4<f32>(_e439.x, _e439.y, _e427.z, _e439.w);
            } else {
                let _e406 = (_e246.xyz * _e399);
                let _e412 = vec4<f32>(_e406.x, _e246.y, _e246.z, _e246.w);
                let _e418 = vec4<f32>(_e412.x, _e406.y, _e412.z, _e412.w);
                phi_12501_ = vec4<f32>(_e418.x, _e418.y, _e406.z, _e418.w);
            }
            let _e447 = phi_12501_;
            phi_21709_ = _e447;
        }
        let _e509 = phi_21709_;
        let _e511 = global_7.member_36;
        let _e519 = smoothstep(vec3(_e511.x), vec3(_e511.y), (_e509.xyz * vec3<f32>(mix(mix(_e265.xyzw, _e272.xyzw, vec4((_e234.y * pow(abs(_e255.y), 7f)))), _e279.xyzw, vec4((_e234.z * pow(abs(_e255.z), 7f)))).w, mix(mix(_e312.xyzw, _e319.xyzw, vec4((_e234.y * pow(abs(_e302.y), 7f)))), _e326.xyzw, vec4((_e234.z * pow(abs(_e302.z), 7f)))).w, mix(mix(_e359.xyzw, _e366.xyzw, vec4((_e234.y * pow(abs(_e349.y), 7f)))), _e373.xyzw, vec4((_e234.z * pow(abs(_e349.z), 7f)))).w)));
        let _e525 = vec4<f32>(_e519.x, _e509.y, _e509.z, _e509.w);
        let _e531 = vec4<f32>(_e525.x, _e519.y, _e525.z, _e525.w);
        phi_22743_ = vec4<f32>(_e531.x, _e531.y, _e519.z, _e531.w);
    }
    let _e539 = phi_22743_;
    let _e540 = global_5;
    let _e542 = textureSample(global_13, global_9, _e540.xy);
    let _e544 = global_7.member_40;
    switch _e544 {
        case 1: {
            phi_19017_ = vec4<f32>(_e542.x, _e542.y, _e542.z, ((_e542.w * (1f - max(_e539.x, max(_e539.y, _e539.z)))) * (1f - max(_e159.y, _e159.z))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e542.x, _e542.y, _e542.z, ((_e542.w * (_e539.x * (1f - max(_e539.y, _e539.z)))) * (1f - max(_e159.y, _e159.z))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e542.x, _e542.y, _e542.z, (_e542.w * (max((_e539.y * (1f - _e539.z)), _e159.y) * (1f - _e159.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e542.x, _e542.y, _e542.z, (_e542.w * max((_e539.z * (1f - _e159.y)), _e159.z)));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e542.x, _e542.y, _e542.z, (_e542.w * max(_e539.x, max(_e539.y, max(_e539.z, max(_e159.y, _e159.z))))));
            break;
        }
        case 7: {
            phi_19017_ = vec4<f32>(_e542.x, _e542.y, _e542.z, (_e542.w * (1f - max(_e159.y, _e159.z))));
            break;
        }
        default: {
            phi_19017_ = _e542;
            break;
        }
    }
    let _e638 = phi_19017_;
    let _e641 = global_7.member_14;
    let _e642 = (_e638.w * _e641);
    let _e645 = global_7.member_16;
    let _e646 = (_e638.xyz * _e645);
    let _e650 = vec4<f32>(_e646.x, _e646.y, _e646.z, _e642);
    let _e651 = (_e192.x * _e156.x);
    let _e654 = global_7.member_32;
    let _e656 = ((_e654 * 6f) + 1f);
    let _e660 = global_7.member_17;
    let _e664 = global_7.member_27;
    let _e678 = mix(mix(mix(mix(mix(_e664.x, _e664.y, _e539.x), _e664.z, _e539.y), _e664.w, _e539.z), _e664.z, _e159.y), _e664.w, _e159.z);
    let _e679 = ((((_e156.w + _e651) * _e656) * mix(1f, _e660, _e638.w)) * _e678);
    let _e681 = global_7.member_21;
    let _e682 = (_e681 * _e678);
    let _e687 = (0.56f - (0.06f * _e654));
    let _e691 = (0.54f - (_e654 * 0.12f));
    let _e701 = (_e539.xyz * vec3<f32>(smoothstep((0.58f + _e682), (_e687 - _e682), _e679), smoothstep((_e687 + _e682), (_e691 - _e682), _e679), smoothstep((_e691 + _e682), ((0.52f - (_e654 * 0.17999999f)) - _e682), _e679)).xyz);
    let _e705 = (0.58f - _e682);
    let _e706 = (0.68f + _e682);
    let _e707 = smoothstep(_e705, _e706, _e679);
    let _e716 = smoothstep(_e705, _e706, ((_e651 * _e656) * _e660));
    if (_e544 == 0i) {
        phi_21710_ = max(0f, mix(_e707, min(_e707, _e716), _e642));
    } else {
        phi_21710_ = _e707;
    }
    let _e722 = phi_21710_;
    let _e724 = global_7.member_41;
    phi_19287_ = _e650;
    if (_e724 == 4i) {
        phi_19287_ = vec4<f32>(_e650.x, _e650.y, _e650.z, (_e642 * clamp((1f - _e716), 0f, 1f)));
    }
    let _e735 = phi_19287_;
    let _e737 = textureSample(global_14, global_9, _e190.zw);
    let _e744 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e737, vec4(((pow((1f - _e156.x), 4f) * 0.25f) + (0.75f * _e654))));
    let _e746 = global_7.member_31;
    let _e755 = mix(mix(mix(mix(mix(_e746.x, _e746.y, _e701.x), _e746.z, _e701.y), _e746.w, _e701.z), _e746.z, _e159.y), _e746.w, _e159.z);
    let _e757 = global_7.member_8;
    if (_e757 != 0i) {
        let _e759 = textureSample(global_15, global_2, _e155);
        let _e770 = global_7.member_12;
        if (_e770 != 0i) {
            let _e774 = textureSample(global_11, global_2, _e155);
            let _e778 = normalize(((_e774.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e779 = textureSample(global_16, global_9, _e212);
            let _e781 = textureSample(global_16, global_9, _e220);
            let _e783 = textureSample(global_16, global_9, _e228);
            phi_21711_ = mix(mix(_e779.xyzw, _e781.xyzw, vec4((_e234.y * pow(abs(_e778.y), 7f)))), _e783.xyzw, vec4((_e234.z * pow(abs(_e778.z), 7f)))).x;
        } else {
            let _e772 = textureSample(global_16, global_9, _e155);
            phi_21711_ = _e772.x;
        }
        let _e799 = phi_21711_;
        let _e801 = global_7.member_28;
        let _e802 = (_e801 != 0i);
        phi_12885_ = _e799;
        if _e802 {
            let _e804 = global_7.member_29;
            phi_12885_ = mix(mix(mix(_e804.x, _e804.y, _e701.x), _e804.z, _e701.y), _e804.w, _e701.z);
        }
        let _e813 = phi_12885_;
        phi_21712_ = _e813;
        if _e802 {
            let _e815 = global_7.member_29;
            phi_21712_ = mix(mix(_e813, _e815.z, _e159.y), _e815.w, _e159.z);
        }
        let _e821 = phi_21712_;
        let _e823 = global_7.member_15;
        let _e824 = (((1f - _e716) * _e735.w) * _e823);
        let _e826 = global_7.member_18;
        let _e829 = global_7.member_19;
        let _e830 = mix(_e755, _e829, _e824);
        let _e840 = mix(vec4<f32>(min(1f, (mix(_e821, _e826, _e824) + ((((1f - _e744.w) * _e654) * _e654) * 0.5f))), _e830, 0f, 1f), vec4<f32>(_e759.x, _e759.y, _e759.z, _e759.w), vec4(_e722));
        let _e841 = (1f - _e722);
        let _e843 = global_7.member_13;
        if (_e843 != 0i) {
            let _e854 = textureSample(global_11, global_2, _e155);
            let _e858 = normalize(((_e854.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e859 = textureSample(global_17, global_9, _e212);
            let _e861 = textureSample(global_17, global_9, _e220);
            let _e863 = textureSample(global_17, global_9, _e228);
            phi_15784_ = vec4<f32>(_e840.x, _e840.y, (_e841 * mix(mix(_e859.xyzw, _e861.xyzw, vec4((_e234.y * pow(abs(_e858.y), 7f)))), _e863.xyzw, vec4((_e234.z * pow(abs(_e858.z), 7f)))).x), _e840.w);
        } else {
            let _e845 = textureSample(global_17, global_9, _e155);
            let _e847 = (_e841 * _e845.x);
            phi_15784_ = vec4<f32>(_e840.x, _e840.y, (_e847 * _e847), _e840.w);
        }
        let _e885 = phi_15784_;
        let _e891 = global_7.member_20;
        let _e893 = mix((_e885.z * (1f - max(_e159.y, _e159.z))), (_e891 - _e722), _e824);
        let _e900 = global_7.member_30;
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
    } else {
        phi_11711_ = vec4<f32>(_e153, 0f, 1f);
        phi_10247_ = _e755;
    }
    let _e931 = phi_11711_;
    let _e933 = phi_10247_;
    phi_22401_ = _e931;
    if (_e757 == 0i) {
        let _e935 = textureSample(global_18, global_2, _e155);
        let _e938 = global_7.member_22;
        let _e940 = global_7.member_23;
        let _e944 = global_7.member_24;
        let _e948 = global_7.member_25;
        let _e955 = _e935.xyz;
        let _e956 = vec3(_e722);
        let _e957 = mix(mix(mix(mix(mix(mix(_e938, _e940, vec3(_e701.x)), _e944, vec3(_e701.y)), _e948, vec3(_e701.z)), _e944, vec3(_e159.y)), _e948, vec3(_e159.z)).xyz, _e955, _e956);
        switch _e724 {
            case 0: {
                phi_21714_ = mix(_e957.xyz, _e735.xyz, vec3(_e735.w));
                break;
            }
            case 1: {
                let _e1071 = global_7.member_10;
                let _e1072 = _e957.xyz;
                let _e1093 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e735.xyz * _e1072).xyz)) * 1.06f);
                let _e1095 = _e1093.xyz;
                phi_21714_ = mix(_e957.xyz, mix(vec3(_e1071.x), max(((((_e1095 * _e1071.x) * 1.732f) / vec3(length(_e1095))) / vec3(dot(_e1093.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e1093 * mix(_e1071.x, _e1071.z, clamp(pow(max(_e957.x, max(_e957.y, _e957.z)), _e1071.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e1071.x, dot(clamp((_e1072 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e735.w));
                break;
            }
            case 2: {
                let _e1022 = _e957.xyz;
                let _e1024 = (_e1022 * _e735.xyz);
                let _e1026 = global_7.member_10;
                let _e1046 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e1024.xyz)) * 1.06f);
                let _e1048 = _e1046.xyz;
                phi_21714_ = mix(_e1022, mix(vec3(_e1026.x), max(((((_e1048 * _e1026.x) * 1.732f) / vec3(length(_e1048))) / vec3(dot(_e1046.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e1046 * mix(_e1026.x, _e1026.z, clamp(pow(max(_e1024.x, max(_e1024.y, _e1024.z)), _e1026.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e1026.x, dot(clamp((_e1024.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e735.w));
                break;
            }
            case 3: {
                let _e963 = _e957.xyz;
                let _e965 = (_e963 + _e735.xyz);
                let _e967 = global_7.member_10;
                let _e972 = dot(clamp((_e965.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e988 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e965.xyz)) * 1.06f);
                let _e990 = _e988.xyz;
                let _e1001 = max(((((_e990 * _e967.x) * 1.732f) / vec3(length(_e990))) / vec3(dot(_e988.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e988 * mix(_e967.x, _e967.z, clamp(pow((max(_e965.x, max(_e965.y, _e965.z)) * 2f), _e967.y), 0f, 1f)))).xyz;
                let _e1008 = global_7.member_11;
                phi_21714_ = mix(_e963, mix(vec3(_e967.x), mix(_e1001, min(_e967.zzz, (_e1001 + (vec3(_e972) * 2f))), vec3((1f / _e1008))).xyz, vec3(pow(smoothstep(0.0003f, _e967.x, _e972), 0.5f))).xyz, vec3(_e735.w));
                break;
            }
            case 4: {
                phi_21714_ = mix(_e957.xyz, _e735.xyz, vec3(_e735.w));
                break;
            }
            default: {
                phi_21714_ = _e957;
                break;
            }
        }
        let _e1122 = phi_21714_;
        let _e1124 = global_7.member_26;
        let _e1127 = clamp((_e1122 * mix(_e1124, 1f, (smoothstep(0f, 0.01f, _e707) * (1f - (smoothstep(0.5f, 0.6f, _e539.w) * smoothstep(1f, 0.9f, _e539.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e1130 = (_e1127.xyz * _e744.xyz);
        let _e1135 = global_7.member_38;
        let _e1137 = global_7.member_39;
        let _e1140 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e1130.xyz));
        let _e1148 = mix(_e1135.xyz, _e1137.xyz, vec3(_e933));
        let _e1168 = mix(mix(_e1130, ((_e1140.xyz * mix(min(_e1148.x, dot(_e1127.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e1148.z, clamp(pow(max(_e1130.x, max(_e1130.y, _e1130.z)), _e1148.y), 0f, 1f))) / vec3(max(_e1140.x, max(_e1140.y, _e1140.z)))).xyz, vec3(_e654)), _e955, _e956);
        phi_22401_ = vec4<f32>(_e1168.x, _e1168.y, _e1168.z, 1f);
    }
    let _e1174 = phi_22401_;
    let _e1175 = textureSample(global_19, global_9, _e155);
    phi_6805_ = _e1174;
    if (_e1175.w < 0f) {
        let _e1183 = vec4<f32>(_e1175.x, _e1174.y, _e1174.z, _e1174.w);
        let _e1189 = vec4<f32>(_e1183.x, _e1175.y, _e1183.z, _e1183.w);
        phi_6805_ = vec4<f32>(_e1189.x, _e1189.y, _e1175.z, _e1189.w);
    }
    let _e1197 = phi_6805_;
    global_20 = _e1197;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_5 = param_2;
    function_();
    let _e7 = global_20;
    return _e7;
}
