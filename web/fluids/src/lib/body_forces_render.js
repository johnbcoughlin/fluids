
import {createProgram, loadShader} from "../gl_util";
import {toVelocityYClipcoords, toVelocityYTexcoords} from "./grids";

export class BodyForcesRender {
  gl;
  nx;
  dx;
  ny;
  dy;
  dt;
  g;
  velocityY;

  program;
  vao;
  positions;
  uniformTextureLocation;

  constructor(gl, nx, dx, ny, dy, dt, g, velocityY) {
    this.gl = gl;
    this.nx = nx;
    this.dx = dx;
    this.ny = ny;
    this.dy = dy;
    this.dt = dt;
    this.g = g;
    this.velocityY = velocityY;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, velocityYVertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, velocityYFragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    // don't forget
    gl.useProgram(this.program);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.setupPositions(gl, this.program);
    gl.bindVertexArray(null);

    this.uniformTextureLocation = gl.getUniformLocation(this.program, "velocityYTexture");

    gl.uniform1f(gl.getUniformLocation(this.program, "dt"), false, this.dt);
    gl.uniform1f(gl.getUniformLocation(this.program, "g"), false, this.g);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toVelocityYClipcoords"),
        false, toVelocityYClipcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toVelocityYTexcoords"),
        false, toVelocityYTexcoords(this.nx, this.ny));
  }

  setupPositions(gl, program) {
    const positionAttributeLocation = gl.getAttribLocation(program, "velocityYGridcoords");
    const positionBuffer = gl.createBuffer();
    this.positions = [];
    for (let i = 0; i < this.nx-1; i++) {
      for (let j = 0; j < this.ny+1; j++) {
        // staggered grid
        this.positions.push(i, j, i+1, j);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render() {
    this.gl.useProgram(this.program);
    this.velocityY.renderFromA(this.uniformTextureLocation);
    this.velocityY.renderToB();
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.positions.length / 2);
    this.gl.bindVertexArray(null);
  }

  render2() {
    this.gl.useProgram(this.program);
    this.velocityY.renderFromB(this.uniformTextureLocation);
    this.velocityY.renderToA();
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, this.positions.length / 2);
    this.gl.bindVertexArray(null);
  }
}

const velocityYVertexShaderSource = `#version 300 es
in vec4 velocityYGridcoords;

out vec2 velocityYTexcoords;

uniform mat4 toVelocityYClipcoords;
uniform mat4 toVelocityYTexcoords;

void main() {
  velocityYTexcoords = (toVelocityYTexcoords * velocityYGridcoords).xy;
  gl_Position = toVelocityYClipcoords * velocityYGridcoords;
  gl_PointSize = 1.0;
}
`;

const velocityYFragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 velocityYTexcoords;

uniform float dt;
uniform float g;
uniform sampler2D velocityYTexture;
 
out float new_velocityY;

void main() {
  float velocityY = texture(velocityYTexture, velocityYTexcoords).x;
  new_velocityY = velocityY + g * dt;
}
`;
