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
    member_18: f32,
    member_19: f32,
    member_20: vec3<f32>,
    member_21: f32,
    member_22: vec3<f32>,
    member_23: vec2<f32>,
    member_24: i32,
    member_25: vec3<f32>,
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
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19167_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e126 = global;
    let _e127 = _e126.xy;
    let _e129 = _e126.xy;
    let _e130 = textureSample(global_1, global_2, _e129);
    let _e133 = textureSample(global_3, global_2, _e129);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e135 = phi_13155_;
        let _e137 = phi_16208_;
        local_1 = _e135;
        if (_e137 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e146 = local[_e137];
        let _e150 = textureSample(global_5, global_2, (_e127 + (_e146 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e135 + (_e150 * 0.05882353f));
            phi_16208_ = (_e137 + 1i);
        }
    }
    let _e140 = local_1;
    let _e141 = (_e140 * 2f);
    let _e143 = global_6.member_9;
    let _e144 = (_e143 != 0i);
    phi_18941_ = _e141;
    if _e144 {
        phi_18941_ = vec4<f32>(_e141.x, _e141.y, (_e141.z * -1f), _e141.w);
    }
    let _e162 = phi_18941_;
    let _e164 = global_4;
    let _e166 = textureSample(global_7, global_8, _e164.xy);
    let _e169 = global_6.member;
    let _e171 = global_6.member_1;
    let _e172 = textureSample(global_10, global_2, _e129);
    let _e176 = normalize(((_e172.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e177 = _e162.yz;
    let _e178 = _e169.xy;
    let _e182 = _e171.xy;
    let _e187 = textureSample(global_11, global_9, vec2<f32>((dot(_e177, _e178) + _e169.w), (dot(_e177, _e182) + _e171.w)));
    let _e189 = _e162.xz;
    let _e195 = textureSample(global_11, global_9, vec2<f32>((dot(_e189, _e178) + _e169.w), (dot(_e189, _e182) + _e171.w)));
    let _e197 = _e162.yx;
    let _e203 = textureSample(global_11, global_9, vec2<f32>((dot(_e197, _e178) + _e169.w), (dot(_e197, _e182) + _e171.w)));
    let _e208 = global_6.member_20;
    let _e220 = mix(mix(_e187.xyzw, _e195.xyzw, vec4((_e208.y * pow(abs(_e176.y), 7f)))), _e203.xyzw, vec4((_e208.z * pow(abs(_e176.z), 7f))));
    phi_11237_ = _e220;
    if _e144 {
        let _e222 = global_6.member_2;
        let _e224 = global_6.member_3;
        let _e225 = textureSample(global_10, global_2, _e129);
        let _e229 = normalize(((_e225.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e230 = _e222.xy;
        let _e234 = _e224.xy;
        let _e239 = textureSample(global_11, global_9, vec2<f32>((dot(_e177, _e230) + _e222.w), (dot(_e177, _e234) + _e224.w)));
        let _e246 = textureSample(global_11, global_9, vec2<f32>((dot(_e189, _e230) + _e222.w), (dot(_e189, _e234) + _e224.w)));
        let _e253 = textureSample(global_11, global_9, vec2<f32>((dot(_e197, _e230) + _e222.w), (dot(_e197, _e234) + _e224.w)));
        let _e269 = global_6.member_4;
        let _e271 = global_6.member_5;
        let _e272 = textureSample(global_10, global_2, _e129);
        let _e276 = normalize(((_e272.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e277 = _e269.xy;
        let _e281 = _e271.xy;
        let _e286 = textureSample(global_11, global_9, vec2<f32>((dot(_e177, _e277) + _e269.w), (dot(_e177, _e281) + _e271.w)));
        let _e293 = textureSample(global_11, global_9, vec2<f32>((dot(_e189, _e277) + _e269.w), (dot(_e189, _e281) + _e271.w)));
        let _e300 = textureSample(global_11, global_9, vec2<f32>((dot(_e197, _e277) + _e269.w), (dot(_e197, _e281) + _e271.w)));
        let _e316 = global_6.member_6;
        let _e318 = global_6.member_7;
        let _e319 = textureSample(global_10, global_2, _e129);
        let _e323 = normalize(((_e319.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e324 = _e316.xy;
        let _e328 = _e318.xy;
        let _e333 = textureSample(global_11, global_9, vec2<f32>((dot(_e177, _e324) + _e316.w), (dot(_e177, _e328) + _e318.w)));
        let _e340 = textureSample(global_11, global_9, vec2<f32>((dot(_e189, _e324) + _e316.w), (dot(_e189, _e328) + _e318.w)));
        let _e347 = textureSample(global_11, global_9, vec2<f32>((dot(_e197, _e324) + _e316.w), (dot(_e197, _e328) + _e318.w)));
        let _e363 = global_6.member_24;
        if (_e363 != 0i) {
            let _e423 = global_6.member_22;
            let _e427 = global_6.member_21;
            let _e433 = smoothstep(_e423.x, _e423.z, pow(((min(_e130.x, _e427) * _e130.y) * 2f), _e423.y));
            let _e435 = global_6.member_23;
            if (_e435.x > _e435.y) {
                let _e461 = (_e220.xyz * _e433);
                let _e467 = vec4<f32>(_e461.x, _e220.y, _e220.z, _e220.w);
                let _e473 = vec4<f32>(_e467.x, _e461.y, _e467.z, _e467.w);
                phi_12502_ = vec4<f32>(_e473.x, _e473.y, _e461.z, _e473.w);
            } else {
                let _e441 = (_e220.xyz * (1f - _e433));
                let _e447 = vec4<f32>(_e441.x, _e220.y, _e220.z, _e220.w);
                let _e453 = vec4<f32>(_e447.x, _e441.y, _e447.z, _e447.w);
                phi_12502_ = vec4<f32>(_e453.x, _e453.y, _e441.z, _e453.w);
            }
            let _e481 = phi_12502_;
            phi_21709_ = _e481;
        } else {
            let _e366 = global_6.member_22;
            let _e373 = smoothstep(_e366.x, _e366.z, pow(((_e130.x * _e130.y) * 2f), _e366.y));
            let _e375 = global_6.member_23;
            if (_e375.x > _e375.y) {
                let _e401 = (_e220.xyz * (1f - _e373));
                let _e407 = vec4<f32>(_e401.x, _e220.y, _e220.z, _e220.w);
                let _e413 = vec4<f32>(_e407.x, _e401.y, _e407.z, _e407.w);
                phi_12501_ = vec4<f32>(_e413.x, _e413.y, _e401.z, _e413.w);
            } else {
                let _e380 = (_e220.xyz * _e373);
                let _e386 = vec4<f32>(_e380.x, _e220.y, _e220.z, _e220.w);
                let _e392 = vec4<f32>(_e386.x, _e380.y, _e386.z, _e386.w);
                phi_12501_ = vec4<f32>(_e392.x, _e392.y, _e380.z, _e392.w);
            }
            let _e421 = phi_12501_;
            phi_21709_ = _e421;
        }
        let _e483 = phi_21709_;
        let _e485 = global_6.member_23;
        let _e493 = smoothstep(vec3(_e485.x), vec3(_e485.y), (_e483.xyz * vec3<f32>(mix(mix(_e239.xyzw, _e246.xyzw, vec4((_e208.y * pow(abs(_e229.y), 7f)))), _e253.xyzw, vec4((_e208.z * pow(abs(_e229.z), 7f)))).w, mix(mix(_e286.xyzw, _e293.xyzw, vec4((_e208.y * pow(abs(_e276.y), 7f)))), _e300.xyzw, vec4((_e208.z * pow(abs(_e276.z), 7f)))).w, mix(mix(_e333.xyzw, _e340.xyzw, vec4((_e208.y * pow(abs(_e323.y), 7f)))), _e347.xyzw, vec4((_e208.z * pow(abs(_e323.z), 7f)))).w)));
        let _e499 = vec4<f32>(_e493.x, _e483.y, _e483.z, _e483.w);
        let _e505 = vec4<f32>(_e499.x, _e493.y, _e499.z, _e499.w);
        phi_11237_ = vec4<f32>(_e505.x, _e505.y, _e493.z, _e505.w);
    }
    let _e513 = phi_11237_;
    let _e517 = global_6.member_19;
    let _e522 = global_6.member_16;
    let _e536 = mix(mix(mix(mix(mix(_e522.x, _e522.y, _e513.x), _e522.z, _e513.y), _e522.w, _e513.z), _e522.z, _e133.y), _e522.w, _e133.z);
    let _e539 = global_6.member_10;
    let _e540 = (_e539 * _e536);
    let _e543 = smoothstep((0.58f - _e540), (0.68f + _e540), (((_e130.w + (_e166.x * _e130.x)) * ((_e517 * 6f) + 1f)) * _e536));
    let _e553 = max((1f - _e133.x), _e543);
    let _e554 = ((smoothstep(0f, 0.01f, _e543) * (1f - (smoothstep(0.5f, 0.6f, _e513.w) * smoothstep(1f, 0.9f, _e513.w)))) * _e133.x);
    let _e556 = textureSample(global_12, global_8, _e164.zw);
    let _e563 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e556, vec4(((pow((1f - _e130.x), 4f) * 0.25f) + (0.75f * _e517))));
    let _e565 = global_6.member_8;
    phi_7078_ = vec4<f32>(_e127, 0f, 1f);
    if (_e565 != 0i) {
        let _e567 = textureSample(global_13, global_2, _e129);
        let _e569 = (1f - _e553);
        let _e574 = global_6.member_17;
        let _e583 = mix(_e567.x, min(1f, (mix(mix(_e574, _e574, max(max(_e133.y, _e133.z), _e553)), 0.35f, _e554) + ((1f - dot(_e563.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))) * 0.2f))), max(0f, _e569));
        let _e585 = mix(_e133.x, _e567.y, _e553);
        let _e587 = global_6.member_18;
        let _e589 = vec4<f32>(_e583, _e585, _e569, min(1f, _e587));
        let _e590 = _e589.xyz;
        let _e591 = (_e590 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e594 = pow(((_e590 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e583 <= 0.04045f) {
            phi_23035_ = _e591.x;
        } else {
            phi_23035_ = _e594.x;
        }
        let _e599 = phi_23035_;
        if (_e585 <= 0.04045f) {
            phi_23036_ = _e591.y;
        } else {
            phi_23036_ = _e594.y;
        }
        let _e604 = phi_23036_;
        if (_e569 <= 0.04045f) {
            phi_19167_ = _e591.z;
        } else {
            phi_19167_ = _e594.z;
        }
        let _e609 = phi_19167_;
        let _e614 = vec4<f32>(_e599, _e589.y, _e589.z, _e589.w);
        let _e619 = vec4<f32>(_e614.x, _e604, _e614.z, _e614.w);
        phi_7078_ = vec4<f32>(_e619.x, _e619.y, _e609, _e619.w);
    }
    let _e626 = phi_7078_;
    phi_22401_ = _e626;
    if (_e565 == 0i) {
        let _e628 = textureSample(global_14, global_2, _e129);
        let _e631 = global_6.member_11;
        let _e633 = global_6.member_12;
        let _e637 = global_6.member_13;
        let _e641 = global_6.member_14;
        let _e647 = _e628.xyz;
        let _e651 = vec3(_e554);
        let _e654 = global_6.member_15;
        let _e655 = mix(_e654, 1f, _e554);
        let _e659 = clamp((clamp((mix(mix(_e647, mix(mix(mix(mix(mix(_e631, _e633, vec3(_e513.x)), _e637, vec3(_e513.y)), _e641, vec3(_e513.z)), _e637, vec3(_e133.y)), _e641, vec3(_e133.z)).xyz, vec3(_e133.x)), vec3<f32>(0.38f, 0.37f, 0.35f), _e651) * _e655), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)) * _e655), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e661 = mix(_e563.xyz, vec3<f32>(1f, 1f, 1f), _e651);
        let _e667 = vec4<f32>(_e661.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e673 = vec4<f32>(_e667.x, _e661.y, _e667.z, _e667.w);
        let _e682 = (_e659.xyz * vec4<f32>(_e673.x, _e673.y, _e661.z, _e673.w).xyz);
        let _e687 = global_6.member_25;
        let _e690 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e682.xyz));
        let _e715 = mix(mix(_e682, ((_e690.xyz * mix(min(_e687.x, dot(_e659.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e687.z, clamp(pow(max(_e682.x, max(_e682.y, _e682.z)), _e687.y), 0f, 1f))) / vec3(max(_e690.x, max(_e690.y, _e690.z)))).xyz, vec3(_e517)), _e647, vec3(_e553));
        phi_22401_ = vec4<f32>(_e715.x, _e715.y, _e715.z, 1f);
    }
    let _e721 = phi_22401_;
    let _e722 = textureSample(global_15, global_8, _e129);
    phi_6805_ = _e721;
    if (_e722.w < 0f) {
        let _e730 = vec4<f32>(_e722.x, _e721.y, _e721.z, _e721.w);
        let _e736 = vec4<f32>(_e730.x, _e722.y, _e730.z, _e730.w);
        phi_6805_ = vec4<f32>(_e736.x, _e736.y, _e722.z, _e736.w);
    }
    let _e744 = phi_6805_;
    global_16 = _e744;
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
