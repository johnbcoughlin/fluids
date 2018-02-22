import {createProgram, loadShader} from "../gl_util";

export class MultigridInterpolatePressure {
  gl;
  nx;
  ny;
  multigrid;
  pressure;

  program;
  vaos;
  coords;

  sourceLocation;

  constructor(gl, nx, ny, multigrid, pressure) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.multigrid = multigrid;
    this.pressure = pressure;

    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

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
          levelCoords.push(i + offset, j + offset);
          if (targetLevel > 0) {
            offset += Math.max(Math.floor(targetLevelNx / 2), Math.floor(targetLevelNy / 2)) + 1;
          }
          if (i % 2 === 0 && j % 2 === 0) {
            levelCoords.push(
                i / 2 + offset, j / 2, 1,
                0, 0, 0,
                0, 0, 0,
                0, 0, 0);
          } else if (i % 2 === 0 && j % 2 === 1) {
            levelCoords.push(
                i / 2 + offset, j / 2 + offset, 0.5,
                i / 2 + offset, j / 2 + 1 + offset, 0.5,
                0, 0, 0,
                0, 0, 0);
          } else if (i % 2 === 1 && j % 2 === 0) {
            levelCoords.push(
                i / 2 + offset, j / 2 + offset, 0.5,
                0, 0, 0,
                i / 2 + 1 + offset, j / 2 + offset, 0.5,
                0, 0, 0);
          } else {
            levelCoords.push(
                i / 2 + offset, j / 2 + offset, 0.25,
                i / 2 + offset, j / 2 + 1 + offset, 0.25,
                i / 2 + 1 + offset, j / 2 + offset, 0.25,
                i / 2 + 1 + offset, j / 2 + 1 + offset, 0.25);
          }
        }
      }

      this.coords[targetLevel] = levelCoords;

      targetLevel = targetLevel + 1;
      targetLevelNx = Math.floor(targetLevelNx / 2);
      targetLevelNy = Math.floor(targetLevelNy / 2);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(levelCoords), gl.STATIC_DRAW);

      const vao = gl.createVertexArray();

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
      this.vaos[targetLevel] = vao;
    }
  }

  // interpolate from the given level to the level below
  interpolateFrom(level) {
    this.gl.useProgram(this.program);
    // prepare to use the vertices referring to coordinates in the target level
    this.gl.bindVertexArray(this.vaos[level - 1]);

    this.multigrid.renderFromA(this.sourceLocation);
    if (level === 0) {
      this.pressure.renderToB();
    } else {
      this.multigrid.renderToB();
    }

    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level - 1].length / 14);

    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `#version 300 es
in vec4 afterGridcoords;

in vec4 contributor1;
in vec4 contributor2;
in vec4 contributor3;
in vec4 contributor4;

// the conversion for the level which is being interpolated from
// we'll use this to query data points to combine in the interpolated level
uniform mat4 beforeGridToTexcoords;

// we have to convert the afterGridcoords to clip space
uniform mat4 afterGridcoordsToClipcoords;

uniform sampler2D source;

out float value;

void main() {
  gl_Position = afterGridcoordsToClipcoords * afterGridcoords;
  gl_PointSize = 1.0;
  
  value = 
      texture(source, (beforeGridToTexcoords * contributor1).xy).x * contributor1.z +
      texture(source, (beforeGridToTexcoords * contributor2).xy).x * contributor2.z +
      texture(source, (beforeGridToTexcoords * contributor3).xy).x * contributor3.z +
      texture(source, (beforeGridToTexcoords * contributor4).xy).x * contributor4.z;
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