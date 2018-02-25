// @flow
import {createProgram, loadShader} from "../gl_util";
import {toGridClipcoords} from "./grids";

export class MultigridRestrictionRender {
  gl;
  nx;
  ny;
  residuals;
  residualsMultigrid;

  program;
  vaos;
  coords;

  sourceLocation;

  constructor(gl, nx, ny, residuals, residualsMultigrid) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.residuals = residuals;
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
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "afterGridToClipcoords"),
        false, toGridClipcoords(this.residualsMultigrid.width, this.residualsMultigrid.height));
  }

  setupPositions(gl, program) {
    let sourceLevel = 0;
    let sourceLevelNx = this.nx;
    let sourceLevelNy = this.ny;
    let offset = 0;
    let sourceOffset = 0;
    this.coords = [];
    this.vaos = [];

    while (sourceLevelNx > 2 && sourceLevelNy > 2) {
      const levelCoords = [];
      const targetLevelNx = Math.floor(sourceLevelNx / 2);
      const targetLevelNy = Math.floor(sourceLevelNy / 2);
      for (let i = 0; i < targetLevelNx; i++) {
        for (let j = 0; j < targetLevelNy; j++) {
          const vertexCoords = [
            i + offset, j + offset,
          ];
          vertexCoords.push(
            // the coordinates of the target of the restriction
            // the coordinates of the source grid points which contribute to the target
            2 * i - 1 + sourceOffset, 2 * j - 1 + sourceOffset, 1.0 / 16,
            2 * i - 1 + sourceOffset, 2 * j + sourceOffset, 1.0 / 8,
            2 * i - 1 + sourceOffset, 2 * j + 1 + sourceOffset, 1.0 / 16,
            2 * i + sourceOffset, 2 * j - 1 + sourceOffset, 1.0 / 8,
            2 * i + sourceOffset, 2 * j + sourceOffset, 1.0 / 4,
            2 * i + sourceOffset, 2 * j + 1 + sourceOffset, 1.0 / 8,
            2 * i + 1 + sourceOffset, 2 * j - 1 + sourceOffset, 1.0 / 16,
            2 * i + 1 + sourceOffset, 2 * j + sourceOffset, 1.0 / 8,
            2 * i + 1 + sourceOffset, 2 * j + 1 + sourceOffset, 1.0 / 16
          );
          levelCoords.push(vertexCoords);
        }
      }
      this.coords[sourceLevel] = levelCoords;

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const data = [].concat(...levelCoords);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

      const afterGridcoordLocation = gl.getAttribLocation(program, "afterGridcoords");
      gl.vertexAttribPointer(
          afterGridcoordLocation, 2, gl.FLOAT, false, 29 * 4, 0);
      gl.enableVertexAttribArray(afterGridcoordLocation);
      const contributor1Location = gl.getAttribLocation(program, "contributor1");
      gl.vertexAttribPointer(
          contributor1Location, 3, gl.FLOAT, false, 29 * 4, 2 * 4);
      gl.enableVertexAttribArray(contributor1Location);
      const contributor2Location = gl.getAttribLocation(program, "contributor2");
      gl.enableVertexAttribArray(contributor2Location);
      gl.vertexAttribPointer(
          contributor2Location, 3, gl.FLOAT, false, 29 * 4, 5 * 4);
      const contributor3Location = gl.getAttribLocation(program, "contributor3");
      gl.enableVertexAttribArray(contributor3Location);
      gl.vertexAttribPointer(
          contributor3Location, 3, gl.FLOAT, false, 29 * 4, 8 * 4);
      const contributor4Location = gl.getAttribLocation(program, "contributor4");
      gl.enableVertexAttribArray(contributor4Location);
      gl.vertexAttribPointer(
          contributor4Location, 3, gl.FLOAT, false, 29 * 4, 11 * 4);
      const contributor5Location = gl.getAttribLocation(program, "contributor5");
      gl.enableVertexAttribArray(contributor5Location);
      gl.vertexAttribPointer(
          contributor5Location, 3, gl.FLOAT, false, 29 * 4, 14 * 4);
      const contributor6Location = gl.getAttribLocation(program, "contributor6");
      gl.enableVertexAttribArray(contributor6Location);
      gl.vertexAttribPointer(
          contributor6Location, 3, gl.FLOAT, false, 29 * 4, 17 * 4);
      const contributor7Location = gl.getAttribLocation(program, "contributor7");
      gl.enableVertexAttribArray(contributor7Location);
      gl.vertexAttribPointer(
          contributor7Location, 3, gl.FLOAT, false, 29 * 4, 20 * 4);
      const contributor8Location = gl.getAttribLocation(program, "contributor8");
      gl.enableVertexAttribArray(contributor8Location);
      gl.vertexAttribPointer(
          contributor8Location, 3, gl.FLOAT, false, 29 * 4, 23 * 4);
      const contributor9Location = gl.getAttribLocation(program, "contributor9");
      gl.enableVertexAttribArray(contributor9Location);
      gl.vertexAttribPointer(
          contributor9Location, 3, gl.FLOAT, false, 29 * 4, 26 * 4);

      gl.bindVertexArray(null);
      this.vaos[sourceLevel] = vao;

      sourceLevel += 1;
      if (sourceLevel > 1) {
        sourceOffset = offset;
      }
      offset += Math.max(targetLevelNx, targetLevelNy) + 1;
      sourceLevelNx = Math.floor(sourceLevelNx / 2);
      sourceLevelNy = Math.floor(sourceLevelNy / 2);
    }
  }

  restrictFrom(level) {
    this.gl.useProgram(this.program);

    if (level === 0) {
      this.residuals.renderFromB(this.sourceLocation);
      this.residualsMultigrid.renderToA();
    } else {
      this.residualsMultigrid.renderFromB(this.sourceLocation);
      this.residualsMultigrid.renderToA();
    }
    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `
in vec4 afterGridcoords;

// The grid coordinates of the center of the restriction kernel in before-space
in vec4 contributor1;
in vec4 contributor2;
in vec4 contributor3;
in vec4 contributor4;
in vec4 contributor5;
in vec4 contributor6;
in vec4 contributor7;
in vec4 contributor8;
in vec4 contributor9;

// we have to convert the afterGridcoords to clip space
uniform mat4 afterGridToClipcoords;

uniform sampler2D source;

// the value we pass directly to the fragment shader
out float value;

void main() {
  gl_Position = afterGridToClipcoords * afterGridcoords;
  gl_PointSize = 1.0;
  
  float foo = 
      texelFetch(source, ivec2(contributor1.xy), 0).x * contributor1.z +
      texelFetch(source, ivec2(contributor2.xy), 0).x * contributor2.z +
      texelFetch(source, ivec2(contributor3.xy), 0).x * contributor3.z +
      texelFetch(source, ivec2(contributor4.xy), 0).x * contributor4.z +
      texelFetch(source, ivec2(contributor5.xy), 0).x * contributor5.z +
      texelFetch(source, ivec2(contributor6.xy), 0).x * contributor6.z +
      texelFetch(source, ivec2(contributor7.xy), 0).x * contributor7.z +
      texelFetch(source, ivec2(contributor8.xy), 0).x * contributor8.z +
      texelFetch(source, ivec2(contributor9.xy), 0).x * contributor9.z;
  value = foo;
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
