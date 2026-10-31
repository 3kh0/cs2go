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
    member_28: f32,
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
@group(1) @binding(37) 
var global_15: texture_2d<f32>;
@group(1) @binding(35) 
var global_16: texture_2d<f32>;
@group(1) @binding(36) 
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
    var phi_15785_: vec4<f32>;
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
    let _e746 = global_7.member_13;
    if (_e746 != 0i) {
        let _e751 = textureSample(global_15, global_9, _e152.zw);
        phi_21711_ = _e751.x;
    } else {
        let _e748 = textureSample(global_15, global_9, _e155);
        phi_21711_ = _e748.x;
    }
    let _e754 = phi_21711_;
    let _e756 = global_7.member_8;
    phi_11711_ = vec4<f32>(_e153, 0f, 1f);
    phi_10247_ = _e754;
    if (_e756 != 0i) {
        let _e758 = textureSample(global_16, global_2, _e155);
        let _e769 = global_7.member_29;
        let _e770 = (_e769 != 0i);
        if _e770 {
            let _e774 = global_7.member_30;
            phi_12885_ = mix(mix(mix(_e774.x, _e774.y, _e701.x), _e774.z, _e701.y), _e774.w, _e701.z);
        } else {
            let _e772 = global_7.member_28;
            phi_12885_ = _e772;
        }
        let _e783 = phi_12885_;
        phi_21712_ = _e783;
        if _e770 {
            let _e785 = global_7.member_30;
            phi_21712_ = mix(mix(_e783, _e785.z, _e159.y), _e785.w, _e159.z);
        }
        let _e791 = phi_21712_;
        let _e793 = global_7.member_15;
        let _e794 = (((1f - _e716) * _e735.w) * _e793);
        let _e796 = global_7.member_18;
        let _e799 = global_7.member_19;
        let _e800 = mix(_e754, _e799, _e794);
        let _e810 = mix(vec4<f32>(min(1f, (mix(_e791, _e796, _e794) + ((((1f - _e744.w) * _e654) * _e654) * 0.5f))), _e800, 0f, 1f), vec4<f32>(_e758.x, _e758.y, _e758.z, _e758.w), vec4(_e722));
        let _e811 = (1f - _e722);
        let _e813 = global_7.member_12;
        if (_e813 != 0i) {
            let _e824 = textureSample(global_11, global_2, _e155);
            let _e828 = normalize(((_e824.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e829 = textureSample(global_17, global_9, _e212);
            let _e831 = textureSample(global_17, global_9, _e220);
            let _e833 = textureSample(global_17, global_9, _e228);
            phi_15785_ = vec4<f32>(_e810.x, _e810.y, (_e811 * mix(mix(_e829.xyzw, _e831.xyzw, vec4((_e234.y * pow(abs(_e828.y), 7f)))), _e833.xyzw, vec4((_e234.z * pow(abs(_e828.z), 7f)))).x), _e810.w);
        } else {
            let _e815 = textureSample(global_17, global_9, _e155);
            let _e817 = (_e811 * _e815.x);
            phi_15785_ = vec4<f32>(_e810.x, _e810.y, (_e817 * _e817), _e810.w);
        }
        let _e855 = phi_15785_;
        let _e861 = global_7.member_20;
        let _e863 = mix((_e855.z * (1f - max(_e159.y, _e159.z))), (_e861 - _e722), _e794);
        let _e870 = global_7.member_31;
        let _e872 = vec4<f32>(_e855.x, _e855.y, _e863, _e855.w).xyz;
        let _e873 = (_e872 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e876 = pow(((_e872 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e855.x <= 0.04045f) {
            phi_21354_ = _e873.x;
        } else {
            phi_21354_ = _e876.x;
        }
        let _e882 = phi_21354_;
        if (_e855.y <= 0.04045f) {
            phi_23035_ = _e873.y;
        } else {
            phi_23035_ = _e876.y;
        }
        let _e888 = phi_23035_;
        if (_e863 <= 0.04045f) {
            phi_19513_ = _e873.z;
        } else {
            phi_19513_ = _e876.z;
        }
        let _e893 = phi_19513_;
        let _e894 = vec4<f32>(_e882, _e888, _e863, min(1f, _e870));
        phi_11711_ = vec4<f32>(_e894.x, _e894.y, _e893, _e894.w);
        phi_10247_ = _e800;
    }
    let _e901 = phi_11711_;
    let _e903 = phi_10247_;
    phi_22401_ = _e901;
    if (_e756 == 0i) {
        let _e905 = textureSample(global_18, global_2, _e155);
        let _e908 = global_7.member_22;
        let _e910 = global_7.member_23;
        let _e914 = global_7.member_24;
        let _e918 = global_7.member_25;
        let _e925 = _e905.xyz;
        let _e926 = vec3(_e722);
        let _e927 = mix(mix(mix(mix(mix(mix(_e908, _e910, vec3(_e701.x)), _e914, vec3(_e701.y)), _e918, vec3(_e701.z)), _e914, vec3(_e159.y)), _e918, vec3(_e159.z)).xyz, _e925, _e926);
        switch _e724 {
            case 0: {
                phi_21714_ = mix(_e927.xyz, _e735.xyz, vec3(_e735.w));
                break;
            }
            case 1: {
                let _e1041 = global_7.member_10;
                let _e1042 = _e927.xyz;
                let _e1063 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e735.xyz * _e1042).xyz)) * 1.06f);
                let _e1065 = _e1063.xyz;
                phi_21714_ = mix(_e927.xyz, mix(vec3(_e1041.x), max(((((_e1065 * _e1041.x) * 1.732f) / vec3(length(_e1065))) / vec3(dot(_e1063.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e1063 * mix(_e1041.x, _e1041.z, clamp(pow(max(_e927.x, max(_e927.y, _e927.z)), _e1041.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e1041.x, dot(clamp((_e1042 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e735.w));
                break;
            }
            case 2: {
                let _e992 = _e927.xyz;
                let _e994 = (_e992 * _e735.xyz);
                let _e996 = global_7.member_10;
                let _e1016 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e994.xyz)) * 1.06f);
                let _e1018 = _e1016.xyz;
                phi_21714_ = mix(_e992, mix(vec3(_e996.x), max(((((_e1018 * _e996.x) * 1.732f) / vec3(length(_e1018))) / vec3(dot(_e1016.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e1016 * mix(_e996.x, _e996.z, clamp(pow(max(_e994.x, max(_e994.y, _e994.z)), _e996.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e996.x, dot(clamp((_e994.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e735.w));
                break;
            }
            case 3: {
                let _e933 = _e927.xyz;
                let _e935 = (_e933 + _e735.xyz);
                let _e937 = global_7.member_10;
                let _e942 = dot(clamp((_e935.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e958 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e935.xyz)) * 1.06f);
                let _e960 = _e958.xyz;
                let _e971 = max(((((_e960 * _e937.x) * 1.732f) / vec3(length(_e960))) / vec3(dot(_e958.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e958 * mix(_e937.x, _e937.z, clamp(pow((max(_e935.x, max(_e935.y, _e935.z)) * 2f), _e937.y), 0f, 1f)))).xyz;
                let _e978 = global_7.member_11;
                phi_21714_ = mix(_e933, mix(vec3(_e937.x), mix(_e971, min(_e937.zzz, (_e971 + (vec3(_e942) * 2f))), vec3((1f / _e978))).xyz, vec3(pow(smoothstep(0.0003f, _e937.x, _e942), 0.5f))).xyz, vec3(_e735.w));
                break;
            }
            case 4: {
                phi_21714_ = mix(_e927.xyz, _e735.xyz, vec3(_e735.w));
                break;
            }
            default: {
                phi_21714_ = _e927;
                break;
            }
        }
        let _e1092 = phi_21714_;
        let _e1094 = global_7.member_26;
        let _e1097 = clamp((_e1092 * mix(_e1094, 1f, (smoothstep(0f, 0.01f, _e707) * (1f - (smoothstep(0.5f, 0.6f, _e539.w) * smoothstep(1f, 0.9f, _e539.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e1100 = (_e1097.xyz * _e744.xyz);
        let _e1105 = global_7.member_38;
        let _e1107 = global_7.member_39;
        let _e1110 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e1100.xyz));
        let _e1118 = mix(_e1105.xyz, _e1107.xyz, vec3(_e903));
        let _e1138 = mix(mix(_e1100, ((_e1110.xyz * mix(min(_e1118.x, dot(_e1097.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e1118.z, clamp(pow(max(_e1100.x, max(_e1100.y, _e1100.z)), _e1118.y), 0f, 1f))) / vec3(max(_e1110.x, max(_e1110.y, _e1110.z)))).xyz, vec3(_e654)), _e925, _e926);
        phi_22401_ = vec4<f32>(_e1138.x, _e1138.y, _e1138.z, 1f);
    }
    let _e1144 = phi_22401_;
    let _e1145 = textureSample(global_19, global_9, _e155);
    phi_6805_ = _e1144;
    if (_e1145.w < 0f) {
        let _e1153 = vec4<f32>(_e1145.x, _e1144.y, _e1144.z, _e1144.w);
        let _e1159 = vec4<f32>(_e1153.x, _e1145.y, _e1153.z, _e1153.w);
        phi_6805_ = vec4<f32>(_e1159.x, _e1159.y, _e1145.z, _e1159.w);
    }
    let _e1167 = phi_6805_;
    global_20 = _e1167;
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
