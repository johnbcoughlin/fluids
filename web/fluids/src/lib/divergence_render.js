// @flow
import {createProgram, loadShader} from "../gl_util";
import {toGridClipcoords, toGridTexcoords, toVelocityXTexcoords, toVelocityYTexcoords} from "./grids";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";
import type {GL, GLLocation, GLProgram, GLVAO} from "./types";
import type {Divergence, FinestGrid, StaggerXGrid, StaggerYGrid} from "./gpu_fluid";

export class DivergenceRender {
  gl: GL;
  nx: number;
  dx: number;
  ny: number;
  dy: number;
  divergence: Divergence;
  velocityX: StaggerXGrid;
  velocityY: StaggerYGrid;
  waterMask: FinestGrid;
  solidDistance: FinestGrid;
  airDistance: FinestGrid;

  program: GLProgram;
  vao: GLVAO;
  gridcoords: Array<number>;
  uniformVelocityXTextureLocation: GLLocation;
  uniformVelocityYTextureLocation: GLLocation;
  waterMaskLocation: GLLocation;
  solidDistanceLocation: GLLocation;
  airDistanceLocation: GLLocation;

  constructor(gl: GL,
              nx: number,
              dx: number,
              ny: number,
              dy: number,
              divergence: TwoPhaseRenderTarget,
              velocityX: TwoPhaseRenderTarget,
              velocityY: TwoPhaseRenderTarget,
              waterMask: TwoPhaseRenderTarget,
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
    this.waterMask = waterMask;
    this.solidDistance = solidDistance;
    this.airDistance = airDistance;
    this.initialize(gl);
  }

  initialize(gl: GL) {
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
    this.waterMaskLocation = gl.getUniformLocation(this.program, "waterMask");
    this.solidDistanceLocation = gl.getUniformLocation(this.program, "solidDistance");
    this.airDistanceLocation = gl.getUniformLocation(this.program, "airDistance");

    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridClipcoords"),
        false, toGridClipcoords(this.nx, this.ny));
    gl.uniform1f(gl.getUniformLocation(this.program, "dx"), this.dx);
    gl.uniform1f(gl.getUniformLocation(this.program, "dy"), this.dy);
  }

  setupPositions(gl: GL, program: GLProgram) {
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
    this.velocityX.useAsTexture(this.uniformVelocityXTextureLocation);
    this.velocityY.useAsTexture(this.uniformVelocityYTextureLocation);
    this.waterMask.useAsTexture(this.waterMaskLocation);
    this.solidDistance.useAsTexture(this.solidDistanceLocation);
    this.airDistance.useAsTexture(this.airDistanceLocation);
    this.divergence.renderTo();
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.gridcoords.length / 2);
    this.gl.bindVertexArray(null);
    this.divergence.swap();
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
uniform mediump isampler2D waterMask;

uniform float dx;
uniform float dy;

out float divergence;

void main() {
  ivec2 here = ivec2(v_gridcoords.xy);
  bool water = texelFetch(waterMask, here, 0).x == 1;
  
  if (!water) {
    divergence = 0.0;
    return;
  }
  
  float u_solid = 0.0;
  
  bool solid_right = max4(texelFetch(solidDistance, here + ivec2(1, 0), 0)) == 0.0;
  bool solid_left = max4(texelFetch(solidDistance, here - ivec2(1, 0), 0)) == 0.0;
  bool solid_up = max4(texelFetch(solidDistance, here + ivec2(0, 1), 0)) == 0.0;
  bool solid_down = max4(texelFetch(solidDistance, here - ivec2(0, 1), 0)) == 0.0;
  
  float R = !solid_right ? texelFetch(u_velocityXTexture, here + ivec2(1, 0), 0).x : u_solid;
  float L = !solid_left ? texelFetch(u_velocityXTexture, here, 0).x : u_solid;
  float U = !solid_up ? texelFetch(u_velocityYTexture, here + ivec2(0, 1), 0).x : u_solid;
  float D = !solid_down ? texelFetch(u_velocityYTexture, here, 0).x : u_solid;
  
  divergence = -((R - L) / dx + (U - D) / dy);
}
`;