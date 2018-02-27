// @flow
import {toGridClipcoords} from "./grids";
import {MultigridRender} from "./multigrid_render";

export class AddCorrectionRender extends MultigridRender {
  corrections;
  correctionsMultigrid;

  correctionLocation;
  solutionLocation;

  constructor(gl, nx, ny, pressure, corrections, multigrid, correctionsMultigrid) {
    super(gl, nx, ny, pressure, null, multigrid, null, vertexShaderSource, fragmentShaderSource);
    this.corrections = corrections;
    this.correctionsMultigrid = correctionsMultigrid;
    this.initialize(gl);
  }

  initializeUniforms(gl, program) {
    this.correctionLocation = gl.getUniformLocation(program, "correction");
    this.solutionLocation = gl.getUniformLocation(program, "solution");
  }

  initializeLevel(level, levelNx, levelNy, offset) {
    // no-op
  }

  bindCoordinateArrays(gl, program) {
    const gridcoordsLocation = gl.getAttribLocation(program, "a_gridcoords");
    gl.enableVertexAttribArray(gridcoordsLocation);
    gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render(level) {
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