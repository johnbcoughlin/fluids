import React, {Component} from 'react';
import logo from './logo.svg';
import './App.css';
import {loadShader} from "./gl_util.js";
import {resizeCanvasToDisplaySize, checkFramebuffer, createProgram, renderToCanvas} from "./gl_util";
import {TwoPhaseRenderTarget} from "./lib/body_forces";

const n = 500;
const nx = n;
const dx = 0.01;
const ny = n;
const dy = 0.01;

const dt = 0.016;

class App extends Component {
  canvas;


  render() {
    return (
        <div className="App">
          <header className="App-header">
            <img src={logo} className="App-logo" alt="logo"/>
            <h1 className="App-title">Welcome to React</h1>
          </header>
          <div>
            <canvas width={600} height={600}
                    ref={(canvas) => {
                      this.initializeCanvas(canvas);
                    }}/>
          </div>
        </div>
    );
  }

  initializeCanvas(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      alert("Unable to initialize WebGL.");
      return;
    }

    // allow ourselves to play with float-only buffers.
    if (!gl.getExtension("EXT_color_buffer_float")) {
      alert("Unable to load extension EXT_color_buffer_float.");
      return;
    }
    if (!gl.getExtension("OES_texture_float_linear")) {
      alert("Unable to load extension OES_texture_float_linear.");
      return;
    }

    const canvasVertexShader = loadShader(gl, gl.VERTEX_SHADER, canvasVertexShaderSource);
    const canvasFragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, canvasFragmentShaderSource);
    const canvasProgram = createProgram(gl, canvasVertexShader, canvasFragmentShader);

    const velocityYVertexShader = loadShader(gl, gl.VERTEX_SHADER, velocityYVertexShaderSource);
    const velocityYFragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, velocityYFragmentShaderSource);
    const velocityYProgram = createProgram(gl, velocityYVertexShader, velocityYFragmentShader);

    resizeCanvasToDisplaySize(gl.canvas);


    // render first to the B texture
    gl.viewport(0, 0, nx, ny);
    gl.useProgram(velocityYProgram);
    const velocityYSetup = this.setupVelocityRenderStage(gl, velocityYProgram);
    gl.bindVertexArray(velocityYSetup.vao);
    velocityYSetup.velocityYRenderTarget.renderFromA(velocityYSetup.velocityYUniformLocation);
    velocityYSetup.velocityYRenderTarget.renderToB();
    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    checkFramebuffer(gl);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, velocityYSetup.positions.length / 2);


    gl.useProgram(canvasProgram);
    const canvasSetup = this.setupCanvasRenderingStage(gl, canvasProgram);
    gl.bindVertexArray(canvasSetup.vao);
    velocityYSetup.velocityYRenderTarget.renderFromB(canvasSetup.uniformTextureLocation);
    renderToCanvas(gl);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // try to do the texture swap
    gl.useProgram(velocityYProgram);
    gl.bindVertexArray(velocityYSetup.vao);
    velocityYSetup.velocityYRenderTarget.renderFromB(velocityYSetup.velocityYUniformLocation);
    velocityYSetup.velocityYRenderTarget.renderToA();
    checkFramebuffer(gl);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, velocityYSetup.positions.length / 2);

    // Tell WebGL how to convert from clip space to pixels
    gl.useProgram(canvasProgram);
    gl.bindVertexArray(canvasSetup.vao);
    // Now render to the canvas.
    velocityYSetup.velocityYRenderTarget.renderFromA(canvasSetup.uniformTextureLocation);
    renderToCanvas(gl);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  setupCanvasRenderingStage(gl, program) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.setupPositions(gl, program);
    gl.bindVertexArray(null);
    const uniformTextureLocation = gl.getUniformLocation(program, "u_texture");
    return {
      vao,
      uniformTextureLocation,
    }
  }

  setupPositions(gl, program) {
    // Create a buffer and put three 2d clip space points in it
    const positionBuffer = gl.createBuffer();
    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      // top right triangle
      -1, 1.0, 0, 1,
      1, 1, 1, 1,
      1, -1, 1, 0,

      // bottom left triangle
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1
    ]), gl.STATIC_DRAW);
    // look up where the vertex data needs to go.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
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

  setupVelocityRenderStage(gl, program) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const positions = this.setVelocityYPositions(gl, program);
    gl.bindVertexArray(null);
    const velocityYRenderTarget = new TwoPhaseRenderTarget(gl, gl.TEXTURE0, 0, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }, nx, ny);
    // gl.activeTexture(gl.TEXTURE0);
    //
    // const velocityTextureA = gl.createTexture();
    // gl.bindTexture(gl.TEXTURE_2D, velocityTextureA);
    //
    // // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    //
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny, 0, gl.RED, gl.FLOAT, null);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    //
    // const velocityTextureB = gl.createTexture();
    // gl.bindTexture(gl.TEXTURE_2D, velocityTextureB);
    //
    // // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    //
    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny, 0, gl.RED, gl.FLOAT, null);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    //
    // // create two framebuffers for us to render between textures
    // const velocityFramebufferA = gl.createFramebuffer();
    // gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFramebufferA);
    // // bind velocityTextureB to the framebuffer
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, velocityTextureB, 0);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    //
    // const velocityFramebufferB = gl.createFramebuffer();
    // gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFramebufferB);
    // // bind velocityTextureA to the framebuffer
    // gl.bindTexture(gl.TEXTURE_2D, velocityTextureA);
    // gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, velocityTextureA, 0);
    // gl.bindFramebuffer(gl.FRAMEBUFFER, null);


    const velocityYUniformLocation = gl.getUniformLocation(program, "velocityYTexture");
    return {
      vao,
      // velocityFramebufferA,
      // velocityTextureA,
      // velocityFramebufferB,
      // velocityTextureB,
      velocityYUniformLocation,
      positions,
      velocityYRenderTarget
    }
  }

  setVelocityYPositions(gl, program) {
    const positionAttributeLocation = gl.getAttribLocation(program, "velocityY_position");
    const positionBuffer = gl.createBuffer();
    const positions = [];
    for (let i = 0; i < nx-1; i++) {
      for (let j = 0; j < ny; j++) {
        // staggered grid
        positions.push(i * dx, j * dy, (i + 1) * dx, j * dy);
      }
    }
    console.log(positions);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    return positions;
  }
}

export default App;

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

const velocityYVertexShaderSource = `#version 300 es
in vec4 velocityY_position;

out vec2 velocityY_texcoord;

void main() {
  velocityY_texcoord = velocityY_position.xy;
  gl_Position = vec4(velocityY_position.x * 2.0 - 1.0, velocityY_position.y * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}
`;

const velocityYFragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 velocityY_texcoord;

uniform sampler2D velocityYTexture;
 
out float new_velocityY;

void main() {
  float velocityY = texture(velocityYTexture, velocityY_texcoord).x;
  if (velocityY == 0.0) {
    new_velocityY = 0.4;
  } else {
    new_velocityY = 0.9;
  }
}
`;
