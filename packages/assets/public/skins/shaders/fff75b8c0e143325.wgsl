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
@group(1) @binding(40) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
@group(1) @binding(34) 
var global_15: texture_2d<f32>;
@group(1) @binding(37) 
var global_16: texture_2d<f32>;
var<private> global_17: vec4<f32>;

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
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e132 = global;
    let _e133 = _e132.xy;
    let _e135 = _e132.xy;
    let _e136 = textureSample(global_1, global_2, _e135);
    let _e139 = textureSample(global_3, global_2, _e135);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e141 = phi_13155_;
        let _e143 = phi_16208_;
        local_1 = _e141;
        if (_e143 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e152 = local[_e143];
        let _e156 = textureSample(global_5, global_2, (_e133 + (_e152 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e141 + (_e156 * 0.05882353f));
            phi_16208_ = (_e143 + 1i);
        }
    }
    let _e146 = local_1;
    let _e147 = (_e146 * 2f);
    let _e149 = global_6.member_9;
    let _e150 = (_e149 != 0i);
    phi_18941_ = _e147;
    if _e150 {
        phi_18941_ = vec4<f32>(_e147.x, _e147.y, (_e147.z * -1f), _e147.w);
    }
    let _e168 = phi_18941_;
    let _e170 = global_4;
    let _e172 = textureSample(global_7, global_8, _e170.xy);
    let _e175 = global_6.member;
    let _e177 = global_6.member_1;
    let _e178 = textureSample(global_10, global_2, _e135);
    let _e182 = normalize(((_e178.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e183 = _e168.yz;
    let _e184 = _e175.xy;
    let _e188 = _e177.xy;
    let _e192 = vec2<f32>((dot(_e183, _e184) + _e175.w), (dot(_e183, _e188) + _e177.w));
    let _e193 = textureSample(global_11, global_9, _e192);
    let _e195 = _e168.xz;
    let _e200 = vec2<f32>((dot(_e195, _e184) + _e175.w), (dot(_e195, _e188) + _e177.w));
    let _e201 = textureSample(global_11, global_9, _e200);
    let _e203 = _e168.yx;
    let _e208 = vec2<f32>((dot(_e203, _e184) + _e175.w), (dot(_e203, _e188) + _e177.w));
    let _e209 = textureSample(global_11, global_9, _e208);
    let _e214 = global_6.member_23;
    let _e226 = mix(mix(_e193.xyzw, _e201.xyzw, vec4((_e214.y * pow(abs(_e182.y), 7f)))), _e209.xyzw, vec4((_e214.z * pow(abs(_e182.z), 7f))));
    phi_11237_ = _e226;
    if _e150 {
        let _e228 = global_6.member_2;
        let _e230 = global_6.member_3;
        let _e231 = textureSample(global_10, global_2, _e135);
        let _e235 = normalize(((_e231.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e236 = _e228.xy;
        let _e240 = _e230.xy;
        let _e245 = textureSample(global_11, global_9, vec2<f32>((dot(_e183, _e236) + _e228.w), (dot(_e183, _e240) + _e230.w)));
        let _e252 = textureSample(global_11, global_9, vec2<f32>((dot(_e195, _e236) + _e228.w), (dot(_e195, _e240) + _e230.w)));
        let _e259 = textureSample(global_11, global_9, vec2<f32>((dot(_e203, _e236) + _e228.w), (dot(_e203, _e240) + _e230.w)));
        let _e275 = global_6.member_4;
        let _e277 = global_6.member_5;
        let _e278 = textureSample(global_10, global_2, _e135);
        let _e282 = normalize(((_e278.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e283 = _e275.xy;
        let _e287 = _e277.xy;
        let _e292 = textureSample(global_11, global_9, vec2<f32>((dot(_e183, _e283) + _e275.w), (dot(_e183, _e287) + _e277.w)));
        let _e299 = textureSample(global_11, global_9, vec2<f32>((dot(_e195, _e283) + _e275.w), (dot(_e195, _e287) + _e277.w)));
        let _e306 = textureSample(global_11, global_9, vec2<f32>((dot(_e203, _e283) + _e275.w), (dot(_e203, _e287) + _e277.w)));
        let _e322 = global_6.member_6;
        let _e324 = global_6.member_7;
        let _e325 = textureSample(global_10, global_2, _e135);
        let _e329 = normalize(((_e325.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e330 = _e322.xy;
        let _e334 = _e324.xy;
        let _e339 = textureSample(global_11, global_9, vec2<f32>((dot(_e183, _e330) + _e322.w), (dot(_e183, _e334) + _e324.w)));
        let _e346 = textureSample(global_11, global_9, vec2<f32>((dot(_e195, _e330) + _e322.w), (dot(_e195, _e334) + _e324.w)));
        let _e353 = textureSample(global_11, global_9, vec2<f32>((dot(_e203, _e330) + _e322.w), (dot(_e203, _e334) + _e324.w)));
        let _e369 = global_6.member_27;
        if (_e369 != 0i) {
            let _e429 = global_6.member_25;
            let _e433 = global_6.member_24;
            let _e439 = smoothstep(_e429.x, _e429.z, pow(((min(_e136.x, _e433) * _e136.y) * 2f), _e429.y));
            let _e441 = global_6.member_26;
            if (_e441.x > _e441.y) {
                let _e467 = (_e226.xyz * _e439);
                let _e473 = vec4<f32>(_e467.x, _e226.y, _e226.z, _e226.w);
                let _e479 = vec4<f32>(_e473.x, _e467.y, _e473.z, _e473.w);
                phi_12502_ = vec4<f32>(_e479.x, _e479.y, _e467.z, _e479.w);
            } else {
                let _e447 = (_e226.xyz * (1f - _e439));
                let _e453 = vec4<f32>(_e447.x, _e226.y, _e226.z, _e226.w);
                let _e459 = vec4<f32>(_e453.x, _e447.y, _e453.z, _e453.w);
                phi_12502_ = vec4<f32>(_e459.x, _e459.y, _e447.z, _e459.w);
            }
            let _e487 = phi_12502_;
            phi_21709_ = _e487;
        } else {
            let _e372 = global_6.member_25;
            let _e379 = smoothstep(_e372.x, _e372.z, pow(((_e136.x * _e136.y) * 2f), _e372.y));
            let _e381 = global_6.member_26;
            if (_e381.x > _e381.y) {
                let _e407 = (_e226.xyz * (1f - _e379));
                let _e413 = vec4<f32>(_e407.x, _e226.y, _e226.z, _e226.w);
                let _e419 = vec4<f32>(_e413.x, _e407.y, _e413.z, _e413.w);
                phi_12501_ = vec4<f32>(_e419.x, _e419.y, _e407.z, _e419.w);
            } else {
                let _e386 = (_e226.xyz * _e379);
                let _e392 = vec4<f32>(_e386.x, _e226.y, _e226.z, _e226.w);
                let _e398 = vec4<f32>(_e392.x, _e386.y, _e392.z, _e392.w);
                phi_12501_ = vec4<f32>(_e398.x, _e398.y, _e386.z, _e398.w);
            }
            let _e427 = phi_12501_;
            phi_21709_ = _e427;
        }
        let _e489 = phi_21709_;
        let _e491 = global_6.member_26;
        let _e499 = smoothstep(vec3(_e491.x), vec3(_e491.y), (_e489.xyz * vec3<f32>(mix(mix(_e245.xyzw, _e252.xyzw, vec4((_e214.y * pow(abs(_e235.y), 7f)))), _e259.xyzw, vec4((_e214.z * pow(abs(_e235.z), 7f)))).w, mix(mix(_e292.xyzw, _e299.xyzw, vec4((_e214.y * pow(abs(_e282.y), 7f)))), _e306.xyzw, vec4((_e214.z * pow(abs(_e282.z), 7f)))).w, mix(mix(_e339.xyzw, _e346.xyzw, vec4((_e214.y * pow(abs(_e329.y), 7f)))), _e353.xyzw, vec4((_e214.z * pow(abs(_e329.z), 7f)))).w)));
        let _e505 = vec4<f32>(_e499.x, _e489.y, _e489.z, _e489.w);
        let _e511 = vec4<f32>(_e505.x, _e499.y, _e505.z, _e505.w);
        phi_11237_ = vec4<f32>(_e511.x, _e511.y, _e499.z, _e511.w);
    }
    let _e519 = phi_11237_;
    let _e523 = global_6.member_22;
    let _e528 = global_6.member_17;
    let _e542 = mix(mix(mix(mix(mix(_e528.x, _e528.y, _e519.x), _e528.z, _e519.y), _e528.w, _e519.z), _e528.z, _e139.y), _e528.w, _e139.z);
    let _e543 = (((_e136.w + (_e172.x * _e136.x)) * ((_e523 * 6f) + 1f)) * _e542);
    let _e545 = global_6.member_11;
    let _e546 = (_e545 * _e542);
    let _e551 = (0.56f - (0.06f * _e523));
    let _e555 = (0.54f - (_e523 * 0.12f));
    let _e565 = (_e519.xyz * vec3<f32>(smoothstep((0.58f + _e546), (_e551 - _e546), _e543), smoothstep((_e551 + _e546), (_e555 - _e546), _e543), smoothstep((_e555 + _e546), ((0.52f - (_e523 * 0.17999999f)) - _e546), _e543)).xyz);
    let _e571 = smoothstep((0.58f - _e546), (0.68f + _e546), _e543);
    let _e580 = textureSample(global_12, global_8, _e170.zw);
    let _e587 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e580, vec4(((pow((1f - _e136.x), 4f) * 0.25f) + (0.75f * _e523))));
    let _e589 = global_6.member_21;
    let _e598 = mix(mix(mix(mix(mix(_e589.x, _e589.y, _e565.x), _e589.z, _e565.y), _e589.w, _e565.z), _e589.z, _e139.y), _e589.w, _e139.z);
    let _e600 = global_6.member_8;
    phi_7078_ = vec4<f32>(_e133, 0f, 1f);
    if (_e600 != 0i) {
        let _e602 = textureSample(global_13, global_2, _e135);
        let _e610 = global_6.member_10;
        if (_e610 != 0i) {
            let _e614 = textureSample(global_10, global_2, _e135);
            let _e618 = normalize(((_e614.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e619 = textureSample(global_14, global_8, _e192);
            let _e621 = textureSample(global_14, global_8, _e200);
            let _e623 = textureSample(global_14, global_8, _e208);
            phi_21710_ = mix(mix(_e619.xyzw, _e621.xyzw, vec4((_e214.y * pow(abs(_e618.y), 7f)))), _e623.xyzw, vec4((_e214.z * pow(abs(_e618.z), 7f)))).x;
        } else {
            let _e612 = textureSample(global_14, global_8, _e135);
            phi_21710_ = _e612.x;
        }
        let _e639 = phi_21710_;
        let _e641 = global_6.member_18;
        let _e642 = (_e641 != 0i);
        phi_12885_ = _e639;
        if _e642 {
            let _e644 = global_6.member_19;
            phi_12885_ = mix(mix(mix(_e644.x, _e644.y, _e565.x), _e644.z, _e565.y), _e644.w, _e565.z);
        }
        let _e653 = phi_12885_;
        phi_20271_ = _e653;
        if _e642 {
            let _e655 = global_6.member_19;
            phi_20271_ = mix(mix(_e653, _e655.z, _e139.y), _e655.w, _e139.z);
        }
        let _e661 = phi_20271_;
        let _e671 = mix(vec4<f32>(min(1f, (_e661 + ((((1f - _e587.w) * _e523) * _e523) * 0.5f))), _e598, 0f, 1f), vec4<f32>(_e602.x, _e602.y, _e602.z, _e602.w), vec4(_e571));
        let _e672 = (1f - _e571);
        let _e679 = global_6.member_20;
        let _e681 = vec4<f32>(_e671.x, _e671.y, _e672, _e671.w).xyz;
        let _e682 = (_e681 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e685 = pow(((_e681 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e671.x <= 0.04045f) {
            phi_21354_ = _e682.x;
        } else {
            phi_21354_ = _e685.x;
        }
        let _e691 = phi_21354_;
        if (_e671.y <= 0.04045f) {
            phi_23035_ = _e682.y;
        } else {
            phi_23035_ = _e685.y;
        }
        let _e697 = phi_23035_;
        if (_e672 <= 0.04045f) {
            phi_19513_ = _e682.z;
        } else {
            phi_19513_ = _e685.z;
        }
        let _e702 = phi_19513_;
        let _e703 = vec4<f32>(_e691, _e697, _e672, min(1f, _e679));
        phi_7078_ = vec4<f32>(_e703.x, _e703.y, _e702, _e703.w);
    }
    let _e710 = phi_7078_;
    phi_22401_ = _e710;
    if (_e600 == 0i) {
        let _e712 = textureSample(global_15, global_2, _e135);
        let _e715 = global_6.member_12;
        let _e717 = global_6.member_13;
        let _e721 = global_6.member_14;
        let _e725 = global_6.member_15;
        let _e732 = global_6.member_16;
        let _e735 = clamp((mix(mix(mix(mix(mix(_e715, _e717, vec3(_e565.x)), _e721, vec3(_e565.y)), _e725, vec3(_e565.z)), _e721, vec3(_e139.y)), _e725, vec3(_e139.z)) * mix(_e732, 1f, (smoothstep(0f, 0.01f, _e571) * (1f - (smoothstep(0.5f, 0.6f, _e519.w) * smoothstep(1f, 0.9f, _e519.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e738 = (_e735.xyz * _e587.xyz);
        let _e743 = global_6.member_28;
        let _e745 = global_6.member_29;
        let _e748 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e738.xyz));
        let _e756 = mix(_e743.xyz, _e745.xyz, vec3(_e598));
        let _e778 = mix(mix(_e738, ((_e748.xyz * mix(min(_e756.x, dot(_e735.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e756.z, clamp(pow(max(_e738.x, max(_e738.y, _e738.z)), _e756.y), 0f, 1f))) / vec3(max(_e748.x, max(_e748.y, _e748.z)))).xyz, vec3(_e523)), _e712.xyz, vec3(_e571));
        phi_22401_ = vec4<f32>(_e778.x, _e778.y, _e778.z, 1f);
    }
    let _e784 = phi_22401_;
    let _e785 = textureSample(global_16, global_8, _e135);
    phi_6805_ = _e784;
    if (_e785.w < 0f) {
        let _e793 = vec4<f32>(_e785.x, _e784.y, _e784.z, _e784.w);
        let _e799 = vec4<f32>(_e793.x, _e785.y, _e793.z, _e793.w);
        phi_6805_ = vec4<f32>(_e799.x, _e799.y, _e785.z, _e799.w);
    }
    let _e807 = phi_6805_;
    global_17 = _e807;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_17;
    return _e5;
}
