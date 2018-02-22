import {createProgram, loadShader} from "../gl_util";
import {toGridClipcoords, toGridTexcoords} from "./grids";

export class AddCorrectionRender {
  gl;
  nx;
  ny;
  pressure;
  multigrid;

  program;
  vaos;
  correctionLocation;
  solutionLocation;

  constructor(gl, nx, ny, pressure, multigrid) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.pressure = pressure;
    this.multigrid = multigrid;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(this.program);
    this.correctionLocation = gl.getUniformLocation(this.program, "correction");
    this.solutionLocation = gl.getUniformLocation(this.program, "solution");

    this.setupPositions(gl, this.program);
  }

  setupPositions(gl, program) {
    let level = 0;
    let levelNx = Math.floor(this.nx / 2);
    let levelNy = Math.floor(this.ny / 2);
    let offset = 0;
    this.coords = [];
    this.vaos = [];

    while (levelNx > 2 && levelNy > 2) {
      const levelCoords = [];
      for (let i = 0; i < levelNx; i++) {
        for (let j = 0; j < levelNy; j++) {
          levelCoords.push(i + offset, j + offset);
        }
      }
      this.coords[level] = levelCoords;

      const gridcoordsLocation = gl.getAttribLocation(program, "a_gridcoords");
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(levelCoords), gl.STATIC_DRAW);

      const vao = gl.createVertexArray();
      this.vaos[level] = vao;
      gl.bindVertexArray(vao);
      gl.enableVertexAttribArray(gridcoordsLocation);
      gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      if (level > 0) {
        offset += Math.max(levelNx, levelNy);
        levelNx = Math.floor(levelNx / 2);
        levelNy = Math.floor(levelNy / 2);
      }
      level += 1;
    }
  }

  render(level) {
    const gl = this.gl;
    gl.useProgram(this.program);
    if (level === 0) {
      this.pressure.renderFromB(this.correctionLocation);
      this.pressure.renderToA();
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toGridClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
      gl.uniformMatrix4fv(
          gl.getUniformLocation(this.program, "toGridTexcoords"),
          false, toGridTexcoords(this.nx, this.ny));
    } else {
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
  }
}

const vertexShaderSource = `#version 300 es
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

const fragmentShaderSource = `#version 300 es
precision mediump float;

in float value;

out float Value;

void main() {
  Value = value;
}
`;