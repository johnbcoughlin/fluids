// @flow
import {toGridClipcoords} from "./grids";
import {MultigridRender} from "./multigrid_render";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";

export class ErrorCorrectionJacobiRender extends MultigridRender {
  dx;
  dy;
  dt;
  waterMask;
  airDistance;
  solidDistance;
  rightHandSideMultigrid;

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
              divergence: TwoPhaseRenderTarget,
              multigrid: TwoPhaseRenderTarget,
              residualsMultigrid: TwoPhaseRenderTarget,
              rightHandSideMultigrid: TwoPhaseRenderTarget) {
    super(gl, nx, ny, pressure, divergence, multigrid, residualsMultigrid, vertexShaderSource, fragmentShaderSource);
    this.dx = dx;
    this.dy = dy;
    this.dt = dt;
    this.waterMask = waterMask;
    this.airDistance = airDistance;
    this.solidDistance = solidDistance;
    this.rightHandSideMultigrid = rightHandSideMultigrid;
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

    gl.uniform1f(gl.getUniformLocation(program, "dx"), this.dx * Math.pow(2, level));
    gl.uniform1f(gl.getUniformLocation(program, "dy"), this.dy * Math.pow(2, level));

    if (level === 0) {
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
      this.renderAToB(level, this.pressure, this.divergence);
    } else {
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridClipcoords"),
          false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
      this.renderAToB(level, this.multigrid, this.rightHandSideMultigrid);
    }
  }

  renderAToB(level: num, solution: TwoPhaseRenderTarget, residuals: TwoPhaseRenderTarget) {
    this.waterMask.useAsTexture(this.waterMaskLocation);
    this.airDistance.useAsTexture(this.airDistanceLocation);
    residuals.useAsTexture(this.residualsLocation);
    solution.useAsTexture(this.solutionLocation);
    solution.renderTo();
    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
    this.gl.bindVertexArray(null);
    solution.swap();
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
  
  float solution_here = texelFetch(solution, ihere, 0).x;
  float residual_here = texelFetch(residuals, ihere, 0).x;
  
  float norm = dt / (dx * dx);
  float d = float(water_left + water_right + water_up + water_down + 
  air_left + air_right + air_up + air_down) * norm;
  
  float z = (1.0 / d) * (residual_here +
      (float(water_left) * solution_left + 
      float(water_right) * solution_right +
      float(water_up) * solution_up + 
      float(water_down) * solution_down) * norm);
      
  float omega = 0.8;
  new_solution = solution_here + omega * (z - solution_here);
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
