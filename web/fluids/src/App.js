// @flow

import React, {Component} from 'react';
import './App.css';
import {GPUFluid} from "./lib/gpu_fluid";
import {FrameTimer, FrameTimerComponent} from "./components/frametimer";
import {GPUTimer} from "./lib/gpu_timer";
import {TimingComponent} from "./components/TimingComponent";

type State = {
  frameDuration: number;
  timer: GPUTimer,
}

class App extends Component {
  canvas;
  boundCanvasRefCallback = this.initializeCanvas.bind(this);
  fluid: GPUFluid;
  frameTimer: FrameTimer = new FrameTimer();
  goodToGo = 0;

  state: State = {
    frameDuration: 0,
    timer: null,
  };

  componentDidMount() {
    this.goodToGo += 1;
    this.fluid.render();
  }

  componentWillUnmount() {
    console.log("unmounting");
  }

  render() {
    return (
        <div className="App">
          <div>
            <canvas width={700} height={700}
                    ref={this.boundCanvasRefCallback}/>
          </div>
          {
            this.state.timer == null ? null : <TimingComponent timer={this.state.timer}/>
          }
        </div>
    );
  }

  initializeCanvas(canvas) {
    this.goodToGo += 1;
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2");
    console.log(canvas);
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

    const timer = new GPUTimer(gl);
    this.setState({timer});

    this.fluid = new GPUFluid(gl, (now) => {
      this.frameTimer.submitTiming(now);
      if (this.goodToGo === 2) {
        this.setState({
          frameDuration: this.frameTimer.averageTimePerFrame(),
        });
      }
    }, timer);
  }
}

export default App;
