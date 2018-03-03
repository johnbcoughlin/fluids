// @flow

import {toGridClipcoords} from "./grids";
import {MultigridRender} from "./multigrid_render";
import type {Pressure} from "./types";
import type {GL, GLLocation, GLProgram} from "./gl_types";
import type {Correction, FinestGrid, Multigrid, Solution} from "./types";
import {GPUTimer} from "./gpu_timer";

export class AddCorrectionRender extends MultigridRender {
  pressure: Solution & FinestGrid;
  corrections: Correction & FinestGrid;
  multigrid: Solution & Multigrid;
  correctionsMultigrid: Correction & Multigrid;

  correctionLocation: GLLocation;
  solutionLocation: GLLocation;

  constructor(gl: GL,
              nx: number,
              ny: number,
              pressure: Pressure,
              corrections: Correction & FinestGrid,
              multigrid: Solution & Multigrid,
              correctionsMultigrid: Correction & Multigrid,
              timer: GPUTimer) {
    super(gl, nx, ny, vertexShaderSource, fragmentShaderSource, timer, "addCorrection");
    this.pressure = pressure;
    this.corrections = corrections;
    this.multigrid = multigrid;
    this.correctionsMultigrid = correctionsMultigrid;
    this.timer = timer;
    this.initialize(gl);
  }

  initializeUniforms(gl: GL, program: GLProgram) {
    this.correctionLocation = gl.getUniformLocation(program, "correction");
    this.solutionLocation = gl.getUniformLocation(program, "solution");
  }

  initializeLevel0() {
    this.coords[0] = [
        [0, 0],
        [0, this.ny],
        [this.nx, 0],

        [0, this.ny],
        [this.nx, this.ny],
        [this.nx, 0]
    ];
  }

  initializeLevel(level: number, levelNx: number, levelNy: number, offset: number) {
    const coords = [
        // lower left
        [offset, offset],
        [offset, offset + levelNy],
        [offset + levelNx, offset],

        [offset, offset + levelNy],
        [offset + levelNx, offset + levelNy],
        [offset + levelNx, offset]
    ];
    this.coords[level] = coords;
  }

  bindCoordinateArrays(gl: GL, program: GLProgram) {
    const gridcoordsLocation = gl.getAttribLocation(program, "a_gridcoords");
    gl.enableVertexAttribArray(gridcoordsLocation);
    gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render(level: number) {
    const gl = this.gl;
    gl.useProgram(this.program);
    if (level === 0) {
      this.pressure.useAsTexture(this.solutionLocation);
      this.corrections.useAsTexture(this.correctionLocation);
      this.pressure.renderTo();
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toGridClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
    } else {
      this.multigrid.useAsTexture(this.solutionLocation);
      this.correctionsMultigrid.useAsTexture(this.correctionLocation);
      this.multigrid.renderTo();
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toGridClipcoords"),
          false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
    }

    gl.bindVertexArray(this.vaos[level]);
    super.render(level);
    gl.bindVertexArray(null);

    if (level === 0) {
      this.pressure.swap();
    } else {
      this.multigrid.swap();
    }
  }

  doRender(level: number) {
    const gl = this.gl;
    console.log(this.coords[level]);
    gl.drawArrays(gl.TRIANGLES, 0, this.coords[level].length);
  }
}

const vertexShaderSource = `
in vec4 a_gridcoords;

uniform mat4 toGridClipcoords;

out vec4 v_gridcoords;

void main() {
  gl_Position = toGridClipcoords * a_gridcoords;
  gl_PointSize = 1.0;
  v_gridcoords = a_gridcoords;
}
`;

const fragmentShaderSource = `
precision mediump float;

in vec4 v_gridcoords;

uniform sampler2D solution;
uniform sampler2D correction;

out float value;

void main() {
  ivec2 here = ivec2(v_gridcoords.xy);
  value = texelFetch(solution, here, 0).x + texelFetch(correction, here, 0).x;
}
`;