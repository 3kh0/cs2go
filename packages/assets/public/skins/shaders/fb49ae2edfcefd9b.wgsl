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
    member_11: f32,
    member_12: vec3<f32>,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
    member_15: vec3<f32>,
    member_16: f32,
    member_17: vec4<f32>,
    member_18: i32,
    member_19: vec4<f32>,
    member_20: f32,
    member_21: vec4<f32>,
    member_22: f32,
    member_23: vec3<f32>,
    member_24: f32,
    member_25: vec3<f32>,
    member_26: vec2<f32>,
    member_27: i32,
    member_28: vec3<f32>,
    member_29: vec3<f32>,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
var<private> global_3: vec4<f32>;
@group(1) @binding(33) 
var global_4: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_5: type_12;
@group(1) @binding(39) 
var global_6: texture_2d<f32>;
@group(1) @binding(22) 
var global_7: sampler;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(32) 
var global_9: texture_2d<f32>;
@group(1) @binding(38) 
var global_10: texture_2d<f32>;
@group(1) @binding(40) 
var global_11: texture_2d<f32>;
@group(1) @binding(35) 
var global_12: texture_2d<f32>;
@group(1) @binding(36) 
var global_13: texture_2d<f32>;
@group(1) @binding(34) 
var global_14: texture_2d<f32>;
@group(1) @binding(37) 
var global_15: texture_2d<f32>;
var<private> global_16: vec4<f32>;

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
    var phi_21710_: f32;
    var phi_20271_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e131 = global;
    let _e132 = _e131.xy;
    let _e134 = _e131.xy;
    let _e135 = textureSample(global_1, global_2, _e134);
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
        let _e154 = textureSample(global_4, global_2, (_e132 + (_e150 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e139 + (_e154 * 0.05882353f));
            phi_16208_ = (_e141 + 1i);
        }
    }
    let _e144 = local_1;
    let _e145 = (_e144 * 2f);
    let _e147 = global_5.member_9;
    let _e148 = (_e147 != 0i);
    phi_18941_ = _e145;
    if _e148 {
        phi_18941_ = vec4<f32>(_e145.x, _e145.y, (_e145.z * -1f), _e145.w);
    }
    let _e166 = phi_18941_;
    let _e168 = global_3;
    let _e170 = textureSample(global_6, global_7, _e168.xy);
    let _e173 = global_5.member;
    let _e175 = global_5.member_1;
    let _e176 = textureSample(global_9, global_2, _e134);
    let _e180 = normalize(((_e176.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e181 = _e166.yz;
    let _e182 = _e173.xy;
    let _e186 = _e175.xy;
    let _e190 = vec2<f32>((dot(_e181, _e182) + _e173.w), (dot(_e181, _e186) + _e175.w));
    let _e191 = textureSample(global_10, global_8, _e190);
    let _e193 = _e166.xz;
    let _e198 = vec2<f32>((dot(_e193, _e182) + _e173.w), (dot(_e193, _e186) + _e175.w));
    let _e199 = textureSample(global_10, global_8, _e198);
    let _e201 = _e166.yx;
    let _e206 = vec2<f32>((dot(_e201, _e182) + _e173.w), (dot(_e201, _e186) + _e175.w));
    let _e207 = textureSample(global_10, global_8, _e206);
    let _e212 = global_5.member_23;
    let _e224 = mix(mix(_e191.xyzw, _e199.xyzw, vec4((_e212.y * pow(abs(_e180.y), 7f)))), _e207.xyzw, vec4((_e212.z * pow(abs(_e180.z), 7f))));
    phi_11237_ = _e224;
    if _e148 {
        let _e226 = global_5.member_2;
        let _e228 = global_5.member_3;
        let _e229 = textureSample(global_9, global_2, _e134);
        let _e233 = normalize(((_e229.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e234 = _e226.xy;
        let _e238 = _e228.xy;
        let _e243 = textureSample(global_10, global_8, vec2<f32>((dot(_e181, _e234) + _e226.w), (dot(_e181, _e238) + _e228.w)));
        let _e250 = textureSample(global_10, global_8, vec2<f32>((dot(_e193, _e234) + _e226.w), (dot(_e193, _e238) + _e228.w)));
        let _e257 = textureSample(global_10, global_8, vec2<f32>((dot(_e201, _e234) + _e226.w), (dot(_e201, _e238) + _e228.w)));
        let _e273 = global_5.member_4;
        let _e275 = global_5.member_5;
        let _e276 = textureSample(global_9, global_2, _e134);
        let _e280 = normalize(((_e276.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e281 = _e273.xy;
        let _e285 = _e275.xy;
        let _e290 = textureSample(global_10, global_8, vec2<f32>((dot(_e181, _e281) + _e273.w), (dot(_e181, _e285) + _e275.w)));
        let _e297 = textureSample(global_10, global_8, vec2<f32>((dot(_e193, _e281) + _e273.w), (dot(_e193, _e285) + _e275.w)));
        let _e304 = textureSample(global_10, global_8, vec2<f32>((dot(_e201, _e281) + _e273.w), (dot(_e201, _e285) + _e275.w)));
        let _e320 = global_5.member_6;
        let _e322 = global_5.member_7;
        let _e323 = textureSample(global_9, global_2, _e134);
        let _e327 = normalize(((_e323.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e328 = _e320.xy;
        let _e332 = _e322.xy;
        let _e337 = textureSample(global_10, global_8, vec2<f32>((dot(_e181, _e328) + _e320.w), (dot(_e181, _e332) + _e322.w)));
        let _e344 = textureSample(global_10, global_8, vec2<f32>((dot(_e193, _e328) + _e320.w), (dot(_e193, _e332) + _e322.w)));
        let _e351 = textureSample(global_10, global_8, vec2<f32>((dot(_e201, _e328) + _e320.w), (dot(_e201, _e332) + _e322.w)));
        let _e367 = global_5.member_27;
        if (_e367 != 0i) {
            let _e427 = global_5.member_25;
            let _e431 = global_5.member_24;
            let _e437 = smoothstep(_e427.x, _e427.z, pow(((min(_e135.x, _e431) * _e135.y) * 2f), _e427.y));
            let _e439 = global_5.member_26;
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
            let _e370 = global_5.member_25;
            let _e377 = smoothstep(_e370.x, _e370.z, pow(((_e135.x * _e135.y) * 2f), _e370.y));
            let _e379 = global_5.member_26;
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
        let _e489 = global_5.member_26;
        let _e497 = smoothstep(vec3(_e489.x), vec3(_e489.y), (_e487.xyz * vec3<f32>(mix(mix(_e243.xyzw, _e250.xyzw, vec4((_e212.y * pow(abs(_e233.y), 7f)))), _e257.xyzw, vec4((_e212.z * pow(abs(_e233.z), 7f)))).w, mix(mix(_e290.xyzw, _e297.xyzw, vec4((_e212.y * pow(abs(_e280.y), 7f)))), _e304.xyzw, vec4((_e212.z * pow(abs(_e280.z), 7f)))).w, mix(mix(_e337.xyzw, _e344.xyzw, vec4((_e212.y * pow(abs(_e327.y), 7f)))), _e351.xyzw, vec4((_e212.z * pow(abs(_e327.z), 7f)))).w)));
        let _e503 = vec4<f32>(_e497.x, _e487.y, _e487.z, _e487.w);
        let _e509 = vec4<f32>(_e503.x, _e497.y, _e503.z, _e503.w);
        phi_11237_ = vec4<f32>(_e509.x, _e509.y, _e497.z, _e509.w);
    }
    let _e517 = phi_11237_;
    let _e521 = global_5.member_22;
    let _e526 = global_5.member_17;
    let _e536 = mix(mix(mix(_e526.x, _e526.y, _e517.x), _e526.z, _e517.y), _e526.w, _e517.z);
    let _e537 = (((_e135.w + (_e170.x * _e135.x)) * ((_e521 * 6f) + 1f)) * _e536);
    let _e539 = global_5.member_11;
    let _e540 = (_e539 * _e536);
    let _e545 = (0.56f - (0.06f * _e521));
    let _e549 = (0.54f - (_e521 * 0.12f));
    let _e559 = (_e517.xyz * vec3<f32>(smoothstep((0.58f + _e540), (_e545 - _e540), _e537), smoothstep((_e545 + _e540), (_e549 - _e540), _e537), smoothstep((_e549 + _e540), ((0.52f - (_e521 * 0.17999999f)) - _e540), _e537)).xyz);
    let _e565 = smoothstep((0.58f - _e540), (0.68f + _e540), _e537);
    let _e574 = textureSample(global_11, global_7, _e168.zw);
    let _e581 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e574, vec4(((pow((1f - _e135.x), 4f) * 0.25f) + (0.75f * _e521))));
    let _e583 = global_5.member_21;
    let _e590 = mix(mix(mix(_e583.x, _e583.y, _e559.x), _e583.z, _e559.y), _e583.w, _e559.z);
    let _e592 = global_5.member_8;
    phi_7078_ = vec4<f32>(_e132, 0f, 1f);
    if (_e592 != 0i) {
        let _e594 = textureSample(global_12, global_2, _e134);
        let _e602 = global_5.member_10;
        if (_e602 != 0i) {
            let _e606 = textureSample(global_9, global_2, _e134);
            let _e610 = normalize(((_e606.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e611 = textureSample(global_13, global_7, _e190);
            let _e613 = textureSample(global_13, global_7, _e198);
            let _e615 = textureSample(global_13, global_7, _e206);
            phi_21710_ = mix(mix(_e611.xyzw, _e613.xyzw, vec4((_e212.y * pow(abs(_e610.y), 7f)))), _e615.xyzw, vec4((_e212.z * pow(abs(_e610.z), 7f)))).x;
        } else {
            let _e604 = textureSample(global_13, global_7, _e134);
            phi_21710_ = _e604.x;
        }
        let _e631 = phi_21710_;
        let _e633 = global_5.member_18;
        phi_20271_ = _e631;
        if (_e633 != 0i) {
            let _e636 = global_5.member_19;
            phi_20271_ = mix(mix(mix(_e636.x, _e636.y, _e559.x), _e636.z, _e559.y), _e636.w, _e559.z);
        }
        let _e645 = phi_20271_;
        let _e655 = mix(vec4<f32>(min(1f, (_e645 + ((((1f - _e581.w) * _e521) * _e521) * 0.5f))), _e590, 0f, 1f), vec4<f32>(_e594.x, _e594.y, _e594.z, _e594.w), vec4(_e565));
        let _e656 = (1f - _e565);
        let _e663 = global_5.member_20;
        let _e665 = vec4<f32>(_e655.x, _e655.y, _e656, _e655.w).xyz;
        let _e666 = (_e665 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e669 = pow(((_e665 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e655.x <= 0.04045f) {
            phi_21354_ = _e666.x;
        } else {
            phi_21354_ = _e669.x;
        }
        let _e675 = phi_21354_;
        if (_e655.y <= 0.04045f) {
            phi_23035_ = _e666.y;
        } else {
            phi_23035_ = _e669.y;
        }
        let _e681 = phi_23035_;
        if (_e656 <= 0.04045f) {
            phi_19513_ = _e666.z;
        } else {
            phi_19513_ = _e669.z;
        }
        let _e686 = phi_19513_;
        let _e687 = vec4<f32>(_e675, _e681, _e656, min(1f, _e663));
        phi_7078_ = vec4<f32>(_e687.x, _e687.y, _e686, _e687.w);
    }
    let _e694 = phi_7078_;
    phi_22401_ = _e694;
    if (_e592 == 0i) {
        let _e696 = textureSample(global_14, global_2, _e134);
        let _e699 = global_5.member_12;
        let _e701 = global_5.member_13;
        let _e705 = global_5.member_14;
        let _e709 = global_5.member_15;
        let _e712 = global_5.member_16;
        let _e715 = clamp((mix(mix(mix(_e699, _e701, vec3(_e559.x)), _e705, vec3(_e559.y)), _e709, vec3(_e559.z)) * mix(_e712, 1f, (smoothstep(0f, 0.01f, _e565) * (1f - (smoothstep(0.5f, 0.6f, _e517.w) * smoothstep(1f, 0.9f, _e517.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e718 = (_e715.xyz * _e581.xyz);
        let _e723 = global_5.member_28;
        let _e725 = global_5.member_29;
        let _e728 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e718.xyz));
        let _e736 = mix(_e723.xyz, _e725.xyz, vec3(_e590));
        let _e758 = mix(mix(_e718, ((_e728.xyz * mix(min(_e736.x, dot(_e715.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e736.z, clamp(pow(max(_e718.x, max(_e718.y, _e718.z)), _e736.y), 0f, 1f))) / vec3(max(_e728.x, max(_e728.y, _e728.z)))).xyz, vec3(_e521)), _e696.xyz, vec3(_e565));
        phi_22401_ = vec4<f32>(_e758.x, _e758.y, _e758.z, 1f);
    }
    let _e764 = phi_22401_;
    let _e765 = textureSample(global_15, global_7, _e134);
    phi_6805_ = _e764;
    if (_e765.w < 0f) {
        let _e773 = vec4<f32>(_e765.x, _e764.y, _e764.z, _e764.w);
        let _e779 = vec4<f32>(_e773.x, _e765.y, _e773.z, _e773.w);
        phi_6805_ = vec4<f32>(_e779.x, _e779.y, _e765.z, _e779.w);
    }
    let _e787 = phi_6805_;
    global_16 = _e787;
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
