// @flow
import {toGridClipcoords, toGridTexcoords} from "./grids";
import {MultigridRender} from "./multigrid_render";

export class AddCorrectionRender extends MultigridRender {
  correctionLocation;
  solutionLocation;

  constructor(gl, nx, ny, pressure, residuals, multigrid, residualsMultigrid) {
    super(gl, nx, ny, pressure, residuals, multigrid, residualsMultigrid, vertexShaderSource, fragmentShaderSource);
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
      this.pressure.renderFromA(this.solutionLocation);
      this.residuals.renderFromB(this.correctionLocation);
      this.pressure.renderToB();
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toGridClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toGridTexcoords"),
          false, toGridTexcoords(this.nx, this.ny));
    } else {
      throw new Error();
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toGridClipcoords"),
          false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toGridTexcoords"),
          false, toGridTexcoords(this.multigrid.width, this.multigrid.height));
    }
    gl.bindVertexArray(this.vaos[level]);
    gl.drawArrays(gl.POINTS, 0, this.coords[level].length);
    gl.bindVertexArray(null);
    this.pressure.swap();
  }
}

const vertexShaderSource = `
in vec4 a_gridcoords;

uniform sampler2D solution;
uniform sampler2D correction;

uniform mat4 toGridClipcoords;
uniform mat4 toGridTexcoords;

out float value;

void main() {
  gl_Position = toGridClipcoords * a_gridcoords;
  gl_PointSize = 1.0;
  
  vec2 here = (toGridTexcoords * a_gridcoords).xy;
  
  value = texture(solution, here).x + texture(correction, here).x;
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