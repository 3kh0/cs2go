struct type_5 {
    member: vec4<f32>,
    member_1: vec4<f32>,
    member_2: vec4<f32>,
    member_3: vec4<f32>,
    member_4: vec4<f32>,
    member_5: vec4<f32>,
    member_6: i32,
    member_7: i32,
    member_8: vec4<f32>,
    member_9: vec4<f32>,
    member_10: vec4<f32>,
}

struct VertexOutput {
    @location(0) member: vec4<f32>,
    @location(1) member_1: vec4<f32>,
    @location(2) member_2: vec4<f32>,
    @location(3) member_3: vec2<f32>,
    @builtin(position) member_4: vec4<f32>,
}

var<private> global: vec2<f32>;
@group(0) @binding(0) 
var<storage> global_1: type_5;
var<private> global_2: vec4<f32>;
var<private> global_3: vec2<f32>;
var<private> global_4: vec4<f32>;
var<private> global_5: vec4<f32>;
var<private> global_6: vec4<f32>;
var<private> global_7: vec2<f32>;
var<private> global_8: vec4<f32> = vec4<f32>(0f, 0f, 0f, 1f);

fn function_() {
    var phi_21354_: f32;
    var phi_21355_: f32;
    var phi_19302_: f32;
    var phi_12501_: vec2<f32>;
    var phi_22247_: vec2<f32>;

    let _e35 = global;
    let _e38 = global_1.member_10;
    let _e44 = ((((_e35.xy - _e38.xy) * 2f) / _e38.zw) - vec2<f32>(1f, 1f));
    let _e47 = vec4<f32>(_e44.x, f32(), 1f, 1f);
    let _e48 = global_2;
    let _e49 = _e48.xyz;
    let _e50 = (_e49 * vec3<f32>(0.07739938f, 0.07739938f, 0.07739938f));
    let _e53 = pow(((_e49 * vec3<f32>(0.94786733f, 0.94786733f, 0.94786733f)) + vec3<f32>(0.052132703f, 0.052132703f, 0.052132703f)), vec3<f32>(2.4f, 2.4f, 2.4f));
    if (_e48.x <= 0.04045f) {
        phi_21354_ = _e50.x;
    } else {
        phi_21354_ = _e53.x;
    }
    let _e59 = phi_21354_;
    if (_e48.y <= 0.04045f) {
        phi_21355_ = _e50.y;
    } else {
        phi_21355_ = _e53.y;
    }
    let _e65 = phi_21355_;
    if (_e48.z <= 0.04045f) {
        phi_19302_ = _e50.z;
    } else {
        phi_19302_ = _e53.z;
    }
    let _e71 = phi_19302_;
    let _e74 = global_3;
    let _e77 = _e74.xy;
    let _e79 = global_1.member;
    let _e83 = (dot(_e77, _e79.xy) + _e79.w);
    let _e85 = global_1.member_1;
    let _e89 = (dot(_e77, _e85.xy) + _e85.w);
    let _e92 = global_1.member_2;
    let _e98 = global_1.member_3;
    let _e104 = global_1.member_4;
    let _e110 = global_1.member_5;
    let _e117 = global_1.member_7;
    phi_22247_ = _e74;
    if (_e117 != 0i) {
        let _e120 = global_1.member_6;
        if (_e120 != 0i) {
            let _e123 = global_1.member_8;
            let _e129 = global_1.member_9;
            phi_12501_ = vec2<f32>((dot(_e77, _e123.xy) + _e123.w), (dot(_e77, _e129.xy) + _e129.w));
        } else {
            phi_12501_ = vec2<f32>(_e83, _e89);
        }
        let _e137 = phi_12501_;
        phi_22247_ = _e137;
    }
    let _e139 = phi_22247_;
    global_4 = vec4<f32>(_e59, _e65, _e71, _e48.w);
    global_5 = vec4<f32>(_e74.x, _e74.y, _e83, _e89);
    global_6 = vec4<f32>((dot(_e77, _e92.xy) + _e92.w), (dot(_e77, _e98.xy) + _e98.w), (dot(_e77, _e104.xy) + _e104.w), (dot(_e77, _e110.xy) + _e110.w));
    global_7 = _e139;
    global_8 = vec4<f32>(_e47.x, _e44.y, _e47.z, _e47.w);
    return;
}

@vertex 
fn MainVs(@location(0) param: vec2<f32>, @location(1) param_1: vec4<f32>, @location(2) param_2: vec2<f32>) -> VertexOutput {
    global = param;
    global_2 = param_1;
    global_3 = param_2;
    function_();
    let _e12 = global_8.y;
    global_8.y = -(_e12);
    let _e14 = global_4;
    let _e15 = global_5;
    let _e16 = global_6;
    let _e17 = global_7;
    let _e18 = global_8;
    return VertexOutput(_e14, _e15, _e16, _e17, _e18);
}
