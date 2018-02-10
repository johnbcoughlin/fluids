import React, {Component} from 'react';
import logo from './logo.svg';
import './App.css';
import {loadShader} from "./gl_util.js";
import {createProgram} from "./gl_util";

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
    const gl = canvas.getContext("webgl");
    if (!gl) {
      alert("Unable to initialize WebGL.");
      return;
    }

    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const program = createProgram(gl, vertexShader, fragmentShader);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Clear the canvas
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    this.setPositions(gl, program);
    this.setTexcoords(gl, program);

    // Create a texture.
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

// Fill the texture with a 1x1 blue pixel.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 255, 255]));

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  setupVelocityFramebuffer(gl, program) {
    const velocityFrameBuffer = gl.createFrameBuffer();
    gl.bindFrameBuffer(velocityFrameBuffer);
    const velocityTextureA = gl.createTexture();
    gl.bindTexture(velocityTextureA);
    gl.framebufferTexture2D(velocityFrameBuffer, gl.COLOR_ATTACHMENT_0, gl.TEXTURE_2D, velocityTextureA, 0);
    const velocityTextureB = gl.createTexture();
    gl.bindTexture(velocityTextureB);
    gl.framebufferTexture2D(velocityFrameBuffer, gl.COLOR_ATTACHMENT_0, gl.TEXTURE_2D, velocityTextureB, 0);
  }

  setPositions(gl, program) {
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    // three 2d points
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
    const texcoordLocation = gl.getAttribLocation(program, "a_texcoords");
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
}

export default App;

const vertexShaderSource = `
attribute vec4 a_position;
attribute vec2 a_texcoord;

varying vec2 v_texcoord;

void main() {
  gl_Position = a_position;
  
  v_texcoord = a_texcoord;
}
`;

const fragmentShaderSource = `
precision mediump float;

varying vec2 v_texcoord;

uniform sampler2D u_texture;

void main() {
  gl_FragColor = texture2D(u_texture, v_texcoord);
}
`;
