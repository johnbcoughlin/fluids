// @flow

import {TwoPhaseRenderTarget} from "./two_phase_render_target";
import {CanvasRender} from "./canvas_render";
import {BodyForcesRender} from "./body_forces_render";
import {DivergenceRender} from "./divergence_render";
import {MultigridInterpolatePressure} from "./multigrid_interpolate";
import {MultigridRestrictionRender} from "./multigrid_restrict";
import {ResidualsRender} from "./pressure_residuals_render";
import {ErrorCorrectionJacobiRender} from "./error_correction_render";
import {AddCorrectionRender} from "./add_correction_render";
import {airDistances, solidDistances} from "./grids";

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
  airDistance;

  // render targets
  velocityX;
  velocityY;
  residuals;
  pressure;
  multigrid;
  residualsMultigrid;

  // render stages
  bodyForcesRender: BodyForcesRender;
  divergenceRender: DivergenceRender;
  pressureResidualsRender: ResidualsRender;
  restrictResidualsRender: MultigridRestrictionRender;
  interpolatePressureRender: MultigridInterpolatePressure;
  errorCorrectionJacobiRender: ErrorCorrectionJacobiRender;
  addCorrectionRender: AddCorrectionRender;
  canvasRender: CanvasRender;

  constructor(gl) {
    this.gl = gl;
    const n = 12;
    this.nx = n;
    this.dx = 1.0 / n;
    this.ny = n;
    this.dy = 1.0 / n;
    this.dt = 0.01;
    this.g = -9.8;
    this.initialize(gl);
  }

  initialize(gl) {
    this.waterMask = new TwoPhaseRenderTarget(gl, "water", gl.TEXTURE0, 0, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32I, 4, 4, 0, gl.RED_INTEGER, gl.INT,
          new Int32Array([
            0, 0, 0, 0,
            0, 1, 1, 0,
            0, 1, 1, 0,
            0, 0, 0, 0
          ]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      // this is important.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }, 4, 4);
    this.airDistance = new TwoPhaseRenderTarget(gl, "air_distance", gl.TEXTURE1, 1, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.nx, this.ny, 0, gl.RGBA, gl.FLOAT,
          new Float32Array([].concat(...airDistances(this.nx, this.ny))));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      // this is important.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }, this.nx, this.ny);

    this.solidDistance = new TwoPhaseRenderTarget(gl, "solid_distance", gl.TEXTURE2, 2, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.nx, this.ny, 0, gl.RGBA, gl.FLOAT,
          new Float32Array([].concat(...solidDistances(this.nx, this.ny))));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      // this is important.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }, this.nx, this.ny);

    this.velocityX = new TwoPhaseRenderTarget(gl, "u_x", gl.TEXTURE3, 3, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.nx + 1, this.ny, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }, this.nx + 1, this.ny);

    this.velocityY = new TwoPhaseRenderTarget(gl, "u_y", gl.TEXTURE4, 4, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.nx, this.ny + 1, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }, this.nx, this.ny + 1);

    this.residuals = new TwoPhaseRenderTarget(gl, "residuals", gl.TEXTURE5, 5, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.nx, this.ny, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }, this.nx, this.ny);

    this.pressure = new TwoPhaseRenderTarget(gl, "pressure", gl.TEXTURE6, 6, () => {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, this.nx, this.ny, 0, gl.RED, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    }, this.nx, this.ny);

    this.multigrid = new TwoPhaseRenderTarget(gl, "multigrid", gl.TEXTURE7, 7, () => {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F,
              this.nx + Math.floor(Math.log2(this.nx)) * 2,
              this.ny + Math.floor(Math.log2(this.ny)) * 2,
              0, gl.RED, gl.FLOAT, null);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        },
        this.nx + Math.floor(Math.log2(this.nx)) * 2,
        this.ny + Math.floor(Math.log2(this.ny)) * 2
    );

    this.residualsMultigrid = new TwoPhaseRenderTarget(gl, "residualsMultigrid", gl.TEXTURE8, 8, () => {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F,
              this.nx + Math.floor(Math.log2(this.nx)) * 2,
              this.ny + Math.floor(Math.log2(this.ny)) * 2,
              0, gl.RED, gl.FLOAT, null);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        },
        this.nx + Math.floor(Math.log2(this.nx)) * 2,
        this.ny + Math.floor(Math.log2(this.ny)) * 2
    );

    this.bodyForcesRender = new BodyForcesRender(gl, this.nx, this.dx, this.ny, this.dy, this.dt,
        this.g, this.solidDistance, this.velocityY);
    this.divergenceRender = new DivergenceRender(gl, this.nx, this.dx, this.ny, this.dy, this.residuals,
        this.velocityX, this.velocityY, this.solidDistance, this.airDistance);
    this.pressureResidualsRender = new ResidualsRender(gl, this.nx, this.dx, this.ny, this.dy,
        this.dt, this.waterMask, this.airMask, this.pressure, this.residuals, this.multigrid,
        this.residualsMultigrid);

    this.restrictResidualsRender = new MultigridRestrictionRender(gl, this.nx, this.ny, this.residuals,
        this.residualsMultigrid);
    this.interpolatePressureRender = new MultigridInterpolatePressure(gl, this.nx, this.ny,
        this.pressure, this.residuals, this.multigrid, this.residualsMultigrid);

    this.errorCorrectionJacobiRender = new ErrorCorrectionJacobiRender(this.gl, this.nx, this.dx, this.ny, this.dy,
        this.dt, this.waterMask, this.airDistance, this.pressure, this.residuals, this.multigrid, this.residualsMultigrid);

    this.addCorrectionRender = new AddCorrectionRender(this.gl, this.nx, this.ny, this.pressure, this.residuals,
        this.multigrid, this.residualsMultigrid);

    this.canvasRender = new CanvasRender(gl, this.nx, this.ny, this.velocityX, this.velocityY,
        this.airDistance, this.solidDistance,
        this.pressure, this.residuals, this.multigrid, this.residualsMultigrid);
  }

  render() {
    this.bodyForcesRender.render();
    this.divergenceRender.render();
    this.step();
  }

  step() {
    console.log("frame");
    this.errorCorrectionJacobiRender.render(0);
    // this.pressureResidualsRender.render(0);
    // this.restrictResidualsRender.restrictFrom(0);
    // this.errorCorrectionJacobiRender.render(1);
    // this.pressureResidualsRender.render(1);
    // this.interpolatePressureRender.interpolateTo(0);
    // this.addCorrectionRender.render(0);
    this.canvasRender.render2();
    // requestAnimationFrame(() => this.step());
  }
}