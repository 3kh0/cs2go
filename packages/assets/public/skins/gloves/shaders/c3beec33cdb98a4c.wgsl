struct type_5 {
    member: vec4<f32>,
}

struct VertexOutput {
    @location(0) member: vec4<f32>,
    @builtin(position) member_1: vec4<f32>,
}

var<private> global: vec2<f32>;
@group(0) @binding(0) 
var<storage> global_1: type_5;
var<private> global_2: vec2<f32>;
var<private> global_3: vec4<f32>;
var<private> global_4: vec4<f32> = vec4<f32>(0f, 0f, 0f, 1f);

fn function_() {
    let _e10 = global;
    let _e13 = global_1.member;
    let _e19 = ((((_e10.xy - _e13.xy) * 2f) / _e13.zw) - vec2<f32>(1f, 1f));
    let _e22 = vec4<f32>(_e19.x, f32(), 1f, 1f);
    let _e23 = global_2;
    global_3 = vec4<f32>(_e23.x, _e23.y, _e23.x, _e23.y);
    global_4 = vec4<f32>(_e22.x, _e19.y, _e22.z, _e22.w);
    return;
}

@vertex 
fn MainVs(@location(0) param: vec2<f32>, @location(1) param_1: vec2<f32>) -> VertexOutput {
    global = param;
    global_2 = param_1;
    function_();
    let _e7 = global_4.y;
    global_4.y = -(_e7);
    let _e9 = global_3;
    let _e10 = global_4;
    return VertexOutput(_e9, _e10);
}
