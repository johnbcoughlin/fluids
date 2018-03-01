import React, {Component} from 'react';
import logo from './logo.svg';
import './App.css';
import {GPUFluid} from "./lib/gpu_fluid";

class App extends Component {
  canvas;
  fluid;


  render() {
    return (
        <div className="App">
          <div>
            <canvas width={700} height={700}
                    ref={(canvas) => {
                      this.initializeCanvas(canvas);
                    }}/>
          </div>
          <button onClick={() => this.fluid.render()}>Go</button>
          <button onClick={() => this.fluid.doCycle()}>Cycle</button>
          {
            [0, 1, 2, 3, 4].map((level) => (
                <div key={level}>
                  <span>Level {level}</span>
                  <button onClick={() => this.fluid.errorCorrect(level)}>Smooth</button>
                  <button onClick={() => this.fluid.computeResiduals(level)}>Residuals</button>
                  <button onClick={() => this.fluid.restrictFrom(level)}>Restrict</button>
                  {
                    level > 0 ? <button onClick={() => this.fluid.interpolateFrom(level)}>Interpolate</button> : null
                  }
                  <button onClick={() => this.fluid.correct(level)}>Correct</button>
                </div>
            ))
          }
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

    this.fluid = new GPUFluid(gl);
    this.fluid.render();

    if (true) {
      return;
    }
  }
}

export default App;
