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
    member_16: i32,
    member_17: vec4<f32>,
    member_18: f32,
    member_19: vec4<f32>,
    member_20: f32,
    member_21: vec3<f32>,
    member_22: f32,
    member_23: vec3<f32>,
    member_24: vec2<f32>,
    member_25: i32,
    member_26: f32,
    member_27: f32,
    member_28: f32,
    member_29: vec4<f32>,
    member_30: vec3<f32>,
    member_31: vec3<f32>,
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
@group(1) @binding(41) 
var global_7: texture_2d<f32>;
@group(1) @binding(22) 
var global_8: sampler;
@group(1) @binding(27) 
var global_9: sampler;
@group(1) @binding(32) 
var global_10: texture_2d<f32>;
@group(1) @binding(40) 
var global_11: texture_2d<f32>;
@group(1) @binding(36) 
var global_12: texture_2d<f32>;
@group(1) @binding(43) 
var global_13: texture_2d<f32>;
@group(1) @binding(42) 
var global_14: texture_2d<f32>;
@group(1) @binding(35) 
var global_15: texture_2d<f32>;
@group(1) @binding(37) 
var global_16: texture_2d<f32>;
@group(1) @binding(38) 
var global_17: texture_2d<f32>;
@group(1) @binding(34) 
var global_18: texture_2d<f32>;
@group(1) @binding(39) 
var global_19: texture_2d<f32>;
var<private> global_20: vec4<f32>;

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

    let _e136 = global;
    let _e137 = _e136.xy;
    let _e139 = _e136.xy;
    let _e140 = textureSample(global_1, global_2, _e139);
    let _e143 = textureSample(global_3, global_2, _e139);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e145 = phi_13155_;
        let _e147 = phi_16208_;
        local_1 = _e145;
        if (_e147 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e156 = local[_e147];
        let _e160 = textureSample(global_5, global_2, (_e137 + (_e156 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e145 + (_e160 * 0.05882353f));
            phi_16208_ = (_e147 + 1i);
        }
    }
    let _e150 = local_1;
    let _e151 = (_e150 * 2f);
    let _e153 = global_6.member_9;
    let _e154 = (_e153 != 0i);
    phi_19667_ = _e151;
    if _e154 {
        phi_19667_ = vec4<f32>(_e151.x, _e151.y, (_e151.z * -1f), _e151.w);
    }
    let _e172 = phi_19667_;
    let _e173 = _e172.xyz;
    let _e175 = global_4;
    let _e177 = textureSample(global_7, global_8, _e175.xy);
    let _e180 = global_6.member;
    let _e182 = global_6.member_1;
    let _e183 = textureSample(global_10, global_2, _e139);
    let _e187 = normalize(((_e183.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e188 = _e172.yz;
    let _e189 = _e180.xy;
    let _e193 = _e182.xy;
    let _e198 = textureSample(global_11, global_9, vec2<f32>((dot(_e188, _e189) + _e180.w), (dot(_e188, _e193) + _e182.w)));
    let _e200 = _e172.xz;
    let _e206 = textureSample(global_11, global_9, vec2<f32>((dot(_e200, _e189) + _e180.w), (dot(_e200, _e193) + _e182.w)));
    let _e208 = _e172.yx;
    let _e214 = textureSample(global_11, global_9, vec2<f32>((dot(_e208, _e189) + _e180.w), (dot(_e208, _e193) + _e182.w)));
    let _e219 = global_6.member_21;
    let _e231 = mix(mix(_e198.xyzw, _e206.xyzw, vec4((_e219.y * pow(abs(_e187.y), 7f)))), _e214.xyzw, vec4((_e219.z * pow(abs(_e187.z), 7f))));
    phi_22401_ = _e231;
    if _e154 {
        let _e233 = global_6.member_2;
        let _e235 = global_6.member_3;
        let _e236 = textureSample(global_10, global_2, _e139);
        let _e240 = normalize(((_e236.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e241 = _e233.xy;
        let _e245 = _e235.xy;
        let _e250 = textureSample(global_11, global_9, vec2<f32>((dot(_e188, _e241) + _e233.w), (dot(_e188, _e245) + _e235.w)));
        let _e257 = textureSample(global_11, global_9, vec2<f32>((dot(_e200, _e241) + _e233.w), (dot(_e200, _e245) + _e235.w)));
        let _e264 = textureSample(global_11, global_9, vec2<f32>((dot(_e208, _e241) + _e233.w), (dot(_e208, _e245) + _e235.w)));
        let _e280 = global_6.member_4;
        let _e282 = global_6.member_5;
        let _e283 = textureSample(global_10, global_2, _e139);
        let _e287 = normalize(((_e283.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e288 = _e280.xy;
        let _e292 = _e282.xy;
        let _e297 = textureSample(global_11, global_9, vec2<f32>((dot(_e188, _e288) + _e280.w), (dot(_e188, _e292) + _e282.w)));
        let _e304 = textureSample(global_11, global_9, vec2<f32>((dot(_e200, _e288) + _e280.w), (dot(_e200, _e292) + _e282.w)));
        let _e311 = textureSample(global_11, global_9, vec2<f32>((dot(_e208, _e288) + _e280.w), (dot(_e208, _e292) + _e282.w)));
        let _e327 = global_6.member_25;
        if (_e327 != 0i) {
            let _e375 = global_6.member_23;
            let _e379 = global_6.member_22;
            let _e385 = smoothstep(_e375.x, _e375.z, pow(((min(_e140.x, _e379) * _e140.y) * 2f), _e375.y));
            let _e387 = global_6.member_24;
            if (_e387.x > _e387.y) {
                let _e407 = (_e231.xyz * _e385);
                let _e413 = vec4<f32>(_e407.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
                phi_12502_ = vec4<f32>(_e413.x, _e407.y, _e413.z, _e413.w);
            } else {
                let _e393 = (_e231.xyz * (1f - _e385));
                let _e399 = vec4<f32>(_e393.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
                phi_12502_ = vec4<f32>(_e399.x, _e393.y, _e399.z, _e399.w);
            }
            let _e421 = phi_12502_;
            phi_21709_ = _e421;
        } else {
            let _e330 = global_6.member_23;
            let _e337 = smoothstep(_e330.x, _e330.z, pow(((_e140.x * _e140.y) * 2f), _e330.y));
            let _e339 = global_6.member_24;
            if (_e339.x > _e339.y) {
                let _e359 = (_e231.xyz * (1f - _e337));
                let _e365 = vec4<f32>(_e359.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
                phi_12501_ = vec4<f32>(_e365.x, _e359.y, _e365.z, _e365.w);
            } else {
                let _e344 = (_e231.xyz * _e337);
                let _e350 = vec4<f32>(_e344.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
                phi_12501_ = vec4<f32>(_e350.x, _e344.y, _e350.z, _e350.w);
            }
            let _e373 = phi_12501_;
            phi_21709_ = _e373;
        }
        let _e423 = phi_21709_;
        let _e425 = global_6.member_24;
        let _e433 = smoothstep(vec3(_e425.x), vec3(_e425.y), (_e423.xyz * vec3<f32>(mix(mix(_e250.xyzw, _e257.xyzw, vec4((_e219.y * pow(abs(_e240.y), 7f)))), _e264.xyzw, vec4((_e219.z * pow(abs(_e240.z), 7f)))).w, mix(mix(_e297.xyzw, _e304.xyzw, vec4((_e219.y * pow(abs(_e287.y), 7f)))), _e311.xyzw, vec4((_e219.z * pow(abs(_e287.z), 7f)))).w, f32())));
        let _e439 = vec4<f32>(_e433.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        phi_22401_ = vec4<f32>(_e439.x, _e433.y, _e439.z, _e439.w);
    }
    let _e447 = phi_22401_;
    let _e448 = textureSample(global_12, global_8, _e139);
    let _e451 = smoothstep(vec4<f32>(0.85f, 0.85f, 0.85f, 0.85f), vec4<f32>(0.2f, 0.2f, 0.2f, 0.2f), min(_e448, (vec4<f32>(1f, 1f, 1f, 1f) - _e448)));
    let _e458 = global_6.member_27;
    let _e462 = (mix(0.5f, pow(_e140.x, 0.85f), _e458) * mix(1f, (_e140.y * (min(_e451.x, _e451.y) * 2f)), _e458));
    let _e463 = (_e462 * 2f);
    let _e467 = global_6.member_26;
    let _e476 = global_6.member_28;
    let _e477 = (max((_e447.y * _e467), (((1f - _e140.y) * 0.2f) * _e458)) + _e476);
    let _e478 = (_e173 + vec3<f32>(0f, 0.00048828125f, 0.00048828125f));
    let _e479 = textureSample(global_10, global_2, _e139);
    let _e483 = normalize(((_e479.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e484 = _e478.yz;
    let _e490 = textureSample(global_11, global_9, vec2<f32>((dot(_e484, _e189) + _e180.w), (dot(_e484, _e193) + _e182.w)));
    let _e492 = _e478.xz;
    let _e498 = textureSample(global_11, global_9, vec2<f32>((dot(_e492, _e189) + _e180.w), (dot(_e492, _e193) + _e182.w)));
    let _e500 = _e478.yx;
    let _e506 = textureSample(global_11, global_9, vec2<f32>((dot(_e500, _e189) + _e180.w), (dot(_e500, _e193) + _e182.w)));
    let _e520 = (_e173 + vec3<f32>(0f, -0.00048828125f, -0.00048828125f));
    let _e521 = textureSample(global_10, global_2, _e139);
    let _e525 = normalize(((_e521.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e526 = _e520.yz;
    let _e532 = textureSample(global_11, global_9, vec2<f32>((dot(_e526, _e189) + _e180.w), (dot(_e526, _e193) + _e182.w)));
    let _e534 = _e520.xz;
    let _e540 = textureSample(global_11, global_9, vec2<f32>((dot(_e534, _e189) + _e180.w), (dot(_e534, _e193) + _e182.w)));
    let _e542 = _e520.yx;
    let _e548 = textureSample(global_11, global_9, vec2<f32>((dot(_e542, _e189) + _e180.w), (dot(_e542, _e193) + _e182.w)));
    let _e562 = (_e173 + vec3<f32>(0f, -0.00048828125f, 0.00048828125f));
    let _e563 = textureSample(global_10, global_2, _e139);
    let _e567 = normalize(((_e563.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e568 = _e562.yz;
    let _e574 = textureSample(global_11, global_9, vec2<f32>((dot(_e568, _e189) + _e180.w), (dot(_e568, _e193) + _e182.w)));
    let _e576 = _e562.xz;
    let _e582 = textureSample(global_11, global_9, vec2<f32>((dot(_e576, _e189) + _e180.w), (dot(_e576, _e193) + _e182.w)));
    let _e584 = _e562.yx;
    let _e590 = textureSample(global_11, global_9, vec2<f32>((dot(_e584, _e189) + _e180.w), (dot(_e584, _e193) + _e182.w)));
    let _e604 = (_e173 + vec3<f32>(0f, 0.00048828125f, -0.00048828125f));
    let _e605 = textureSample(global_10, global_2, _e139);
    let _e609 = normalize(((_e605.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e610 = _e604.yz;
    let _e616 = textureSample(global_11, global_9, vec2<f32>((dot(_e610, _e189) + _e180.w), (dot(_e610, _e193) + _e182.w)));
    let _e618 = _e604.xz;
    let _e624 = textureSample(global_11, global_9, vec2<f32>((dot(_e618, _e189) + _e180.w), (dot(_e618, _e193) + _e182.w)));
    let _e626 = _e604.yx;
    let _e632 = textureSample(global_11, global_9, vec2<f32>((dot(_e626, _e189) + _e180.w), (dot(_e626, _e193) + _e182.w)));
    let _e659 = textureSample(global_13, global_2, vec2<f32>(mix(_e463, (_e462 + _e447.x), _e467), _e477));
    let _e662 = textureSample(global_13, global_2, vec2<f32>(mix(_e463, (_e462 + mix(mix(_e490.xyzw, _e498.xyzw, vec4((_e219.y * pow(abs(_e483.y), 7f)))), _e506.xyzw, vec4((_e219.z * pow(abs(_e483.z), 7f)))).x), _e467), _e477));
    let _e667 = textureSample(global_13, global_2, vec2<f32>(mix(_e463, (_e462 + mix(mix(_e532.xyzw, _e540.xyzw, vec4((_e219.y * pow(abs(_e525.y), 7f)))), _e548.xyzw, vec4((_e219.z * pow(abs(_e525.z), 7f)))).x), _e467), _e477));
    let _e672 = textureSample(global_13, global_2, vec2<f32>(mix(_e463, (_e462 + mix(mix(_e574.xyzw, _e582.xyzw, vec4((_e219.y * pow(abs(_e567.y), 7f)))), _e590.xyzw, vec4((_e219.z * pow(abs(_e567.z), 7f)))).x), _e467), _e477));
    let _e677 = textureSample(global_13, global_2, vec2<f32>(mix(_e463, (_e462 + mix(mix(_e616.xyzw, _e624.xyzw, vec4((_e219.y * pow(abs(_e609.y), 7f)))), _e632.xyzw, vec4((_e219.z * pow(abs(_e609.z), 7f)))).x), _e467), _e477));
    let _e685 = global_6.member_20;
    let _e690 = global_6.member_15;
    let _e700 = mix(mix(mix(_e690.x, _e690.y, _e143.x), _e690.z, _e143.y), _e690.w, _e143.z);
    let _e703 = global_6.member_10;
    let _e704 = (_e703 * _e700);
    let _e707 = smoothstep((0.58f - _e704), (0.68f + _e704), (((_e140.w + (_e177.x * _e140.x)) * ((_e685 * 6f) + 1f)) * _e700));
    let _e709 = textureSample(global_14, global_8, _e175.zw);
    let _e716 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e709, vec4(((pow((1f - _e140.x), 4f) * 0.25f) + (0.75f * _e685))));
    let _e718 = global_6.member_19;
    let _e725 = mix(mix(mix(_e718.x, _e718.y, _e143.x), _e718.z, _e143.y), _e718.w, _e143.z);
    let _e727 = global_6.member_8;
    phi_7078_ = vec4<f32>(_e137, 0f, 1f);
    if (_e727 != 0i) {
        let _e729 = textureSample(global_15, global_2, _e139);
        let _e736 = textureSample(global_16, global_8, _e139);
        let _e739 = global_6.member_16;
        if (_e739 != 0i) {
            let _e742 = global_6.member_17;
            phi_20271_ = mix(mix(mix(_e742.x, _e742.y, _e143.x), _e742.z, _e143.y), _e742.w, _e143.z);
        } else {
            phi_20271_ = _e736.x;
        }
        let _e751 = phi_20271_;
        let _e761 = mix(vec4<f32>(min(1f, (_e751 + ((((1f - _e716.w) * _e685) * _e685) * 0.5f))), _e725, 0f, 1f), vec4<f32>(_e729.x, _e729.y, _e729.z, _e729.w), vec4(_e707));
        let _e763 = textureSample(global_17, global_8, _e139);
        let _e765 = ((1f - _e707) * _e763.x);
        let _e772 = global_6.member_18;
        let _e774 = vec4<f32>(_e761.x, _e761.y, _e765, _e761.w).xyz;
        let _e775 = (_e774 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e778 = pow(((_e774 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e761.x <= 0.04045f) {
            phi_21354_ = _e775.x;
        } else {
            phi_21354_ = _e778.x;
        }
        let _e784 = phi_21354_;
        if (_e761.y <= 0.04045f) {
            phi_23035_ = _e775.y;
        } else {
            phi_23035_ = _e778.y;
        }
        let _e790 = phi_23035_;
        if (_e765 <= 0.04045f) {
            phi_19513_ = _e775.z;
        } else {
            phi_19513_ = _e778.z;
        }
        let _e795 = phi_19513_;
        let _e796 = vec4<f32>(_e784, _e790, _e765, min(1f, _e772));
        phi_7078_ = vec4<f32>(_e796.x, _e796.y, _e795, _e796.w);
    }
    let _e803 = phi_7078_;
    phi_22402_ = _e803;
    if (_e727 == 0i) {
        let _e805 = textureSample(global_18, global_2, _e139);
        let _e807 = global_6.member_11;
        let _e809 = (((((_e659.xyzw + _e662.xyzw).xyzw + _e667.xyzw).xyzw + _e672.xyzw).xyzw + _e677.xyzw).xyzw * 0.2f).xyz;
        let _e811 = global_6.member_29;
        let _e817 = global_6.member_12;
        let _e826 = global_6.member_13;
        let _e835 = global_6.member_14;
        let _e841 = mix(mix(mix(mix(_e807.xyz, _e809, vec3(_e811.x)).xyz, mix(_e817.xyz, _e809, vec3(_e811.y)), vec3(_e143.x)).xyz, mix(_e826.xyz, _e809, vec3(_e811.z)), vec3(_e143.y)).xyz, mix(_e835.xyz, _e809, vec3(_e811.w)), vec3(_e143.z));
        let _e844 = (_e841.xyz * _e716.xyz);
        let _e849 = global_6.member_30;
        let _e851 = global_6.member_31;
        let _e854 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e844.xyz));
        let _e862 = mix(_e849.xyz, _e851.xyz, vec3(_e725));
        let _e884 = mix(mix(_e844, ((_e854.xyz * mix(min(_e862.x, dot(_e841.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e862.z, clamp(pow(max(_e844.x, max(_e844.y, _e844.z)), _e862.y), 0f, 1f))) / vec3(max(_e854.x, max(_e854.y, _e854.z)))).xyz, vec3(_e685)), _e805.xyz, vec3(_e707));
        phi_22402_ = vec4<f32>(_e884.x, _e884.y, _e884.z, 1f);
    }
    let _e890 = phi_22402_;
    let _e891 = textureSample(global_19, global_8, _e139);
    phi_6805_ = _e890;
    if (_e891.w < 0f) {
        let _e899 = vec4<f32>(_e891.x, _e890.y, _e890.z, _e890.w);
        let _e905 = vec4<f32>(_e899.x, _e891.y, _e899.z, _e899.w);
        phi_6805_ = vec4<f32>(_e905.x, _e905.y, _e891.z, _e905.w);
    }
    let _e913 = phi_6805_;
    global_20 = _e913;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_20;
    return _e5;
}
