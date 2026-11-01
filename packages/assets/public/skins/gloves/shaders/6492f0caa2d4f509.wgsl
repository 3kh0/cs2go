struct type_6 {
    member: vec4<f32>,
    member_1: vec2<f32>,
    member_2: vec2<f32>,
    member_3: vec2<f32>,
    member_4: vec2<f32>,
    member_5: vec2<f32>,
    member_6: vec2<f32>,
    member_7: vec2<f32>,
    member_8: vec2<f32>,
    member_9: vec4<f32>,
    member_10: vec4<f32>,
    member_11: vec4<f32>,
    member_12: vec4<f32>,
    member_13: vec2<f32>,
    member_14: i32,
    member_15: f32,
    member_16: vec4<f32>,
    member_17: vec4<f32>,
}

struct VertexOutput {
    @location(0) member: vec4<f32>,
    @location(1) member_1: vec4<f32>,
    @location(2) member_2: vec4<f32>,
    @location(3) member_3: vec4<f32>,
    @location(4) member_4: vec4<f32>,
    @location(5) member_5: vec3<f32>,
    @location(6) member_6: vec4<f32>,
    @builtin(position) member_7: vec4<f32>,
}

var<private> global: vec2<f32>;
@group(0) @binding(0) 
var<storage> global_1: type_6;
var<private> global_2: vec2<f32>;
var<private> global_3: vec4<f32>;
var<private> global_4: vec4<f32>;
var<private> global_5: vec4<f32>;
var<private> global_6: vec4<f32>;
var<private> global_7: vec4<f32>;
var<private> global_8: vec3<f32>;
var<private> global_9: vec4<f32>;
var<private> global_10: vec4<f32> = vec4<f32>(0f, 0f, 0f, 1f);

fn function_() {
    var phi_19363_: vec4<f32>;

    let _e39 = global;
    let _e42 = global_1.member;
    let _e48 = ((((_e39.xy - _e42.xy) * 2f) / _e42.zw) - vec2<f32>(1f, 1f));
    let _e51 = vec4<f32>(_e48.x, f32(), 1f, 1f);
    let _e52 = global_2;
    let _e55 = vec4<f32>(_e52.x, _e52.y, _e52.x, _e52.y);
    let _e60 = vec4<f32>(_e52.x, vec4<f32>().y, vec4<f32>().z, vec4<f32>().w);
    let _e65 = vec4<f32>(_e60.x, _e52.y, _e60.z, _e60.w);
    let _e67 = global_1.member_14;
    phi_19363_ = _e65;
    if (_e67 != 0i) {
        phi_19363_ = vec4<f32>((_e52.x * -1f), _e65.y, _e65.z, _e65.w);
    }
    let _e76 = phi_19363_;
    let _e77 = _e76.xy;
    let _e79 = global_1.member_16;
    let _e85 = global_1.member_17;
    let _e91 = global_1.member_15;
    let _e94 = global_1.member_13;
    let _e96 = (vec2(_e91) * _e94.xy);
    let _e100 = _e55.xy;
    let _e102 = global_1.member_9;
    let _e108 = global_1.member_10;
    let _e114 = global_1.member_11;
    let _e120 = global_1.member_12;
    let _e126 = _e55.xy;
    let _e128 = global_1.member_1;
    let _e132 = global_1.member_2;
    let _e134 = ((_e126 * _e128.xy) + _e132.xy);
    let _e138 = global_1.member_3;
    let _e142 = global_1.member_4;
    let _e144 = ((_e126 * _e138.xy) + _e142.xy);
    let _e149 = global_1.member_5;
    let _e153 = global_1.member_6;
    let _e155 = ((_e126 * _e149.xy) + _e153.xy);
    let _e159 = global_1.member_7;
    let _e163 = global_1.member_8;
    let _e165 = ((_e126 * _e159.xy) + _e163.xy);
    global_3 = _e55;
    global_4 = vec4<f32>((dot(_e77, _e79.xy) + _e79.w), (dot(_e77, _e85.xy) + _e85.w), _e96.x, _e96.y);
    global_5 = vec4<f32>(_e134.x, _e134.y, _e144.x, _e144.y);
    global_6 = vec4<f32>(_e155.x, _e155.y, _e165.x, _e165.y);
    global_7 = vec4<f32>((dot(_e100, _e102.xy) + _e102.w), (dot(_e100, _e108.xy) + _e108.w), (dot(_e100, _e114.xy) + _e114.w), (dot(_e100, _e120.xy) + _e120.w));
    global_8 = vec3<f32>(0f, 0f, 1f);
    global_9 = vec4<f32>(1f, 0f, 0f, 1f);
    global_10 = vec4<f32>(_e51.x, _e48.y, _e51.z, _e51.w);
    return;
}

@vertex 
fn MainVs(@location(0) param: vec2<f32>, @location(1) param_1: vec2<f32>) -> VertexOutput {
    global = param;
    global_2 = param_1;
    function_();
    let _e13 = global_10.y;
    global_10.y = -(_e13);
    let _e15 = global_3;
    let _e16 = global_4;
    let _e17 = global_5;
    let _e18 = global_6;
    let _e19 = global_7;
    let _e20 = global_8;
    let _e21 = global_9;
    let _e22 = global_10;
    return VertexOutput(_e15, _e16, _e17, _e18, _e19, _e20, _e21, _e22);
}
