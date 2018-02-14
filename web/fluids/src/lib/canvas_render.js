import {createProgram, loadShader, renderToCanvas} from "../gl_util";
import {toGridClipcoords, toGridTexcoords} from "./grids";

export class CanvasRender {
  gl;
  nx;
  ny;
  velocityX;
  velocityY;
  divergence;

  program;
  vao;
  uniformTextureLocation;

  constructor(gl, nx, ny, velocityX, velocityY, divergence) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.divergence = divergence;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, canvasVertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, canvasFragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    // this is important
    gl.useProgram(this.program);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.setupPositions(gl, this.program);
    gl.bindVertexArray(null);

    this.uniformTextureLocation = gl.getUniformLocation(this.program, "u_texture");

    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridClipcoords"),
        false, toGridClipcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toGridTexcoords"),
        false, toGridTexcoords(this.nx, this.ny));
  }

  setupPositions(gl, program) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      // top right triangle
      0, this.ny,
      this.nx, this.ny,
      this.nx, 0,

      // bottom left triangle
      0, 0,
      this.nx, 0,
      0, this.ny
    ]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_gridcoords");
    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
        positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  }

  render() {
    this.gl.useProgram(this.program);
    this.divergence.renderFromA(this.uniformTextureLocation);
    renderToCanvas(this.gl);
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.bindVertexArray(null);
  }

  render2() {
    this.gl.useProgram(this.program);
    this.velocityY.renderFromB(this.uniformTextureLocation);
    renderToCanvas(this.gl);
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.bindVertexArray(null);
  }
}

const canvasVertexShaderSource = `#version 300 es
in vec4 a_gridcoords;

out vec4 v_gridcoords;

uniform mat4 toGridClipcoords;

void main() {
  v_gridcoords = a_gridcoords;
  gl_Position = toGridClipcoords * a_gridcoords;
}
`;

const canvasFragmentShaderSource = `#version 300 es
precision mediump float;

in vec4 v_gridcoords;

out vec4 outColor;

uniform mat4 toGridTexcoords;
uniform sampler2D u_texture;

void main() {
  vec4 texcoords = toGridTexcoords * v_gridcoords;
  float velocityY = texture(u_texture, texcoords.xy).x;
  outColor = vec4(velocityY, velocityY, 0.0, 1.0);
}
`;
