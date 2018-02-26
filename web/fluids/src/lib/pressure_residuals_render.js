// @flow
import {toGridClipcoords} from "./grids";
import {MultigridRender} from "./multigrid_render";
import {TwoPhaseRenderTarget} from "./two_phase_render_target";

export class ResidualsRender extends MultigridRender {
  waterMask: TwoPhaseRenderTarget;
  airDistance: TwoPhaseRenderTarget;

  waterMaskLocation;
  airDistanceLocation;
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
              pressure: TwoPhaseRenderTarget,
              residuals: TwoPhaseRenderTarget,
              multigrid: TwoPhaseRenderTarget,
              residualsMultigrid: TwoPhaseRenderTarget) {
    super(gl, nx, ny, pressure, residuals, multigrid, residualsMultigrid, vertexShaderSource, fragmentShaderSource);
    this.dx = dx;
    this.dy = dy;
    this.dt = dt;
    this.waterMask = waterMask;
    this.airDistance = airDistance;
    this.initialize(gl);
  }

  initializeLevel(level, levelNx, levelNy, offset) {
    // no-op
  }

  initializeUniforms(gl, program) {
    this.waterMaskLocation = gl.getUniformLocation(program, "waterMask");
    this.airDistanceLocation = gl.getUniformLocation(program, "airDistance");
    this.residualsLocation = gl.getUniformLocation(program, "residuals");
    this.solutionLocation = gl.getUniformLocation(program, "solution");

    gl.uniform1f(gl.getUniformLocation(program, "dx"), this.dx);
    gl.uniform1f(gl.getUniformLocation(program, "dy"), this.dy);
    gl.uniform1f(gl.getUniformLocation(program, "dt"), this.dt);
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
    this.gl.useProgram(this.program);
    this.waterMask.useAsTexture(this.waterMaskLocation);
    this.airDistance.useAsTexture(this.airDistanceLocation);
    gl.uniform1f(gl.getUniformLocation(program, "dx"), this.dx * Math.pow(2, level));
    gl.uniform1f(gl.getUniformLocation(program, "dy"), this.dy * Math.pow(2, level));
    if (level === 0) {
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
      this.residuals.useAsTexture(this.residualsLocation);
      this.pressure.useAsTexture(this.solutionLocation);
      this.residuals.renderTo();
    } else {
      gl.uniformMatrix4fv(
          gl.getUniformLocation(program, "toGridClipcoords"),
          false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
      this.residualsMultigrid.useAsTexture(this.residualsLocation);
      this.multigrid.useAsTexture(this.solutionLocation);
      this.residualsMultigrid.renderTo();
    }
    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
    this.gl.bindVertexArray(null);

    if (level === 0) {
      this.residuals.swap();
    } else {
      this.residualsMultigrid.swap();
    }
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
uniform mediump sampler2D airDistance;
uniform sampler2D residuals;
uniform mediump sampler2D solution;

out float new_residual;

void main() {
  gl_Position = toGridClipcoords * vec4(a_gridcoords, 0.0, 1.0);
  gl_PointSize = 1.0;
  
  ivec2 here = ivec2(finest_gridcoords);
  bool water_here = texelFetch(waterMask, here, 0).x == 1;
  if (!water_here) {
    new_residual = 0.0;
    return;
  }
  
  int water_left = bitmask_left(waterMask, here) ? 1 : 0;
  int water_right = bitmask_right(waterMask, here) ? 1 : 0;
  int water_down = bitmask_down(waterMask, here) ? 1 : 0;
  int water_up = bitmask_up(waterMask, here) ? 1 : 0;
  int air_left = texelFetch(airDistance, here, 0).x < 1.0 ? 1 : 0;
  int air_right = texelFetch(airDistance, here, 0).y < 1.0 ? 1 : 0;
  int air_down = texelFetch(airDistance, here, 0).z < 1.0 ? 1 : 0;
  int air_up = texelFetch(airDistance, here, 0).w < 1.0 ? 1 : 0;
  
  here = ivec2(a_gridcoords);
  float solution_left = texelFetch(solution, left(here), 0).x;
  float solution_right = texelFetch(solution, right(here), 0).x;
  float solution_down = texelFetch(solution, down(here), 0).x;
  float solution_up = texelFetch(solution, up(here), 0).x;
  
  float solution_here = texelFetch(solution, here, 0).x;
  float residual_here = texelFetch(residuals, here, 0).x;
  
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

const fragmentShaderSource = `
precision mediump float;

in float new_residual;

out float value;

void main() {
  value = new_residual;
}
`;
