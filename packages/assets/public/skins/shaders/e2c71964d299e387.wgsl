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
    member_23: i32,
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
    var phi_20271_: f32;
    var phi_21362_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_7078_: vec4<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e147 = global;
    let _e148 = _e147.xy;
    let _e150 = _e147.xy;
    let _e151 = textureSample(global_1, global_2, _e150);
    let _e154 = (pow(_e151.x, 1.5f) * 0.96f);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e157 = phi_13155_;
        let _e159 = phi_16208_;
        local_1 = _e157;
        if (_e159 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e168 = local[_e159];
        let _e172 = textureSample(global_4, global_2, (_e148 + (_e168 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e157 + (_e172 * 0.05882353f));
            phi_16208_ = (_e159 + 1i);
        }
    }
    let _e162 = local_1;
    let _e163 = (_e162 * 2f);
    let _e165 = global_5.member_9;
    let _e166 = (_e165 != 0i);
    phi_18941_ = _e163;
    if _e166 {
        phi_18941_ = vec4<f32>(_e163.x, _e163.y, (_e163.z * -1f), _e163.w);
    }
    let _e184 = phi_18941_;
    let _e186 = global_3;
    let _e188 = textureSample(global_6, global_7, _e186.xy);
    let _e191 = global_5.member;
    let _e193 = global_5.member_1;
    let _e194 = textureSample(global_9, global_2, _e150);
    let _e196 = global_5.member_23;
    let _e197 = (_e196 != 0i);
    phi_20826_ = _e194;
    if _e197 {
        let _e198 = _e194.xyz;
        let _e199 = (_e198 * 12.92f);
        let _e202 = ((pow(_e198, vec3<f32>(0.41666666f, 0.41666666f, 0.41666666f)) * 1.055f) - vec3<f32>(0.055f, 0.055f, 0.055f));
        if (_e194.x <= 0.0031308f) {
            phi_21354_ = _e199.x;
        } else {
            phi_21354_ = _e202.x;
        }
        let _e208 = phi_21354_;
        if (_e194.y <= 0.0031308f) {
            phi_21355_ = _e199.y;
        } else {
            phi_21355_ = _e202.y;
        }
        let _e214 = phi_21355_;
        if (_e194.z <= 0.0031308f) {
            phi_19167_ = _e199.z;
        } else {
            phi_19167_ = _e202.z;
        }
        let _e220 = phi_19167_;
        let _e225 = vec4<f32>(_e208, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e230 = vec4<f32>(_e225.x, _e214, _e225.z, _e225.w);
        phi_20826_ = vec4<f32>(_e230.x, _e230.y, _e220, _e230.w);
    }
    let _e237 = phi_20826_;
    let _e241 = normalize(((_e237.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e242 = _e184.yz;
    let _e243 = _e191.xy;
    let _e247 = _e193.xy;
    let _e252 = textureSample(global_10, global_8, vec2<f32>((dot(_e242, _e243) + _e191.w), (dot(_e242, _e247) + _e193.w)));
    let _e254 = _e184.xz;
    let _e260 = textureSample(global_10, global_8, vec2<f32>((dot(_e254, _e243) + _e191.w), (dot(_e254, _e247) + _e193.w)));
    let _e262 = _e184.yx;
    let _e268 = textureSample(global_10, global_8, vec2<f32>((dot(_e262, _e243) + _e191.w), (dot(_e262, _e247) + _e193.w)));
    let _e273 = global_5.member_24;
    let _e285 = mix(mix(_e252.xyzw, _e260.xyzw, vec4((_e273.y * pow(abs(_e241.y), 7f)))), _e268.xyzw, vec4((_e273.z * pow(abs(_e241.z), 7f))));
    phi_11692_ = _e285;
    if _e166 {
        let _e287 = global_5.member_2;
        let _e289 = global_5.member_3;
        let _e290 = textureSample(global_9, global_2, _e150);
        phi_20827_ = _e290;
        if _e197 {
            let _e291 = _e290.xyz;
            let _e292 = (_e291 * 12.92f);
            let _e295 = ((pow(_e291, vec3<f32>(0.41666666f, 0.41666666f, 0.41666666f)) * 1.055f) - vec3<f32>(0.055f, 0.055f, 0.055f));
            if (_e290.x <= 0.0031308f) {
                phi_21356_ = _e292.x;
            } else {
                phi_21356_ = _e295.x;
            }
            let _e301 = phi_21356_;
            if (_e290.y <= 0.0031308f) {
                phi_21357_ = _e292.y;
            } else {
                phi_21357_ = _e295.y;
            }
            let _e307 = phi_21357_;
            if (_e290.z <= 0.0031308f) {
                phi_19168_ = _e292.z;
            } else {
                phi_19168_ = _e295.z;
            }
            let _e313 = phi_19168_;
            let _e318 = vec4<f32>(_e301, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
            let _e323 = vec4<f32>(_e318.x, _e307, _e318.z, _e318.w);
            phi_20827_ = vec4<f32>(_e323.x, _e323.y, _e313, _e323.w);
        }
        let _e330 = phi_20827_;
        let _e334 = normalize(((_e330.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e335 = _e287.xy;
        let _e339 = _e289.xy;
        let _e344 = textureSample(global_10, global_8, vec2<f32>((dot(_e242, _e335) + _e287.w), (dot(_e242, _e339) + _e289.w)));
        let _e351 = textureSample(global_10, global_8, vec2<f32>((dot(_e254, _e335) + _e287.w), (dot(_e254, _e339) + _e289.w)));
        let _e358 = textureSample(global_10, global_8, vec2<f32>((dot(_e262, _e335) + _e287.w), (dot(_e262, _e339) + _e289.w)));
        let _e374 = global_5.member_4;
        let _e376 = global_5.member_5;
        let _e377 = textureSample(global_9, global_2, _e150);
        phi_20828_ = _e377;
        if _e197 {
            let _e378 = _e377.xyz;
            let _e379 = (_e378 * 12.92f);
            let _e382 = ((pow(_e378, vec3<f32>(0.41666666f, 0.41666666f, 0.41666666f)) * 1.055f) - vec3<f32>(0.055f, 0.055f, 0.055f));
            if (_e377.x <= 0.0031308f) {
                phi_21358_ = _e379.x;
            } else {
                phi_21358_ = _e382.x;
            }
            let _e388 = phi_21358_;
            if (_e377.y <= 0.0031308f) {
                phi_21359_ = _e379.y;
            } else {
                phi_21359_ = _e382.y;
            }
            let _e394 = phi_21359_;
            if (_e377.z <= 0.0031308f) {
                phi_19169_ = _e379.z;
            } else {
                phi_19169_ = _e382.z;
            }
            let _e400 = phi_19169_;
            let _e405 = vec4<f32>(_e388, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
            let _e410 = vec4<f32>(_e405.x, _e394, _e405.z, _e405.w);
            phi_20828_ = vec4<f32>(_e410.x, _e410.y, _e400, _e410.w);
        }
        let _e417 = phi_20828_;
        let _e421 = normalize(((_e417.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e422 = _e374.xy;
        let _e426 = _e376.xy;
        let _e431 = textureSample(global_10, global_8, vec2<f32>((dot(_e242, _e422) + _e374.w), (dot(_e242, _e426) + _e376.w)));
        let _e438 = textureSample(global_10, global_8, vec2<f32>((dot(_e254, _e422) + _e374.w), (dot(_e254, _e426) + _e376.w)));
        let _e445 = textureSample(global_10, global_8, vec2<f32>((dot(_e262, _e422) + _e374.w), (dot(_e262, _e426) + _e376.w)));
        let _e461 = global_5.member_6;
        let _e463 = global_5.member_7;
        let _e464 = textureSample(global_9, global_2, _e150);
        phi_20829_ = _e464;
        if _e197 {
            let _e465 = _e464.xyz;
            let _e466 = (_e465 * 12.92f);
            let _e469 = ((pow(_e465, vec3<f32>(0.41666666f, 0.41666666f, 0.41666666f)) * 1.055f) - vec3<f32>(0.055f, 0.055f, 0.055f));
            if (_e464.x <= 0.0031308f) {
                phi_21360_ = _e466.x;
            } else {
                phi_21360_ = _e469.x;
            }
            let _e475 = phi_21360_;
            if (_e464.y <= 0.0031308f) {
                phi_21361_ = _e466.y;
            } else {
                phi_21361_ = _e469.y;
            }
            let _e481 = phi_21361_;
            if (_e464.z <= 0.0031308f) {
                phi_19170_ = _e466.z;
            } else {
                phi_19170_ = _e469.z;
            }
            let _e487 = phi_19170_;
            let _e492 = vec4<f32>(_e475, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
            let _e497 = vec4<f32>(_e492.x, _e481, _e492.z, _e492.w);
            phi_20829_ = vec4<f32>(_e497.x, _e497.y, _e487, _e497.w);
        }
        let _e504 = phi_20829_;
        let _e508 = normalize(((_e504.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e509 = _e461.xy;
        let _e513 = _e463.xy;
        let _e518 = textureSample(global_10, global_8, vec2<f32>((dot(_e242, _e509) + _e461.w), (dot(_e242, _e513) + _e463.w)));
        let _e525 = textureSample(global_10, global_8, vec2<f32>((dot(_e254, _e509) + _e461.w), (dot(_e254, _e513) + _e463.w)));
        let _e532 = textureSample(global_10, global_8, vec2<f32>((dot(_e262, _e509) + _e461.w), (dot(_e262, _e513) + _e463.w)));
        let _e548 = global_5.member_28;
        if (_e548 != 0i) {
            let _e608 = global_5.member_26;
            let _e612 = global_5.member_25;
            let _e618 = smoothstep(_e608.x, _e608.z, pow(((min(_e154, _e612) * _e151.y) * 2f), _e608.y));
            let _e620 = global_5.member_27;
            if (_e620.x > _e620.y) {
                let _e646 = (_e285.xyz * _e618);
                let _e652 = vec4<f32>(_e646.x, _e285.y, _e285.z, _e285.w);
                let _e658 = vec4<f32>(_e652.x, _e646.y, _e652.z, _e652.w);
                phi_12502_ = vec4<f32>(_e658.x, _e658.y, _e646.z, _e658.w);
            } else {
                let _e626 = (_e285.xyz * (1f - _e618));
                let _e632 = vec4<f32>(_e626.x, _e285.y, _e285.z, _e285.w);
                let _e638 = vec4<f32>(_e632.x, _e626.y, _e632.z, _e632.w);
                phi_12502_ = vec4<f32>(_e638.x, _e638.y, _e626.z, _e638.w);
            }
            let _e666 = phi_12502_;
            phi_21709_ = _e666;
        } else {
            let _e551 = global_5.member_26;
            let _e558 = smoothstep(_e551.x, _e551.z, pow(((_e154 * _e151.y) * 2f), _e551.y));
            let _e560 = global_5.member_27;
            if (_e560.x > _e560.y) {
                let _e586 = (_e285.xyz * (1f - _e558));
                let _e592 = vec4<f32>(_e586.x, _e285.y, _e285.z, _e285.w);
                let _e598 = vec4<f32>(_e592.x, _e586.y, _e592.z, _e592.w);
                phi_12501_ = vec4<f32>(_e598.x, _e598.y, _e586.z, _e598.w);
            } else {
                let _e565 = (_e285.xyz * _e558);
                let _e571 = vec4<f32>(_e565.x, _e285.y, _e285.z, _e285.w);
                let _e577 = vec4<f32>(_e571.x, _e565.y, _e571.z, _e571.w);
                phi_12501_ = vec4<f32>(_e577.x, _e577.y, _e565.z, _e577.w);
            }
            let _e606 = phi_12501_;
            phi_21709_ = _e606;
        }
        let _e668 = phi_21709_;
        let _e670 = global_5.member_27;
        let _e678 = smoothstep(vec3(_e670.x), vec3(_e670.y), (_e668.xyz * vec3<f32>(mix(mix(_e344.xyzw, _e351.xyzw, vec4((_e273.y * pow(abs(_e334.y), 7f)))), _e358.xyzw, vec4((_e273.z * pow(abs(_e334.z), 7f)))).w, mix(mix(_e431.xyzw, _e438.xyzw, vec4((_e273.y * pow(abs(_e421.y), 7f)))), _e445.xyzw, vec4((_e273.z * pow(abs(_e421.z), 7f)))).w, mix(mix(_e518.xyzw, _e525.xyzw, vec4((_e273.y * pow(abs(_e508.y), 7f)))), _e532.xyzw, vec4((_e273.z * pow(abs(_e508.z), 7f)))).w)));
        let _e684 = vec4<f32>(_e678.x, _e668.y, _e668.z, _e668.w);
        let _e690 = vec4<f32>(_e684.x, _e678.y, _e684.z, _e684.w);
        phi_11692_ = vec4<f32>(_e690.x, _e690.y, _e678.z, _e690.w);
    }
    let _e698 = phi_11692_;
    let _e704 = global_5.member_22;
    let _e713 = global_5.member_16;
    let _e723 = mix(mix(mix(_e713.x, _e713.y, _e698.x), _e713.z, _e698.y), _e713.w, _e698.z);
    let _e724 = (((_e151.w + (_e188.x * mix(smoothstep(0f, 0.68f, pow(_e154, 1.1f)), smoothstep(0f, 0.51f, pow(_e154, 0.8f)), pow(_e704, 0.3f)))) * ((_e704 * 6f) + 1f)) * _e723);
    let _e726 = global_5.member_10;
    let _e727 = (_e726 * _e723);
    let _e732 = (0.56f - (0.06f * _e704));
    let _e736 = (0.54f - (_e704 * 0.12f));
    let _e746 = (_e698.xyz * vec3<f32>(smoothstep((0.58f + _e727), (_e732 - _e727), _e724), smoothstep((_e732 + _e727), (_e736 - _e727), _e724), smoothstep((_e736 + _e727), ((0.52f - (_e704 * 0.17999999f)) - _e727), _e724)).xyz);
    let _e755 = smoothstep((0.56f - _e727), (0.74f + _e727), _e724);
    let _e763 = textureSample(global_11, global_7, _e186.zw);
    let _e770 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e763, vec4(((pow((1f - _e154), 4f) * 0.25f) + (0.75f * _e704))));
    let _e772 = global_5.member_21;
    let _e779 = mix(mix(mix(_e772.x, _e772.y, _e746.x), _e772.z, _e746.y), _e772.w, _e746.z);
    let _e781 = global_5.member_8;
    phi_7078_ = vec4<f32>(_e148, 0f, 1f);
    if (_e781 != 0i) {
        let _e783 = textureSample(global_12, global_2, _e150);
        let _e791 = global_5.member_18;
        if (_e791 != 0i) {
            let _e796 = global_5.member_19;
            phi_20271_ = mix(mix(mix(_e796.x, _e796.y, _e746.x), _e796.z, _e746.y), _e796.w, _e746.z);
        } else {
            let _e794 = global_5.member_17;
            phi_20271_ = _e794;
        }
        let _e805 = phi_20271_;
        let _e815 = mix(vec4<f32>(min(1f, (_e805 + ((((1f - _e770.w) * _e704) * _e704) * 0.5f))), _e779, 0f, 1f), vec4<f32>(_e783.x, _e783.y, _e783.z, _e783.w), vec4(_e755));
        let _e816 = (1f - _e755);
        let _e823 = global_5.member_20;
        let _e825 = vec4<f32>(_e815.x, _e815.y, _e816, _e815.w).xyz;
        let _e826 = (_e825 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e829 = pow(((_e825 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e815.x <= 0.04045f) {
            phi_21362_ = _e826.x;
        } else {
            phi_21362_ = _e829.x;
        }
        let _e835 = phi_21362_;
        if (_e815.y <= 0.04045f) {
            phi_23035_ = _e826.y;
        } else {
            phi_23035_ = _e829.y;
        }
        let _e841 = phi_23035_;
        if (_e816 <= 0.04045f) {
            phi_19513_ = _e826.z;
        } else {
            phi_19513_ = _e829.z;
        }
        let _e846 = phi_19513_;
        let _e847 = vec4<f32>(_e835, _e841, _e816, min(1f, _e823));
        phi_7078_ = vec4<f32>(_e847.x, _e847.y, _e846, _e847.w);
    }
    let _e854 = phi_7078_;
    phi_22401_ = _e854;
    if (_e781 == 0i) {
        let _e856 = textureSample(global_13, global_2, _e150);
        let _e859 = global_5.member_11;
        let _e861 = global_5.member_12;
        let _e865 = global_5.member_13;
        let _e869 = global_5.member_14;
        let _e872 = global_5.member_15;
        let _e875 = clamp((mix(mix(mix(_e859, _e861, vec3(_e746.x)), _e865, vec3(_e746.y)), _e869, vec3(_e746.z)) * mix(_e872, 1f, (smoothstep((0.53f - _e727), (0.72f + _e727), _e724) * (1f - (smoothstep(0.5f, 0.6f, _e698.w) * smoothstep(1f, 0.9f, _e698.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e878 = (_e875.xyz * _e770.xyz);
        let _e883 = global_5.member_29;
        let _e885 = global_5.member_30;
        let _e888 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e878.xyz));
        let _e896 = mix(_e883.xyz, _e885.xyz, vec3(_e779));
        let _e918 = mix(mix(_e878, ((_e888.xyz * mix(min(_e896.x, dot(_e875.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e896.z, clamp(pow(max(_e878.x, max(_e878.y, _e878.z)), _e896.y), 0f, 1f))) / vec3(max(_e888.x, max(_e888.y, _e888.z)))).xyz, vec3(_e704)), _e856.xyz, vec3(_e755));
        phi_22401_ = vec4<f32>(_e918.x, _e918.y, _e918.z, 1f);
    }
    let _e924 = phi_22401_;
    let _e925 = textureSample(global_14, global_7, _e150);
    phi_6805_ = _e924;
    if (_e925.w < 0f) {
        let _e933 = vec4<f32>(_e925.x, _e924.y, _e924.z, _e924.w);
        let _e939 = vec4<f32>(_e933.x, _e925.y, _e933.z, _e933.w);
        phi_6805_ = vec4<f32>(_e939.x, _e939.y, _e925.z, _e939.w);
    }
    let _e947 = phi_6805_;
    global_15 = _e947;
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
