// @flow
import {toGridClipcoords, toGridTexcoords} from "./grids";
import {MultigridRender} from "./multigrid_render";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";

export class ResidualsRender extends MultigridRender {
  waterMask;
  airMask;

  waterMaskLocation;
  airMaskLocation;
  solutionLocation;
  residualsLocation;

  constructor(gl: any,
              nx: num,
              dx: num,
              ny: num,
              dy: num,
              dt: num,
              waterMask: TwoPhaseRenderTarget,
              airMask: TwoPhaseRenderTarget,
              pressure: TwoPhaseRenderTarget,
              residuals: TwoPhaseRenderTarget,
              multigrid: TwoPhaseRenderTarget,
              residualsMultigrid: TwoPhaseRenderTarget) {
    super(gl, nx, ny, pressure, residuals, multigrid, residualsMultigrid, vertexShaderSource, fragmentShaderSource);
    this.dx = dx;
    this.dy = dy;
    this.dt = dt;
    this.waterMask = waterMask;
    this.airMask = airMask;
    this.initialize(gl);
  }

  initializeLevel(level, levelNx, levelNy, offset) {
    // no-op
  }

  initializeUniforms(gl, program) {
    this.waterMaskLocation = gl.getUniformLocation(program, "waterMask");
    this.airMaskLocation = gl.getUniformLocation(program, "airMask");
    this.residualsLocation = gl.getUniformLocation(program, "residuals");
    this.solutionLocation = gl.getUniformLocation(program, "solution");

    gl.uniform1f(gl.getUniformLocation(program, "dx"), this.dx);
    gl.uniform1f(gl.getUniformLocation(program, "dy"), this.dy);
    gl.uniform1f(gl.getUniformLocation(program, "dt"), this.dt);
  }

  bindCoordinateArrays(gl, program) {
    const gridcoordsLocation = gl.getAttribLocation(program, "a_gridcoords");
    gl.enableVertexAttribArray(gridcoordsLocation);
    gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render(level) {
    const gl = this.gl;
    const program = this.program;
    this.gl.useProgram(this.program);
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.airMask.renderFromA(this.airMaskLocation);
    if (level === 0) {
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridTexcoords"),
          false, toGridTexcoords(this.nx, this.ny));
      this.residuals.renderFromA(this.residualsLocation);
      this.pressure.renderFromA(this.solutionLocation);
      this.residuals.renderToB();
    } else {
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridClipcoords"),
          false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridTexcoords"),
          false, toGridTexcoords(this.multigrid.width, this.multigrid.height));
      this.residualsMultigrid.renderFromA(this.residualsLocation);
      this.multigrid.renderFromA(this.solutionLocation);
      this.residualsMultigrid.renderToB();
    }
    this.gl.bindVertexArray(this.vaos[0]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[0].length);
    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `#version 300 es
in vec2 a_gridcoords;

uniform mat4 toGridClipcoords;
uniform mat4 toGridTexcoords;

uniform float dx;
uniform float dy;
uniform float dt;
uniform mediump isampler2D waterMask;
uniform mediump isampler2D airMask;
uniform sampler2D residuals;
uniform mediump sampler2D solution;

out float new_residual;

void main() {
  gl_Position = toGridClipcoords * vec4(a_gridcoords, 0.0, 1.0);
  gl_PointSize = 1.0;
  
  vec2 here = (toGridTexcoords * vec4(a_gridcoords, 0.0, 1.0)).xy;
  int water_here = texture(waterMask, here).x;
  if (water_here == 0) {
    new_residual = 0.0;
    return;
  }
  
  vec2 left = (toGridTexcoords * vec4((a_gridcoords + vec2(-1.0, 0.0)).xy, 0.0, 1.0)).xy;
  vec2 right = (toGridTexcoords * vec4((a_gridcoords + vec2(1.0, 0.0)).xy, 0.0, 1.0)).xy;
  vec2 up = (toGridTexcoords * vec4((a_gridcoords + vec2(0.0, 1.0)).xy, 0.0, 1.0)).xy;
  vec2 down = (toGridTexcoords * vec4((a_gridcoords + vec2(0.0, -1.0)).xy, 0.0, 1.0)).xy;
  
  int water_left = texture(waterMask, left).x;
  int water_right = texture(waterMask, right).x;
  int water_up = texture(waterMask, up).x;
  int water_down = texture(waterMask, down).x;
  int air_left = texture(airMask, left).x;
  int air_right = texture(airMask, right).x;
  int air_up = texture(airMask, up).x;
  int air_down = texture(airMask, down).x;
  
  float solution_left = texture(solution, left).x;
  float solution_right = texture(solution, right).x;
  float solution_up = texture(solution, up).x;
  float solution_down = texture(solution, down).x;
  
  float solution_here = texture(solution, here).x;
  float residual_here = texture(residuals, here).x;
  
  float norm = dt / (dx * dx);
  int neighbors = water_left + water_right + water_up + water_down + 
  air_left + air_right + air_up + air_down;
  
  float Lp = 
      float(neighbors) * norm * solution_here -
      (float(water_left) * solution_left + 
      float(water_right) * solution_right +
      float(water_up) * solution_up + 
      float(water_down) * solution_down) * norm;
      
  new_residual = residual_here - Lp;
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

in float new_residual;

out float value;

void main() {
  value = new_residual;
}
`;
