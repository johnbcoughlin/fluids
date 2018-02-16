import {createProgram, loadShader} from "../gl_util";

class MultigridInterpolate {
  gl;
  nx;
  ny;
  multigrid;
  pressure;

  program;
  vaos;
  coords;

  sourceLocation;

  constructor(gl, multigrid, pressure) {
    this.gl = gl;
    this.multigrid = multigrid;
    this.pressure = pressure;
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    this.sourceLocation = gl.getUniformLocation(this.program, "source");


  }

  setupPositions(gl) {
    let level = 0;
    let levelNx = this.nx;
    let levelNy = this.ny;
    let xOffset = 0;

    while (levelNx > 2 && levelNy > 2) {
      level = level + 1;
      levelNx = Math.floor(this.nx / 2);
      levelNy = Math.floor(this.ny / 2);


      const levelCoords = [];
      for (let i = 0; i < levelNx; i++) {
        for (let j = 0; j < levelNy; j++) {
          levelCoords.push(i + xOffset, j);
          if (i % 2 === 0 && j % 2 === 0) {
            levelCoords.push(
                i / 2, j / 2, 1,
                0, 0, 0,
                0, 0, 0,
                0, 0, 0);
          } else if (i % 2 === 0 && j % 2 === 1) {
            levelCoords.push(
                i / 2, j / 2, 0.5,
                i / 2, j / 2 + 1, 0.5,
                0, 0, 0,
                0, 0, 0);
          } else if (i % 2 === 1 && j % 2 === 0) {
            levelCoords.push(
                i / 2, j / 2, 0.5,
                0, 0, 0,
                i / 2 + 1, j / 2, 0.5,
                0, 0, 0);
          } else {
            levelCoords.push(
                i / 2, j / 2, 0.25,
                i / 2, j / 2 + 1, 0.25,
                i / 2 + 1, j / 2, 0.25,
                i / 2 + 1, j / 2 + 1, 0.25);
          }
        }
      }
      this.coords[level] = levelCoords;
      xOffset += levelNx;

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(levelCoords), gl.STATIC_DRAW);

      const vao = gl.createVertexArray();

      gl.bindVertexArray(vao);
      const afterGridCoordLocation = gl.getAttribLocation(program, "afterGridCoords");
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
      )

      gl.bindVertexArray(null);
      this.vaos[level] = vao;
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

    gl.drawArrays(gl.POINTS, )

    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `#version 300 es
in ivec4 afterGridcoords;

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
  
  value = 
      texture(source, (beforeGridToTexcoords * contributor1).xy) * contributor1.z +
      texture(source, (beforeGridToTexcoords * contributor2).xy) * contributor2.z +
      texture(source, (beforeGridToTexcoords * contributor3).xy) * contributor3.z +
      texture(source, (beforeGridToTexcoords * contributor4).xy) * contributor4.z;
}
`;

const fragmentShaderSource = `#version 300 es
in float value;

out float Value;

void main() {
  Value = value;
  gl_PointSize = 1.0;
}
`;
