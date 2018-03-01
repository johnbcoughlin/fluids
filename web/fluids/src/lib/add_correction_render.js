// @flow

import {toGridClipcoords} from "./grids";
import {MultigridRender} from "./multigrid_render";
import type {Pressure} from "./types";
import type {GL, GLLocation, GLProgram} from "./gl_types";
import type {Correction, FinestGrid, Multigrid, Solution} from "./types";

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
              correctionsMultigrid: Correction & Multigrid) {
    super(gl, nx, ny, vertexShaderSource, fragmentShaderSource);
    this.pressure = pressure;
    this.corrections = corrections;
    this.multigrid = multigrid;
    this.correctionsMultigrid = correctionsMultigrid;
    this.initialize(gl);
  }

  initializeUniforms(gl: GL, program: GLProgram) {
    this.correctionLocation = gl.getUniformLocation(program, "correction");
    this.solutionLocation = gl.getUniformLocation(program, "solution");
  }

  initializeLevel(level: number, levelNx: number, levelNy: number, offset: number) {
    // no-op
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
    gl.drawArrays(gl.POINTS, 0, this.coords[level].length);
    gl.bindVertexArray(null);

    if (level === 0) {
      this.pressure.swap();
    } else {
      this.multigrid.swap();
    }
  }
}

const vertexShaderSource = `
in vec4 a_gridcoords;

uniform sampler2D solution;
uniform sampler2D correction;

uniform mat4 toGridClipcoords;

out float value;

void main() {
  gl_Position = toGridClipcoords * a_gridcoords;
  gl_PointSize = 1.0;
  
  ivec2 here = ivec2(a_gridcoords.xy);
  
  value = texelFetch(solution, here, 0).x + texelFetch(correction, here, 0).x;
}
`;

const fragmentShaderSource = `
precision mediump float;

in float value;

out float Value;

void main() {
  Value = value;
}
`;