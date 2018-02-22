import {toGridClipcoords, toGridTexcoords, toGridTexcoordsWithOffset} from "./grids";
import {createProgram, loadShader} from "../gl_util";

export class ErrorCorrectionJacobiRender {
  gl;
  nx;
  dx;
  ny;
  dy;
  dt;
  waterMask;
  airMask;
  multigrid;

  program;
  vaos;
  toFinestGridTexcoords;
  waterMaskLocation;
  airMaskLocation;
  pressureLocation;

  constructor(gl, nx, dx, ny, dy, dt, waterMask, airMask, multigrid) {
    this.gl = gl;
    this.nx = nx;
    this.dx = dx;
    this.ny = ny;
    this.dy = dy;
    this.dt = dt;
    this.waterMask = waterMask;
    this.airMask = airMask;
    this.multigrid = multigrid;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    gl.useProgram(this.program);
    this.setupPositions(gl, this.program);

    this.waterMaskLocation = gl.getUniformLocation(this.program, "waterMask");
    this.airMaskLocation = gl.getUniformLocation(this.program, "airMask");
    this.pressureLocation = gl.getUniformLocation(this.program, "pressure");

    gl.uniform1f(gl.getUniformLocation(this.program, "dx"), this.dx);
    gl.uniform1f(gl.getUniformLocation(this.program, "dy"), this.dy);
    gl.uniform1f(gl.getUniformLocation(this.program, "dt"), this.dt);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridClipcoords"),
        false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridTexcoords"),
        false, toGridTexcoords(this.multigrid.width, this.multigrid.height));
  }

  setupPositions(gl, program) {
    let level = 1;
    let levelNx = Math.floor(this.nx / 2);
    let levelNy = Math.floor(this.ny / 2);
    let offset = 0;
    this.coords = [];
    this.vaos = [];
    this.toFinestGridTexcoords = [];

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

      this.toFinestGridTexcoords[level] = toGridTexcoordsWithOffset(
          levelNx, levelNy, offset);

      offset += Math.max(levelNx, levelNy);
      levelNx = Math.floor(levelNx / 2);
      levelNy = Math.floor(levelNy / 2);
      level += 1;
    }
  }

  render(level) {
    if (level === 0) {
      throw new Error("level must be at least 1");
    }
    this.renderAToB(level);
    this.renderBToA(level);
  }

  renderAToB(level) {
    this.gl.useProgram(this.program);
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.airMask.renderFromA(this.airMaskLocation);
    this.multigrid.renderFromA(this.pressureLocation);
    this.multigrid.renderToB();
    console.log(this.toFinestGridTexcoords[level]);
    console.log(level);
    this.gl.uniformMatrix4fv(
        this.gl.getUniformLocation(this.program, "toFinestGridTexcoords"),
        false, this.toFinestGridTexcoords[level]);
    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length / 2);
    this.gl.bindVertexArray(null);
  }

  renderBToA(level) {
    this.gl.useProgram(this.program);
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.airMask.renderFromA(this.airMaskLocation);
    this.multigrid.renderFromB(this.pressureLocation);
    this.multigrid.renderToA();
    this.gl.uniformMatrix4fv(
        this.gl.getUniformLocation(this.program, "toFinestGridTexcoords"),
        false, this.toFinestGridTexcoords[level]);
    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length / 2);
    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `#version 300 es
in vec2 a_gridcoords;

uniform mat4 toGridClipcoords;
uniform float dx;
uniform float dy;
uniform float dt;
uniform mediump isampler2D waterMask;
uniform mediump isampler2D airMask;
uniform sampler2D pressure;

uniform mat4 toGridTexcoords;
uniform mat4 toFinestGridTexcoords;

out float value;

void main() {
  gl_Position = toGridClipcoords * vec4(a_gridcoords, 0.0, 1.0);
  
  // First refer to the finest grid discretization for mask values
  vec2 here = (toFinestGridTexcoords * vec4(a_gridcoords, 0.0, 1.0)).xy;
  int water_here = texture(waterMask, here).x;
  if (water_here == 0) {
    value = 0.0;
    return;
  }
  
  vec2 left = (toFinestGridTexcoords * vec4((a_gridcoords + vec2(-1.0, 0.0)).xy, 0.0, 1.0)).xy;
  vec2 right = (toFinestGridTexcoords * vec4((a_gridcoords + vec2(1.0, 0.0)).xy, 0.0, 1.0)).xy;
  vec2 up = (toFinestGridTexcoords * vec4((a_gridcoords + vec2(0.0, 1.0)).xy, 0.0, 1.0)).xy;
  vec2 down = (toFinestGridTexcoords * vec4((a_gridcoords + vec2(0.0, -1.0)).xy, 0.0, 1.0)).xy;
  
  int water_left = texture(waterMask, left).x;
  int water_right = texture(waterMask, right).x;
  int water_up = texture(waterMask, up).x;
  int water_down = texture(waterMask, down).x;
  int air_left = texture(airMask, left).x;
  int air_right = texture(airMask, right).x;
  int air_up = texture(airMask, up).x;
  int air_down = texture(airMask, down).x;
  
  // Then refer to the multigrid discretization for current vector values 
  here = (toGridTexcoords * vec4(a_gridcoords, 0.0, 1.0)).xy;
  left = (toGridTexcoords * vec4((a_gridcoords + vec2(-1.0, 0.0)).xy, 0.0, 1.0)).xy;
  right = (toGridTexcoords * vec4((a_gridcoords + vec2(1.0, 0.0)).xy, 0.0, 1.0)).xy;
  up = (toGridTexcoords * vec4((a_gridcoords + vec2(0.0, 1.0)).xy, 0.0, 1.0)).xy;
  down = (toGridTexcoords * vec4((a_gridcoords + vec2(0.0, -1.0)).xy, 0.0, 1.0)).xy;
  
  float pressure_left = texture(pressure, left).x;
  float pressure_right = texture(pressure, right).x;
  float pressure_up = texture(pressure, up).x;
  float pressure_down = texture(pressure, down).x;
  float pressure_here = texture(pressure, here).x;
  
  // TODO handle air cells here
  int d = water_left + water_right + water_up + water_down + 
  air_left + air_right + air_up + air_down;
  
  value = (1.0 / float(d)) * (
      float(water_left) * pressure_left + 
      float(water_right) * pressure_right +
      float(water_up) * pressure_up + 
      float(water_down) * pressure_down);
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
