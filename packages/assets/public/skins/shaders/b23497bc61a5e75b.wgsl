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
var<private> global_3: vec4<f32>;
@group(1) @binding(33) 
var global_4: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_5: type_12;
@group(1) @binding(40) 
var global_6: texture_2d<f32>;
@group(1) @binding(22) 
var global_7: sampler;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(32) 
var global_9: texture_2d<f32>;
@group(1) @binding(39) 
var global_10: texture_2d<f32>;
@group(1) @binding(41) 
var global_11: texture_2d<f32>;
@group(1) @binding(35) 
var global_12: texture_2d<f32>;
@group(1) @binding(36) 
var global_13: texture_2d<f32>;
@group(1) @binding(37) 
var global_14: texture_2d<f32>;
@group(1) @binding(34) 
var global_15: texture_2d<f32>;
@group(1) @binding(38) 
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
    var phi_20271_: f32;
    var phi_21711_: vec4<f32>;
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_22686_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e133 = global;
    let _e134 = _e133.xy;
    let _e136 = _e133.xy;
    let _e137 = textureSample(global_1, global_2, _e136);
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
        let _e156 = textureSample(global_4, global_2, (_e134 + (_e152 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e141 + (_e156 * 0.05882353f));
            phi_16208_ = (_e143 + 1i);
        }
    }
    let _e146 = local_1;
    let _e147 = (_e146 * 2f);
    let _e149 = global_5.member_9;
    let _e150 = (_e149 != 0i);
    phi_18941_ = _e147;
    if _e150 {
        phi_18941_ = vec4<f32>(_e147.x, _e147.y, (_e147.z * -1f), _e147.w);
    }
    let _e168 = phi_18941_;
    let _e170 = global_3;
    let _e172 = textureSample(global_6, global_7, _e170.xy);
    let _e175 = global_5.member;
    let _e177 = global_5.member_1;
    let _e178 = textureSample(global_9, global_2, _e136);
    let _e182 = normalize(((_e178.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e183 = _e168.yz;
    let _e184 = _e175.xy;
    let _e188 = _e177.xy;
    let _e192 = vec2<f32>((dot(_e183, _e184) + _e175.w), (dot(_e183, _e188) + _e177.w));
    let _e193 = textureSample(global_10, global_8, _e192);
    let _e195 = _e168.xz;
    let _e200 = vec2<f32>((dot(_e195, _e184) + _e175.w), (dot(_e195, _e188) + _e177.w));
    let _e201 = textureSample(global_10, global_8, _e200);
    let _e203 = _e168.yx;
    let _e208 = vec2<f32>((dot(_e203, _e184) + _e175.w), (dot(_e203, _e188) + _e177.w));
    let _e209 = textureSample(global_10, global_8, _e208);
    let _e214 = global_5.member_24;
    let _e226 = mix(mix(_e193.xyzw, _e201.xyzw, vec4((_e214.y * pow(abs(_e182.y), 7f)))), _e209.xyzw, vec4((_e214.z * pow(abs(_e182.z), 7f))));
    phi_11237_ = _e226;
    if _e150 {
        let _e228 = global_5.member_2;
        let _e230 = global_5.member_3;
        let _e231 = textureSample(global_9, global_2, _e136);
        let _e235 = normalize(((_e231.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e236 = _e228.xy;
        let _e240 = _e230.xy;
        let _e245 = textureSample(global_10, global_8, vec2<f32>((dot(_e183, _e236) + _e228.w), (dot(_e183, _e240) + _e230.w)));
        let _e252 = textureSample(global_10, global_8, vec2<f32>((dot(_e195, _e236) + _e228.w), (dot(_e195, _e240) + _e230.w)));
        let _e259 = textureSample(global_10, global_8, vec2<f32>((dot(_e203, _e236) + _e228.w), (dot(_e203, _e240) + _e230.w)));
        let _e275 = global_5.member_4;
        let _e277 = global_5.member_5;
        let _e278 = textureSample(global_9, global_2, _e136);
        let _e282 = normalize(((_e278.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e283 = _e275.xy;
        let _e287 = _e277.xy;
        let _e292 = textureSample(global_10, global_8, vec2<f32>((dot(_e183, _e283) + _e275.w), (dot(_e183, _e287) + _e277.w)));
        let _e299 = textureSample(global_10, global_8, vec2<f32>((dot(_e195, _e283) + _e275.w), (dot(_e195, _e287) + _e277.w)));
        let _e306 = textureSample(global_10, global_8, vec2<f32>((dot(_e203, _e283) + _e275.w), (dot(_e203, _e287) + _e277.w)));
        let _e322 = global_5.member_6;
        let _e324 = global_5.member_7;
        let _e325 = textureSample(global_9, global_2, _e136);
        let _e329 = normalize(((_e325.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e330 = _e322.xy;
        let _e334 = _e324.xy;
        let _e339 = textureSample(global_10, global_8, vec2<f32>((dot(_e183, _e330) + _e322.w), (dot(_e183, _e334) + _e324.w)));
        let _e346 = textureSample(global_10, global_8, vec2<f32>((dot(_e195, _e330) + _e322.w), (dot(_e195, _e334) + _e324.w)));
        let _e353 = textureSample(global_10, global_8, vec2<f32>((dot(_e203, _e330) + _e322.w), (dot(_e203, _e334) + _e324.w)));
        let _e369 = global_5.member_28;
        if (_e369 != 0i) {
            let _e429 = global_5.member_26;
            let _e433 = global_5.member_25;
            let _e439 = smoothstep(_e429.x, _e429.z, pow(((min(_e137.x, _e433) * _e137.y) * 2f), _e429.y));
            let _e441 = global_5.member_27;
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
            let _e372 = global_5.member_26;
            let _e379 = smoothstep(_e372.x, _e372.z, pow(((_e137.x * _e137.y) * 2f), _e372.y));
            let _e381 = global_5.member_27;
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
        let _e491 = global_5.member_27;
        let _e499 = smoothstep(vec3(_e491.x), vec3(_e491.y), (_e489.xyz * vec3<f32>(mix(mix(_e245.xyzw, _e252.xyzw, vec4((_e214.y * pow(abs(_e235.y), 7f)))), _e259.xyzw, vec4((_e214.z * pow(abs(_e235.z), 7f)))).w, mix(mix(_e292.xyzw, _e299.xyzw, vec4((_e214.y * pow(abs(_e282.y), 7f)))), _e306.xyzw, vec4((_e214.z * pow(abs(_e282.z), 7f)))).w, mix(mix(_e339.xyzw, _e346.xyzw, vec4((_e214.y * pow(abs(_e329.y), 7f)))), _e353.xyzw, vec4((_e214.z * pow(abs(_e329.z), 7f)))).w)));
        let _e505 = vec4<f32>(_e499.x, _e489.y, _e489.z, _e489.w);
        let _e511 = vec4<f32>(_e505.x, _e499.y, _e505.z, _e505.w);
        phi_11237_ = vec4<f32>(_e511.x, _e511.y, _e499.z, _e511.w);
    }
    let _e519 = phi_11237_;
    let _e523 = global_5.member_23;
    let _e528 = global_5.member_18;
    let _e538 = mix(mix(mix(_e528.x, _e528.y, _e519.x), _e528.z, _e519.y), _e528.w, _e519.z);
    let _e539 = (((_e137.w + (_e172.x * _e137.x)) * ((_e523 * 6f) + 1f)) * _e538);
    let _e541 = global_5.member_12;
    let _e542 = (_e541 * _e538);
    let _e547 = (0.56f - (0.06f * _e523));
    let _e551 = (0.54f - (_e523 * 0.12f));
    let _e561 = (_e519.xyz * vec3<f32>(smoothstep((0.58f + _e542), (_e547 - _e542), _e539), smoothstep((_e547 + _e542), (_e551 - _e542), _e539), smoothstep((_e551 + _e542), ((0.52f - (_e523 * 0.17999999f)) - _e542), _e539)).xyz);
    let _e567 = smoothstep((0.58f - _e542), (0.68f + _e542), _e539);
    let _e576 = textureSample(global_11, global_7, _e170.zw);
    let _e583 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e576, vec4(((pow((1f - _e137.x), 4f) * 0.25f) + (0.75f * _e523))));
    let _e585 = global_5.member_22;
    let _e592 = mix(mix(mix(_e585.x, _e585.y, _e561.x), _e585.z, _e561.y), _e585.w, _e561.z);
    let _e594 = global_5.member_8;
    phi_7078_ = vec4<f32>(_e134, 0f, 1f);
    if (_e594 != 0i) {
        let _e596 = textureSample(global_12, global_2, _e136);
        let _e604 = global_5.member_10;
        if (_e604 != 0i) {
            let _e608 = textureSample(global_9, global_2, _e136);
            let _e612 = normalize(((_e608.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e613 = textureSample(global_13, global_7, _e192);
            let _e615 = textureSample(global_13, global_7, _e200);
            let _e617 = textureSample(global_13, global_7, _e208);
            phi_21710_ = mix(mix(_e613.xyzw, _e615.xyzw, vec4((_e214.y * pow(abs(_e612.y), 7f)))), _e617.xyzw, vec4((_e214.z * pow(abs(_e612.z), 7f)))).x;
        } else {
            let _e606 = textureSample(global_13, global_7, _e136);
            phi_21710_ = _e606.x;
        }
        let _e633 = phi_21710_;
        let _e635 = global_5.member_19;
        phi_20271_ = _e633;
        if (_e635 != 0i) {
            let _e638 = global_5.member_20;
            phi_20271_ = mix(mix(mix(_e638.x, _e638.y, _e561.x), _e638.z, _e561.y), _e638.w, _e561.z);
        }
        let _e647 = phi_20271_;
        let _e657 = mix(vec4<f32>(min(1f, (_e647 + ((((1f - _e583.w) * _e523) * _e523) * 0.5f))), _e592, 0f, 1f), vec4<f32>(_e596.x, _e596.y, _e596.z, _e596.w), vec4(_e567));
        let _e658 = (1f - _e567);
        let _e660 = global_5.member_11;
        if (_e660 != 0i) {
            let _e671 = textureSample(global_9, global_2, _e136);
            let _e675 = normalize(((_e671.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
            let _e676 = textureSample(global_14, global_7, _e192);
            let _e678 = textureSample(global_14, global_7, _e200);
            let _e680 = textureSample(global_14, global_7, _e208);
            phi_21711_ = vec4<f32>(_e657.x, _e657.y, (_e658 * mix(mix(_e676.xyzw, _e678.xyzw, vec4((_e214.y * pow(abs(_e675.y), 7f)))), _e680.xyzw, vec4((_e214.z * pow(abs(_e675.z), 7f)))).x), _e657.w);
        } else {
            let _e662 = textureSample(global_14, global_7, _e136);
            let _e664 = (_e658 * _e662.x);
            phi_21711_ = vec4<f32>(_e657.x, _e657.y, (_e664 * _e664), _e657.w);
        }
        let _e702 = phi_21711_;
        let _e704 = global_5.member_21;
        let _e706 = _e702.xyz;
        let _e707 = (_e706 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e710 = pow(((_e706 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e702.x <= 0.04045f) {
            phi_21354_ = _e707.x;
        } else {
            phi_21354_ = _e710.x;
        }
        let _e716 = phi_21354_;
        if (_e702.y <= 0.04045f) {
            phi_21355_ = _e707.y;
        } else {
            phi_21355_ = _e710.y;
        }
        let _e722 = phi_21355_;
        if (_e702.z <= 0.04045f) {
            phi_22686_ = _e707.z;
        } else {
            phi_22686_ = _e710.z;
        }
        let _e728 = phi_22686_;
        phi_7078_ = vec4<f32>(_e716, _e722, _e728, min(1f, _e704));
    }
    let _e731 = phi_7078_;
    phi_22401_ = _e731;
    if (_e594 == 0i) {
        let _e733 = textureSample(global_15, global_2, _e136);
        let _e736 = global_5.member_13;
        let _e738 = global_5.member_14;
        let _e742 = global_5.member_15;
        let _e746 = global_5.member_16;
        let _e749 = global_5.member_17;
        let _e752 = clamp((mix(mix(mix(_e736, _e738, vec3(_e561.x)), _e742, vec3(_e561.y)), _e746, vec3(_e561.z)) * mix(_e749, 1f, (smoothstep(0f, 0.01f, _e567) * (1f - (smoothstep(0.5f, 0.6f, _e519.w) * smoothstep(1f, 0.9f, _e519.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e755 = (_e752.xyz * _e583.xyz);
        let _e760 = global_5.member_29;
        let _e762 = global_5.member_30;
        let _e765 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e755.xyz));
        let _e773 = mix(_e760.xyz, _e762.xyz, vec3(_e592));
        let _e795 = mix(mix(_e755, ((_e765.xyz * mix(min(_e773.x, dot(_e752.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e773.z, clamp(pow(max(_e755.x, max(_e755.y, _e755.z)), _e773.y), 0f, 1f))) / vec3(max(_e765.x, max(_e765.y, _e765.z)))).xyz, vec3(_e523)), _e733.xyz, vec3(_e567));
        phi_22401_ = vec4<f32>(_e795.x, _e795.y, _e795.z, 1f);
    }
    let _e801 = phi_22401_;
    let _e802 = textureSample(global_16, global_7, _e136);
    phi_6805_ = _e801;
    if (_e802.w < 0f) {
        let _e810 = vec4<f32>(_e802.x, _e801.y, _e801.z, _e801.w);
        let _e816 = vec4<f32>(_e810.x, _e802.y, _e810.z, _e810.w);
        phi_6805_ = vec4<f32>(_e816.x, _e816.y, _e802.z, _e816.w);
    }
    let _e824 = phi_6805_;
    global_17 = _e824;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_17;
    return _e5;
}
