// @flow

import {createProgram, loadShader} from "../gl_util";
import {toGridClipcoords, toGridTexcoords} from "./grids";

export class MultigridInterpolatePressure {
  gl;
  nx;
  ny;
  pressure;
  residuals;
  multigrid;
  residualsMultigrid;

  program;
  vaos;
  coords;

  sourceLocation;

  constructor(gl, nx, ny, pressure, residuals, multigrid, residualsMultigrid) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.pressure = pressure;
    this.residuals = residuals;
    this.multigrid = multigrid;
    this.residualsMultigrid = residualsMultigrid;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(this.program);
    this.sourceLocation = gl.getUniformLocation(this.program, "source");

    this.setupPositions(gl, this.program);
  }

  setupPositions(gl, program) {
    let targetLevel = 0;
    let targetLevelNx = this.nx;
    let targetLevelNy = this.ny;
    let offset = 0;
    this.coords = [];
    this.vaos = [];

    while (targetLevelNx > 2 && targetLevelNy > 2) {
      const levelCoords = [];
      for (let i = 0; i < targetLevelNx; i++) {
        for (let j = 0; j < targetLevelNy; j++) {
          const vertex = [i + offset, j + offset];
          if (targetLevel > 0) {
            offset += Math.max(Math.floor(targetLevelNx / 2), Math.floor(targetLevelNy / 2)) + 1;
          }
          if (i % 2 === 0 && j % 2 === 0) {
            vertex.push(
                i / 2 + offset, j / 2, 1,
                0, 0, 0,
                0, 0, 0,
                0, 0, 0);
          } else if (i % 2 === 0 && j % 2 === 1) {
            vertex.push(
                i / 2 + offset, Math.floor(j / 2) + offset, 0.5,
                i / 2 + offset, Math.floor(j / 2) + 1 + offset, 0.5,
                0, 0, 0,
                0, 0, 0);
          } else if (i % 2 === 1 && j % 2 === 0) {
            vertex.push(
                Math.floor(i / 2) + offset, j / 2 + offset, 0.5,
                0, 0, 0,
                Math.floor(i / 2) + 1 + offset, j / 2 + offset, 0.5,
                0, 0, 0);
          } else {
            vertex.push(
                Math.floor(i / 2) + offset, Math.floor(j / 2) + offset, 0.25,
                Math.floor(i / 2) + offset, Math.floor(j / 2) + 1 + offset, 0.25,
                Math.floor(i / 2) + 1 + offset, Math.floor(j / 2) + offset, 0.25,
                Math.floor(i / 2) + 1 + offset, Math.floor(j / 2) + 1 + offset, 0.25);
          }
          levelCoords.push(vertex);
        }
      }

      this.coords[targetLevel] = levelCoords;

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const data = [].concat(...levelCoords);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

      const vao = gl.createVertexArray();
      this.vaos[targetLevel] = vao;
      gl.bindVertexArray(vao);

      const afterGridCoordLocation = gl.getAttribLocation(program, "afterGridcoords");
      gl.enableVertexAttribArray(afterGridCoordLocation);
      gl.vertexAttribPointer(
          afterGridCoordLocation, 2, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT, 0);
      const contributor1Location = gl.getAttribLocation(program, "contributor1");
      gl.enableVertexAttribArray(contributor1Location);
      gl.vertexAttribPointer(
          contributor1Location, 3, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT,
          2 * Float32Array.BYTES_PER_ELEMENT);
      const contributor2Location = gl.getAttribLocation(program, "contributor2");
      gl.enableVertexAttribArray(contributor2Location);
      gl.vertexAttribPointer(
          contributor2Location, 3, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT,
          5 * Float32Array.BYTES_PER_ELEMENT);
      const contributor3Location = gl.getAttribLocation(program, "contributor3");
      gl.enableVertexAttribArray(contributor3Location);
      gl.vertexAttribPointer(
          contributor3Location, 3, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT,
          8 * Float32Array.BYTES_PER_ELEMENT);
      const contributor4Location = gl.getAttribLocation(program, "contributor4");
      gl.enableVertexAttribArray(contributor4Location);
      gl.vertexAttribPointer(
          contributor4Location, 3, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT,
          11 * Float32Array.BYTES_PER_ELEMENT);

      gl.bindVertexArray(null);

      targetLevel = targetLevel + 1;
      targetLevelNx = Math.floor(targetLevelNx / 2);
      targetLevelNy = Math.floor(targetLevelNy / 2);
    }
  }

  // interpolate from the given level to the level below
  interpolateTo(level) {
    this.gl.useProgram(this.program);
    // prepare to use the vertices referring to coordinates in the target level

    this.multigrid.renderFromA(this.sourceLocation);
    if (level === 0) {
      this.residuals.renderToB();
      this.gl.uniformMatrix4fv(
          this.gl.getUniformLocation(this.program, "afterGridToClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
    } else {
      this.residualsMultigrid.renderToB();
      this.gl.uniformMatrix4fv(
          this.gl.getUniformLocation(this.program, "afterGridToClipcoords"),
          false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
    }

    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `
in vec4 afterGridcoords;

in vec4 contributor1;
in vec4 contributor2;
in vec4 contributor3;
in vec4 contributor4;

// we have to convert the afterGridcoords to clip space
uniform mat4 afterGridToClipcoords;

uniform sampler2D source;

out float value;

void main() {
  gl_Position = afterGridToClipcoords * afterGridcoords;
  gl_PointSize = 1.0;
  
  value = 
      texelFetch(source, ivec2(contributor1.xy), 0).x * contributor1.z +
      texelFetch(source, ivec2(contributor2.xy), 0).x * contributor2.z +
      texelFetch(source, ivec2(contributor3.xy), 0).x * contributor3.z +
      texelFetch(source, ivec2(contributor4.xy), 0).x * contributor4.z;
}
`;

const fragmentShaderSource = `
in float value;

out float Value;

void main() {
  Value = value;
}
`;
