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
    member_15: f32,
    member_16: vec4<f32>,
    member_17: f32,
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
@group(1) @binding(38) 
var global_6: texture_2d<f32>;
@group(1) @binding(22) 
var global_7: sampler;
@group(1) @binding(27) 
var global_8: sampler;
@group(1) @binding(32) 
var global_9: texture_2d<f32>;
@group(1) @binding(37) 
var global_10: texture_2d<f32>;
@group(1) @binding(39) 
var global_11: texture_2d<f32>;
@group(1) @binding(35) 
var global_12: texture_2d<f32>;
@group(1) @binding(34) 
var global_13: texture_2d<f32>;
@group(1) @binding(36) 
var global_14: texture_2d<f32>;
var<private> global_15: vec4<f32>;

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
    var phi_20271_: f32;
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
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e138 = phi_13155_;
        let _e140 = phi_16208_;
        local_1 = _e138;
        if (_e140 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e149 = local[_e140];
        let _e153 = textureSample(global_4, global_2, (_e131 + (_e149 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e138 + (_e153 * 0.05882353f));
            phi_16208_ = (_e140 + 1i);
        }
    }
    let _e143 = local_1;
    let _e144 = (_e143 * 2f);
    let _e146 = global_5.member_9;
    let _e147 = (_e146 != 0i);
    phi_18941_ = _e144;
    if _e147 {
        phi_18941_ = vec4<f32>(_e144.x, _e144.y, (_e144.z * -1f), _e144.w);
    }
    let _e165 = phi_18941_;
    let _e167 = global_3;
    let _e169 = textureSample(global_6, global_7, _e167.xy);
    let _e172 = global_5.member;
    let _e174 = global_5.member_1;
    let _e175 = textureSample(global_9, global_2, _e133);
    let _e179 = normalize(((_e175.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e180 = _e165.yz;
    let _e181 = _e172.xy;
    let _e185 = _e174.xy;
    let _e190 = textureSample(global_10, global_8, vec2<f32>((dot(_e180, _e181) + _e172.w), (dot(_e180, _e185) + _e174.w)));
    let _e192 = _e165.xz;
    let _e198 = textureSample(global_10, global_8, vec2<f32>((dot(_e192, _e181) + _e172.w), (dot(_e192, _e185) + _e174.w)));
    let _e200 = _e165.yx;
    let _e206 = textureSample(global_10, global_8, vec2<f32>((dot(_e200, _e181) + _e172.w), (dot(_e200, _e185) + _e174.w)));
    let _e211 = global_5.member_23;
    let _e223 = mix(mix(_e190.xyzw, _e198.xyzw, vec4((_e211.y * pow(abs(_e179.y), 7f)))), _e206.xyzw, vec4((_e211.z * pow(abs(_e179.z), 7f))));
    phi_11237_ = _e223;
    if _e147 {
        let _e225 = global_5.member_2;
        let _e227 = global_5.member_3;
        let _e228 = textureSample(global_9, global_2, _e133);
        let _e232 = normalize(((_e228.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e233 = _e225.xy;
        let _e237 = _e227.xy;
        let _e242 = textureSample(global_10, global_8, vec2<f32>((dot(_e180, _e233) + _e225.w), (dot(_e180, _e237) + _e227.w)));
        let _e249 = textureSample(global_10, global_8, vec2<f32>((dot(_e192, _e233) + _e225.w), (dot(_e192, _e237) + _e227.w)));
        let _e256 = textureSample(global_10, global_8, vec2<f32>((dot(_e200, _e233) + _e225.w), (dot(_e200, _e237) + _e227.w)));
        let _e272 = global_5.member_4;
        let _e274 = global_5.member_5;
        let _e275 = textureSample(global_9, global_2, _e133);
        let _e279 = normalize(((_e275.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e280 = _e272.xy;
        let _e284 = _e274.xy;
        let _e289 = textureSample(global_10, global_8, vec2<f32>((dot(_e180, _e280) + _e272.w), (dot(_e180, _e284) + _e274.w)));
        let _e296 = textureSample(global_10, global_8, vec2<f32>((dot(_e192, _e280) + _e272.w), (dot(_e192, _e284) + _e274.w)));
        let _e303 = textureSample(global_10, global_8, vec2<f32>((dot(_e200, _e280) + _e272.w), (dot(_e200, _e284) + _e274.w)));
        let _e319 = global_5.member_6;
        let _e321 = global_5.member_7;
        let _e322 = textureSample(global_9, global_2, _e133);
        let _e326 = normalize(((_e322.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e327 = _e319.xy;
        let _e331 = _e321.xy;
        let _e336 = textureSample(global_10, global_8, vec2<f32>((dot(_e180, _e327) + _e319.w), (dot(_e180, _e331) + _e321.w)));
        let _e343 = textureSample(global_10, global_8, vec2<f32>((dot(_e192, _e327) + _e319.w), (dot(_e192, _e331) + _e321.w)));
        let _e350 = textureSample(global_10, global_8, vec2<f32>((dot(_e200, _e327) + _e319.w), (dot(_e200, _e331) + _e321.w)));
        let _e366 = global_5.member_27;
        if (_e366 != 0i) {
            let _e426 = global_5.member_25;
            let _e430 = global_5.member_24;
            let _e436 = smoothstep(_e426.x, _e426.z, pow(((min(_e134.x, _e430) * _e134.y) * 2f), _e426.y));
            let _e438 = global_5.member_26;
            if (_e438.x > _e438.y) {
                let _e464 = (_e223.xyz * _e436);
                let _e470 = vec4<f32>(_e464.x, _e223.y, _e223.z, _e223.w);
                let _e476 = vec4<f32>(_e470.x, _e464.y, _e470.z, _e470.w);
                phi_12502_ = vec4<f32>(_e476.x, _e476.y, _e464.z, _e476.w);
            } else {
                let _e444 = (_e223.xyz * (1f - _e436));
                let _e450 = vec4<f32>(_e444.x, _e223.y, _e223.z, _e223.w);
                let _e456 = vec4<f32>(_e450.x, _e444.y, _e450.z, _e450.w);
                phi_12502_ = vec4<f32>(_e456.x, _e456.y, _e444.z, _e456.w);
            }
            let _e484 = phi_12502_;
            phi_21709_ = _e484;
        } else {
            let _e369 = global_5.member_25;
            let _e376 = smoothstep(_e369.x, _e369.z, pow(((_e134.x * _e134.y) * 2f), _e369.y));
            let _e378 = global_5.member_26;
            if (_e378.x > _e378.y) {
                let _e404 = (_e223.xyz * (1f - _e376));
                let _e410 = vec4<f32>(_e404.x, _e223.y, _e223.z, _e223.w);
                let _e416 = vec4<f32>(_e410.x, _e404.y, _e410.z, _e410.w);
                phi_12501_ = vec4<f32>(_e416.x, _e416.y, _e404.z, _e416.w);
            } else {
                let _e383 = (_e223.xyz * _e376);
                let _e389 = vec4<f32>(_e383.x, _e223.y, _e223.z, _e223.w);
                let _e395 = vec4<f32>(_e389.x, _e383.y, _e389.z, _e389.w);
                phi_12501_ = vec4<f32>(_e395.x, _e395.y, _e383.z, _e395.w);
            }
            let _e424 = phi_12501_;
            phi_21709_ = _e424;
        }
        let _e486 = phi_21709_;
        let _e488 = global_5.member_26;
        let _e496 = smoothstep(vec3(_e488.x), vec3(_e488.y), (_e486.xyz * vec3<f32>(mix(mix(_e242.xyzw, _e249.xyzw, vec4((_e211.y * pow(abs(_e232.y), 7f)))), _e256.xyzw, vec4((_e211.z * pow(abs(_e232.z), 7f)))).w, mix(mix(_e289.xyzw, _e296.xyzw, vec4((_e211.y * pow(abs(_e279.y), 7f)))), _e303.xyzw, vec4((_e211.z * pow(abs(_e279.z), 7f)))).w, mix(mix(_e336.xyzw, _e343.xyzw, vec4((_e211.y * pow(abs(_e326.y), 7f)))), _e350.xyzw, vec4((_e211.z * pow(abs(_e326.z), 7f)))).w)));
        let _e502 = vec4<f32>(_e496.x, _e486.y, _e486.z, _e486.w);
        let _e508 = vec4<f32>(_e502.x, _e496.y, _e502.z, _e502.w);
        phi_11237_ = vec4<f32>(_e508.x, _e508.y, _e496.z, _e508.w);
    }
    let _e516 = phi_11237_;
    let _e520 = global_5.member_22;
    let _e525 = global_5.member_16;
    let _e535 = mix(mix(mix(_e525.x, _e525.y, _e516.x), _e525.z, _e516.y), _e525.w, _e516.z);
    let _e536 = (((_e134.w + (_e169.x * _e134.x)) * ((_e520 * 6f) + 1f)) * _e535);
    let _e538 = global_5.member_10;
    let _e539 = (_e538 * _e535);
    let _e544 = (0.56f - (0.06f * _e520));
    let _e548 = (0.54f - (_e520 * 0.12f));
    let _e558 = (_e516.xyz * vec3<f32>(smoothstep((0.58f + _e539), (_e544 - _e539), _e536), smoothstep((_e544 + _e539), (_e548 - _e539), _e536), smoothstep((_e548 + _e539), ((0.52f - (_e520 * 0.17999999f)) - _e539), _e536)).xyz);
    let _e564 = smoothstep((0.58f - _e539), (0.68f + _e539), _e536);
    let _e573 = textureSample(global_11, global_7, _e167.zw);
    let _e580 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e573, vec4(((pow((1f - _e134.x), 4f) * 0.25f) + (0.75f * _e520))));
    let _e582 = global_5.member_21;
    let _e589 = mix(mix(mix(_e582.x, _e582.y, _e558.x), _e582.z, _e558.y), _e582.w, _e558.z);
    let _e591 = global_5.member_8;
    phi_7078_ = vec4<f32>(_e131, 0f, 1f);
    if (_e591 != 0i) {
        let _e593 = textureSample(global_12, global_2, _e133);
        let _e601 = global_5.member_18;
        if (_e601 != 0i) {
            let _e606 = global_5.member_19;
            phi_20271_ = mix(mix(mix(_e606.x, _e606.y, _e558.x), _e606.z, _e558.y), _e606.w, _e558.z);
        } else {
            let _e604 = global_5.member_17;
            phi_20271_ = _e604;
        }
        let _e615 = phi_20271_;
        let _e625 = mix(vec4<f32>(min(1f, (_e615 + ((((1f - _e580.w) * _e520) * _e520) * 0.5f))), _e589, 0f, 1f), vec4<f32>(_e593.x, _e593.y, _e593.z, _e593.w), vec4(_e564));
        let _e626 = (1f - _e564);
        let _e633 = global_5.member_20;
        let _e635 = vec4<f32>(_e625.x, _e625.y, _e626, _e625.w).xyz;
        let _e636 = (_e635 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e639 = pow(((_e635 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e625.x <= 0.04045f) {
            phi_21354_ = _e636.x;
        } else {
            phi_21354_ = _e639.x;
        }
        let _e645 = phi_21354_;
        if (_e625.y <= 0.04045f) {
            phi_23035_ = _e636.y;
        } else {
            phi_23035_ = _e639.y;
        }
        let _e651 = phi_23035_;
        if (_e626 <= 0.04045f) {
            phi_19513_ = _e636.z;
        } else {
            phi_19513_ = _e639.z;
        }
        let _e656 = phi_19513_;
        let _e657 = vec4<f32>(_e645, _e651, _e626, min(1f, _e633));
        phi_7078_ = vec4<f32>(_e657.x, _e657.y, _e656, _e657.w);
    }
    let _e664 = phi_7078_;
    phi_22401_ = _e664;
    if (_e591 == 0i) {
        let _e666 = textureSample(global_13, global_2, _e133);
        let _e669 = global_5.member_11;
        let _e671 = global_5.member_12;
        let _e675 = global_5.member_13;
        let _e679 = global_5.member_14;
        let _e682 = global_5.member_15;
        let _e685 = clamp((mix(mix(mix(_e669, _e671, vec3(_e558.x)), _e675, vec3(_e558.y)), _e679, vec3(_e558.z)) * mix(_e682, 1f, (smoothstep(0f, 0.01f, _e564) * (1f - (smoothstep(0.5f, 0.6f, _e516.w) * smoothstep(1f, 0.9f, _e516.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e688 = (_e685.xyz * _e580.xyz);
        let _e693 = global_5.member_28;
        let _e695 = global_5.member_29;
        let _e698 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e688.xyz));
        let _e706 = mix(_e693.xyz, _e695.xyz, vec3(_e589));
        let _e728 = mix(mix(_e688, ((_e698.xyz * mix(min(_e706.x, dot(_e685.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e706.z, clamp(pow(max(_e688.x, max(_e688.y, _e688.z)), _e706.y), 0f, 1f))) / vec3(max(_e698.x, max(_e698.y, _e698.z)))).xyz, vec3(_e520)), _e666.xyz, vec3(_e564));
        phi_22401_ = vec4<f32>(_e728.x, _e728.y, _e728.z, 1f);
    }
    let _e734 = phi_22401_;
    let _e735 = textureSample(global_14, global_7, _e133);
    phi_6805_ = _e734;
    if (_e735.w < 0f) {
        let _e743 = vec4<f32>(_e735.x, _e734.y, _e734.z, _e734.w);
        let _e749 = vec4<f32>(_e743.x, _e735.y, _e743.z, _e743.w);
        phi_6805_ = vec4<f32>(_e749.x, _e749.y, _e735.z, _e749.w);
    }
    let _e757 = phi_6805_;
    global_15 = _e757;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    function_();
    let _e5 = global_15;
    return _e5;
}
