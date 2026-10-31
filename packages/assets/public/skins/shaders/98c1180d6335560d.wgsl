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
    member_10: i32,
    member_11: i32,
    member_12: f32,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
    member_15: vec3<f32>,
    member_16: vec3<f32>,
    member_17: f32,
    member_18: vec4<f32>,
    member_19: f32,
    member_20: f32,
    member_21: f32,
    member_22: vec3<f32>,
    member_23: f32,
    member_24: vec3<f32>,
    member_25: vec2<f32>,
    member_26: i32,
    member_27: vec3<f32>,
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
@group(1) @binding(40) 
var global_7: texture_2d<f32>;
@group(1) @binding(22) 
var global_8: sampler;
@group(1) @binding(27) 
var global_9: sampler;
@group(1) @binding(32) 
var global_10: texture_2d<f32>;
@group(1) @binding(39) 
var global_11: texture_2d<f32>;
@group(1) @binding(41) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
@group(1) @binding(37) 
var global_15: texture_2d<f32>;
@group(1) @binding(34) 
var global_16: texture_2d<f32>;
@group(1) @binding(38) 
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
    var phi_11237_: vec4<f32>;
    var phi_13563_: f32;
    var phi_10671_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e130 = global;
    let _e131 = _e130.xy;
    let _e133 = _e130.xy;
    let _e134 = textureSample(global_1, global_2, _e133);
    let _e137 = textureSample(global_3, global_2, _e133);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e139 = phi_13155_;
        let _e141 = phi_16208_;
        local_1 = _e139;
        if (_e141 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e150 = local[_e141];
        let _e154 = textureSample(global_5, global_2, (_e131 + (_e150 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e139 + (_e154 * 0.05882353f));
            phi_16208_ = (_e141 + 1i);
        }
    }
    let _e144 = local_1;
    let _e145 = (_e144 * 2f);
    let _e147 = global_6.member_9;
    let _e148 = (_e147 != 0i);
    phi_18941_ = _e145;
    if _e148 {
        phi_18941_ = vec4<f32>(_e145.x, _e145.y, (_e145.z * -1f), _e145.w);
    }
    let _e166 = phi_18941_;
    let _e168 = global_4;
    let _e170 = textureSample(global_7, global_8, _e168.xy);
    let _e173 = global_6.member;
    let _e175 = global_6.member_1;
    let _e176 = textureSample(global_10, global_2, _e133);
    let _e180 = normalize(((_e176.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e181 = _e166.yz;
    let _e182 = _e173.xy;
    let _e186 = _e175.xy;
    let _e190 = vec2<f32>((dot(_e181, _e182) + _e173.w), (dot(_e181, _e186) + _e175.w));
    let _e191 = textureSample(global_11, global_9, _e190);
    let _e193 = _e166.xz;
    let _e198 = vec2<f32>((dot(_e193, _e182) + _e173.w), (dot(_e193, _e186) + _e175.w));
    let _e199 = textureSample(global_11, global_9, _e198);
    let _e201 = _e166.yx;
    let _e206 = vec2<f32>((dot(_e201, _e182) + _e173.w), (dot(_e201, _e186) + _e175.w));
    let _e207 = textureSample(global_11, global_9, _e206);
    let _e212 = global_6.member_22;
    let _e224 = mix(mix(_e191.xyzw, _e199.xyzw, vec4((_e212.y * pow(abs(_e180.y), 7f)))), _e207.xyzw, vec4((_e212.z * pow(abs(_e180.z), 7f))));
    phi_11237_ = _e224;
    if _e148 {
        let _e226 = global_6.member_2;
        let _e228 = global_6.member_3;
        let _e229 = textureSample(global_10, global_2, _e133);
        let _e233 = normalize(((_e229.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e234 = _e226.xy;
        let _e238 = _e228.xy;
        let _e243 = textureSample(global_11, global_9, vec2<f32>((dot(_e181, _e234) + _e226.w), (dot(_e181, _e238) + _e228.w)));
        let _e250 = textureSample(global_11, global_9, vec2<f32>((dot(_e193, _e234) + _e226.w), (dot(_e193, _e238) + _e228.w)));
        let _e257 = textureSample(global_11, global_9, vec2<f32>((dot(_e201, _e234) + _e226.w), (dot(_e201, _e238) + _e228.w)));
        let _e273 = global_6.member_4;
        let _e275 = global_6.member_5;
        let _e276 = textureSample(global_10, global_2, _e133);
        let _e280 = normalize(((_e276.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e281 = _e273.xy;
        let _e285 = _e275.xy;
        let _e290 = textureSample(global_11, global_9, vec2<f32>((dot(_e181, _e281) + _e273.w), (dot(_e181, _e285) + _e275.w)));
        let _e297 = textureSample(global_11, global_9, vec2<f32>((dot(_e193, _e281) + _e273.w), (dot(_e193, _e285) + _e275.w)));
        let _e304 = textureSample(global_11, global_9, vec2<f32>((dot(_e201, _e281) + _e273.w), (dot(_e201, _e285) + _e275.w)));
        let _e320 = global_6.member_6;
        let _e322 = global_6.member_7;
        let _e323 = textureSample(global_10, global_2, _e133);
        let _e327 = normalize(((_e323.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e328 = _e320.xy;
        let _e332 = _e322.xy;
        let _e337 = textureSample(global_11, global_9, vec2<f32>((dot(_e181, _e328) + _e320.w), (dot(_e181, _e332) + _e322.w)));
        let _e344 = textureSample(global_11, global_9, vec2<f32>((dot(_e193, _e328) + _e320.w), (dot(_e193, _e332) + _e322.w)));
        let _e351 = textureSample(global_11, global_9, vec2<f32>((dot(_e201, _e328) + _e320.w), (dot(_e201, _e332) + _e322.w)));
        let _e367 = global_6.member_26;
        if (_e367 != 0i) {
            let _e427 = global_6.member_24;
            let _e431 = global_6.member_23;
            let _e437 = smoothstep(_e427.x, _e427.z, pow(((min(_e134.x, _e431) * _e134.y) * 2f), _e427.y));
            let _e439 = global_6.member_25;
            if (_e439.x > _e439.y) {
                let _e465 = (_e224.xyz * _e437);
                let _e471 = vec4<f32>(_e465.x, _e224.y, _e224.z, _e224.w);
                let _e477 = vec4<f32>(_e471.x, _e465.y, _e471.z, _e471.w);
                phi_12502_ = vec4<f32>(_e477.x, _e477.y, _e465.z, _e477.w);
            } else {
                let _e445 = (_e224.xyz * (1f - _e437));
                let _e451 = vec4<f32>(_e445.x, _e224.y, _e224.z, _e224.w);
                let _e457 = vec4<f32>(_e451.x, _e445.y, _e451.z, _e451.w);
                phi_12502_ = vec4<f32>(_e457.x, _e457.y, _e445.z, _e457.w);
            }
            let _e485 = phi_12502_;
            phi_21709_ = _e485;
        } else {
            let _e370 = global_6.member_24;
            let _e377 = smoothstep(_e370.x, _e370.z, pow(((_e134.x * _e134.y) * 2f), _e370.y));
            let _e379 = global_6.member_25;
            if (_e379.x > _e379.y) {
                let _e405 = (_e224.xyz * (1f - _e377));
                let _e411 = vec4<f32>(_e405.x, _e224.y, _e224.z, _e224.w);
                let _e417 = vec4<f32>(_e411.x, _e405.y, _e411.z, _e411.w);
                phi_12501_ = vec4<f32>(_e417.x, _e417.y, _e405.z, _e417.w);
            } else {
                let _e384 = (_e224.xyz * _e377);
                let _e390 = vec4<f32>(_e384.x, _e224.y, _e224.z, _e224.w);
                let _e396 = vec4<f32>(_e390.x, _e384.y, _e390.z, _e390.w);
                phi_12501_ = vec4<f32>(_e396.x, _e396.y, _e384.z, _e396.w);
            }
            let _e425 = phi_12501_;
            phi_21709_ = _e425;
        }
        let _e487 = phi_21709_;
        let _e489 = global_6.member_25;
        let _e497 = smoothstep(vec3(_e489.x), vec3(_e489.y), (_e487.xyz * vec3<f32>(mix(mix(_e243.xyzw, _e250.xyzw, vec4((_e212.y * pow(abs(_e233.y), 7f)))), _e257.xyzw, vec4((_e212.z * pow(abs(_e233.z), 7f)))).w, mix(mix(_e290.xyzw, _e297.xyzw, vec4((_e212.y * pow(abs(_e280.y), 7f)))), _e304.xyzw, vec4((_e212.z * pow(abs(_e280.z), 7f)))).w, mix(mix(_e337.xyzw, _e344.xyzw, vec4((_e212.y * pow(abs(_e327.y), 7f)))), _e351.xyzw, vec4((_e212.z * pow(abs(_e327.z), 7f)))).w)));
        let _e503 = vec4<f32>(_e497.x, _e487.y, _e487.z, _e487.w);
        let _e509 = vec4<f32>(_e503.x, _e497.y, _e503.z, _e503.w);
        phi_11237_ = vec4<f32>(_e509.x, _e509.y, _e497.z, _e509.w);
    }
    let _e517 = phi_11237_;
    let _e521 = global_6.member_21;
    let _e526 = global_6.member_18;
    let _e540 = mix(mix(mix(mix(mix(_e526.x, _e526.y, _e517.x), _e526.z, _e517.y), _e526.w, _e517.z), _e526.z, _e137.y), _e526.w, _e137.z);
    let _e543 = global_6.member_12;
    let _e544 = (_e543 * _e540);
    let _e547 = smoothstep((0.58f - _e544), (0.68f + _e544), (((_e134.w + (_e170.x * _e134.x)) * ((_e521 * 6f) + 1f)) * _e540));
    let _e557 = max((1f - _e137.x), _e547);
    let _e558 = ((smoothstep(0f, 0.01f, _e547) * (1f - (smoothstep(0.5f, 0.6f, _e517.w) * smoothstep(1f, 0.9f, _e517.w)))) * _e137.x);
    let _e560 = textureSample(global_12, global_8, _e168.zw);
    let _e567 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e560, vec4(((pow((1f - _e134.x), 4f) * 0.25f) + (0.75f * _e521))));
    let _e569 = global_6.member_8;
    phi_7078_ = vec4<f32>(_e131, 0f, 1f);
    if (_e569 != 0i) {
        let _e571 = textureSample(global_13, global_2, _e133);
        let _e573 = (1f - _e557);
        let _e576 = global_6.member_10;
        if (_e576 != 0i) {
            let _e580 = textureSample(global_10, global_2, _e133);
            let _e584 = normalize(((_e580.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e585 = textureSample(global_14, global_8, _e190);
            let _e587 = textureSample(global_14, global_8, _e198);
            let _e589 = textureSample(global_14, global_8, _e206);
            phi_13563_ = mix(mix(_e585.xyzw, _e587.xyzw, vec4((_e212.y * pow(abs(_e584.y), 7f)))), _e589.xyzw, vec4((_e212.z * pow(abs(_e584.z), 7f)))).x;
        } else {
            let _e578 = textureSample(global_14, global_8, _e133);
            phi_13563_ = _e578.x;
        }
        let _e605 = phi_13563_;
        let _e606 = max(_e137.y, _e137.z);
        let _e609 = global_6.member_19;
        let _e623 = vec4<f32>(mix(_e571.x, min(1f, (mix(mix(_e605, _e609, max(_e606, _e557)), 0.35f, _e558) + ((1f - dot(_e567.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))) * 0.2f))), max(0f, _e573)), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e630 = vec4<f32>(_e623.x, mix(_e137.x, _e571.y, _e557), _e623.z, _e623.w);
        let _e632 = global_6.member_11;
        if (_e632 != 0i) {
            let _e643 = textureSample(global_10, global_2, _e133);
            let _e647 = normalize(((_e643.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e648 = textureSample(global_15, global_8, _e190);
            let _e650 = textureSample(global_15, global_8, _e198);
            let _e652 = textureSample(global_15, global_8, _e206);
            phi_10671_ = vec4<f32>(_e630.x, _e630.y, (_e573 * mix(mix(_e648.xyzw, _e650.xyzw, vec4((_e212.y * pow(abs(_e647.y), 7f)))), _e652.xyzw, vec4((_e212.z * pow(abs(_e647.z), 7f)))).x), _e630.w);
        } else {
            let _e634 = textureSample(global_15, global_8, _e133);
            let _e636 = (_e573 * _e634.x);
            phi_10671_ = vec4<f32>(_e630.x, _e630.y, (_e636 * _e636), _e630.w);
        }
        let _e674 = phi_10671_;
        let _e677 = (_e674.z * (1f - _e606));
        let _e684 = global_6.member_20;
        let _e686 = vec4<f32>(_e674.x, _e674.y, _e677, _e674.w).xyz;
        let _e687 = (_e686 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e690 = pow(((_e686 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e674.x <= 0.04045f) {
            phi_21354_ = _e687.x;
        } else {
            phi_21354_ = _e690.x;
        }
        let _e696 = phi_21354_;
        if (_e674.y <= 0.04045f) {
            phi_23035_ = _e687.y;
        } else {
            phi_23035_ = _e690.y;
        }
        let _e702 = phi_23035_;
        if (_e677 <= 0.04045f) {
            phi_19513_ = _e687.z;
        } else {
            phi_19513_ = _e690.z;
        }
        let _e707 = phi_19513_;
        let _e708 = vec4<f32>(_e696, _e702, _e677, min(1f, _e684));
        phi_7078_ = vec4<f32>(_e708.x, _e708.y, _e707, _e708.w);
    }
    let _e715 = phi_7078_;
    phi_22401_ = _e715;
    if (_e569 == 0i) {
        let _e717 = textureSample(global_16, global_2, _e133);
        let _e720 = global_6.member_13;
        let _e722 = global_6.member_14;
        let _e726 = global_6.member_15;
        let _e730 = global_6.member_16;
        let _e736 = _e717.xyz;
        let _e740 = vec3(_e558);
        let _e743 = global_6.member_17;
        let _e744 = mix(_e743, 1f, _e558);
        let _e748 = clamp((clamp((mix(mix(_e736, mix(mix(mix(mix(mix(_e720, _e722, vec3(_e517.x)), _e726, vec3(_e517.y)), _e730, vec3(_e517.z)), _e726, vec3(_e137.y)), _e730, vec3(_e137.z)).xyz, vec3(_e137.x)), vec3<f32>(0.38f, 0.37f, 0.35f), _e740) * _e744), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)) * _e744), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e750 = mix(_e567.xyz, vec3<f32>(1f, 1f, 1f), _e740);
        let _e756 = vec4<f32>(_e750.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e762 = vec4<f32>(_e756.x, _e750.y, _e756.z, _e756.w);
        let _e771 = (_e748.xyz * vec4<f32>(_e762.x, _e762.y, _e750.z, _e762.w).xyz);
        let _e776 = global_6.member_27;
        let _e779 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e771.xyz));
        let _e804 = mix(mix(_e771, ((_e779.xyz * mix(min(_e776.x, dot(_e748.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e776.z, clamp(pow(max(_e771.x, max(_e771.y, _e771.z)), _e776.y), 0f, 1f))) / vec3(max(_e779.x, max(_e779.y, _e779.z)))).xyz, vec3(_e521)), _e736, vec3(_e557));
        phi_22401_ = vec4<f32>(_e804.x, _e804.y, _e804.z, 1f);
    }
    let _e810 = phi_22401_;
    let _e811 = textureSample(global_17, global_8, _e133);
    phi_6805_ = _e810;
    if (_e811.w < 0f) {
        let _e819 = vec4<f32>(_e811.x, _e810.y, _e810.z, _e810.w);
        let _e825 = vec4<f32>(_e819.x, _e811.y, _e819.z, _e819.w);
        phi_6805_ = vec4<f32>(_e825.x, _e825.y, _e811.z, _e825.w);
    }
    let _e833 = phi_6805_;
    global_18 = _e833;
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
