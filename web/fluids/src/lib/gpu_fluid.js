import {TwoPhaseRenderTarget} from "./two_phase_render_target";
import {CanvasRender} from "./canvas_render";
import {BodyForcesRender} from "./body_forces_render";
import {DivergenceRender} from "./divergence_render";
import {SinglePressureJacobiRender} from "./pressure_correction_render";

export class GPUFluid {
  // WebGL2 Context
  gl;
  nx;
  dx;
  ny;
  dy;
  dt;
  g;

  // masks and indicators
  waterMask;
  airMask;

  // render targets
  velocityX;
  velocityY;
  divergence;
  pressure;

  // render stages
  bodyForcesRender;
  divergenceRender;
  pressureJacobiRender;
  canvasRender;

  constructor(gl) {
    this.gl = gl;
    const n = 40;
    this.nx = n;
    this.dx = 1.0 / n;
    this.ny = n;
    this.dy = 1.0 / n;
    this.dt = 0.01;
    this.g = -9.8;
    this.initialize(gl);
  }

  initialize(gl) {
    this.waterMask = new TwoPhaseRenderTarget(gl, gl.TEXTURE0, 0, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32I, 4, 4, 0, gl.RED_INTEGER, gl.INT,
          new Int32Array([
              0, 0, 0, 0,
              0, 0, 1, 0,
              0, 1, 1, 0,
              0, 0, 0, 0
          ]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      // this is important.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }, 4, 4);
    this.airMask = new TwoPhaseRenderTarget(gl, gl.TEXTURE1, 1, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32I, 4, 4, 0, gl.RED_INTEGER, gl.INT,
          new Int32Array([
              0, 0, 0, 0,
              0, 0, 0, 0,
              0, 0, 0, 0,
              0, 1, 1, 0
          ]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      // this is important.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }, 4, 4);

    this.velocityX = new TwoPhaseRenderTarget(gl, gl.TEXTURE3, 3, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.nx+1, this.ny, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }, this.nx+1, this.ny);

    this.velocityY = new TwoPhaseRenderTarget(gl, gl.TEXTURE4, 4, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.nx, this.ny+1, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }, this.nx, this.ny+1);

    this.divergence = new TwoPhaseRenderTarget(gl, gl.TEXTURE5, 5, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.nx, this.ny, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }, this.nx, this.ny);

    this.pressure = new TwoPhaseRenderTarget(gl, gl.TEXTURE6, 6, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.nx, this.ny, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }, this.nx, this.ny);

    this.bodyForcesRender = new BodyForcesRender(gl, this.nx, this.dx, this.ny, this.dy, this.dt,
        this.g, this.waterMask, this.velocityY);
    this.divergenceRender = new DivergenceRender(gl, this.nx, this.dx, this.ny, this.dy, this.divergence,
        this.velocityX, this.velocityY, this.waterMask);
    this.pressureJacobiRender = new SinglePressureJacobiRender(gl, this.nx, this.dx, this.ny, this.dy,
        this.dt, this.waterMask, this.airMask, this.pressure, this.divergence);
    this.canvasRender = new CanvasRender(gl, this.nx, this.ny, this.velocityX, this.velocityY,
        this.waterMask, this.airMask, this.pressure, this.divergence);
  }

  render() {
    this.bodyForcesRender.render();
    this.divergenceRender.render();
    for (let i = 0; i < 1000; i++) {
      this.pressureJacobiRender.render();
    }
    this.canvasRender.render();
  }
}