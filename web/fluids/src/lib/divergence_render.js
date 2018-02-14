import {createProgram, loadShader, renderToCanvas} from "../gl_util";

export class DivergenceRender {

}

const vertexShaderSource = `#version 300 es
in vec2 a_gridcoords;

out vec2 v_gridcoords;

uniform mat4 toVelocityYClipcoords;

void main() {
  gl_Position = toVelocityYClipcoords * vec4(a_gridcoords, 0.0, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 v_gridcoords;

uniform sampler2D u_velocityXTexture;
uniform sampler2D u_velocityYTexture;

uniform mat4 toVelocityXTexcoords;
uniform mat4 toVelociyYTexcoords;

out float divergence;

void main() {
  vec4 gc4 = vec4(v_gridcoords, 0.0, 1.0);
  
  vec4 xc = vec4(v_gridcoords.x + 0.5, v_gridcoords.y, 0.0, 1.0);
  vec4 one_half_x = vec4(0.5, 0.0, 0.0, 0.0);
  
  vec4 xc_left = xc - one_half_x;
  vec4 xtc_left = toVelocityXTexcoords * xc_left;
  vec4 xc_right = xc + one_half_x;
  vec4 xtc_right = toVelocityXTexcoords * xc_right;
  
  vec4 yc = vec4(v_gridcoords.x, v_gridcoords.y + 0.5, 0.0, 1.0);
  vec4 one_half_y = vec4(0.0, 0.5, 0.0, 0.0);
  
  vec4 yc_down = yc - one_half_y;
  vec4 ytc_down = toVelocityYTexcoords * yc_down;
  vec4 yc_up = yc + one_half_y;
  vec4 ytc_up = toVelocityYTexcoords * yc_up;
  
  float R = texture(u_velocityXTexture, xc_right).x;
  float L = texture(u_velocityXTexture, xc_left).x;
  float U = texture(u_velocityYTexture, yc_up).x;
  float D = texture(u_velocityYTexture, yc_down).x;
  
  divergence = ((R - L) + (U - D)) * 0.5;
}
`;