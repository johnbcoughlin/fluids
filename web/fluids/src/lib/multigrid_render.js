import {gridPointVertices} from "./grids";

export class MultigridRender {
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

  constructor(gl, nx, ny, pressure, residuals, multigrid, residualsMultigrid, vertexShader, fragmentShader) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.pressure = pressure;
    this.residuals = residuals;
    this.multigrid = multigrid;
    this.residualsMultigrid = residualsMultigrid;
    this.initialize(gl, vertexShader, fragmentShader);
  }

  initialize(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.vaos = [];
    this.coords = [];
    this.setupPositions(gl);
    this.bindPositions();
  }

  setupPositions(gl) {
    this.vaos[0] = gl.createVertexArray();
    this.coords[0] = gridPointVertices(this.nx, this.ny);

    let level = 1;
    let levelNx = Math.floor(this.nx / 2);
    let levelNy = Math.floor(this.ny / 2);
    let offset = 0;

    while (levelNx > 2 && levelNy > 2) {
      const levelCoords = [];
      for (let i = 0; i < levelNx; i++) {
        for (let j = 0; j < levelNy; j++) {
          levelCoords.push(this.vertexAttributeValues(level, i, j, offset));
        }
      }
      this.coords[level] = levelCoords;
      this.vaos[level] = gl.createVertexArray();

      offset += Math.max(levelNx, levelNy);
      levelNx = Math.floor(levelNx / 2);
      levelNy = Math.floor(levelNy / 2);
      level += 1;
    }
  }

  vertexAttributeValues(level, i, j, offset) {
    return [i + offset, j + offset];
  }

  bindPositions() {
    this.gl.useProgram(this.program);
    for (let level = 0; level < this.vaos.length; level++) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([].concat(...this.coords[level])), gl.STATIC_DRAW);
      gl.bindVertexArray(this.vaos[level]);
      this.bindCoordinateArrays();
      gl.bindVertexArray(null);
    }
  }

  bindCoordinateArrays() {
    throw new Error("implement me");
  }
}