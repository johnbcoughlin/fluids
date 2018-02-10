import React, {Component} from 'react';
import logo from './logo.svg';
import './App.css';
import {loadShader} from "./gl_util.js";
import {checkFramebuffer, createProgram} from "./gl_util";

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
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      alert("Unable to load float buffer extension.");
      return;
    }

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    const canvasVertexShader = loadShader(gl, gl.VERTEX_SHADER, canvasVertexShaderSource);
    const canvasFragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, canvasFragmentShaderSource);
    const canvasProgram = createProgram(gl, canvasVertexShader, canvasFragmentShader);
    this.setupCanvasRenderingStage(gl, canvasProgram);

    const velocityYVertexShader = loadShader(gl, gl.VERTEX_SHADER, velocityYVertexShaderSource);
    const velocityYFragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, velocityYFragmentShaderSource);
    const velocityYProgram = createProgram(gl, velocityYVertexShader, velocityYFragmentShader);
    const velocityYSetup = this.setupVelocityRenderStage(gl, velocityYProgram);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);

    // first render from velocityYA to velocityYB
    gl.useProgram(velocityYProgram);
    // even though the texture is floats, the unit is an int, so use uniform1i
    gl.uniform1i(velocityYSetup.velocityYUniformLocation, velocityYSetup.velocityAUnit);
    gl.bindVertexArray(velocityYSetup.vao);

    checkFramebuffer(gl);

    gl.drawArrays(gl.GL_POINTS, 0, nx * (ny + 1));

  }

  setupCanvasRenderingStage(gl, program) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.setPositions(gl, program);
    this.setTexcoords(gl, program);
  }

  setPositions(gl, program) {
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const positionBuffer = gl.createBuffer();
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
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
        positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
  }

  setTexcoords(gl, program) {
    const texcoordLocation = gl.getAttribLocation(program, "a_texcoord");
    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, 1,
        1, 1,
        1, -1,

        -1, -1,
        1, -1,
        -1, 1
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texcoordLocation);
    gl.vertexAttribPointer(texcoordLocation, 2, gl.FLOAT, false, 0, 0);
  }

  setupVelocityRenderStage(gl, program) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    this.setVelocityYPositions(gl, program);

    const velocityTextureA = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, velocityTextureA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny+1, 0, gl.RED, gl.FLOAT, null);

    const velocityTextureB = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, velocityTextureB);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, nx, ny+1, 0, gl.RED, gl.FLOAT, null);

    // create a framebuffer for us to render between textures
    const velocityFramebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, velocityFramebuffer);
    // bind velocityTextureB to the framebuffer
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, velocityTextureB, 0);

    const velocityYUniformLocation = gl.getUniformLocation(program, "velocityYTexture");
    return {
      vao,
      velocityFramebuffer,
      velocityTextureA,
      velocityAUnit: 0,
      velocityTextureB,
      velocityBUnit: 1,
      velocityYUniformLocation,
    }
  }

  setVelocityYPositions(gl, program) {
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [];
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny + 1; j++) {
        positions.push(i * dx, j * dy);
      }
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([positions]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(
        positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
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
  gl_FragColor = texture2D(u_texture, v_texcoord);
}
`;

const velocityYVertexShaderSource = `
attribute vec4 a_position;

varying vec2 v_texcoord;

void main() {
  gl_Position = a_position;
  v_texcoord = a_position.xy;
}
`;

const velocityYFragmentShaderSource = `
precision mediump float;

varying vec2 v_texcoord;

uniform sampler2D velocityYTexture;

void main() {
  float velocityY = texture2D(velocityYTexture, v_texcoord).x;
  gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
}
`;
