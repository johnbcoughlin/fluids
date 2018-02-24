// @flow
import {toGridClipcoords, toGridTexcoords, toGridTexcoordsWithOffset} from "./grids";
import {MultigridRender} from "./multigrid_render";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";

export class ErrorCorrectionJacobiRender extends MultigridRender {
  dx;
  dy;
  dt;
  waterMask;
  airDistance;
  solidDistance;

  toFinestGridTexcoords;
  waterMaskLocation;
  airDistanceLocation;
  solidDistanceLocation;
  solutionLocation;
  residualsLocation;

  constructor(gl: any,
              nx: num,
              dx: num,
              ny: num,
              dy: num,
              dt: num,
              waterMask: TwoPhaseRenderTarget,
              airDistance: TwoPhaseRenderTarget,
              solidDistance: TwoPhaseRenderTarget,
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
    this.airDistance = airDistance;
    this.solidDistance = solidDistance;
    this.initialize(gl);
  }

  initializeUniforms(gl, program) {
    this.waterMaskLocation = gl.getUniformLocation(program, "waterMask");
    this.airDistanceLocation = gl.getUniformLocation(program, "airDistance");
    this.solidDistanceLocation = gl.getUniformLocation(program, "solidDistance");
    this.solutionLocation = gl.getUniformLocation(program, "solution");
    this.residualsLocation = gl.getUniformLocation(program, "residuals");

    gl.uniform1f(gl.getUniformLocation(program, "dt"), this.dt);
  }

  initializeLevel(level, levelNx, levelNy, offset) {
    this.toFinestGridTexcoords[level] = toGridTexcoordsWithOffset(levelNx, levelNy, offset);
  }

  vertexAttributeValues(level, i, j, offset) {
    return [i + offset, j + offset, i * Math.pow(2, level), j * Math.pow(2, level)];
  }

  bindCoordinateArrays(gl, program) {
    const gridcoordsLocation = gl.getAttribLocation(program, "a_gridcoords");
    gl.enableVertexAttribArray(gridcoordsLocation);
    gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 4 * 4, 0);
    const finestGridcoordsLocation = gl.getAttribLocation(program, "finest_gridcoords");
    gl.enableVertexAttribArray(finestGridcoordsLocation);
    gl.vertexAttribPointer(finestGridcoordsLocation, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
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
    this.airDistance.renderFromA(this.airDistanceLocation);
    residuals.renderFromA(this.residualsLocation);
    solution.renderFromA(this.solutionLocation);
    solution.renderToB();
    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
    this.gl.bindVertexArray(null);
  }

  renderBToA(level: num, solution: TwoPhaseRenderTarget, residuals: TwoPhaseRenderTarget) {
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.airDistance.renderFromA(this.airDistanceLocation);
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
in vec2 finest_gridcoords;

uniform mat4 toGridClipcoords;
uniform float dx;
uniform float dy;
uniform float dt;
uniform mediump isampler2D waterMask;
uniform sampler2D airDistance;
uniform sampler2D solidDistance;
uniform sampler2D solution;
uniform sampler2D residuals;

uniform mat4 toGridTexcoords;
uniform mat4 toFinestGridTexcoords;

out float new_solution;

void main() {
  gl_Position = toGridClipcoords * vec4(a_gridcoords, 0.0, 1.0);
  gl_PointSize = 1.0;
  
  // First refer to the finest grid discretization for mask values
  ivec2 here = ivec2(finest_gridcoords);
  bool water_here = texelFetch(waterMask, here, 0).x == 1;
  if (!water_here) {
    new_solution = 0.0;
    return;
  }
  
  int water_left = texelFetch(waterMask, here - ivec2(1, 0), 0).x;
  int water_right = texelFetch(waterMask, here + ivec2(1, 0), 0).x;
  int water_down = texelFetch(waterMask, here - ivec2(0, 1), 0).x;
  int water_up = texelFetch(waterMask, here + ivec2(0, 1), 0).x;
  
  int air_left = texelFetch(airDistance, here, 0).x < 1.0 ? 1 : 0;
  int air_right = texelFetch(airDistance, here, 0).y < 1.0 ? 1 : 0;
  int air_down = texelFetch(airDistance, here, 0).z < 1.0 ? 1 : 0;
  int air_up = texelFetch(airDistance, here, 0).w < 1.0 ? 1 : 0;
  
  // Then refer to the multigrid discretization for current vector values 
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
