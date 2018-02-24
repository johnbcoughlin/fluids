// @flow

import {TwoPhaseRenderTarget} from "./two_phase_render_target";
import {createProgram, loadShader} from "../gl_util";
import {toVelocityYClipcoords} from "./grids";

export class ApplyPressureCorrectionY {
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
  velocityYLocation;
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

    this.velocityYLocation = gl.getUniformLocation(this.program, "velocityY");
    this.pressureLocation = gl.getUniformLocation(this.program, "pressure");
    this.waterMaskLocation = gl.getUniformLocation(this.program, "waterMask");

    gl.uniform1f(gl.getUniformLocation(this.program, "dy"), this.dy);
    gl.uniform1f(gl.getUniformLocation(this.program, "dt"), this.dt);

    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toVelocityYClipcoords"),
        false, toVelocityYClipcoords(this.nx, this.ny));
  }

  setupPositions(gl, program) {
    const positionAttributeLocation = gl.getAttribLocation(program, "velocityYGridcoords");
    const positionBuffer = gl.createBuffer();
    this.positions = [];
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny+1; j++) {
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
    this.velocityY.renderFromB(this.velocityYLocation);
    this.velocityY.renderToA();
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.pressure.renderFromA(this.pressureLocation);
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.positions.length / 2);
    this.gl.bindVertexArray(null);
    this.velocityY.swap();
  }
}

const vertexShaderSource = `
in vec4 velocityYGridcoords;

uniform mat4 toVelocityYClipcoords;
uniform mediump isampler2D waterMask;
uniform sampler2D velocityY;
uniform sampler2D pressure;
uniform float dy;
uniform float dt;

out float value;

void main() {
  gl_Position = toVelocityYClipcoords * velocityYGridcoords;
  gl_PointSize = 1.0;
  
  ivec2 here = ivec2(velocityYGridcoords.xy);
  bool water_up = texelFetch(waterMask, here, 0).x == 1;
  bool water_down = texelFetch(waterMask, here - ivec2(0, 1), 0).x == 1;
  
  if (!water_up || !water_down) {
    value = 0.0;
    return;
  }
  float velocityYHere = texelFetch(velocityY, here, 0).x;
  float pressure_up = texelFetch(pressure, here, 0).x;
  float pressure_down = texelFetch(pressure, here - ivec2(0, 1), 0).x;
  float p_grad = (pressure_up - pressure_down) / dy;
  value = velocityYHere + p_grad * dt;
}
`;

const fragmentShaderSource = `
in float value;

out float Value;

void main() {
  Value = value;
}
`;