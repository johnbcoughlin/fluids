// @flow
import {toGridClipcoords, toGridTexcoords, toGridTexcoordsWithOffset} from "./grids";
import {MultigridRender} from "./multigrid_render";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";

export class ErrorCorrectionJacobiRender extends MultigridRender {
  dx;
  dy;
  dt;
  waterMask;
  airMask;

  toFinestGridTexcoords;
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
    this.toFinestGridTexcoords = [toGridTexcoords(nx, ny)];
    this.dx = dx;
    this.dy = dy;
    this.dt = dt;
    this.waterMask = waterMask;
    this.airMask = airMask;
    this.initialize(gl);
  }

  initializeUniforms(gl, program) {
    this.waterMaskLocation = gl.getUniformLocation(program, "waterMask");
    this.airMaskLocation = gl.getUniformLocation(program, "airMask");
    this.solutionLocation = gl.getUniformLocation(program, "solution");
    this.residualsLocation = gl.getUniformLocation(program, "residuals");

    gl.uniform1f(gl.getUniformLocation(program, "dt"), this.dt);
  }

  initializeLevel(level, levelNx, levelNy, offset) {
    this.toFinestGridTexcoords[level] = toGridTexcoordsWithOffset(levelNx, levelNy, offset);
  }

  bindCoordinateArrays(gl, program) {
    const gridcoordsLocation = gl.getAttribLocation(program, "a_gridcoords");
    gl.enableVertexAttribArray(gridcoordsLocation);
    gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render(level) {
    const gl = this.gl;
    const program = this.program;
    gl.useProgram(program);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(program, "toFinestGridTexcoords"),
        false, this.toFinestGridTexcoords[level]);

    if (level === 0) {
      gl.uniform1f(gl.getUniformLocation(program, "dx"), this.dx);
      gl.uniform1f(gl.getUniformLocation(program, "dy"), this.dy);
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridTexcoords"),
          false, toGridTexcoords(this.nx, this.ny));
      this.renderAToB(level, this.pressure, this.residuals);
      this.renderBToA(level, this.pressure, this.residuals);

    } else {
      gl.uniform1f(gl.getUniformLocation(program, "dx"), this.dx * 2);
      gl.uniform1f(gl.getUniformLocation(program, "dy"), this.dy);
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridClipcoords"),
          false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridTexcoords"),
          false, toGridTexcoords(this.multigrid.width, this.multigrid.height));
      this.renderAToB(level, this.multigrid, this.residualsMultigrid);
      this.renderBToA(level, this.multigrid, this.residualsMultigrid);

    }
  }

  renderAToB(level: num, solution: TwoPhaseRenderTarget, residuals: TwoPhaseRenderTarget) {
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.airMask.renderFromA(this.airMaskLocation);
    residuals.renderFromA(this.residualsLocation);
    solution.renderFromA(this.solutionLocation);
    solution.renderToB();
    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
    this.gl.bindVertexArray(null);
  }

  renderBToA(level: num, solution: TwoPhaseRenderTarget, residuals: TwoPhaseRenderTarget) {
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.airMask.renderFromA(this.airMaskLocation);
    residuals.renderFromA(this.residualsLocation);
    solution.renderFromB(this.solutionLocation);
    solution.renderToA();
    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `
in vec2 a_gridcoords;

uniform mat4 toGridClipcoords;
uniform float dx;
uniform float dy;
uniform float dt;
uniform mediump isampler2D waterMask;
uniform mediump isampler2D airMask;
uniform sampler2D solution;
uniform sampler2D residuals;

uniform mat4 toGridTexcoords;
uniform mat4 toFinestGridTexcoords;

out float new_solution;

void main() {
  gl_Position = toGridClipcoords * vec4(a_gridcoords, 0.0, 1.0);
  gl_PointSize = 1.0;
  
  // First refer to the finest grid discretization for mask values
  vec2 here = (toFinestGridTexcoords * vec4(a_gridcoords, 0.0, 1.0)).xy;
  int water_here = texture(waterMask, here).x;
  if (water_here == 0) {
    new_solution = 0.0;
    return;
  }
  
  vec2 left = (toFinestGridTexcoords * vec4((a_gridcoords + vec2(-1.0, 0.0)).xy, 0.0, 1.0)).xy;
  vec2 right = (toFinestGridTexcoords * vec4((a_gridcoords + vec2(1.0, 0.0)).xy, 0.0, 1.0)).xy;
  vec2 up = (toFinestGridTexcoords * vec4((a_gridcoords + vec2(0.0, 1.0)).xy, 0.0, 1.0)).xy;
  vec2 down = (toFinestGridTexcoords * vec4((a_gridcoords + vec2(0.0, -1.0)).xy, 0.0, 1.0)).xy;
  
  int water_left = texture(waterMask, left).x;
  int water_right = texture(waterMask, right).x;
  int water_up = texture(waterMask, up).x;
  int water_down = texture(waterMask, down).x;
  int air_left = texture(airMask, left).x;
  int air_right = texture(airMask, right).x;
  int air_up = texture(airMask, up).x;
  int air_down = texture(airMask, down).x;
  
  // Then refer to the multigrid discretization for current vector values 
  here = (toGridTexcoords * vec4(a_gridcoords, 0.0, 1.0)).xy;
  left = (toGridTexcoords * vec4((a_gridcoords + vec2(-1.0, 0.0)).xy, 0.0, 1.0)).xy;
  right = (toGridTexcoords * vec4((a_gridcoords + vec2(1.0, 0.0)).xy, 0.0, 1.0)).xy;
  up = (toGridTexcoords * vec4((a_gridcoords + vec2(0.0, 1.0)).xy, 0.0, 1.0)).xy;
  down = (toGridTexcoords * vec4((a_gridcoords + vec2(0.0, -1.0)).xy, 0.0, 1.0)).xy;
  
  ivec2 ihere = ivec2(a_gridcoords.xy);
  float solution_left = texelFetch(solution, ihere + ivec2(-1, 0), 0).x;
  float solution_right = texelFetch(solution, ihere + ivec2(1, 0), 0).x;
  float solution_up = texelFetch(solution, ihere + ivec2(0, 1), 0).x;
  float solution_down = texelFetch(solution, ihere + ivec2(0, -1), 0).x;
  
  float residual_here = texelFetch(residuals, ihere, 0).x;
  
  float norm = dt / (dx * dx);
  float d = float(water_left + water_right + water_up + water_down + 
  air_left + air_right + air_up + air_down) * norm;
  
  new_solution = (1.0 / d) * (residual_here +
      (float(water_left) * solution_left + 
      float(water_right) * solution_right +
      float(water_up) * solution_up + 
      float(water_down) * solution_down) * norm);
}
`;

const fragmentShaderSource = `
precision mediump float;

in float new_solution;

out float value;

void main() {
  value = new_solution;
}
`;
