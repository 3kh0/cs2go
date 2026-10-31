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
    member_19: i32,
    member_20: vec4<f32>,
    member_21: f32,
    member_22: vec4<f32>,
    member_23: f32,
    member_24: vec3<f32>,
    member_25: f32,
    member_26: vec3<f32>,
    member_27: vec2<f32>,
    member_28: i32,
    member_29: vec3<f32>,
    member_30: vec3<f32>,
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
    var phi_21710_: f32;
    var phi_12885_: f32;
    var phi_20271_: f32;
    var phi_15784_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e134 = global;
    let _e135 = _e134.xy;
    let _e137 = _e134.xy;
    let _e138 = textureSample(global_1, global_2, _e137);
    let _e141 = textureSample(global_3, global_2, _e137);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e143 = phi_13155_;
        let _e145 = phi_16208_;
        local_1 = _e143;
        if (_e145 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e154 = local[_e145];
        let _e158 = textureSample(global_5, global_2, (_e135 + (_e154 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e143 + (_e158 * 0.05882353f));
            phi_16208_ = (_e145 + 1i);
        }
    }
    let _e148 = local_1;
    let _e149 = (_e148 * 2f);
    let _e151 = global_6.member_9;
    let _e152 = (_e151 != 0i);
    phi_18941_ = _e149;
    if _e152 {
        phi_18941_ = vec4<f32>(_e149.x, _e149.y, (_e149.z * -1f), _e149.w);
    }
    let _e170 = phi_18941_;
    let _e172 = global_4;
    let _e174 = textureSample(global_7, global_8, _e172.xy);
    let _e177 = global_6.member;
    let _e179 = global_6.member_1;
    let _e180 = textureSample(global_10, global_2, _e137);
    let _e184 = normalize(((_e180.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e185 = _e170.yz;
    let _e186 = _e177.xy;
    let _e190 = _e179.xy;
    let _e194 = vec2<f32>((dot(_e185, _e186) + _e177.w), (dot(_e185, _e190) + _e179.w));
    let _e195 = textureSample(global_11, global_9, _e194);
    let _e197 = _e170.xz;
    let _e202 = vec2<f32>((dot(_e197, _e186) + _e177.w), (dot(_e197, _e190) + _e179.w));
    let _e203 = textureSample(global_11, global_9, _e202);
    let _e205 = _e170.yx;
    let _e210 = vec2<f32>((dot(_e205, _e186) + _e177.w), (dot(_e205, _e190) + _e179.w));
    let _e211 = textureSample(global_11, global_9, _e210);
    let _e216 = global_6.member_24;
    let _e228 = mix(mix(_e195.xyzw, _e203.xyzw, vec4((_e216.y * pow(abs(_e184.y), 7f)))), _e211.xyzw, vec4((_e216.z * pow(abs(_e184.z), 7f))));
    phi_11237_ = _e228;
    if _e152 {
        let _e230 = global_6.member_2;
        let _e232 = global_6.member_3;
        let _e233 = textureSample(global_10, global_2, _e137);
        let _e237 = normalize(((_e233.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e238 = _e230.xy;
        let _e242 = _e232.xy;
        let _e247 = textureSample(global_11, global_9, vec2<f32>((dot(_e185, _e238) + _e230.w), (dot(_e185, _e242) + _e232.w)));
        let _e254 = textureSample(global_11, global_9, vec2<f32>((dot(_e197, _e238) + _e230.w), (dot(_e197, _e242) + _e232.w)));
        let _e261 = textureSample(global_11, global_9, vec2<f32>((dot(_e205, _e238) + _e230.w), (dot(_e205, _e242) + _e232.w)));
        let _e277 = global_6.member_4;
        let _e279 = global_6.member_5;
        let _e280 = textureSample(global_10, global_2, _e137);
        let _e284 = normalize(((_e280.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e285 = _e277.xy;
        let _e289 = _e279.xy;
        let _e294 = textureSample(global_11, global_9, vec2<f32>((dot(_e185, _e285) + _e277.w), (dot(_e185, _e289) + _e279.w)));
        let _e301 = textureSample(global_11, global_9, vec2<f32>((dot(_e197, _e285) + _e277.w), (dot(_e197, _e289) + _e279.w)));
        let _e308 = textureSample(global_11, global_9, vec2<f32>((dot(_e205, _e285) + _e277.w), (dot(_e205, _e289) + _e279.w)));
        let _e324 = global_6.member_6;
        let _e326 = global_6.member_7;
        let _e327 = textureSample(global_10, global_2, _e137);
        let _e331 = normalize(((_e327.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e332 = _e324.xy;
        let _e336 = _e326.xy;
        let _e341 = textureSample(global_11, global_9, vec2<f32>((dot(_e185, _e332) + _e324.w), (dot(_e185, _e336) + _e326.w)));
        let _e348 = textureSample(global_11, global_9, vec2<f32>((dot(_e197, _e332) + _e324.w), (dot(_e197, _e336) + _e326.w)));
        let _e355 = textureSample(global_11, global_9, vec2<f32>((dot(_e205, _e332) + _e324.w), (dot(_e205, _e336) + _e326.w)));
        let _e371 = global_6.member_28;
        if (_e371 != 0i) {
            let _e431 = global_6.member_26;
            let _e435 = global_6.member_25;
            let _e441 = smoothstep(_e431.x, _e431.z, pow(((min(_e138.x, _e435) * _e138.y) * 2f), _e431.y));
            let _e443 = global_6.member_27;
            if (_e443.x > _e443.y) {
                let _e469 = (_e228.xyz * _e441);
                let _e475 = vec4<f32>(_e469.x, _e228.y, _e228.z, _e228.w);
                let _e481 = vec4<f32>(_e475.x, _e469.y, _e475.z, _e475.w);
                phi_12502_ = vec4<f32>(_e481.x, _e481.y, _e469.z, _e481.w);
            } else {
                let _e449 = (_e228.xyz * (1f - _e441));
                let _e455 = vec4<f32>(_e449.x, _e228.y, _e228.z, _e228.w);
                let _e461 = vec4<f32>(_e455.x, _e449.y, _e455.z, _e455.w);
                phi_12502_ = vec4<f32>(_e461.x, _e461.y, _e449.z, _e461.w);
            }
            let _e489 = phi_12502_;
            phi_21709_ = _e489;
        } else {
            let _e374 = global_6.member_26;
            let _e381 = smoothstep(_e374.x, _e374.z, pow(((_e138.x * _e138.y) * 2f), _e374.y));
            let _e383 = global_6.member_27;
            if (_e383.x > _e383.y) {
                let _e409 = (_e228.xyz * (1f - _e381));
                let _e415 = vec4<f32>(_e409.x, _e228.y, _e228.z, _e228.w);
                let _e421 = vec4<f32>(_e415.x, _e409.y, _e415.z, _e415.w);
                phi_12501_ = vec4<f32>(_e421.x, _e421.y, _e409.z, _e421.w);
            } else {
                let _e388 = (_e228.xyz * _e381);
                let _e394 = vec4<f32>(_e388.x, _e228.y, _e228.z, _e228.w);
                let _e400 = vec4<f32>(_e394.x, _e388.y, _e394.z, _e394.w);
                phi_12501_ = vec4<f32>(_e400.x, _e400.y, _e388.z, _e400.w);
            }
            let _e429 = phi_12501_;
            phi_21709_ = _e429;
        }
        let _e491 = phi_21709_;
        let _e493 = global_6.member_27;
        let _e501 = smoothstep(vec3(_e493.x), vec3(_e493.y), (_e491.xyz * vec3<f32>(mix(mix(_e247.xyzw, _e254.xyzw, vec4((_e216.y * pow(abs(_e237.y), 7f)))), _e261.xyzw, vec4((_e216.z * pow(abs(_e237.z), 7f)))).w, mix(mix(_e294.xyzw, _e301.xyzw, vec4((_e216.y * pow(abs(_e284.y), 7f)))), _e308.xyzw, vec4((_e216.z * pow(abs(_e284.z), 7f)))).w, mix(mix(_e341.xyzw, _e348.xyzw, vec4((_e216.y * pow(abs(_e331.y), 7f)))), _e355.xyzw, vec4((_e216.z * pow(abs(_e331.z), 7f)))).w)));
        let _e507 = vec4<f32>(_e501.x, _e491.y, _e491.z, _e491.w);
        let _e513 = vec4<f32>(_e507.x, _e501.y, _e507.z, _e507.w);
        phi_11237_ = vec4<f32>(_e513.x, _e513.y, _e501.z, _e513.w);
    }
    let _e521 = phi_11237_;
    let _e525 = global_6.member_23;
    let _e530 = global_6.member_18;
    let _e544 = mix(mix(mix(mix(mix(_e530.x, _e530.y, _e521.x), _e530.z, _e521.y), _e530.w, _e521.z), _e530.z, _e141.y), _e530.w, _e141.z);
    let _e545 = (((_e138.w + (_e174.x * _e138.x)) * ((_e525 * 6f) + 1f)) * _e544);
    let _e547 = global_6.member_12;
    let _e548 = (_e547 * _e544);
    let _e553 = (0.56f - (0.06f * _e525));
    let _e557 = (0.54f - (_e525 * 0.12f));
    let _e567 = (_e521.xyz * vec3<f32>(smoothstep((0.58f + _e548), (_e553 - _e548), _e545), smoothstep((_e553 + _e548), (_e557 - _e548), _e545), smoothstep((_e557 + _e548), ((0.52f - (_e525 * 0.17999999f)) - _e548), _e545)).xyz);
    let _e573 = smoothstep((0.58f - _e548), (0.68f + _e548), _e545);
    let _e582 = textureSample(global_12, global_8, _e172.zw);
    let _e589 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e582, vec4(((pow((1f - _e138.x), 4f) * 0.25f) + (0.75f * _e525))));
    let _e591 = global_6.member_22;
    let _e600 = mix(mix(mix(mix(mix(_e591.x, _e591.y, _e567.x), _e591.z, _e567.y), _e591.w, _e567.z), _e591.z, _e141.y), _e591.w, _e141.z);
    let _e602 = global_6.member_8;
    phi_7078_ = vec4<f32>(_e135, 0f, 1f);
    if (_e602 != 0i) {
        let _e604 = textureSample(global_13, global_2, _e137);
        let _e612 = global_6.member_10;
        if (_e612 != 0i) {
            let _e616 = textureSample(global_10, global_2, _e137);
            let _e620 = normalize(((_e616.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e621 = textureSample(global_14, global_8, _e194);
            let _e623 = textureSample(global_14, global_8, _e202);
            let _e625 = textureSample(global_14, global_8, _e210);
            phi_21710_ = mix(mix(_e621.xyzw, _e623.xyzw, vec4((_e216.y * pow(abs(_e620.y), 7f)))), _e625.xyzw, vec4((_e216.z * pow(abs(_e620.z), 7f)))).x;
        } else {
            let _e614 = textureSample(global_14, global_8, _e137);
            phi_21710_ = _e614.x;
        }
        let _e641 = phi_21710_;
        let _e643 = global_6.member_19;
        let _e644 = (_e643 != 0i);
        phi_12885_ = _e641;
        if _e644 {
            let _e646 = global_6.member_20;
            phi_12885_ = mix(mix(mix(_e646.x, _e646.y, _e567.x), _e646.z, _e567.y), _e646.w, _e567.z);
        }
        let _e655 = phi_12885_;
        phi_20271_ = _e655;
        if _e644 {
            let _e657 = global_6.member_20;
            phi_20271_ = mix(mix(_e655, _e657.z, _e141.y), _e657.w, _e141.z);
        }
        let _e663 = phi_20271_;
        let _e673 = mix(vec4<f32>(min(1f, (_e663 + ((((1f - _e589.w) * _e525) * _e525) * 0.5f))), _e600, 0f, 1f), vec4<f32>(_e604.x, _e604.y, _e604.z, _e604.w), vec4(_e573));
        let _e674 = (1f - _e573);
        let _e676 = global_6.member_11;
        if (_e676 != 0i) {
            let _e687 = textureSample(global_10, global_2, _e137);
            let _e691 = normalize(((_e687.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e692 = textureSample(global_15, global_8, _e194);
            let _e694 = textureSample(global_15, global_8, _e202);
            let _e696 = textureSample(global_15, global_8, _e210);
            phi_15784_ = vec4<f32>(_e673.x, _e673.y, (_e674 * mix(mix(_e692.xyzw, _e694.xyzw, vec4((_e216.y * pow(abs(_e691.y), 7f)))), _e696.xyzw, vec4((_e216.z * pow(abs(_e691.z), 7f)))).x), _e673.w);
        } else {
            let _e678 = textureSample(global_15, global_8, _e137);
            let _e680 = (_e674 * _e678.x);
            phi_15784_ = vec4<f32>(_e673.x, _e673.y, (_e680 * _e680), _e673.w);
        }
        let _e718 = phi_15784_;
        let _e722 = (_e718.z * (1f - max(_e141.y, _e141.z)));
        let _e729 = global_6.member_21;
        let _e731 = vec4<f32>(_e718.x, _e718.y, _e722, _e718.w).xyz;
        let _e732 = (_e731 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e735 = pow(((_e731 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e718.x <= 0.04045f) {
            phi_21354_ = _e732.x;
        } else {
            phi_21354_ = _e735.x;
        }
        let _e741 = phi_21354_;
        if (_e718.y <= 0.04045f) {
            phi_23035_ = _e732.y;
        } else {
            phi_23035_ = _e735.y;
        }
        let _e747 = phi_23035_;
        if (_e722 <= 0.04045f) {
            phi_19513_ = _e732.z;
        } else {
            phi_19513_ = _e735.z;
        }
        let _e752 = phi_19513_;
        let _e753 = vec4<f32>(_e741, _e747, _e722, min(1f, _e729));
        phi_7078_ = vec4<f32>(_e753.x, _e753.y, _e752, _e753.w);
    }
    let _e760 = phi_7078_;
    phi_22401_ = _e760;
    if (_e602 == 0i) {
        let _e762 = textureSample(global_16, global_2, _e137);
        let _e765 = global_6.member_13;
        let _e767 = global_6.member_14;
        let _e771 = global_6.member_15;
        let _e775 = global_6.member_16;
        let _e782 = global_6.member_17;
        let _e785 = clamp((mix(mix(mix(mix(mix(_e765, _e767, vec3(_e567.x)), _e771, vec3(_e567.y)), _e775, vec3(_e567.z)), _e771, vec3(_e141.y)), _e775, vec3(_e141.z)) * mix(_e782, 1f, (smoothstep(0f, 0.01f, _e573) * (1f - (smoothstep(0.5f, 0.6f, _e521.w) * smoothstep(1f, 0.9f, _e521.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e788 = (_e785.xyz * _e589.xyz);
        let _e793 = global_6.member_29;
        let _e795 = global_6.member_30;
        let _e798 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e788.xyz));
        let _e806 = mix(_e793.xyz, _e795.xyz, vec3(_e600));
        let _e828 = mix(mix(_e788, ((_e798.xyz * mix(min(_e806.x, dot(_e785.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e806.z, clamp(pow(max(_e788.x, max(_e788.y, _e788.z)), _e806.y), 0f, 1f))) / vec3(max(_e798.x, max(_e798.y, _e798.z)))).xyz, vec3(_e525)), _e762.xyz, vec3(_e573));
        phi_22401_ = vec4<f32>(_e828.x, _e828.y, _e828.z, 1f);
    }
    let _e834 = phi_22401_;
    let _e835 = textureSample(global_17, global_8, _e137);
    phi_6805_ = _e834;
    if (_e835.w < 0f) {
        let _e843 = vec4<f32>(_e835.x, _e834.y, _e834.z, _e834.w);
        let _e849 = vec4<f32>(_e843.x, _e835.y, _e843.z, _e843.w);
        phi_6805_ = vec4<f32>(_e849.x, _e849.y, _e835.z, _e849.w);
    }
    let _e857 = phi_6805_;
    global_18 = _e857;
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
