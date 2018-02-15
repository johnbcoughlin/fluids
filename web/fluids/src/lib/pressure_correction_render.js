import {createProgram, loadShader} from "../gl_util";
import {gridTriangleStripVertices, toGridClipcoords, toGridTexcoords} from "./grids";

export class SinglePressureJacobiRender {
  gl;
  nx;
  dx;
  ny;
  dy;
  dt;
  waterMask;
  airMask;
  pressure;
  divergence;

  program;
  vao;
  gridcoords;
  waterMaskLocation;
  airMaskLocation;
  pressureLocation;
  divergenceLocation;

  constructor(gl, nx, dx, ny, dy, dt, waterMask, airMask, pressure, divergence) {
    this.gl = gl;
    this.nx = nx;
    this.dx = dx;
    this.ny = ny;
    this.dy = dy;
    this.dt = dt;
    this.waterMask = waterMask;
    this.airMask = airMask;
    this.pressure = pressure;
    this.divergence = divergence;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    gl.useProgram(this.program);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.setupPositions(gl, this.program);
    gl.bindVertexArray(null);

    this.waterMaskLocation = gl.getUniformLocation(this.program, "waterMask");
    this.airMaskLocation = gl.getUniformLocation(this.program, "airMask");
    this.divergenceLocation = gl.getUniformLocation(this.program, "u_divergence");
    this.pressureLocation = gl.getUniformLocation(this.program, "pressure");

    gl.uniform1f(gl.getUniformLocation(this.program, "dx"), this.dx);
    gl.uniform1f(gl.getUniformLocation(this.program, "dy"), this.dy);
    gl.uniform1f(gl.getUniformLocation(this.program, "dt"), this.dt);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridClipcoords"),
        false, toGridClipcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridTexcoords"),
        false, toGridTexcoords(this.nx, this.ny));
  }

  setupPositions(gl, program) {
    const gridcoordsLocation = gl.getAttribLocation(program, "a_gridcoords");
    const buffer = gl.createBuffer();
    this.gridcoords = gridTriangleStripVertices(this.nx, this.ny);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.gridcoords), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(gridcoordsLocation);
    gl.vertexAttribPointer(gridcoordsLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render() {
    this.renderAToB();
    this.renderBToA();
  }

  renderAToB() {
    this.gl.useProgram(this.program);
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.airMask.renderFromA(this.airMaskLocation);
    this.divergence.renderFromA(this.divergenceLocation);
    this.pressure.renderFromA(this.pressureLocation);
    this.pressure.renderToB();
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.gridcoords.length / 2);
    this.gl.bindVertexArray(null);
  }

  renderBToA() {
    this.gl.useProgram(this.program);
    this.waterMask.renderFromA(this.waterMaskLocation);
    this.airMask.renderFromA(this.airMaskLocation);
    this.divergence.renderFromA(this.divergenceLocation);
    this.pressure.renderFromB(this.pressureLocation);
    this.pressure.renderToA();
    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.gridcoords.length / 2);
    this.gl.bindVertexArray(null);
  }
}

const vertexShaderSource = `#version 300 es
in vec2 a_gridcoords;

out vec2 v_gridcoords;

uniform mat4 toGridClipcoords;

void main() {
  v_gridcoords = a_gridcoords;
  gl_Position = toGridClipcoords * vec4(a_gridcoords, 0.0, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 v_gridcoords;

uniform float dx;
uniform float dy;
uniform float dt;
uniform mediump isampler2D waterMask;
uniform mediump isampler2D airMask;
uniform sampler2D pressure;
uniform mediump sampler2D u_divergence;

uniform mat4 toGridTexcoords;

out float new_pressure;

void main() {
  vec2 here = (toGridTexcoords * vec4(v_gridcoords, 0.0, 1.0)).xy;
  int water_here = texture(waterMask, here).x;
  if (water_here == 0) {
    new_pressure = 0.0;
    return;
  }
  
  vec2 left = (toGridTexcoords * vec4((v_gridcoords + vec2(-1.0, 0.0)).xy, 0.0, 1.0)).xy;
  vec2 right = (toGridTexcoords * vec4((v_gridcoords + vec2(1.0, 0.0)).xy, 0.0, 1.0)).xy;
  vec2 up = (toGridTexcoords * vec4((v_gridcoords + vec2(0.0, 1.0)).xy, 0.0, 1.0)).xy;
  vec2 down = (toGridTexcoords * vec4((v_gridcoords + vec2(0.0, -1.0)).xy, 0.0, 1.0)).xy;
  
  int water_left = texture(waterMask, left).x;
  int water_right = texture(waterMask, right).x;
  int water_up = texture(waterMask, up).x;
  int water_down = texture(waterMask, down).x;
  int air_left = texture(airMask, left).x;
  int air_right = texture(airMask, right).x;
  int air_up = texture(airMask, up).x;
  int air_down = texture(airMask, down).x;
  
  float pressure_left = texture(pressure, left).x;
  float pressure_right = texture(pressure, right).x;
  float pressure_up = texture(pressure, up).x;
  float pressure_down = texture(pressure, down).x;
  
  float pressure_here = texture(pressure, here).x;
  float divergence = texture(u_divergence, here).x;
  float b = divergence * dx * dx / dt;
  
  // TODO handle air cells here
  int d = water_left + water_right + water_up + water_down + 
  air_left + air_right + air_up + air_down;
  
  new_pressure = (1.0 / float(d)) * (b + 
      float(water_left) * pressure_left + 
      float(water_right) * pressure_right +
      float(water_up) * pressure_up + 
      float(water_down) * pressure_down);
}
`;