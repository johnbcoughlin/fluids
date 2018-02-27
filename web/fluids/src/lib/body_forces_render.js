// @flow

import {createProgram, loadShader} from "../gl_util";
import {toGridTexcoords, toVelocityYClipcoords, toVelocityYTexcoords} from "./grids";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";
import type {GL, GLLocation, GLProgram, GLVAO} from "./types";
import type {FinestGrid, StaggerYGrid} from "./gpu_fluid";

export class BodyForcesRender {
  gl: GL;
  nx: number;
  dx: number;
  ny: number;
  dy: number;
  dt: number;
  g: number;
  solidDistance: TwoPhaseRenderTarget & FinestGrid;
  velocityY: StaggerYGrid;

  program: GLProgram;
  vao: GLVAO;
  positions: Array<number>;
  solidDistanceLocation: GLLocation;
  uniformTextureLocation: GLLocation;

  constructor(gl: GL,
              nx: number,
              dx: number,
              ny: number,
              dy: number,
              dt: number,
              g: number,
              solidDistance: TwoPhaseRenderTarget,
              velocityY: TwoPhaseRenderTarget) {
    this.gl = gl;
    this.nx = nx;
    this.dx = dx;
    this.ny = ny;
    this.dy = dy;
    this.dt = dt;
    this.g = g;
    this.solidDistance = solidDistance;
    this.velocityY = velocityY;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, velocityYVertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, velocityYFragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    // don't forget
    gl.useProgram(this.program);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.setupPositions(gl, this.program);
    gl.bindVertexArray(null);

    this.solidDistanceLocation = gl.getUniformLocation(this.program, "solidDistance");
    this.uniformTextureLocation = gl.getUniformLocation(this.program, "velocityYTexture");

    gl.uniform1f(gl.getUniformLocation(this.program, "dt"), this.dt);
    gl.uniform1f(gl.getUniformLocation(this.program, "g"), this.g);
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
    this.solidDistance.useAsTexture(this.solidDistanceLocation);
    this.velocityY.useAsTexture(this.uniformTextureLocation);
    this.velocityY.renderTo();
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.positions.length / 2);
    this.gl.bindVertexArray(null);
    this.velocityY.swap();
  }
}

const velocityYVertexShaderSource = `
in vec4 velocityYGridcoords;

uniform mat4 toVelocityYClipcoords;
uniform float dt;
uniform float g;
uniform sampler2D velocityYTexture;
uniform sampler2D solidDistance;

out float value;

void main() {
  gl_Position = toVelocityYClipcoords * velocityYGridcoords;
  gl_PointSize = 1.0;
  
  ivec2 here = ivec2(velocityYGridcoords.xy);
  ivec2 up = here;
  ivec2 down = here - ivec2(0, 1);
  
  bool solid_up = max4(texelFetch(solidDistance, up, 0)) == 0.0;
  bool solid_down = max4(texelFetch(solidDistance, down, 0)) == 0.0;
  
  if (!solid_down && !solid_up) {
    float velocityY = texelFetch(velocityYTexture, here, 0).x;
    value = velocityY + g * dt;
  } else {
    value = 0.0;
  }
}
`;

const velocityYFragmentShaderSource = `
precision mediump float;

in float value;
out float Value;

void main() {
  Value = value;
}
`;
