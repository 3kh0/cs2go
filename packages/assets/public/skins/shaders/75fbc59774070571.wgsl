struct type_13 {
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
    member_10: vec3<f32>,
    member_11: f32,
    member_12: f32,
    member_13: f32,
    member_14: f32,
    member_15: f32,
    member_16: f32,
    member_17: f32,
    member_18: f32,
    member_19: f32,
    member_20: vec3<f32>,
    member_21: vec3<f32>,
    member_22: vec3<f32>,
    member_23: vec3<f32>,
    member_24: f32,
    member_25: vec4<f32>,
    member_26: f32,
    member_27: i32,
    member_28: vec4<f32>,
    member_29: f32,
    member_30: vec4<f32>,
    member_31: f32,
    member_32: vec3<f32>,
    member_33: f32,
    member_34: vec3<f32>,
    member_35: vec2<f32>,
    member_36: i32,
    member_37: vec3<f32>,
    member_38: vec3<f32>,
    member_39: i32,
    member_40: i32,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
var<private> global_3: vec4<f32>;
var<private> global_4: vec2<f32>;
@group(1) @binding(33) 
var global_5: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_6: type_13;
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
@group(1) @binding(37) 
var global_12: texture_2d<f32>;
@group(1) @binding(41) 
var global_13: texture_2d<f32>;
@group(1) @binding(35) 
var global_14: texture_2d<f32>;
@group(1) @binding(34) 
var global_15: texture_2d<f32>;
@group(1) @binding(36) 
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
    var phi_22743_: vec4<f32>;
    var phi_19017_: vec4<f32>;
    var phi_21710_: f32;
    var phi_19287_: vec4<f32>;
    var phi_21711_: f32;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_21712_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e148 = global;
    let _e149 = _e148.xy;
    let _e151 = _e148.xy;
    let _e152 = textureSample(global_1, global_2, _e151);
    phi_13155_ = vec4<f32>(0f, 0f, 0f, 0f);
    phi_16208_ = 0i;
    loop {
        let _e156 = phi_13155_;
        let _e158 = phi_16208_;
        local_1 = _e156;
        if (_e158 < 17i) {
        } else {
            break;
        }
        local = array<vec2<f32>, 17>(vec2<f32>(-0.00107234f, -0.00400203f), vec2<f32>(0.00195312f, -0.00338291f), vec2<f32>(0.00400203f, -0.00107234f), vec2<f32>(-0.000714896f, -0.00266802f), vec2<f32>(0.000976565f, -0.00169146f), vec2<f32>(0.00266802f, -0.000714896f), vec2<f32>(-0.00338291f, -0.00195312f), vec2<f32>(-0.00169146f, -0.000976565f), vec2<f32>(0f, 0f), vec2<f32>(0.00169146f, 0.000976565f), vec2<f32>(0.00338291f, 0.00195312f), vec2<f32>(-0.00266802f, 0.000714896f), vec2<f32>(-0.000976565f, 0.00169146f), vec2<f32>(0.000714896f, 0.00266802f), vec2<f32>(-0.00400203f, 0.00107234f), vec2<f32>(-0.00195312f, 0.00338291f), vec2<f32>(0.00107234f, 0.00400202f));
        let _e167 = local[_e158];
        let _e171 = textureSample(global_5, global_2, (_e149 + (_e167 * 0.2f)).xy);
        continue;
        continuing {
            phi_13155_ = (_e156 + (_e171 * 0.05882353f));
            phi_16208_ = (_e158 + 1i);
        }
    }
    let _e161 = local_1;
    let _e162 = (_e161 * 2f);
    let _e164 = global_6.member_9;
    let _e165 = (_e164 != 0i);
    phi_18941_ = _e162;
    if _e165 {
        phi_18941_ = vec4<f32>(_e162.x, _e162.y, (_e162.z * -1f), _e162.w);
    }
    let _e183 = phi_18941_;
    let _e185 = global_3;
    let _e187 = textureSample(global_7, global_8, _e185.xy);
    let _e190 = global_6.member;
    let _e192 = global_6.member_1;
    let _e193 = textureSample(global_10, global_2, _e151);
    let _e197 = normalize(((_e193.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
    let _e198 = _e183.yz;
    let _e199 = _e190.xy;
    let _e203 = _e192.xy;
    let _e208 = textureSample(global_11, global_9, vec2<f32>((dot(_e198, _e199) + _e190.w), (dot(_e198, _e203) + _e192.w)));
    let _e210 = _e183.xz;
    let _e216 = textureSample(global_11, global_9, vec2<f32>((dot(_e210, _e199) + _e190.w), (dot(_e210, _e203) + _e192.w)));
    let _e218 = _e183.yx;
    let _e224 = textureSample(global_11, global_9, vec2<f32>((dot(_e218, _e199) + _e190.w), (dot(_e218, _e203) + _e192.w)));
    let _e229 = global_6.member_32;
    let _e241 = mix(mix(_e208.xyzw, _e216.xyzw, vec4((_e229.y * pow(abs(_e197.y), 7f)))), _e224.xyzw, vec4((_e229.z * pow(abs(_e197.z), 7f))));
    phi_22743_ = _e241;
    if _e165 {
        let _e243 = global_6.member_2;
        let _e245 = global_6.member_3;
        let _e246 = textureSample(global_10, global_2, _e151);
        let _e250 = normalize(((_e246.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e251 = _e243.xy;
        let _e255 = _e245.xy;
        let _e260 = textureSample(global_11, global_9, vec2<f32>((dot(_e198, _e251) + _e243.w), (dot(_e198, _e255) + _e245.w)));
        let _e267 = textureSample(global_11, global_9, vec2<f32>((dot(_e210, _e251) + _e243.w), (dot(_e210, _e255) + _e245.w)));
        let _e274 = textureSample(global_11, global_9, vec2<f32>((dot(_e218, _e251) + _e243.w), (dot(_e218, _e255) + _e245.w)));
        let _e290 = global_6.member_4;
        let _e292 = global_6.member_5;
        let _e293 = textureSample(global_10, global_2, _e151);
        let _e297 = normalize(((_e293.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e298 = _e290.xy;
        let _e302 = _e292.xy;
        let _e307 = textureSample(global_11, global_9, vec2<f32>((dot(_e198, _e298) + _e290.w), (dot(_e198, _e302) + _e292.w)));
        let _e314 = textureSample(global_11, global_9, vec2<f32>((dot(_e210, _e298) + _e290.w), (dot(_e210, _e302) + _e292.w)));
        let _e321 = textureSample(global_11, global_9, vec2<f32>((dot(_e218, _e298) + _e290.w), (dot(_e218, _e302) + _e292.w)));
        let _e337 = global_6.member_6;
        let _e339 = global_6.member_7;
        let _e340 = textureSample(global_10, global_2, _e151);
        let _e344 = normalize(((_e340.xyz * 2f) - vec3<f32>(1f, 1f, 1f)));
        let _e345 = _e337.xy;
        let _e349 = _e339.xy;
        let _e354 = textureSample(global_11, global_9, vec2<f32>((dot(_e198, _e345) + _e337.w), (dot(_e198, _e349) + _e339.w)));
        let _e361 = textureSample(global_11, global_9, vec2<f32>((dot(_e210, _e345) + _e337.w), (dot(_e210, _e349) + _e339.w)));
        let _e368 = textureSample(global_11, global_9, vec2<f32>((dot(_e218, _e345) + _e337.w), (dot(_e218, _e349) + _e339.w)));
        let _e384 = global_6.member_36;
        if (_e384 != 0i) {
            let _e444 = global_6.member_34;
            let _e448 = global_6.member_33;
            let _e454 = smoothstep(_e444.x, _e444.z, pow(((min(_e152.x, _e448) * _e152.y) * 2f), _e444.y));
            let _e456 = global_6.member_35;
            if (_e456.x > _e456.y) {
                let _e482 = (_e241.xyz * _e454);
                let _e488 = vec4<f32>(_e482.x, _e241.y, _e241.z, _e241.w);
                let _e494 = vec4<f32>(_e488.x, _e482.y, _e488.z, _e488.w);
                phi_12502_ = vec4<f32>(_e494.x, _e494.y, _e482.z, _e494.w);
            } else {
                let _e462 = (_e241.xyz * (1f - _e454));
                let _e468 = vec4<f32>(_e462.x, _e241.y, _e241.z, _e241.w);
                let _e474 = vec4<f32>(_e468.x, _e462.y, _e468.z, _e468.w);
                phi_12502_ = vec4<f32>(_e474.x, _e474.y, _e462.z, _e474.w);
            }
            let _e502 = phi_12502_;
            phi_21709_ = _e502;
        } else {
            let _e387 = global_6.member_34;
            let _e394 = smoothstep(_e387.x, _e387.z, pow(((_e152.x * _e152.y) * 2f), _e387.y));
            let _e396 = global_6.member_35;
            if (_e396.x > _e396.y) {
                let _e422 = (_e241.xyz * (1f - _e394));
                let _e428 = vec4<f32>(_e422.x, _e241.y, _e241.z, _e241.w);
                let _e434 = vec4<f32>(_e428.x, _e422.y, _e428.z, _e428.w);
                phi_12501_ = vec4<f32>(_e434.x, _e434.y, _e422.z, _e434.w);
            } else {
                let _e401 = (_e241.xyz * _e394);
                let _e407 = vec4<f32>(_e401.x, _e241.y, _e241.z, _e241.w);
                let _e413 = vec4<f32>(_e407.x, _e401.y, _e407.z, _e407.w);
                phi_12501_ = vec4<f32>(_e413.x, _e413.y, _e401.z, _e413.w);
            }
            let _e442 = phi_12501_;
            phi_21709_ = _e442;
        }
        let _e504 = phi_21709_;
        let _e506 = global_6.member_35;
        let _e514 = smoothstep(vec3(_e506.x), vec3(_e506.y), (_e504.xyz * vec3<f32>(mix(mix(_e260.xyzw, _e267.xyzw, vec4((_e229.y * pow(abs(_e250.y), 7f)))), _e274.xyzw, vec4((_e229.z * pow(abs(_e250.z), 7f)))).w, mix(mix(_e307.xyzw, _e314.xyzw, vec4((_e229.y * pow(abs(_e297.y), 7f)))), _e321.xyzw, vec4((_e229.z * pow(abs(_e297.z), 7f)))).w, mix(mix(_e354.xyzw, _e361.xyzw, vec4((_e229.y * pow(abs(_e344.y), 7f)))), _e368.xyzw, vec4((_e229.z * pow(abs(_e344.z), 7f)))).w)));
        let _e520 = vec4<f32>(_e514.x, _e504.y, _e504.z, _e504.w);
        let _e526 = vec4<f32>(_e520.x, _e514.y, _e520.z, _e520.w);
        phi_22743_ = vec4<f32>(_e526.x, _e526.y, _e514.z, _e526.w);
    }
    let _e534 = phi_22743_;
    let _e535 = global_4;
    let _e537 = textureSample(global_12, global_8, _e535.xy);
    let _e539 = global_6.member_39;
    switch _e539 {
        case 1: {
            phi_19017_ = vec4<f32>(_e537.x, _e537.y, _e537.z, (_e537.w * (1f - max(_e534.x, max(_e534.y, _e534.z)))));
            break;
        }
        case 2: {
            phi_19017_ = vec4<f32>(_e537.x, _e537.y, _e537.z, (_e537.w * (_e534.x * (1f - max(_e534.y, _e534.z)))));
            break;
        }
        case 3: {
            phi_19017_ = vec4<f32>(_e537.x, _e537.y, _e537.z, (_e537.w * (_e534.y * (1f - _e534.z))));
            break;
        }
        case 4: {
            phi_19017_ = vec4<f32>(_e537.x, _e537.y, _e537.z, (_e537.w * _e534.z));
            break;
        }
        case 5: {
            phi_19017_ = vec4<f32>(_e537.x, _e537.y, _e537.z, (_e537.w * max(_e534.x, max(_e534.y, _e534.z))));
            break;
        }
        case 7: {
            phi_19017_ = _e537;
            break;
        }
        default: {
            phi_19017_ = _e537;
            break;
        }
    }
    let _e598 = phi_19017_;
    let _e601 = global_6.member_12;
    let _e602 = (_e598.w * _e601);
    let _e605 = global_6.member_14;
    let _e606 = (_e598.xyz * _e605);
    let _e610 = vec4<f32>(_e606.x, _e606.y, _e606.z, _e602);
    let _e611 = (_e187.x * _e152.x);
    let _e614 = global_6.member_31;
    let _e616 = ((_e614 * 6f) + 1f);
    let _e620 = global_6.member_15;
    let _e624 = global_6.member_25;
    let _e634 = mix(mix(mix(_e624.x, _e624.y, _e534.x), _e624.z, _e534.y), _e624.w, _e534.z);
    let _e635 = ((((_e152.w + _e611) * _e616) * mix(1f, _e620, _e598.w)) * _e634);
    let _e637 = global_6.member_19;
    let _e638 = (_e637 * _e634);
    let _e643 = (0.56f - (0.06f * _e614));
    let _e647 = (0.54f - (_e614 * 0.12f));
    let _e657 = (_e534.xyz * vec3<f32>(smoothstep((0.58f + _e638), (_e643 - _e638), _e635), smoothstep((_e643 + _e638), (_e647 - _e638), _e635), smoothstep((_e647 + _e638), ((0.52f - (_e614 * 0.17999999f)) - _e638), _e635)).xyz);
    let _e661 = (0.58f - _e638);
    let _e662 = (0.68f + _e638);
    let _e663 = smoothstep(_e661, _e662, _e635);
    let _e672 = smoothstep(_e661, _e662, ((_e611 * _e616) * _e620));
    if (_e539 == 0i) {
        phi_21710_ = max(0f, mix(_e663, min(_e663, _e672), _e602));
    } else {
        phi_21710_ = _e663;
    }
    let _e678 = phi_21710_;
    let _e680 = global_6.member_40;
    phi_19287_ = _e610;
    if (_e680 == 4i) {
        phi_19287_ = vec4<f32>(_e610.x, _e610.y, _e610.z, (_e602 * clamp((1f - _e672), 0f, 1f)));
    }
    let _e691 = phi_19287_;
    let _e693 = textureSample(global_13, global_8, _e185.zw);
    let _e700 = mix(vec4<f32>(1f, 1f, 1f, 1f), _e693, vec4(((pow((1f - _e152.x), 4f) * 0.25f) + (0.75f * _e614))));
    let _e702 = global_6.member_30;
    let _e709 = mix(mix(mix(_e702.x, _e702.y, _e657.x), _e702.z, _e657.y), _e702.w, _e657.z);
    let _e711 = global_6.member_8;
    if (_e711 != 0i) {
        let _e713 = textureSample(global_14, global_2, _e151);
        let _e724 = global_6.member_27;
        if (_e724 != 0i) {
            let _e729 = global_6.member_28;
            phi_21711_ = mix(mix(mix(_e729.x, _e729.y, _e657.x), _e729.z, _e657.y), _e729.w, _e657.z);
        } else {
            let _e727 = global_6.member_26;
            phi_21711_ = _e727;
        }
        let _e738 = phi_21711_;
        let _e740 = global_6.member_13;
        let _e741 = (((1f - _e672) * _e691.w) * _e740);
        let _e743 = global_6.member_16;
        let _e746 = global_6.member_17;
        let _e747 = mix(_e709, _e746, _e741);
        let _e757 = mix(vec4<f32>(min(1f, (mix(_e738, _e743, _e741) + ((((1f - _e700.w) * _e614) * _e614) * 0.5f))), _e747, 0f, 1f), vec4<f32>(_e713.x, _e713.y, _e713.z, _e713.w), vec4(_e678));
        let _e760 = global_6.member_18;
        let _e762 = mix((1f - _e678), (_e760 - _e678), _e741);
        let _e769 = global_6.member_29;
        let _e771 = vec4<f32>(_e757.x, _e757.y, _e762, _e757.w).xyz;
        let _e772 = (_e771 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e775 = pow(((_e771 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e757.x <= 0.04045f) {
            phi_21354_ = _e772.x;
        } else {
            phi_21354_ = _e775.x;
        }
        let _e781 = phi_21354_;
        if (_e757.y <= 0.04045f) {
            phi_23035_ = _e772.y;
        } else {
            phi_23035_ = _e775.y;
        }
        let _e787 = phi_23035_;
        if (_e762 <= 0.04045f) {
            phi_19513_ = _e772.z;
        } else {
            phi_19513_ = _e775.z;
        }
        let _e792 = phi_19513_;
        let _e793 = vec4<f32>(_e781, _e787, _e762, min(1f, _e769));
        phi_11711_ = vec4<f32>(_e793.x, _e793.y, _e792, _e793.w);
        phi_10247_ = _e747;
    } else {
        phi_11711_ = vec4<f32>(_e149, 0f, 1f);
        phi_10247_ = _e709;
    }
    let _e800 = phi_11711_;
    let _e802 = phi_10247_;
    phi_22401_ = _e800;
    if (_e711 == 0i) {
        let _e804 = textureSample(global_15, global_2, _e151);
        let _e807 = global_6.member_20;
        let _e809 = global_6.member_21;
        let _e813 = global_6.member_22;
        let _e817 = global_6.member_23;
        let _e820 = _e804.xyz;
        let _e821 = vec3(_e678);
        let _e822 = mix(mix(mix(mix(_e807, _e809, vec3(_e657.x)), _e813, vec3(_e657.y)), _e817, vec3(_e657.z)).xyz, _e820, _e821);
        switch _e680 {
            case 0: {
                phi_21712_ = mix(_e822.xyz, _e691.xyz, vec3(_e691.w));
                break;
            }
            case 1: {
                let _e936 = global_6.member_10;
                let _e937 = _e822.xyz;
                let _e958 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e691.xyz * _e937).xyz)) * 1.06f);
                let _e960 = _e958.xyz;
                phi_21712_ = mix(_e822.xyz, mix(vec3(_e936.x), max(((((_e960 * _e936.x) * 1.732f) / vec3(length(_e960))) / vec3(dot(_e958.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e958 * mix(_e936.x, _e936.z, clamp(pow(max(_e822.x, max(_e822.y, _e822.z)), _e936.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e936.x, dot(clamp((_e937 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e691.w));
                break;
            }
            case 2: {
                let _e887 = _e822.xyz;
                let _e889 = (_e887 * _e691.xyz);
                let _e891 = global_6.member_10;
                let _e911 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e889.xyz)) * 1.06f);
                let _e913 = _e911.xyz;
                phi_21712_ = mix(_e887, mix(vec3(_e891.x), max(((((_e913 * _e891.x) * 1.732f) / vec3(length(_e913))) / vec3(dot(_e911.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e911 * mix(_e891.x, _e891.z, clamp(pow(max(_e889.x, max(_e889.y, _e889.z)), _e891.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e891.x, dot(clamp((_e889.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e691.w));
                break;
            }
            case 3: {
                let _e828 = _e822.xyz;
                let _e830 = (_e828 + _e691.xyz);
                let _e832 = global_6.member_10;
                let _e837 = dot(clamp((_e830.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e853 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e830.xyz)) * 1.06f);
                let _e855 = _e853.xyz;
                let _e866 = max(((((_e855 * _e832.x) * 1.732f) / vec3(length(_e855))) / vec3(dot(_e853.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e853 * mix(_e832.x, _e832.z, clamp(pow((max(_e830.x, max(_e830.y, _e830.z)) * 2f), _e832.y), 0f, 1f)))).xyz;
                let _e873 = global_6.member_11;
                phi_21712_ = mix(_e828, mix(vec3(_e832.x), mix(_e866, min(_e832.zzz, (_e866 + (vec3(_e837) * 2f))), vec3((1f / _e873))).xyz, vec3(pow(smoothstep(0.0003f, _e832.x, _e837), 0.5f))).xyz, vec3(_e691.w));
                break;
            }
            case 4: {
                phi_21712_ = mix(_e822.xyz, _e691.xyz, vec3(_e691.w));
                break;
            }
            default: {
                phi_21712_ = _e822;
                break;
            }
        }
        let _e987 = phi_21712_;
        let _e989 = global_6.member_24;
        let _e992 = clamp((_e987 * mix(_e989, 1f, (smoothstep(0f, 0.01f, _e663) * (1f - (smoothstep(0.5f, 0.6f, _e534.w) * smoothstep(1f, 0.9f, _e534.w)))))), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f));
        let _e995 = (_e992.xyz * _e700.xyz);
        let _e1000 = global_6.member_37;
        let _e1002 = global_6.member_38;
        let _e1005 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e995.xyz));
        let _e1013 = mix(_e1000.xyz, _e1002.xyz, vec3(_e802));
        let _e1033 = mix(mix(_e995, ((_e1005.xyz * mix(min(_e1013.x, dot(_e992.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e1013.z, clamp(pow(max(_e995.x, max(_e995.y, _e995.z)), _e1013.y), 0f, 1f))) / vec3(max(_e1005.x, max(_e1005.y, _e1005.z)))).xyz, vec3(_e614)), _e820, _e821);
        phi_22401_ = vec4<f32>(_e1033.x, _e1033.y, _e1033.z, 1f);
    }
    let _e1039 = phi_22401_;
    let _e1040 = textureSample(global_16, global_8, _e151);
    phi_6805_ = _e1039;
    if (_e1040.w < 0f) {
        let _e1048 = vec4<f32>(_e1040.x, _e1039.y, _e1039.z, _e1039.w);
        let _e1054 = vec4<f32>(_e1048.x, _e1040.y, _e1048.z, _e1048.w);
        phi_6805_ = vec4<f32>(_e1054.x, _e1054.y, _e1040.z, _e1054.w);
    }
    let _e1062 = phi_6805_;
    global_17 = _e1062;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_3 = param_1;
    global_4 = param_2;
    function_();
    let _e7 = global_17;
    return _e7;
}
