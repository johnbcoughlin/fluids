// @flow

import {TwoPhaseRenderTarget} from "./two_phase_render_target";
import {createProgram, loadShader} from "../gl_util";
import {toVelocityXClipcoords, toVelocityYClipcoords} from "./grids";

export class ApplyPressureCorrectionX {
  gl;
  nx;
  dx;
  ny;
  dy;
  dt;
  pressure;
  velocityX;
  velocityY;
  waterMask;

  program;
  vao;
  positions;
  velocityXLocation;
  waterMaskLocation;
  pressureLocation;

  constructor(gl: any,
              nx: num,
              dx: num,
              ny: num,
              dy: num,
              dt: num,
              pressure: TwoPhaseRenderTarget,
              velocityX: TwoPhaseRenderTarget,
              velocityY: TwoPhaseRenderTarget,
              waterMask: TwoPhaseRenderTarget) {
    this.gl = gl;
    this.nx = nx;
    this.dx = dx;
    this.ny = ny;
    this.dy = dy;
    this.dt = dt;
    this.pressure = pressure;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.waterMask = waterMask;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    // don't forget
    gl.useProgram(this.program);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.setupPositions(gl, this.program);
    gl.bindVertexArray(null);

    this.velocityXLocation = gl.getUniformLocation(this.program, "velocityX");
    this.pressureLocation = gl.getUniformLocation(this.program, "pressure");
    this.waterMaskLocation = gl.getUniformLocation(this.program, "waterMask");

    gl.uniform1f(gl.getUniformLocation(this.program, "dx"), this.dx);
    gl.uniform1f(gl.getUniformLocation(this.program, "dt"), this.dt);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toVelocityXClipcoords"),
        false, toVelocityXClipcoords(this.nx, this.ny));
  }

  setupPositions(gl, program) {
    const positionAttributeLocation = gl.getAttribLocation(program, "velocityXGridcoords");
    const positionBuffer = gl.createBuffer();
    this.positions = [];
    for (let i = 0; i < this.nx+1; i++) {
      for (let j = 0; j < this.ny; j++) {
        // staggered grid
        this.positions.push(i, j);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render() {
    this.gl.useProgram(this.program);
    this.velocityX.renderFromB(this.velocityXLocation);
    this.velocityX.renderToA();
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.pressure.renderFromA(this.pressureLocation);
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.positions.length / 2);
    this.gl.bindVertexArray(null);
    this.velocityX.swap();
  }
}

const vertexShaderSource = `
in vec4 velocityXGridcoords;

uniform mat4 toVelocityXClipcoords;
uniform mediump isampler2D waterMask;
uniform sampler2D velocityX;
uniform sampler2D pressure;
uniform float dx;
uniform float dt;

out float value;

void main() {
  gl_Position = toVelocityXClipcoords * velocityXGridcoords;
  gl_PointSize = 1.0;
  
  ivec2 here = ivec2(velocityXGridcoords.xy);
  bool water_right = texelFetch(waterMask, here, 0).x == 1;
  bool water_left = texelFetch(waterMask, here - ivec2(1, 0), 0).x == 1;
  
  if (!water_right || !water_left) {
    value = 0.0;
    return;
  }
  float velocityXHere = texelFetch(velocityX, here, 0).x;
  float pressure_right = texelFetch(pressure, here, 0).x;
  float pressure_left = texelFetch(pressure, here - ivec2(1, 0), 0).x;
  float p_grad = (pressure_right - pressure_left) / dx;
  value = velocityXHere + p_grad * dt;
}
`;

const fragmentShaderSource = `
in float value;

out float Value;

void main() {
  Value = value;
}
`;