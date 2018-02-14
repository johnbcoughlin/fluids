
import {createProgram, loadShader, renderToCanvas} from "../gl_util";

export class CanvasRender {
  gl;
  velocityX;
  velocityY;

  program;
  vao;
  uniformTextureLocation;

  constructor(gl, velocityX, velocityY) {
    this.gl = gl;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
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
  }

  setupPositions(gl, program) {
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      // top right triangle
      -1, 1, 0, 1,
      1, 1, 1, 1,
      1, -1, 1, 0,

      // bottom left triangle
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1
    ]), gl.STATIC_DRAW);

    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
        positionAttributeLocation, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 0);

    const texcoordLocation = gl.getAttribLocation(program, "a_texcoord");
    gl.enableVertexAttribArray(texcoordLocation);
    gl.vertexAttribPointer(
        texcoordLocation, 2, gl.FLOAT, false, 4 * Float32Array.BYTES_PER_ELEMENT, 2 * Float32Array.BYTES_PER_ELEMENT);
  }

  render() {
    this.gl.useProgram(this.program);
    this.velocityY.renderFromB(this.uniformTextureLocation);
    renderToCanvas(this.gl);
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.bindVertexArray(null);
  }

  render2() {
    this.gl.useProgram(this.program);
    this.velocityY.renderFromA(this.uniformTextureLocation);
    renderToCanvas(this.gl);
    this.gl.bindVertexArray(this.vao);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.bindVertexArray(null);
  }
}

const canvasVertexShaderSource = `#version 300 es
in vec4 a_position;
in vec2 a_texcoord;

out vec2 foo;

void main() {
  foo = a_texcoord;
  gl_Position = a_position;
}
`;

const canvasFragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 foo;

out vec4 outColor;

uniform sampler2D u_texture;

void main() {
  float velocityY = texture(u_texture, foo).x;
  outColor = vec4(velocityY, velocityY, 0.0, 1.0);
}
`;
