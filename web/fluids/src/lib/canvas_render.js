// @flow

import {createProgram, loadShader, renderToCanvas} from "../gl_util";
import {toGridClipcoords, toGridTexcoords} from "./grids";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";

export class CanvasRender {
  gl;
  nx;
  ny;
  velocityX;
  velocityY;

  airDistance;
  solidDistance;
  pressure;
  residuals;
  multigrid;
  residualsMultigrid;

  program;
  vao;
  solidDistanceLocation;
  airDistanceLocation;
  uniformTextureLocation;

  constructor(gl: any,
              nx: num,
              ny: num,
              velocityX: TwoPhaseRenderTarget,
              velocityY: TwoPhaseRenderTarget,
              airDistance: TwoPhaseRenderTarget,
              solidDistance: TwoPhaseRenderTarget,
              pressure: TwoPhaseRenderTarget,
              residuals: TwoPhaseRenderTarget,
              multigrid: TwoPhaseRenderTarget,
              residualsMultigrid: TwoPhaseRenderTarget) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.airDistance = airDistance;
    this.solidDistance = solidDistance;
    this.pressure = pressure;
    this.residuals = residuals;
    this.multigrid = multigrid;
    this.residualsMultigrid = residualsMultigrid;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, canvasVertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, canvasFragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    // this is important
    gl.useProgram(this.program);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.setupPositions(gl, this.program);
    gl.bindVertexArray(null);

    this.uniformTextureLocation = gl.getUniformLocation(this.program, "u_texture");
    this.airDistanceLocation = gl.getUniformLocation(this.program, "airDistance");
    this.solidDistanceLocation = gl.getUniformLocation(this.program, "solidDistance");

    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridClipcoords"),
        false, toGridClipcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridTexcoords"),
        false, toGridTexcoords(this.nx, this.ny));
  }

  setupPositions(gl, program) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const vertices = [
      // top right triangle
      0, this.ny,
      this.nx, this.ny,
      this.nx, 0,

      // bottom left triangle
      0, 0,
      this.nx, 0,
      0, this.ny
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      // top right triangle
      0, this.ny,
      this.nx, this.ny,
      this.nx, 0,

      // bottom left triangle
      0, 0,
      this.nx, 0,
      0, this.ny
    ]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_gridcoords");
    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
        positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render() {
    this.gl.useProgram(this.program);
    this.pressure.renderFromA(this.uniformTextureLocation);
    this.airDistance.renderFromA(this.airDistanceLocation);
    this.solidDistance.renderFromA(this.solidDistanceLocation);
    renderToCanvas(this.gl);
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.bindVertexArray(null);
  }

  render2() {
    this.gl.useProgram(this.program);
    this.residuals.renderFromA(this.uniformTextureLocation);
    this.airDistance.renderFromA(this.airDistanceLocation);
    this.solidDistance.renderFromA(this.solidDistanceLocation);
    renderToCanvas(this.gl);
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.bindVertexArray(null);
  }
}

const canvasVertexShaderSource = `
in vec4 a_gridcoords;

out vec4 v_gridcoords;

uniform mat4 toGridClipcoords;

void main() {
  v_gridcoords = a_gridcoords;
  gl_Position = toGridClipcoords * a_gridcoords;
}
`;

const canvasFragmentShaderSource = `
precision mediump float;

in vec4 v_gridcoords;

out vec4 outColor;

uniform mat4 toGridTexcoords;
uniform sampler2D u_texture;
uniform mediump sampler2D airDistance;
uniform mediump sampler2D solidDistance;

void main() {
  vec4 texcoords = toGridTexcoords * v_gridcoords;
  ivec2 here = ivec2(v_gridcoords.xy);
  
  bool solid = max4(texelFetch(solidDistance, here, 0)) == 0.0;
  bool air = max4(texelFetch(airDistance, here, 0)) == 0.0;
  bool water = !solid && !air;

  float p = texelFetch(u_texture, here, 0).x;
  
  if (!water && !air) {
    outColor = vec4(0.2, 0.0, 0.0, 1.0);
  } else if (air) {
    outColor = vec4(0.90, 0.90, 0.97, 1.0);
  } else 
  if (p > 0.0) {
    outColor = vec4(0.0, 0.0, p * 50.0, 1.0);
  } else {
    outColor = vec4(abs(p) * 50.0, 0.0, 0.0, 1.0);
  }
}
`;
