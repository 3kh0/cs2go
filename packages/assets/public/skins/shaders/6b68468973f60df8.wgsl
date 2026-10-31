struct type_9 {
    member: i32,
    member_1: vec3<f32>,
    member_2: f32,
    member_3: i32,
    member_4: f32,
    member_5: f32,
    member_6: f32,
    member_7: f32,
    member_8: f32,
    member_9: f32,
    member_10: f32,
    member_11: f32,
    member_12: vec3<f32>,
    member_13: vec3<f32>,
    member_14: vec3<f32>,
    member_15: vec3<f32>,
    member_16: f32,
    member_17: i32,
    member_18: f32,
    member_19: i32,
    member_20: f32,
    member_21: f32,
    member_22: vec3<f32>,
    member_23: vec3<f32>,
    member_24: i32,
    member_25: i32,
}

var<private> global: vec4<f32>;
@group(1) @binding(30) 
var global_1: texture_2d<f32>;
@group(1) @binding(23) 
var global_2: sampler;
@group(1) @binding(31) 
var global_3: texture_2d<f32>;
var<private> global_4: vec4<f32>;
@group(1) @binding(41) 
var global_5: texture_2d<f32>;
@group(1) @binding(22) 
var global_6: sampler;
@group(1) @binding(40) 
var global_7: texture_2d<f32>;
@group(1) @binding(27) 
var global_8: sampler;
var<private> global_9: vec2<f32>;
@group(1) @binding(38) 
var global_10: texture_2d<f32>;
@group(1) @binding(39) 
var global_11: texture_2d<f32>;
@group(1) @binding(0) 
var<storage> global_12: type_9;
@group(1) @binding(42) 
var global_13: texture_2d<f32>;
@group(1) @binding(35) 
var global_14: texture_2d<f32>;
@group(1) @binding(36) 
var global_15: texture_2d<f32>;
@group(1) @binding(34) 
var global_16: texture_2d<f32>;
@group(1) @binding(37) 
var global_17: texture_2d<f32>;
var<private> global_18: vec4<f32>;

fn function_() {
    var phi_19017_: vec4<f32>;
    var phi_21709_: f32;
    var phi_10021_: f32;
    var phi_21710_: f32;
    var phi_19287_: vec4<f32>;
    var phi_21903_: f32;
    var phi_19018_: vec4<f32>;
    var phi_21354_: f32;
    var phi_23035_: f32;
    var phi_19513_: f32;
    var phi_11711_: vec4<f32>;
    var phi_10247_: f32;
    var phi_9750_: vec3<f32>;
    var phi_19340_: vec3<f32>;
    var phi_22401_: vec4<f32>;
    var phi_6805_: vec4<f32>;

    let _e99 = global;
    let _e102 = _e99.xy;
    let _e103 = textureSample(global_1, global_2, _e102);
    let _e105 = pow(_e103.x, 1.5f);
    let _e106 = (_e105 * 0.96f);
    let _e108 = textureSample(global_3, global_2, _e102);
    let _e111 = (1f - _e108.x);
    let _e113 = global_4;
    let _e115 = textureSample(global_5, global_6, _e113.xy);
    let _e117 = _e99.zw;
    let _e118 = textureSample(global_7, global_8, _e117);
    let _e119 = global_9;
    let _e121 = textureSample(global_10, global_6, _e119.xy);
    let _e122 = textureSample(global_11, global_6, _e102);
    let _e125 = global_12.member_24;
    phi_19017_ = _e121;
    if (_e125 == 8i) {
        phi_19017_ = vec4<f32>(_e121.x, _e121.y, _e121.z, (_e121.w * _e122.x));
    }
    let _e135 = phi_19017_;
    let _e138 = global_12.member_4;
    let _e139 = (_e135.w * _e138);
    let _e142 = global_12.member_6;
    let _e143 = (_e135.xyz * _e142);
    let _e147 = vec4<f32>(_e143.x, _e143.y, _e143.z, _e139);
    let _e152 = global_12.member_21;
    let _e155 = (_e115.x * mix(smoothstep(0f, 0.72f, pow(_e106, 1.3f)), smoothstep(0f, 0.4f, _e106), pow(_e152, 1.2f)));
    let _e158 = ((_e152 * 6f) + 1f);
    let _e166 = smoothstep(0f, 0.5f, _e118.w);
    let _e167 = (_e125 == 0i);
    if _e167 {
        phi_21709_ = max(0f, _e166);
    } else {
        phi_21709_ = _e166;
    }
    let _e170 = phi_21709_;
    let _e172 = global_12.member_7;
    let _e174 = (_e170 * mix(1f, _e172, _e135.w));
    if (_e125 > 0i) {
        phi_10021_ = max(0f, _e174);
    } else {
        phi_10021_ = _e174;
    }
    let _e178 = phi_10021_;
    let _e179 = ((((min(_e103.w, _e111) + _e155) * _e158) + (smoothstep(0.5f, 0.6f, _e118.w) * smoothstep(1f, 0.9f, _e118.w))) * _e178);
    let _e181 = global_12.member_11;
    let _e182 = (_e181 * _e178);
    let _e186 = (_e108.x > 0.99f);
    let _e188 = mix(smoothstep((0.58f - _e182), (0.68f + _e182), _e179), _e179, select(0f, 1f, _e186));
    let _e192 = smoothstep((0.56f - _e182), (0.74f + _e182), ((_e155 * _e158) * _e172));
    if _e167 {
        phi_21710_ = max(0f, mix(_e188, min(_e188, _e192), _e139));
    } else {
        phi_21710_ = _e188;
    }
    let _e197 = phi_21710_;
    let _e199 = global_12.member_25;
    phi_19287_ = _e147;
    if (_e199 == 4i) {
        phi_19287_ = vec4<f32>(_e147.x, _e147.y, _e147.z, (_e139 * clamp((1f - _e192), 0f, 1f)));
    }
    let _e210 = phi_19287_;
    let _e212 = textureSample(global_13, global_6, _e113.zw);
    let _e231 = smoothstep(0.2f, 0.6f, (((_e115.x * _e103.y) * (_e115.x * smoothstep(0.2f, 0.3f, _e106))) * _e152));
    let _e240 = (smoothstep((0.5f * _e152), 0f, clamp((((_e105 * 11.5199995f) * _e103.y) - ((_e152 * clamp(((_e212.x * _e212.y) * _e212.z), 0f, 1f)) * 2f)), 0f, 1f)) * _e152);
    let _e241 = (1f - _e240);
    let _e245 = max(mix(vec4<f32>(1f, 1f, 1f, 1f), _e212, vec4(((pow((1f - _e106), 4f) * 0.25f) + (0.75f * _e152)))), vec4(clamp((_e231 * 2f), 0f, 1f)));
    let _e247 = global_12.member;
    if (_e247 != 0i) {
        let _e249 = textureSample(global_14, global_2, _e102);
        let _e251 = (1f - _e197);
        let _e257 = global_12.member_3;
        if (_e257 != 0i) {
            let _e259 = textureSample(global_15, global_6, _e117);
            phi_21903_ = _e259.x;
        } else {
            let _e261 = textureSample(global_15, global_6, _e102);
            phi_21903_ = _e261.x;
        }
        let _e264 = phi_21903_;
        let _e269 = dot(_e245.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
        let _e279 = ((1f - _e245.w) * _e152);
        let _e282 = clamp(((((_e264 * mix(1f, 0.9f, _e231)) + (((1f - _e269) * _e152) * 0.05f)) + ((_e240 * 0.15f) * _e152)) + (_e279 * 0.15f)), 0f, 1f);
        let _e292 = mix(mix(1f, pow(((_e241 * _e245.w) * _e269), 0.5f), _e152), 1f, _e231);
        let _e295 = global_12.member_5;
        let _e296 = (((1f - _e192) * _e210.w) * _e295);
        let _e298 = global_12.member_8;
        let _e304 = vec4<f32>(mix(mix(_e249.x, mix(min(1f, (_e282 + ((_e279 * _e152) * 0.5f))), _e282, _e108.x), select(max(0f, _e251), 1f, _e186)), _e298, _e296), vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e307 = global_12.member_20;
        let _e311 = global_12.member_9;
        let _e317 = vec4<f32>(_e304.x, mix(mix(mix(_e307, _e249.y, _e197), _e292, _e108.x), _e311, _e296), _e304.z, _e304.w);
        let _e322 = vec4<f32>(_e317.x, _e317.y, _e251, _e317.w);
        let _e324 = global_12.member_19;
        phi_19018_ = _e322;
        if (_e324 != 0i) {
            phi_19018_ = vec4<f32>(_e322.x, _e322.y, (_e251 * _e108.x), _e322.w);
        }
        let _e333 = phi_19018_;
        let _e336 = global_12.member_10;
        let _e338 = mix(_e333.z, (_e336 - _e197), _e296);
        let _e345 = global_12.member_18;
        let _e347 = vec4<f32>(_e333.x, _e333.y, _e338, _e333.w).xyz;
        let _e348 = (_e347 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
        let _e351 = pow(((_e347 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
        if (_e333.x <= 0.04045f) {
            phi_21354_ = _e348.x;
        } else {
            phi_21354_ = _e351.x;
        }
        let _e357 = phi_21354_;
        if (_e333.y <= 0.04045f) {
            phi_23035_ = _e348.y;
        } else {
            phi_23035_ = _e351.y;
        }
        let _e363 = phi_23035_;
        if (_e338 <= 0.04045f) {
            phi_19513_ = _e348.z;
        } else {
            phi_19513_ = _e351.z;
        }
        let _e368 = phi_19513_;
        let _e369 = vec4<f32>(_e357, _e363, _e338, min(1f, _e345));
        phi_11711_ = vec4<f32>(_e369.x, _e369.y, _e368, _e369.w);
        phi_10247_ = _e292;
    } else {
        phi_11711_ = vec4<f32>(_e99.xy, 0f, 1f);
        phi_10247_ = 1f;
    }
    let _e376 = phi_11711_;
    let _e378 = phi_10247_;
    phi_22401_ = _e376;
    if (_e247 == 0i) {
        let _e380 = textureSample(global_16, global_2, _e102);
        let _e382 = vec3(_e152);
        let _e384 = global_12.member_13;
        let _e386 = global_12.member_14;
        let _e388 = _e118.xyz;
        let _e390 = global_12.member_16;
        let _e393 = global_12.member_17;
        let _e397 = mix(_e388, (_e388 * _e390), vec3(max(_e108.x, f32(_e393))));
        let _e403 = vec4<f32>(_e397.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e409 = vec4<f32>(_e403.x, _e397.y, _e403.z, _e403.w);
        let _e415 = vec4<f32>(_e409.x, _e409.y, _e397.z, _e409.w);
        let _e419 = global_12.member_15;
        let _e423 = _e415.xyz;
        let _e427 = global_12.member_12;
        let _e430 = mix((mix(mix(_e384, _e419, vec3(pow(_e152, 0.5f))), mix(_e384, _e386, _e382), vec3(_e241)) * _e423), (_e427 * dot(_e415.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), vec3(_e231));
        let _e435 = ((1f - _e192) * _e210.w);
        let _e436 = vec4<f32>(_e210.xyz, _e435);
        switch _e199 {
            case 0: {
                phi_9750_ = mix(_e430.xyz, _e436.xyz, vec3(_e435));
                break;
            }
            case 1: {
                let _e441 = _e430.xyz;
                let _e443 = global_12.member_1;
                let _e464 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e436.xyz * _e441).xyz)) * 1.06f);
                let _e466 = _e464.xyz;
                phi_9750_ = mix(_e441, mix(vec3(_e443.x), max(((((_e466 * _e443.x) * 1.732f) / vec3(length(_e466))) / vec3(dot(_e464.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e464 * mix(_e443.x, _e443.z, clamp(pow(max(_e430.x, max(_e430.y, _e430.z)), _e443.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e443.x, dot(clamp((_e441 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e435));
                break;
            }
            case 2: {
                let _e486 = _e430.xyz;
                let _e488 = (_e486 * _e436.xyz);
                let _e490 = global_12.member_1;
                let _e510 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e488.xyz)) * 1.06f);
                let _e512 = _e510.xyz;
                phi_9750_ = mix(_e486, mix(vec3(_e490.x), max(((((_e512 * _e490.x) * 1.732f) / vec3(length(_e512))) / vec3(dot(_e510.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e510 * mix(_e490.x, _e490.z, clamp(pow(max(_e488.x, max(_e488.y, _e488.z)), _e490.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e490.x, dot(clamp((_e488.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e435));
                break;
            }
            case 3: {
                let _e532 = _e430.xyz;
                let _e534 = (_e532 + _e436.xyz);
                let _e536 = global_12.member_1;
                let _e541 = dot(clamp((_e534.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e557 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e534.xyz)) * 1.06f);
                let _e559 = _e557.xyz;
                let _e570 = max(((((_e559 * _e536.x) * 1.732f) / vec3(length(_e559))) / vec3(dot(_e557.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e557 * mix(_e536.x, _e536.z, clamp(pow((max(_e534.x, max(_e534.y, _e534.z)) * 2f), _e536.y), 0f, 1f)))).xyz;
                let _e577 = global_12.member_2;
                phi_9750_ = mix(_e532, mix(vec3(_e536.x), mix(_e570, min(_e536.zzz, (_e570 + (vec3(_e541) * 2f))), vec3((1f / _e577))).xyz, vec3(pow(smoothstep(0.0003f, _e536.x, _e541), 0.5f))).xyz, vec3(_e435));
                break;
            }
            case 4: {
                phi_9750_ = mix(_e430.xyz, _e436.xyz, vec3(_e435));
                break;
            }
            default: {
                phi_9750_ = _e430.xyz;
                break;
            }
        }
        let _e595 = phi_9750_;
        let _e597 = _e380.xyz;
        let _e599 = mix(clamp(_e423, vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)), _e597, vec3(_e197));
        switch _e199 {
            case 0: {
                phi_19340_ = mix(_e599.xyz, _e210.xyz, vec3(_e210.w));
                break;
            }
            case 1: {
                let _e606 = global_12.member_1;
                let _e607 = _e599.xyz;
                let _e628 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), (_e210.xyz * _e607).xyz)) * 1.06f);
                let _e630 = _e628.xyz;
                phi_19340_ = mix(_e599.xyz, mix(vec3(_e606.x), max(((((_e630 * _e606.x) * 1.732f) / vec3(length(_e630))) / vec3(dot(_e628.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e628 * mix(_e606.x, _e606.z, clamp(pow(max(_e599.x, max(_e599.y, _e599.z)), _e606.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e606.x, dot(clamp((_e607 * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e210.w));
                break;
            }
            case 2: {
                let _e650 = _e599.xyz;
                let _e652 = (_e650 * _e210.xyz);
                let _e654 = global_12.member_1;
                let _e674 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e652.xyz)) * 1.06f);
                let _e676 = _e674.xyz;
                phi_19340_ = mix(_e650, mix(vec3(_e654.x), max(((((_e676 * _e654.x) * 1.732f) / vec3(length(_e676))) / vec3(dot(_e674.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e674 * mix(_e654.x, _e654.z, clamp(pow(max(_e652.x, max(_e652.y, _e652.z)), _e654.y), 0f, 1f)))).xyz, vec3(pow(smoothstep(0.0003f, _e654.x, dot(clamp((_e652.xyz * 1f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), 0.5f))).xyz, vec3(_e210.w));
                break;
            }
            case 3: {
                let _e696 = _e599.xyz;
                let _e698 = (_e696 + _e210.xyz);
                let _e700 = global_12.member_1;
                let _e705 = dot(clamp((_e698.xyz * 2f), vec3<f32>(0f, 0f, 0f), vec3<f32>(1f, 1f, 1f)).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f));
                let _e721 = (normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e698.xyz)) * 1.06f);
                let _e723 = _e721.xyz;
                let _e734 = max(((((_e723 * _e700.x) * 1.732f) / vec3(length(_e723))) / vec3(dot(_e721.xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f)))), (_e721 * mix(_e700.x, _e700.z, clamp(pow((max(_e698.x, max(_e698.y, _e698.z)) * 2f), _e700.y), 0f, 1f)))).xyz;
                let _e741 = global_12.member_2;
                phi_19340_ = mix(_e696, mix(vec3(_e700.x), mix(_e734, min(_e700.zzz, (_e734 + (vec3(_e705) * 2f))), vec3((1f / _e741))).xyz, vec3(pow(smoothstep(0.0003f, _e700.x, _e705), 0.5f))).xyz, vec3(_e210.w));
                break;
            }
            case 4: {
                phi_19340_ = mix(_e599.xyz, _e210.xyz, vec3(_e210.w));
                break;
            }
            default: {
                phi_19340_ = _e599;
                break;
            }
        }
        let _e759 = phi_19340_;
        let _e765 = vec4<f32>(_e759.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
        let _e771 = vec4<f32>(_e765.x, _e759.y, _e765.z, _e765.w);
        let _e778 = vec4<f32>(_e771.x, _e771.y, _e759.z, _e771.w).xyz;
        let _e779 = vec3(_e108.x);
        let _e786 = (mix(_e778, _e595, _e779).xyz * _e245.xyz);
        let _e791 = global_12.member_20;
        let _e794 = global_12.member_22;
        let _e796 = global_12.member_23;
        let _e799 = normalize(max(vec3<f32>(0.0003f, 0.0003f, 0.0003f), _e786.xyz));
        let _e807 = mix(_e794.xyz, _e796.xyz, vec3(mix(_e791, _e378, _e108.x)));
        let _e827 = mix(mix(_e786, ((_e799.xyz * mix(min(_e807.x, dot(mix(_e778, (_e778 * _e384), _e779).xyz, vec3<f32>(0.2125f, 0.7154f, 0.0721f))), _e807.z, clamp(pow(max(_e786.x, max(_e786.y, _e786.z)), _e807.y), 0f, 1f))) / vec3(max(_e799.x, max(_e799.y, _e799.z)))).xyz, _e382), _e597, vec3((_e197 * _e111)));
        phi_22401_ = vec4<f32>(_e827.x, _e827.y, _e827.z, 1f);
    }
    let _e833 = phi_22401_;
    let _e834 = textureSample(global_17, global_6, _e102);
    phi_6805_ = _e833;
    if (_e834.w < 0f) {
        let _e842 = vec4<f32>(_e834.x, _e833.y, _e833.z, _e833.w);
        let _e848 = vec4<f32>(_e842.x, _e834.y, _e842.z, _e842.w);
        phi_6805_ = vec4<f32>(_e848.x, _e848.y, _e834.z, _e848.w);
    }
    let _e856 = phi_6805_;
    global_18 = _e856;
    return;
}

@fragment 
fn MainPs(@location(1) param: vec4<f32>, @location(2) param_1: vec4<f32>, @location(3) param_2: vec2<f32>) -> @location(0) vec4<f32> {
    global = param;
    global_4 = param_1;
    global_9 = param_2;
    function_();
    let _e7 = global_18;
    return _e7;
}
