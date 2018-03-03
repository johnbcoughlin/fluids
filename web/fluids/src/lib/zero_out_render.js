import {MultigridRender} from "./multigrid_render";
import {Pressure} from "./types";
import {TwoPhaseRenderTarget} from "./render_targets";
import type {GL, GLProgram} from "./gl_types";
import {toGridClipcoords} from "./grids";
import {GPUTimer} from "./gpu_timer";

export class ZeroOutRender extends MultigridRender {
  pressure;
  multigrid;

  constructor(gl: GL,
              nx: number,
              ny: number,
              pressure: Pressure,
              multigrid: TwoPhaseRenderTarget,
              timer: GPUTimer) {
    super(gl, nx, ny, vertexShaderSource, fragmentShaderSource, timer, "zeroOut");
    this.pressure = pressure;
    this.multigrid = multigrid;
    this.initialize(gl);
  }

  initializeUniforms(gl: GL, program: GLProgram) {
  }


  initializeLevel(level: number, levelNx: number, levelNy: number, offset: number) {
  }

  bindCoordinateArrays(gl: GL, program: GLProgram) {
    const gridcoordsLocation = gl.getAttribLocation(program, "gridcoords");
    gl.enableVertexAttribArray(gridcoordsLocation);
    gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 0, 0);
  }

  doRender(level: number) {
    const gl = this.gl;
    gl.useProgram(this.program);
    if (level === 0) {
      this.pressure.renderTo();
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
    } else {
      this.multigrid.renderTo();
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toClipcoords"),
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
in vec4 gridcoords;

uniform mat4 toClipcoords;

void main() {
  gl_Position = toClipcoords * gridcoords;
  gl_PointSize = 1.0;
}
`;

const fragmentShaderSource = `
out vec4 color;

void main() {
  color = vec4(0.0, 0.0, 0.0, 1.0);
}
`;