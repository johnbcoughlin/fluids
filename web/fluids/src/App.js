import React, {Component} from 'react';
import logo from './logo.svg';
import './App.css';
import {loadShader} from "./gl_util.js";
import {resizeCanvasToDisplaySize, checkFramebuffer, createProgram} from "./gl_util";
import {glStateDump} from "./gl_state_dump";

const nx = 100;
const dx = 0.01;
const ny = 100;
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
            <canvas width={800} height={600}
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

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const canvasVertexShader = loadShader(gl, gl.VERTEX_SHADER, canvasVertexShaderSource);
    const canvasFragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, canvasFragmentShaderSource);
    const canvasProgram = createProgram(gl, canvasVertexShader, canvasFragmentShader);
    const canvasSetup = this.setupCanvasRenderingStage(gl, canvasProgram);

    const velocityYVertexShader = loadShader(gl, gl.VERTEX_SHADER, velocityYVertexShaderSource);
    const velocityYFragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, velocityYFragmentShaderSource);
    const velocityYProgram = createProgram(gl, velocityYVertexShader, velocityYFragmentShader);
    const velocityYSetup = this.setupVelocityRenderStage(gl, velocityYProgram);

    resizeCanvasToDisplaySize(gl.canvas);


    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // render first to the B texture
    gl.viewport(0, 0, dx * nx, dy * ny);
    gl.useProgram(velocityYProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocityYSetup.velocityFramebuffer);
    gl.uniform1i(velocityYSetup.velocityYUniformLocation, 0);
    gl.bindTexture(gl.TEXTURE_2D, velocityYSetup.velocityTextureA);

    checkFramebuffer(gl);
    gl.drawArrays(gl.POINTS, 0, nx * (ny + 1));

    // Now render to the canvas.

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(canvasProgram);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, velocityYSetup.velocityTextureB);
    gl.uniform1i(canvasSetup.uniformTextureLocation, 0);

    // draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  setupCanvasRenderingStage(gl, program) {
    this.setupPositions(gl, program);
    this.setTexcoords(gl, program);
    const uniformTextureLocation = gl.getUniformLocation(program, "u_texture");
    return {
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
      -1, 1,
      1, 1,
      1, -1,

      // bottom left triangle
      -1, -1,
      1, -1,
      -1, 1
    ]), gl.STATIC_DRAW);
    // look up where the vertex data needs to go.
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
        positionAttributeLocation, 2, gl.FLOAT, false, 0, 0)
  }

  setTexcoords(gl, program) {
    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 1,
        1, 1,
        1, 0,

        0, 0,
        1, 0,
        0, 1
    ]), gl.STATIC_DRAW);
    const texcoordLocation = gl.getAttribLocation(program, "a_texcoord");
    gl.enableVertexAttribArray(texcoordLocation);
    gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);
  }

  setupVelocityRenderStage(gl, program) {
    const positionBuffer = this.setVelocityYPositions(gl, program);
    gl.activeTexture(gl.TEXTURE0);

    const velocityTextureA = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, velocityTextureA);

    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1 + dy, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);


    const velocityTextureB = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, velocityTextureB);

    // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1 + dy, 0, gl.RED, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);


    // create a framebuffer for us to render between textures
    const velocityFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFramebuffer);
    // bind velocityTextureB to the framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, velocityTextureB, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    const velocityYUniformLocation = gl.getUniformLocation(program, "velocityYTexture");
    return {
      velocityFramebuffer,
      velocityTextureA,
      velocityTextureB,
      velocityYUniformLocation,
      positionBuffer,
    }
  }

  setVelocityYPositions(gl, program) {
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny + 1; j++) {
        // staggered grid
        positions.push(i * dx, (j - 0.5) * dy);
      }
    }
    console.log(positions);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

    return positionBuffer;
  }
}

export default App;

const canvasVertexShaderSource = `
attribute vec4 a_position;
attribute vec2 a_texcoord;

varying vec2 v_texcoord;

void main() {
  gl_Position = a_position;
  
  v_texcoord = a_texcoord;
}
`;

const canvasFragmentShaderSource = `
precision mediump float;

varying vec2 v_texcoord;

uniform sampler2D u_texture;

void main() {
  float velocityY = texture2D(u_texture, v_texcoord).x;
  gl_FragColor = vec4(velocityY, 0.0, velocityY, 1.0);
}
`;

const velocityYVertexShaderSource = `#version 300 es
in vec4 a_position;

out vec2 v_texcoord;

void main() {
  v_texcoord = a_position.xy;
  gl_Position = a_position;
}
`;

const velocityYFragmentShaderSource = `#version 300 es
precision mediump float;

in vec2 v_texcoord;

uniform sampler2D velocityYTexture;
 
out float new_velocityY;

void main() {
  float velocityY = texture(velocityYTexture, v_texcoord).x;
  new_velocityY = velocityY + v_texcoord.y;
}
`;
