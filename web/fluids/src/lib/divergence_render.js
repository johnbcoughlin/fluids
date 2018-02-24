// @flow
import {createProgram, loadShader} from "../gl_util";
import {toGridClipcoords, toGridTexcoords, toVelocityXTexcoords, toVelocityYTexcoords} from "./grids";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";

export class DivergenceRender {
  gl;
  nx;
  dx;
  ny;
  dy;
  divergence;
  velocityX;
  velocityY;
  solidDistance;
  airDistance;

  program;
  vao;
  gridcoords;
  uniformVelocityXTextureLocation;
  uniformVelocityYTextureLocation;
  solidDistanceLocation;
  airDistanceLocation;

  constructor(gl: any,
              nx: num,
              dx: num,
              ny: num,
              dy: num,
              divergence: TwoPhaseRenderTarget,
              velocityX: TwoPhaseRenderTarget,
              velocityY: TwoPhaseRenderTarget,
              solidDistance: TwoPhaseRenderTarget,
              airDistance: TwoPhaseRenderTarget) {
    this.gl = gl;
    this.nx = nx;
    this.dx = dx;
    this.ny = ny;
    this.dy = dy;
    this.divergence = divergence;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.solidDistance = solidDistance;
    this.airDistance = airDistance;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    gl.useProgram(this.program);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.setupPositions(gl, this.program);
    gl.bindVertexArray(null);

    this.uniformVelocityXTextureLocation = gl.getUniformLocation(this.program, "u_velocityXTexture");
    this.uniformVelocityYTextureLocation = gl.getUniformLocation(this.program, "u_velocityYTexture");
    this.solidDistanceLocation = gl.getUniformLocation(this.program, "solidDistance");
    this.airDistanceLocation = gl.getUniformLocation(this.program, "airDistance");

    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridClipcoords"),
        false, toGridClipcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toVelocityXTexcoords"),
        false, toVelocityXTexcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toVelocityYTexcoords"),
        false, toVelocityYTexcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridTexcoords"),
        false, toGridTexcoords(this.nx, this.ny));
    gl.uniform1f(gl.getUniformLocation(this.program, "dx"), this.dx);
    gl.uniform1f(gl.getUniformLocation(this.program, "dy"), this.dy);
  }

  setupPositions(gl, program) {
    const gridcoordsAttributeLocation = gl.getAttribLocation(program, "a_gridcoords");
    const buffer = gl.createBuffer();
    this.gridcoords = [];
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny; j++) {
        this.gridcoords.push(i, j);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.gridcoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gridcoordsAttributeLocation);
    gl.vertexAttribPointer(gridcoordsAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render() {
    this.gl.useProgram(this.program);
    this.velocityX.renderFromB(this.uniformVelocityXTextureLocation);
    this.velocityY.renderFromB(this.uniformVelocityYTextureLocation);
    this.solidDistance.renderFromA(this.solidDistanceLocation);
    this.airDistance.renderFromA(this.airDistanceLocation);
    this.divergence.renderToA();
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.gridcoords.length / 2);
    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `
in vec2 a_gridcoords;

out vec2 v_gridcoords;

uniform mat4 toGridClipcoords;

void main() {
  v_gridcoords = a_gridcoords;
  gl_Position = toGridClipcoords * vec4(a_gridcoords, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;

const fragmentShaderSource = `
precision mediump float;

in vec2 v_gridcoords;

uniform sampler2D u_velocityXTexture;
uniform sampler2D u_velocityYTexture;
uniform sampler2D solidDistance;
uniform sampler2D airDistance;

uniform mat4 toVelocityXTexcoords;
uniform mat4 toVelocityYTexcoords;
uniform mat4 toGridTexcoords;
uniform float dx;
uniform float dy;

out float divergence;

void main() {
  ivec2 here = ivec2(v_gridcoords.xy);
  
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
  
  float R = texelFetch(u_velocityXTexture, here, 0).x;
  float L = texelFetch(u_velocityXTexture, here + ivec2(1, 0), 0).x;
  float U = texelFetch(u_velocityYTexture, here, 0).x;
  float D = texelFetch(u_velocityYTexture, here + ivec2(0, 1), 0).x;
  
  bool solid = max4(texelFetch(solidDistance, here, 0)) == 0.0;
  bool air = max4(texelFetch(airDistance, here, 0)) == 0.0;
  bool water = !solid && !air;
  
  if (water) {
    divergence = ((R - L) + (U - D)) * 0.5;
  } else {
    divergence = 0.0;
  }
}
`;