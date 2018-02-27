// @flow
import {toGridClipcoords} from "./grids";
import {MultigridRender} from "./multigrid_render";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";
import type {Divergence, FinestGrid, Multigrid, Pressure, Residual, RightHandSide, Solution} from "./gpu_fluid";
import type {GL, GLLocation, GLProgram} from "./types";

export class ErrorCorrectionJacobiRender extends MultigridRender {
  dx: number;
  dy: number;
  dt: number;
  waterMask: FinestGrid;
  airDistance: FinestGrid;
  solidDistance: FinestGrid;

  pressure: Pressure;
  divergence: Divergence;
  multigrid: Solution & Multigrid;
  residualsMultigrid: Residual & Multigrid;
  rightHandSideMultigrid: RightHandSide & Multigrid;

  waterMaskLocation: GLLocation;
  airDistanceLocation: GLLocation;
  solidDistanceLocation: GLLocation;
  solutionLocation: GLLocation;
  residualsLocation: GLLocation;

  constructor(gl: GL,
              nx: number,
              dx: number,
              ny: number,
              dy: number,
              dt: number,
              waterMask: TwoPhaseRenderTarget,
              airDistance: TwoPhaseRenderTarget,
              solidDistance: TwoPhaseRenderTarget,
              pressure: TwoPhaseRenderTarget,
              divergence: TwoPhaseRenderTarget,
              multigrid: TwoPhaseRenderTarget,
              residualsMultigrid: TwoPhaseRenderTarget,
              rightHandSideMultigrid: TwoPhaseRenderTarget) {
    super(gl, nx, ny, vertexShaderSource, fragmentShaderSource);
    this.dx = dx;
    this.dy = dy;
    this.dt = dt;
    this.waterMask = waterMask;
    this.airDistance = airDistance;
    this.solidDistance = solidDistance;

    this.pressure = pressure;
    this.divergence = divergence;
    this.multigrid = multigrid;
    this.residualsMultigrid = residualsMultigrid;

    this.rightHandSideMultigrid = rightHandSideMultigrid;
    this.initialize(gl);
  }

  initializeUniforms(gl: GL, program: GLProgram) {
    this.waterMaskLocation = gl.getUniformLocation(program, "waterMask");
    this.airDistanceLocation = gl.getUniformLocation(program, "airDistance");
    this.solidDistanceLocation = gl.getUniformLocation(program, "solidDistance");
    this.solutionLocation = gl.getUniformLocation(program, "solution");
    this.residualsLocation = gl.getUniformLocation(program, "residuals");

    gl.uniform1f(gl.getUniformLocation(program, "dt"), this.dt);
  }

  initializeLevel(level: number, levelNx: number, levelNy: number, offset: number) {
  }

  vertexAttributeValues(level: number, i: number, j: number, offset: number) {
    return [i + offset, j + offset, i * Math.pow(2, level), j * Math.pow(2, level)];
  }

  bindCoordinateArrays(gl: GL, program: GLProgram) {
    const gridcoordsLocation = gl.getAttribLocation(program, "a_gridcoords");
    gl.enableVertexAttribArray(gridcoordsLocation);
    gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 4 * 4, 0);
    const finestGridcoordsLocation = gl.getAttribLocation(program, "finest_gridcoords");
    gl.enableVertexAttribArray(finestGridcoordsLocation);
    gl.vertexAttribPointer(finestGridcoordsLocation, 2, gl.FLOAT, false, 4 * 4, 2 * 4);
  }

  render(level: number) {
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

  renderAToB(level: number, solution: Solution, residuals: Residual) {
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
