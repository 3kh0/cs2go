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
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(33) 
var global_5: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_6: type_12;
@group(1) @binding(38) 
var global_7: texture_2d<f32>;
@group(1) @binding(22) 
var global_8: sampler;
@group(1) @binding(27) 
var global_9: sampler;
@group(1) @binding(32) 
var global_10: texture_2d<f32>;
@group(1) @binding(37) 
var global_11: texture_2d<f32>;
@group(1) @binding(39) 
var global_12: texture_2d<f32>;
@group(1) @binding(35) 
var global_13: texture_2d<f32>;
@group(1) @binding(34) 
var global_14: texture_2d<f32>;
@group(1) @binding(36) 
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
    var phi_12885_: f32;
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
    let _e138 = textureSample(global_3, global_2, _e134);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e140 = phi_13155_;
        let _e142 = phi_16208_;
        local_1 = _e140;
        if (_e142 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e151 = local[_e142];
        let _e155 = textureSample(global_5, global_2, (_e132 + (_e151 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e140 + (_e155 * 0.05882353f));
            phi_16208_ = (_e142 + 1i);
        }
    }
    let _e145 = local_1;
    let _e146 = (_e145 * 2f);
    let _e148 = global_6.member_9;
    let _e149 = (_e148 != 0i);
    phi_18941_ = _e146;
    if _e149 {
        phi_18941_ = vec4<f32>(_e146.x, _e146.y, (_e146.z * -1f), _e146.w);
    }
    let _e167 = phi_18941_;
    let _e169 = global_4;
    let _e171 = textureSample(global_7, global_8, _e169.xy);
    let _e174 = global_6.member;
    let _e176 = global_6.member_1;
    let _e177 = textureSample(global_10, global_2, _e134);
    let _e181 = normalize(((_e177.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e182 = _e167.yz;
    let _e183 = _e174.xy;
    let _e187 = _e176.xy;
    let _e192 = textureSample(global_11, global_9, vec2<f32>((dot(_e182, _e183) + _e174.w), (dot(_e182, _e187) + _e176.w)));
    let _e194 = _e167.xz;
    let _e200 = textureSample(global_11, global_9, vec2<f32>((dot(_e194, _e183) + _e174.w), (dot(_e194, _e187) + _e176.w)));
    let _e202 = _e167.yx;
    let _e208 = textureSample(global_11, global_9, vec2<f32>((dot(_e202, _e183) + _e174.w), (dot(_e202, _e187) + _e176.w)));
    let _e213 = global_6.member_23;
    let _e225 = mix(mix(_e192.xyzw, _e200.xyzw, vec4((_e213.y * pow(abs(_e181.y), 7f)))), _e208.xyzw, vec4((_e213.z * pow(abs(_e181.z), 7f))));
    phi_11237_ = _e225;
    if _e149 {
        let _e227 = global_6.member_2;
        let _e229 = global_6.member_3;
        let _e230 = textureSample(global_10, global_2, _e134);
        let _e234 = normalize(((_e230.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e235 = _e227.xy;
        let _e239 = _e229.xy;
        let _e244 = textureSample(global_11, global_9, vec2<f32>((dot(_e182, _e235) + _e227.w), (dot(_e182, _e239) + _e229.w)));
        let _e251 = textureSample(global_11, global_9, vec2<f32>((dot(_e194, _e235) + _e227.w), (dot(_e194, _e239) + _e229.w)));
        let _e258 = textureSample(global_11, global_9, vec2<f32>((dot(_e202, _e235) + _e227.w), (dot(_e202, _e239) + _e229.w)));
        let _e274 = global_6.member_4;
        let _e276 = global_6.member_5;
        let _e277 = textureSample(global_10, global_2, _e134);
        let _e281 = normalize(((_e277.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e282 = _e274.xy;
        let _e286 = _e276.xy;
        let _e291 = textureSample(global_11, global_9, vec2<f32>((dot(_e182, _e282) + _e274.w), (dot(_e182, _e286) + _e276.w)));
        let _e298 = textureSample(global_11, global_9, vec2<f32>((dot(_e194, _e282) + _e274.w), (dot(_e194, _e286) + _e276.w)));
        let _e305 = textureSample(global_11, global_9, vec2<f32>((dot(_e202, _e282) + _e274.w), (dot(_e202, _e286) + _e276.w)));
        let _e321 = global_6.member_6;
        let _e323 = global_6.member_7;
        let _e324 = textureSample(global_10, global_2, _e134);
        let _e328 = normalize(((_e324.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e329 = _e321.xy;
        let _e333 = _e323.xy;
        let _e338 = textureSample(global_11, global_9, vec2<f32>((dot(_e182, _e329) + _e321.w), (dot(_e182, _e333) + _e323.w)));
        let _e345 = textureSample(global_11, global_9, vec2<f32>((dot(_e194, _e329) + _e321.w), (dot(_e194, _e333) + _e323.w)));
        let _e352 = textureSample(global_11, global_9, vec2<f32>((dot(_e202, _e329) + _e321.w), (dot(_e202, _e333) + _e323.w)));
        let _e368 = global_6.member_27;
        if (_e368 != 0i) {
            let _e428 = global_6.member_25;
            let _e432 = global_6.member_24;
            let _e438 = smoothstep(_e428.x, _e428.z, pow(((min(_e135.x, _e432) * _e135.y) * 2f), _e428.y));
            let _e440 = global_6.member_26;
            if (_e440.x > _e440.y) {
                let _e466 = (_e225.xyz * _e438);
                let _e472 = vec4<f32>(_e466.x, _e225.y, _e225.z, _e225.w);
                let _e478 = vec4<f32>(_e472.x, _e466.y, _e472.z, _e472.w);
                phi_12502_ = vec4<f32>(_e478.x, _e478.y, _e466.z, _e478.w);
            } else {
                let _e446 = (_e225.xyz * (1f - _e438));
                let _e452 = vec4<f32>(_e446.x, _e225.y, _e225.z, _e225.w);
                let _e458 = vec4<f32>(_e452.x, _e446.y, _e452.z, _e452.w);
                phi_12502_ = vec4<f32>(_e458.x, _e458.y, _e446.z, _e458.w);
            }
            let _e486 = phi_12502_;
            phi_21709_ = _e486;
        } else {
            let _e371 = global_6.member_25;
            let _e378 = smoothstep(_e371.x, _e371.z, pow(((_e135.x * _e135.y) * 2f), _e371.y));
            let _e380 = global_6.member_26;
            if (_e380.x > _e380.y) {
                let _e406 = (_e225.xyz * (1f - _e378));
                let _e412 = vec4<f32>(_e406.x, _e225.y, _e225.z, _e225.w);
                let _e418 = vec4<f32>(_e412.x, _e406.y, _e412.z, _e412.w);
                phi_12501_ = vec4<f32>(_e418.x, _e418.y, _e406.z, _e418.w);
            } else {
                let _e385 = (_e225.xyz * _e378);
                let _e391 = vec4<f32>(_e385.x, _e225.y, _e225.z, _e225.w);
                let _e397 = vec4<f32>(_e391.x, _e385.y, _e391.z, _e391.w);
                phi_12501_ = vec4<f32>(_e397.x, _e397.y, _e385.z, _e397.w);
            }
            let _e426 = phi_12501_;
            phi_21709_ = _e426;
        }
        let _e488 = phi_21709_;
        let _e490 = global_6.member_26;
        let _e498 = smoothstep(vec3(_e490.x), vec3(_e490.y), (_e488.xyz * vec3<f32>(mix(mix(_e244.xyzw, _e251.xyzw, vec4((_e213.y * pow(abs(_e234.y), 7f)))), _e258.xyzw, vec4((_e213.z * pow(abs(_e234.z), 7f)))).w, mix(mix(_e291.xyzw, _e298.xyzw, vec4((_e213.y * pow(abs(_e281.y), 7f)))), _e305.xyzw, vec4((_e213.z * pow(abs(_e281.z), 7f)))).w, mix(mix(_e338.xyzw, _e345.xyzw, vec4((_e213.y * pow(abs(_e328.y), 7f)))), _e352.xyzw, vec4((_e213.z * pow(abs(_e328.z), 7f)))).w)));
        let _e504 = vec4<f32>(_e498.x, _e488.y, _e488.z, _e488.w);
        let _e510 = vec4<f32>(_e504.x, _e498.y, _e504.z, _e504.w);
        phi_11237_ = vec4<f32>(_e510.x, _e510.y, _e498.z, _e510.w);
    }
    let _e518 = phi_11237_;
    let _e522 = global_6.member_22;
    let _e527 = global_6.member_16;
    let _e541 = mix(mix(mix(mix(mix(_e527.x, _e527.y, _e518.x), _e527.z, _e518.y), _e527.w, _e518.z), _e527.z, _e138.y), _e527.w, _e138.z);
    let _e542 = (((_e135.w + (_e171.x * _e135.x)) * ((_e522 * 6f) + 1f)) * _e541);
    let _e544 = global_6.member_10;
    let _e545 = (_e544 * _e541);
    let _e550 = (0.56f - (0.06f * _e522));
    let _e554 = (0.54f - (_e522 * 0.12f));
    let _e564 = (_e518.xyz * vec3<f32>(smoothstep((0.58f + _e545), (_e550 - _e545), _e542), smoothstep((_e550 + _e545), (_e554 - _e545), _e542), smoothstep((_e554 + _e545), ((0.52f - (_e522 * 0.17999999f)) - _e545), _e542)).xyz);
    let _e570 = smoothstep((0.58f - _e545), (0.68f + _e545), _e542);
    let _e579 = textureSample(global_12, global_8, _e169.zw);
    let _e586 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e579, vec4(((pow((1f - _e135.x), 4f) * 0.25f) + (0.75f * _e522))));
    let _e588 = global_6.member_21;
    let _e597 = mix(mix(mix(mix(mix(_e588.x, _e588.y, _e564.x), _e588.z, _e564.y), _e588.w, _e564.z), _e588.z, _e138.y), _e588.w, _e138.z);
    let _e599 = global_6.member_8;
    phi_7078_ = vec4<f32>(_e132, 0f, 1f);
    if (_e599 != 0i) {
        let _e601 = textureSample(global_13, global_2, _e134);
        let _e609 = global_6.member_18;
        let _e610 = (_e609 != 0i);
        if _e610 {
            let _e614 = global_6.member_19;
            phi_12885_ = mix(mix(mix(_e614.x, _e614.y, _e564.x), _e614.z, _e564.y), _e614.w, _e564.z);
        } else {
            let _e612 = global_6.member_17;
            phi_12885_ = _e612;
        }
        let _e623 = phi_12885_;
        phi_20271_ = _e623;
        if _e610 {
            let _e625 = global_6.member_19;
            phi_20271_ = mix(mix(_e623, _e625.z, _e138.y), _e625.w, _e138.z);
        }
        let _e631 = phi_20271_;
        let _e641 = mix(vec4<f32>(min(1f, (_e631 + ((((1f - _e586.w) * _e522) * _e522) * 0.5f))), _e597, 0f, 1f), vec4<f32>(_e601.x, _e601.y, _e601.z, _e601.w), vec4(_e570));
        let _e642 = (1f - _e570);
        let _e649 = global_6.member_20;
        let _e651 = vec4<f32>(_e641.x, _e641.y, _e642, _e641.w).xyz;
        let _e652 = (_e651 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e655 = pow(((_e651 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e641.x <= 0.04045f) {
            phi_21354_ = _e652.x;
        } else {
            phi_21354_ = _e655.x;
        }
        let _e661 = phi_21354_;
        if (_e641.y <= 0.04045f) {
            phi_23035_ = _e652.y;
        } else {
            phi_23035_ = _e655.y;
        }
        let _e667 = phi_23035_;
        if (_e642 <= 0.04045f) {
            phi_19513_ = _e652.z;
        } else {
            phi_19513_ = _e655.z;
        }
        let _e672 = phi_19513_;
        let _e673 = vec4<f32>(_e661, _e667, _e642, min(1f, _e649));
        phi_7078_ = vec4<f32>(_e673.x, _e673.y, _e672, _e673.w);
    }
    let _e680 = phi_7078_;
    phi_22401_ = _e680;
    if (_e599 == 0i) {
        let _e682 = textureSample(global_14, global_2, _e134);
        let _e685 = global_6.member_11;
        let _e687 = global_6.member_12;
        let _e691 = global_6.member_13;
        let _e695 = global_6.member_14;
        let _e702 = global_6.member_15;
        let _e705 = clamp((mix(mix(mix(mix(mix(_e685, _e687, vec3(_e564.x)), _e691, vec3(_e564.y)), _e695, vec3(_e564.z)), _e691, vec3(_e138.y)), _e695, vec3(_e138.z)) * mix(_e702, 1f, (smoothstep(0f, 0.01f, _e570) * (1f - (smoothstep(0.5f, 0.6f, _e518.w) * smoothstep(1f, 0.9f, _e518.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e708 = (_e705.xyz * _e586.xyz);
        let _e713 = global_6.member_28;
        let _e715 = global_6.member_29;
        let _e718 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e708.xyz));
        let _e726 = mix(_e713.xyz, _e715.xyz, vec3(_e597));
        let _e748 = mix(mix(_e708, ((_e718.xyz * mix(min(_e726.x, dot(_e705.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e726.z, clamp(pow(max(_e708.x, max(_e708.y, _e708.z)), _e726.y), 0f, 1f))) / vec3(max(_e718.x, max(_e718.y, _e718.z)))).xyz, vec3(_e522)), _e682.xyz, vec3(_e570));
        phi_22401_ = vec4<f32>(_e748.x, _e748.y, _e748.z, 1f);
    }
    let _e754 = phi_22401_;
    let _e755 = textureSample(global_15, global_8, _e134);
    phi_6805_ = _e754;
    if (_e755.w < 0f) {
        let _e763 = vec4<f32>(_e755.x, _e754.y, _e754.z, _e754.w);
        let _e769 = vec4<f32>(_e763.x, _e755.y, _e763.z, _e763.w);
        phi_6805_ = vec4<f32>(_e769.x, _e769.y, _e755.z, _e769.w);
    }
    let _e777 = phi_6805_;
    global_16 = _e777;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    function_();
    let _e5 = global_16;
    return _e5;
}
