struct type_12 {
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
    member_10: f32,
    member_11: vec3<f32>,
    member_12: vec3<f32>,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
    member_15: vec4<f32>,
    member_16: f32,
    member_17: i32,
    member_18: vec4<f32>,
    member_19: f32,
    member_20: vec4<f32>,
    member_21: f32,
    member_22: vec3<f32>,
    member_23: f32,
    member_24: vec3<f32>,
    member_25: vec2<f32>,
    member_26: i32,
    member_27: f32,
    member_28: f32,
    member_29: f32,
    member_30: vec4<f32>,
    member_31: vec3<f32>,
    member_32: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(33) 
var global_5: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_6: type_12;
@group(1) @binding(39) 
var global_7: texture_2d<f32>;
@group(1) @binding(22) 
var global_8: sampler;
@group(1) @binding(27) 
var global_9: sampler;
@group(1) @binding(32) 
var global_10: texture_2d<f32>;
@group(1) @binding(38) 
var global_11: texture_2d<f32>;
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
@group(1) @binding(41) 
var global_13: texture_2d<f32>;
@group(1) @binding(40) 
var global_14: texture_2d<f32>;
@group(1) @binding(35) 
var global_15: texture_2d<f32>;
@group(1) @binding(34) 
var global_16: texture_2d<f32>;
@group(1) @binding(37) 
var global_17: texture_2d<f32>;
var<private> global_18: vec4<f32>;

fn function_() {
    var local: array<vec2<f32>, 17>;
    var phi_13155_: vec4<f32>;
    var phi_16208_: i32;
    var local_1: vec4<f32>;
    var phi_19667_: vec4<f32>;
    var phi_12501_: vec4<f32>;
    var phi_12502_: vec4<f32>;
    var phi_21709_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22402_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e135 = global;
    let _e136 = _e135.xy;
    let _e138 = _e135.xy;
    let _e139 = textureSample(global_1, global_2, _e138);
    let _e142 = textureSample(global_3, global_2, _e138);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e144 = phi_13155_;
        let _e146 = phi_16208_;
        local_1 = _e144;
        if (_e146 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e155 = local[_e146];
        let _e159 = textureSample(global_5, global_2, (_e136 + (_e155 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e144 + (_e159 * 0.05882353f));
            phi_16208_ = (_e146 + 1i);
        }
    }
    let _e149 = local_1;
    let _e150 = (_e149 * 2f);
    let _e152 = global_6.member_9;
    let _e153 = (_e152 != 0i);
    phi_19667_ = _e150;
    if _e153 {
        phi_19667_ = vec4<f32>(_e150.x, _e150.y, (_e150.z * -1f), _e150.w);
    }
    let _e171 = phi_19667_;
    let _e172 = _e171.xyz;
    let _e174 = global_4;
    let _e176 = textureSample(global_7, global_8, _e174.xy);
    let _e179 = global_6.member;
    let _e181 = global_6.member_1;
    let _e182 = textureSample(global_10, global_2, _e138);
    let _e186 = normalize(((_e182.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e187 = _e171.yz;
    let _e188 = _e179.xy;
    let _e192 = _e181.xy;
    let _e197 = textureSample(global_11, global_9, vec2<f32>((dot(_e187, _e188) + _e179.w), (dot(_e187, _e192) + _e181.w)));
    let _e199 = _e171.xz;
    let _e205 = textureSample(global_11, global_9, vec2<f32>((dot(_e199, _e188) + _e179.w), (dot(_e199, _e192) + _e181.w)));
    let _e207 = _e171.yx;
    let _e213 = textureSample(global_11, global_9, vec2<f32>((dot(_e207, _e188) + _e179.w), (dot(_e207, _e192) + _e181.w)));
    let _e218 = global_6.member_22;
    let _e230 = mix(mix(_e197.xyzw, _e205.xyzw, vec4((_e218.y * pow(abs(_e186.y), 7f)))), _e213.xyzw, vec4((_e218.z * pow(abs(_e186.z), 7f))));
    phi_22401_ = _e230;
    if _e153 {
        let _e232 = global_6.member_2;
        let _e234 = global_6.member_3;
        let _e235 = textureSample(global_10, global_2, _e138);
        let _e239 = normalize(((_e235.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e240 = _e232.xy;
        let _e244 = _e234.xy;
        let _e249 = textureSample(global_11, global_9, vec2<f32>((dot(_e187, _e240) + _e232.w), (dot(_e187, _e244) + _e234.w)));
        let _e256 = textureSample(global_11, global_9, vec2<f32>((dot(_e199, _e240) + _e232.w), (dot(_e199, _e244) + _e234.w)));
        let _e263 = textureSample(global_11, global_9, vec2<f32>((dot(_e207, _e240) + _e232.w), (dot(_e207, _e244) + _e234.w)));
        let _e279 = global_6.member_4;
        let _e281 = global_6.member_5;
        let _e282 = textureSample(global_10, global_2, _e138);
        let _e286 = normalize(((_e282.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e287 = _e279.xy;
        let _e291 = _e281.xy;
        let _e296 = textureSample(global_11, global_9, vec2<f32>((dot(_e187, _e287) + _e279.w), (dot(_e187, _e291) + _e281.w)));
        let _e303 = textureSample(global_11, global_9, vec2<f32>((dot(_e199, _e287) + _e279.w), (dot(_e199, _e291) + _e281.w)));
        let _e310 = textureSample(global_11, global_9, vec2<f32>((dot(_e207, _e287) + _e279.w), (dot(_e207, _e291) + _e281.w)));
        let _e326 = global_6.member_26;
        if (_e326 != 0i) {
            let _e374 = global_6.member_24;
            let _e378 = global_6.member_23;
            let _e384 = smoothstep(_e374.x, _e374.z, pow(((min(_e139.x, _e378) * _e139.y) * 2f), _e374.y));
            let _e386 = global_6.member_25;
            if (_e386.x > _e386.y) {
                let _e406 = (_e230.xyz * _e384);
                let _e412 = vec4<f32>(_e406.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
                phi_12502_ = vec4<f32>(_e412.x, _e406.y, _e412.z, _e412.w);
            } else {
                let _e392 = (_e230.xyz * (1f - _e384));
                let _e398 = vec4<f32>(_e392.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
                phi_12502_ = vec4<f32>(_e398.x, _e392.y, _e398.z, _e398.w);
            }
            let _e420 = phi_12502_;
            phi_21709_ = _e420;
        } else {
            let _e329 = global_6.member_24;
            let _e336 = smoothstep(_e329.x, _e329.z, pow(((_e139.x * _e139.y) * 2f), _e329.y));
            let _e338 = global_6.member_25;
            if (_e338.x > _e338.y) {
                let _e358 = (_e230.xyz * (1f - _e336));
                let _e364 = vec4<f32>(_e358.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
                phi_12501_ = vec4<f32>(_e364.x, _e358.y, _e364.z, _e364.w);
            } else {
                let _e343 = (_e230.xyz * _e336);
                let _e349 = vec4<f32>(_e343.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
                phi_12501_ = vec4<f32>(_e349.x, _e343.y, _e349.z, _e349.w);
            }
            let _e372 = phi_12501_;
            phi_21709_ = _e372;
        }
        let _e422 = phi_21709_;
        let _e424 = global_6.member_25;
        let _e432 = smoothstep(vec3(_e424.x), vec3(_e424.y), (_e422.xyz * vec3<f32>(mix(mix(_e249.xyzw, _e256.xyzw, vec4((_e218.y * pow(abs(_e239.y), 7f)))), _e263.xyzw, vec4((_e218.z * pow(abs(_e239.z), 7f)))).w, mix(mix(_e296.xyzw, _e303.xyzw, vec4((_e218.y * pow(abs(_e286.y), 7f)))), _e310.xyzw, vec4((_e218.z * pow(abs(_e286.z), 7f)))).w, f32())));
        let _e438 = vec4<f32>(_e432.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        phi_22401_ = vec4<f32>(_e438.x, _e432.y, _e438.z, _e438.w);
    }
    let _e446 = phi_22401_;
    let _e447 = textureSample(global_12, global_8, _e138);
    let _e450 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e447, (vec4<f32>(1f, 1f, 1f, 1f) - _e447)));
    let _e457 = global_6.member_28;
    let _e461 = (mix(0.5f, pow(_e139.x, 0.85f), _e457) * mix(1f, (_e139.y * (min(_e450.x, _e450.y) * 2f)), _e457));
    let _e462 = (_e461 * 2f);
    let _e466 = global_6.member_27;
    let _e475 = global_6.member_29;
    let _e476 = (max((_e446.y * _e466), (((1f - _e139.y) * 0.2f) * _e457)) + _e475);
    let _e477 = (_e172 + vec3<f32>(0f, 0.00048828125f, 0.00048828125f));
    let _e478 = textureSample(global_10, global_2, _e138);
    let _e482 = normalize(((_e478.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e483 = _e477.yz;
    let _e489 = textureSample(global_11, global_9, vec2<f32>((dot(_e483, _e188) + _e179.w), (dot(_e483, _e192) + _e181.w)));
    let _e491 = _e477.xz;
    let _e497 = textureSample(global_11, global_9, vec2<f32>((dot(_e491, _e188) + _e179.w), (dot(_e491, _e192) + _e181.w)));
    let _e499 = _e477.yx;
    let _e505 = textureSample(global_11, global_9, vec2<f32>((dot(_e499, _e188) + _e179.w), (dot(_e499, _e192) + _e181.w)));
    let _e519 = (_e172 + vec3<f32>(0f, -0.00048828125f, -0.00048828125f));
    let _e520 = textureSample(global_10, global_2, _e138);
    let _e524 = normalize(((_e520.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e525 = _e519.yz;
    let _e531 = textureSample(global_11, global_9, vec2<f32>((dot(_e525, _e188) + _e179.w), (dot(_e525, _e192) + _e181.w)));
    let _e533 = _e519.xz;
    let _e539 = textureSample(global_11, global_9, vec2<f32>((dot(_e533, _e188) + _e179.w), (dot(_e533, _e192) + _e181.w)));
    let _e541 = _e519.yx;
    let _e547 = textureSample(global_11, global_9, vec2<f32>((dot(_e541, _e188) + _e179.w), (dot(_e541, _e192) + _e181.w)));
    let _e561 = (_e172 + vec3<f32>(0f, -0.00048828125f, 0.00048828125f));
    let _e562 = textureSample(global_10, global_2, _e138);
    let _e566 = normalize(((_e562.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e567 = _e561.yz;
    let _e573 = textureSample(global_11, global_9, vec2<f32>((dot(_e567, _e188) + _e179.w), (dot(_e567, _e192) + _e181.w)));
    let _e575 = _e561.xz;
    let _e581 = textureSample(global_11, global_9, vec2<f32>((dot(_e575, _e188) + _e179.w), (dot(_e575, _e192) + _e181.w)));
    let _e583 = _e561.yx;
    let _e589 = textureSample(global_11, global_9, vec2<f32>((dot(_e583, _e188) + _e179.w), (dot(_e583, _e192) + _e181.w)));
    let _e603 = (_e172 + vec3<f32>(0f, 0.00048828125f, -0.00048828125f));
    let _e604 = textureSample(global_10, global_2, _e138);
    let _e608 = normalize(((_e604.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e609 = _e603.yz;
    let _e615 = textureSample(global_11, global_9, vec2<f32>((dot(_e609, _e188) + _e179.w), (dot(_e609, _e192) + _e181.w)));
    let _e617 = _e603.xz;
    let _e623 = textureSample(global_11, global_9, vec2<f32>((dot(_e617, _e188) + _e179.w), (dot(_e617, _e192) + _e181.w)));
    let _e625 = _e603.yx;
    let _e631 = textureSample(global_11, global_9, vec2<f32>((dot(_e625, _e188) + _e179.w), (dot(_e625, _e192) + _e181.w)));
    let _e658 = textureSample(global_13, global_2, vec2<f32>(mix(_e462, (_e461 + _e446.x), _e466), _e476));
    let _e661 = textureSample(global_13, global_2, vec2<f32>(mix(_e462, (_e461 + mix(mix(_e489.xyzw, _e497.xyzw, vec4((_e218.y * pow(abs(_e482.y), 7f)))), _e505.xyzw, vec4((_e218.z * pow(abs(_e482.z), 7f)))).x), _e466), _e476));
    let _e666 = textureSample(global_13, global_2, vec2<f32>(mix(_e462, (_e461 + mix(mix(_e531.xyzw, _e539.xyzw, vec4((_e218.y * pow(abs(_e524.y), 7f)))), _e547.xyzw, vec4((_e218.z * pow(abs(_e524.z), 7f)))).x), _e466), _e476));
    let _e671 = textureSample(global_13, global_2, vec2<f32>(mix(_e462, (_e461 + mix(mix(_e573.xyzw, _e581.xyzw, vec4((_e218.y * pow(abs(_e566.y), 7f)))), _e589.xyzw, vec4((_e218.z * pow(abs(_e566.z), 7f)))).x), _e466), _e476));
    let _e676 = textureSample(global_13, global_2, vec2<f32>(mix(_e462, (_e461 + mix(mix(_e615.xyzw, _e623.xyzw, vec4((_e218.y * pow(abs(_e608.y), 7f)))), _e631.xyzw, vec4((_e218.z * pow(abs(_e608.z), 7f)))).x), _e466), _e476));
    let _e684 = global_6.member_21;
    let _e689 = global_6.member_15;
    let _e699 = mix(mix(mix(_e689.x, _e689.y, _e142.x), _e689.z, _e142.y), _e689.w, _e142.z);
    let _e702 = global_6.member_10;
    let _e703 = (_e702 * _e699);
    let _e706 = smoothstep((0.58f - _e703), (0.68f + _e703), (((_e139.w + (_e176.x * _e139.x)) * ((_e684 * 6f) + 1f)) * _e699));
    let _e708 = textureSample(global_14, global_8, _e174.zw);
    let _e715 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e708, vec4(((pow((1f - _e139.x), 4f) * 0.25f) + (0.75f * _e684))));
    let _e717 = global_6.member_20;
    let _e724 = mix(mix(mix(_e717.x, _e717.y, _e142.x), _e717.z, _e142.y), _e717.w, _e142.z);
    let _e726 = global_6.member_8;
    phi_7078_ = vec4<f32>(_e136, 0f, 1f);
    if (_e726 != 0i) {
        let _e728 = textureSample(global_15, global_2, _e138);
        let _e736 = global_6.member_17;
        if (_e736 != 0i) {
            let _e741 = global_6.member_18;
            phi_20271_ = mix(mix(mix(_e741.x, _e741.y, _e142.x), _e741.z, _e142.y), _e741.w, _e142.z);
        } else {
            let _e739 = global_6.member_16;
            phi_20271_ = _e739;
        }
        let _e750 = phi_20271_;
        let _e760 = mix(vec4<f32>(min(1f, (_e750 + ((((1f - _e715.w) * _e684) * _e684) * 0.5f))), _e724, 0f, 1f), vec4<f32>(_e728.x, _e728.y, _e728.z, _e728.w), vec4(_e706));
        let _e761 = (1f - _e706);
        let _e768 = global_6.member_19;
        let _e770 = vec4<f32>(_e760.x, _e760.y, _e761, _e760.w).xyz;
        let _e771 = (_e770 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e774 = pow(((_e770 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e760.x <= 0.04045f) {
            phi_21354_ = _e771.x;
        } else {
            phi_21354_ = _e774.x;
        }
        let _e780 = phi_21354_;
        if (_e760.y <= 0.04045f) {
            phi_23035_ = _e771.y;
        } else {
            phi_23035_ = _e774.y;
        }
        let _e786 = phi_23035_;
        if (_e761 <= 0.04045f) {
            phi_19513_ = _e771.z;
        } else {
            phi_19513_ = _e774.z;
        }
        let _e791 = phi_19513_;
        let _e792 = vec4<f32>(_e780, _e786, _e761, min(1f, _e768));
        phi_7078_ = vec4<f32>(_e792.x, _e792.y, _e791, _e792.w);
    }
    let _e799 = phi_7078_;
    phi_22402_ = _e799;
    if (_e726 == 0i) {
        let _e801 = textureSample(global_16, global_2, _e138);
        let _e803 = global_6.member_11;
        let _e805 = (((((_e658.xyzw + _e661.xyzw).xyzw + _e666.xyzw).xyzw + _e671.xyzw).xyzw + _e676.xyzw).xyzw * 0.2f).xyz;
        let _e807 = global_6.member_30;
        let _e813 = global_6.member_12;
        let _e822 = global_6.member_13;
        let _e831 = global_6.member_14;
        let _e837 = mix(mix(mix(mix(_e803.xyz, _e805, vec3(_e807.x)).xyz, mix(_e813.xyz, _e805, vec3(_e807.y)), vec3(_e142.x)).xyz, mix(_e822.xyz, _e805, vec3(_e807.z)), vec3(_e142.y)).xyz, mix(_e831.xyz, _e805, vec3(_e807.w)), vec3(_e142.z));
        let _e840 = (_e837.xyz * _e715.xyz);
        let _e845 = global_6.member_31;
        let _e847 = global_6.member_32;
        let _e850 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e840.xyz));
        let _e858 = mix(_e845.xyz, _e847.xyz, vec3(_e724));
        let _e880 = mix(mix(_e840, ((_e850.xyz * mix(min(_e858.x, dot(_e837.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e858.z, clamp(pow(max(_e840.x, max(_e840.y, _e840.z)), _e858.y), 0f, 1f))) / vec3(max(_e850.x, max(_e850.y, _e850.z)))).xyz, vec3(_e684)), _e801.xyz, vec3(_e706));
        phi_22402_ = vec4<f32>(_e880.x, _e880.y, _e880.z, 1f);
    }
    let _e886 = phi_22402_;
    let _e887 = textureSample(global_17, global_8, _e138);
    phi_6805_ = _e886;
    if (_e887.w < 0f) {
        let _e895 = vec4<f32>(_e887.x, _e886.y, _e886.z, _e886.w);
        let _e901 = vec4<f32>(_e895.x, _e887.y, _e895.z, _e895.w);
        phi_6805_ = vec4<f32>(_e901.x, _e901.y, _e887.z, _e901.w);
    }
    let _e909 = phi_6805_;
    global_18 = _e909;
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
