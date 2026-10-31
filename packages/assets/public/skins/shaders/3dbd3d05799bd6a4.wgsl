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
    member_20: i32,
    member_21: vec3<f32>,
    member_22: f32,
    member_23: vec3<f32>,
    member_24: vec2<f32>,
    member_25: i32,
    member_26: vec3<f32>,
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
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_19167_: f32;
    var phi_20826_: vec4<f32>;
    var phi_21356_: f32;
    var phi_21357_: f32;
    var phi_19168_: f32;
    var phi_20827_: vec4<f32>;
    var phi_21358_: f32;
    var phi_21359_: f32;
    var phi_19169_: f32;
    var phi_20828_: vec4<f32>;
    var phi_21360_: f32;
    var phi_21361_: f32;
    var phi_19170_: f32;
    var phi_20829_: vec4<f32>;
    var phi_12501_: vec4<f32>;
    var phi_12502_: vec4<f32>;
    var phi_21709_: vec4<f32>;
    var phi_11692_: vec4<f32>;
    var phi_23035_: f32;
    var phi_23036_: f32;
    var phi_19172_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e140 = global;
    let _e141 = _e140.xy;
    let _e143 = _e140.xy;
    let _e144 = textureSample(global_1, global_2, _e143);
    let _e147 = (pow(_e144.x, 1.5f) * 0.96f);
    let _e149 = textureSample(global_3, global_2, _e143);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e151 = phi_13155_;
        let _e153 = phi_16208_;
        local_1 = _e151;
        if (_e153 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e162 = local[_e153];
        let _e166 = textureSample(global_5, global_2, (_e141 + (_e162 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e151 + (_e166 * 0.05882353f));
            phi_16208_ = (_e153 + 1i);
        }
    }
    let _e156 = local_1;
    let _e157 = (_e156 * 2f);
    let _e159 = global_6.member_9;
    let _e160 = (_e159 != 0i);
    phi_18941_ = _e157;
    if _e160 {
        phi_18941_ = vec4<f32>(_e157.x, _e157.y, (_e157.z * -1f), _e157.w);
    }
    let _e178 = phi_18941_;
    let _e180 = global_4;
    let _e182 = textureSample(global_7, global_8, _e180.xy);
    let _e185 = global_6.member;
    let _e187 = global_6.member_1;
    let _e188 = textureSample(global_10, global_2, _e143);
    let _e190 = global_6.member_20;
    let _e191 = (_e190 != 0i);
    phi_20826_ = _e188;
    if _e191 {
        let _e192 = _e188.xyz;
        let _e193 = (_e192 * 12.92f);
        let _e196 = ((pow(_e192, vec3<f32>(0.41666666f, 0.41666666f, 0.41666666f)) * 1.055f) - vec3<f32>(0.055f, 0.055f, 0.055f));
        if (_e188.x <= 0.0031308f) {
            phi_21354_ = _e193.x;
        } else {
            phi_21354_ = _e196.x;
        }
        let _e202 = phi_21354_;
        if (_e188.y <= 0.0031308f) {
            phi_21355_ = _e193.y;
        } else {
            phi_21355_ = _e196.y;
        }
        let _e208 = phi_21355_;
        if (_e188.z <= 0.0031308f) {
            phi_19167_ = _e193.z;
        } else {
            phi_19167_ = _e196.z;
        }
        let _e214 = phi_19167_;
        let _e219 = vec4<f32>(_e202, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e224 = vec4<f32>(_e219.x, _e208, _e219.z, _e219.w);
        phi_20826_ = vec4<f32>(_e224.x, _e224.y, _e214, _e224.w);
    }
    let _e231 = phi_20826_;
    let _e235 = normalize(((_e231.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e236 = _e178.yz;
    let _e237 = _e185.xy;
    let _e241 = _e187.xy;
    let _e246 = textureSample(global_11, global_9, vec2<f32>((dot(_e236, _e237) + _e185.w), (dot(_e236, _e241) + _e187.w)));
    let _e248 = _e178.xz;
    let _e254 = textureSample(global_11, global_9, vec2<f32>((dot(_e248, _e237) + _e185.w), (dot(_e248, _e241) + _e187.w)));
    let _e256 = _e178.yx;
    let _e262 = textureSample(global_11, global_9, vec2<f32>((dot(_e256, _e237) + _e185.w), (dot(_e256, _e241) + _e187.w)));
    let _e267 = global_6.member_21;
    let _e279 = mix(mix(_e246.xyzw, _e254.xyzw, vec4((_e267.y * pow(abs(_e235.y), 7f)))), _e262.xyzw, vec4((_e267.z * pow(abs(_e235.z), 7f))));
    phi_11692_ = _e279;
    if _e160 {
        let _e281 = global_6.member_2;
        let _e283 = global_6.member_3;
        let _e284 = textureSample(global_10, global_2, _e143);
        phi_20827_ = _e284;
        if _e191 {
            let _e285 = _e284.xyz;
            let _e286 = (_e285 * 12.92f);
            let _e289 = ((pow(_e285, vec3<f32>(0.41666666f, 0.41666666f, 0.41666666f)) * 1.055f) - vec3<f32>(0.055f, 0.055f, 0.055f));
            if (_e284.x <= 0.0031308f) {
                phi_21356_ = _e286.x;
            } else {
                phi_21356_ = _e289.x;
            }
            let _e295 = phi_21356_;
            if (_e284.y <= 0.0031308f) {
                phi_21357_ = _e286.y;
            } else {
                phi_21357_ = _e289.y;
            }
            let _e301 = phi_21357_;
            if (_e284.z <= 0.0031308f) {
                phi_19168_ = _e286.z;
            } else {
                phi_19168_ = _e289.z;
            }
            let _e307 = phi_19168_;
            let _e312 = vec4<f32>(_e295, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
            let _e317 = vec4<f32>(_e312.x, _e301, _e312.z, _e312.w);
            phi_20827_ = vec4<f32>(_e317.x, _e317.y, _e307, _e317.w);
        }
        let _e324 = phi_20827_;
        let _e328 = normalize(((_e324.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e329 = _e281.xy;
        let _e333 = _e283.xy;
        let _e338 = textureSample(global_11, global_9, vec2<f32>((dot(_e236, _e329) + _e281.w), (dot(_e236, _e333) + _e283.w)));
        let _e345 = textureSample(global_11, global_9, vec2<f32>((dot(_e248, _e329) + _e281.w), (dot(_e248, _e333) + _e283.w)));
        let _e352 = textureSample(global_11, global_9, vec2<f32>((dot(_e256, _e329) + _e281.w), (dot(_e256, _e333) + _e283.w)));
        let _e368 = global_6.member_4;
        let _e370 = global_6.member_5;
        let _e371 = textureSample(global_10, global_2, _e143);
        phi_20828_ = _e371;
        if _e191 {
            let _e372 = _e371.xyz;
            let _e373 = (_e372 * 12.92f);
            let _e376 = ((pow(_e372, vec3<f32>(0.41666666f, 0.41666666f, 0.41666666f)) * 1.055f) - vec3<f32>(0.055f, 0.055f, 0.055f));
            if (_e371.x <= 0.0031308f) {
                phi_21358_ = _e373.x;
            } else {
                phi_21358_ = _e376.x;
            }
            let _e382 = phi_21358_;
            if (_e371.y <= 0.0031308f) {
                phi_21359_ = _e373.y;
            } else {
                phi_21359_ = _e376.y;
            }
            let _e388 = phi_21359_;
            if (_e371.z <= 0.0031308f) {
                phi_19169_ = _e373.z;
            } else {
                phi_19169_ = _e376.z;
            }
            let _e394 = phi_19169_;
            let _e399 = vec4<f32>(_e382, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
            let _e404 = vec4<f32>(_e399.x, _e388, _e399.z, _e399.w);
            phi_20828_ = vec4<f32>(_e404.x, _e404.y, _e394, _e404.w);
        }
        let _e411 = phi_20828_;
        let _e415 = normalize(((_e411.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e416 = _e368.xy;
        let _e420 = _e370.xy;
        let _e425 = textureSample(global_11, global_9, vec2<f32>((dot(_e236, _e416) + _e368.w), (dot(_e236, _e420) + _e370.w)));
        let _e432 = textureSample(global_11, global_9, vec2<f32>((dot(_e248, _e416) + _e368.w), (dot(_e248, _e420) + _e370.w)));
        let _e439 = textureSample(global_11, global_9, vec2<f32>((dot(_e256, _e416) + _e368.w), (dot(_e256, _e420) + _e370.w)));
        let _e455 = global_6.member_6;
        let _e457 = global_6.member_7;
        let _e458 = textureSample(global_10, global_2, _e143);
        phi_20829_ = _e458;
        if _e191 {
            let _e459 = _e458.xyz;
            let _e460 = (_e459 * 12.92f);
            let _e463 = ((pow(_e459, vec3<f32>(0.41666666f, 0.41666666f, 0.41666666f)) * 1.055f) - vec3<f32>(0.055f, 0.055f, 0.055f));
            if (_e458.x <= 0.0031308f) {
                phi_21360_ = _e460.x;
            } else {
                phi_21360_ = _e463.x;
            }
            let _e469 = phi_21360_;
            if (_e458.y <= 0.0031308f) {
                phi_21361_ = _e460.y;
            } else {
                phi_21361_ = _e463.y;
            }
            let _e475 = phi_21361_;
            if (_e458.z <= 0.0031308f) {
                phi_19170_ = _e460.z;
            } else {
                phi_19170_ = _e463.z;
            }
            let _e481 = phi_19170_;
            let _e486 = vec4<f32>(_e469, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
            let _e491 = vec4<f32>(_e486.x, _e475, _e486.z, _e486.w);
            phi_20829_ = vec4<f32>(_e491.x, _e491.y, _e481, _e491.w);
        }
        let _e498 = phi_20829_;
        let _e502 = normalize(((_e498.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e503 = _e455.xy;
        let _e507 = _e457.xy;
        let _e512 = textureSample(global_11, global_9, vec2<f32>((dot(_e236, _e503) + _e455.w), (dot(_e236, _e507) + _e457.w)));
        let _e519 = textureSample(global_11, global_9, vec2<f32>((dot(_e248, _e503) + _e455.w), (dot(_e248, _e507) + _e457.w)));
        let _e526 = textureSample(global_11, global_9, vec2<f32>((dot(_e256, _e503) + _e455.w), (dot(_e256, _e507) + _e457.w)));
        let _e542 = global_6.member_25;
        if (_e542 != 0i) {
            let _e602 = global_6.member_23;
            let _e606 = global_6.member_22;
            let _e612 = smoothstep(_e602.x, _e602.z, pow(((min(_e147, _e606) * _e144.y) * 2f), _e602.y));
            let _e614 = global_6.member_24;
            if (_e614.x > _e614.y) {
                let _e640 = (_e279.xyz * _e612);
                let _e646 = vec4<f32>(_e640.x, _e279.y, _e279.z, _e279.w);
                let _e652 = vec4<f32>(_e646.x, _e640.y, _e646.z, _e646.w);
                phi_12502_ = vec4<f32>(_e652.x, _e652.y, _e640.z, _e652.w);
            } else {
                let _e620 = (_e279.xyz * (1f - _e612));
                let _e626 = vec4<f32>(_e620.x, _e279.y, _e279.z, _e279.w);
                let _e632 = vec4<f32>(_e626.x, _e620.y, _e626.z, _e626.w);
                phi_12502_ = vec4<f32>(_e632.x, _e632.y, _e620.z, _e632.w);
            }
            let _e660 = phi_12502_;
            phi_21709_ = _e660;
        } else {
            let _e545 = global_6.member_23;
            let _e552 = smoothstep(_e545.x, _e545.z, pow(((_e147 * _e144.y) * 2f), _e545.y));
            let _e554 = global_6.member_24;
            if (_e554.x > _e554.y) {
                let _e580 = (_e279.xyz * (1f - _e552));
                let _e586 = vec4<f32>(_e580.x, _e279.y, _e279.z, _e279.w);
                let _e592 = vec4<f32>(_e586.x, _e580.y, _e586.z, _e586.w);
                phi_12501_ = vec4<f32>(_e592.x, _e592.y, _e580.z, _e592.w);
            } else {
                let _e559 = (_e279.xyz * _e552);
                let _e565 = vec4<f32>(_e559.x, _e279.y, _e279.z, _e279.w);
                let _e571 = vec4<f32>(_e565.x, _e559.y, _e565.z, _e565.w);
                phi_12501_ = vec4<f32>(_e571.x, _e571.y, _e559.z, _e571.w);
            }
            let _e600 = phi_12501_;
            phi_21709_ = _e600;
        }
        let _e662 = phi_21709_;
        let _e664 = global_6.member_24;
        let _e672 = smoothstep(vec3(_e664.x), vec3(_e664.y), (_e662.xyz * vec3<f32>(mix(mix(_e338.xyzw, _e345.xyzw, vec4((_e267.y * pow(abs(_e328.y), 7f)))), _e352.xyzw, vec4((_e267.z * pow(abs(_e328.z), 7f)))).w, mix(mix(_e425.xyzw, _e432.xyzw, vec4((_e267.y * pow(abs(_e415.y), 7f)))), _e439.xyzw, vec4((_e267.z * pow(abs(_e415.z), 7f)))).w, mix(mix(_e512.xyzw, _e519.xyzw, vec4((_e267.y * pow(abs(_e502.y), 7f)))), _e526.xyzw, vec4((_e267.z * pow(abs(_e502.z), 7f)))).w)));
        let _e678 = vec4<f32>(_e672.x, _e662.y, _e662.z, _e662.w);
        let _e684 = vec4<f32>(_e678.x, _e672.y, _e678.z, _e678.w);
        phi_11692_ = vec4<f32>(_e684.x, _e684.y, _e672.z, _e684.w);
    }
    let _e692 = phi_11692_;
    let _e697 = global_6.member_19;
    let _e706 = global_6.member_16;
    let _e720 = mix(mix(mix(mix(mix(_e706.x, _e706.y, _e692.x), _e706.z, _e692.y), _e706.w, _e692.z), _e706.z, _e149.y), _e706.w, _e149.z);
    let _e721 = (((_e144.w + (_e182.x * mix(smoothstep(0f, 0.72f, pow(_e147, 1.3f)), smoothstep(0f, 0.4f, _e147), pow(_e697, 1.2f)))) * ((_e697 * 6f) + 1f)) * _e720);
    let _e723 = global_6.member_10;
    let _e724 = (_e723 * _e720);
    let _e739 = max((1f - _e149.x), smoothstep((0.56f - _e724), (0.74f + _e724), _e721));
    let _e740 = ((smoothstep((0.53f - _e724), (0.72f + _e724), _e721) * (1f - (smoothstep(0.5f, 0.6f, _e692.w) * smoothstep(1f, 0.9f, _e692.w)))) * _e149.x);
    let _e742 = textureSample(global_12, global_8, _e180.zw);
    let _e749 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e742, vec4(((pow((1f - _e147), 4f) * 0.25f) + (0.75f * _e697))));
    let _e751 = global_6.member_8;
    phi_7078_ = vec4<f32>(_e141, 0f, 1f);
    if (_e751 != 0i) {
        let _e753 = textureSample(global_13, global_2, _e143);
        let _e755 = (1f - _e739);
        let _e760 = global_6.member_17;
        let _e769 = mix(_e753.x, min(1f, (mix(mix(_e760, _e760, max(max(_e149.y, _e149.z), _e739)), 0.35f, _e740) + ((1f - dot(_e749.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))) * 0.2f))), max(0f, _e755));
        let _e771 = mix(_e149.x, _e753.y, _e739);
        let _e773 = global_6.member_18;
        let _e775 = vec4<f32>(_e769, _e771, _e755, min(1f, _e773));
        let _e776 = _e775.xyz;
        let _e777 = (_e776 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e780 = pow(((_e776 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e769 <= 0.04045f) {
            phi_23035_ = _e777.x;
        } else {
            phi_23035_ = _e780.x;
        }
        let _e785 = phi_23035_;
        if (_e771 <= 0.04045f) {
            phi_23036_ = _e777.y;
        } else {
            phi_23036_ = _e780.y;
        }
        let _e790 = phi_23036_;
        if (_e755 <= 0.04045f) {
            phi_19172_ = _e777.z;
        } else {
            phi_19172_ = _e780.z;
        }
        let _e795 = phi_19172_;
        let _e800 = vec4<f32>(_e785, _e775.y, _e775.z, _e775.w);
        let _e805 = vec4<f32>(_e800.x, _e790, _e800.z, _e800.w);
        phi_7078_ = vec4<f32>(_e805.x, _e805.y, _e795, _e805.w);
    }
    let _e812 = phi_7078_;
    phi_22401_ = _e812;
    if (_e751 == 0i) {
        let _e814 = textureSample(global_14, global_2, _e143);
        let _e817 = global_6.member_11;
        let _e819 = global_6.member_12;
        let _e823 = global_6.member_13;
        let _e827 = global_6.member_14;
        let _e833 = _e814.xyz;
        let _e837 = vec3(_e740);
        let _e840 = global_6.member_15;
        let _e841 = mix(_e840, 1f, _e740);
        let _e845 = clamp((clamp((mix(mix(_e833, mix(mix(mix(mix(mix(_e817, _e819, vec3(_e692.x)), _e823, vec3(_e692.y)), _e827, vec3(_e692.z)), _e823, vec3(_e149.y)), _e827, vec3(_e149.z)).xyz, vec3(_e149.x)), vec3<f32>(0.38f, 0.37f, 0.35f), _e837) * _e841), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)) * _e841), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e847 = mix(_e749.xyz, vec3<f32>(1f, 1f, 1f), _e837);
        let _e853 = vec4<f32>(_e847.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e859 = vec4<f32>(_e853.x, _e847.y, _e853.z, _e853.w);
        let _e868 = (_e845.xyz * vec4<f32>(_e859.x, _e859.y, _e847.z, _e859.w).xyz);
        let _e873 = global_6.member_26;
        let _e876 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e868.xyz));
        let _e901 = mix(mix(_e868, ((_e876.xyz * mix(min(_e873.x, dot(_e845.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e873.z, clamp(pow(max(_e868.x, max(_e868.y, _e868.z)), _e873.y), 0f, 1f))) / vec3(max(_e876.x, max(_e876.y, _e876.z)))).xyz, vec3(_e697)), _e833, vec3(_e739));
        phi_22401_ = vec4<f32>(_e901.x, _e901.y, _e901.z, 1f);
    }
    let _e907 = phi_22401_;
    let _e908 = textureSample(global_15, global_8, _e143);
    phi_6805_ = _e907;
    if (_e908.w < 0f) {
        let _e916 = vec4<f32>(_e908.x, _e907.y, _e907.z, _e907.w);
        let _e922 = vec4<f32>(_e916.x, _e908.y, _e916.z, _e916.w);
        phi_6805_ = vec4<f32>(_e922.x, _e922.y, _e908.z, _e922.w);
    }
    let _e930 = phi_6805_;
    global_16 = _e930;
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
