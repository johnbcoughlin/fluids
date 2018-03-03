// @flow
import {createProgram, loadShader} from "../gl_util";
import {toGridClipcoords} from "./grids";
import {flatten} from "./utils";
import type {GL, GLLocation, GLProgram, GLVAO} from "./gl_types";
import type {Residual} from "./types";
import type {FinestGrid, Multigrid, RightHandSide} from "./types";
import {GPUTimer} from "./gpu_timer";
import {Render} from "./render";

export class MultigridRestrictionRender extends Render {
  gl: GL;
  nx: number;
  ny: number;
  residuals: Residual & FinestGrid;
  residualsMultigrid: Residual & Multigrid;
  rightHandSideMultigrid: RightHandSide & Multigrid;
  waterMask: FinestGrid;

  program: GLProgram;
  vaos: Array<GLVAO>;
  coords: Array<Array<Array<number>>>;
  destinationOffsets: Array<number>;
  sourceOffsets: Array<number>;

  sourceLocation: GLLocation;
  waterMaskLocation: GLLocation;
  destinationLevelLocation: GLLocation;
  destinationOffset: GLLocation;
  sourceOffset: GLLocation;

  constructor(gl: GL,
              nx: number,
              ny: number,
              residuals: Residual & FinestGrid,
              residualsMultigrid: Residual & Multigrid,
              rightHandSideMultigrid: RightHandSide & Multigrid,
              waterMask: FinestGrid,
              timer: GPUTimer) {
    super(timer, "restrictFrom");
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.residuals = residuals;
    this.residualsMultigrid = residualsMultigrid;
    this.rightHandSideMultigrid = rightHandSideMultigrid;
    this.waterMask = waterMask;

    this.initialize(gl);
  }

  initialize(gl: GL) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    gl.useProgram(this.program);
    this.sourceLocation = gl.getUniformLocation(this.program, "source");
    this.waterMaskLocation = gl.getUniformLocation(this.program, "waterMask");
    this.destinationLevelLocation = gl.getUniformLocation(this.program, "destinationLevel");
    this.destinationOffset = gl.getUniformLocation(this.program, "destinationOffset");
    this.sourceOffset = gl.getUniformLocation(this.program, "sourceOffset");

    this.setupPositions(gl, this.program);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "afterGridToClipcoords"),
        false, toGridClipcoords(this.rightHandSideMultigrid.width, this.rightHandSideMultigrid.height));
  }

  setupPositions(gl: GL, program: GLProgram) {
    let sourceLevel = 0;
    let sourceLevelNx = this.nx;
    let sourceLevelNy = this.ny;
    let offset = 0;
    let sourceOffset = 0;
    this.coords = [];
    this.vaos = [];
    this.destinationOffsets = [];
    this.sourceOffsets = [];

    while (sourceLevelNx > 2 && sourceLevelNy > 2) {
      const levelCoords = [];
      const targetLevelNx = Math.floor(sourceLevelNx / 2);
      const targetLevelNy = Math.floor(sourceLevelNy / 2);
      for (let i = 0; i < targetLevelNx; i++) {
        for (let j = 0; j < targetLevelNy; j++) {
          const vertexCoords = [
            i + offset, j + offset,
          ];
          vertexCoords.push(
              // the coordinates of the target of the restriction
              // the coordinates of the source grid points which contribute to the target
              2 * i - 1 + sourceOffset, 2 * j - 1 + sourceOffset, 1.0 / 16,
              2 * i - 1 + sourceOffset, 2 * j + sourceOffset, 1.0 / 8,
              2 * i - 1 + sourceOffset, 2 * j + 1 + sourceOffset, 1.0 / 16,
              2 * i + sourceOffset, 2 * j - 1 + sourceOffset, 1.0 / 8,
              2 * i + sourceOffset, 2 * j + sourceOffset, 1.0 / 4,
              2 * i + sourceOffset, 2 * j + 1 + sourceOffset, 1.0 / 8,
              2 * i + 1 + sourceOffset, 2 * j - 1 + sourceOffset, 1.0 / 16,
              2 * i + 1 + sourceOffset, 2 * j + sourceOffset, 1.0 / 8,
              2 * i + 1 + sourceOffset, 2 * j + 1 + sourceOffset, 1.0 / 16
          );
          const clamped = vertexCoords.map((c) => Math.max(0, Math.min(c, this.rightHandSideMultigrid.height)));
          levelCoords.push(clamped);
        }
      }
      this.coords[sourceLevel] = levelCoords;
      this.destinationOffsets[sourceLevel] = offset;
      this.sourceOffsets[sourceLevel] = sourceOffset;

      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const data = flatten(levelCoords);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

      const afterGridcoordLocation = gl.getAttribLocation(program, "afterGridcoords");
      gl.vertexAttribPointer(
          afterGridcoordLocation, 2, gl.FLOAT, false, 29 * 4, 0);
      gl.enableVertexAttribArray(afterGridcoordLocation);
      const contributor1Location = gl.getAttribLocation(program, "contributor1");
      gl.vertexAttribPointer(
          contributor1Location, 3, gl.FLOAT, false, 29 * 4, 2 * 4);
      gl.enableVertexAttribArray(contributor1Location);
      const contributor2Location = gl.getAttribLocation(program, "contributor2");
      gl.enableVertexAttribArray(contributor2Location);
      gl.vertexAttribPointer(
          contributor2Location, 3, gl.FLOAT, false, 29 * 4, 5 * 4);
      const contributor3Location = gl.getAttribLocation(program, "contributor3");
      gl.enableVertexAttribArray(contributor3Location);
      gl.vertexAttribPointer(
          contributor3Location, 3, gl.FLOAT, false, 29 * 4, 8 * 4);
      const contributor4Location = gl.getAttribLocation(program, "contributor4");
      gl.enableVertexAttribArray(contributor4Location);
      gl.vertexAttribPointer(
          contributor4Location, 3, gl.FLOAT, false, 29 * 4, 11 * 4);
      const contributor5Location = gl.getAttribLocation(program, "contributor5");
      gl.enableVertexAttribArray(contributor5Location);
      gl.vertexAttribPointer(
          contributor5Location, 3, gl.FLOAT, false, 29 * 4, 14 * 4);
      const contributor6Location = gl.getAttribLocation(program, "contributor6");
      gl.enableVertexAttribArray(contributor6Location);
      gl.vertexAttribPointer(
          contributor6Location, 3, gl.FLOAT, false, 29 * 4, 17 * 4);
      const contributor7Location = gl.getAttribLocation(program, "contributor7");
      gl.enableVertexAttribArray(contributor7Location);
      gl.vertexAttribPointer(
          contributor7Location, 3, gl.FLOAT, false, 29 * 4, 20 * 4);
      const contributor8Location = gl.getAttribLocation(program, "contributor8");
      gl.enableVertexAttribArray(contributor8Location);
      gl.vertexAttribPointer(
          contributor8Location, 3, gl.FLOAT, false, 29 * 4, 23 * 4);
      const contributor9Location = gl.getAttribLocation(program, "contributor9");
      gl.enableVertexAttribArray(contributor9Location);
      gl.vertexAttribPointer(
          contributor9Location, 3, gl.FLOAT, false, 29 * 4, 26 * 4);

      gl.bindVertexArray(null);
      this.vaos[sourceLevel] = vao;

      sourceLevel += 1;
      if (sourceLevel > 1) {
        sourceOffset = offset;
      }
      offset += Math.max(targetLevelNx, targetLevelNy) + 1;
      sourceLevelNx = Math.floor(sourceLevelNx / 2);
      sourceLevelNy = Math.floor(sourceLevelNy / 2);
    }
  }

  restrictFrom(level: number) {
    this.render(level);
  }

  doRender(level: number) {
      this.gl.useProgram(this.program);

      this.waterMask.useAsTexture(this.waterMaskLocation);
      this.gl.uniform1i(this.destinationLevelLocation, level + 1);
      this.gl.uniform1i(this.destinationOffset, this.destinationOffsets[level]);
      this.gl.uniform1i(this.sourceOffset, this.sourceOffsets[level]);
      this.gl.uniformMatrix4fv(
          this.gl.getUniformLocation(this.program, "afterGridToClipcoords"),
          false, toGridClipcoords(this.rightHandSideMultigrid.width, this.rightHandSideMultigrid.height));

      if (level === 0) {
        this.residuals.useAsTexture(this.sourceLocation);
      } else {
        this.residualsMultigrid.useAsTexture(this.sourceLocation);
      }
      this.rightHandSideMultigrid.renderTo();
      this.gl.bindVertexArray(this.vaos[level]);
      this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
      this.gl.bindVertexArray(null);

      this.rightHandSideMultigrid.swap();
  }
}

const vertexShaderSource = `
in vec4 afterGridcoords;

// The grid coordinates of the center of the restriction kernel in before-space
in vec4 contributor1;
in vec4 contributor2;
in vec4 contributor3;
in vec4 contributor4;
in vec4 contributor5;
in vec4 contributor6;
in vec4 contributor7;
in vec4 contributor8;
in vec4 contributor9;

uniform mediump isampler2D waterMask;
uniform int destinationLevel;
uniform int destinationOffset;
uniform int sourceOffset;

// we have to convert the afterGridcoords to clip space
uniform mat4 afterGridToClipcoords;

uniform sampler2D source;

// the value we pass directly to the fragment shader
out float value;

bool waterAtContributor(vec4 contributor) {
  ivec2 finestCoords = (ivec2(contributor.xy) - ivec2(sourceOffset, sourceOffset)) * (1 << (destinationLevel - 1));
  return texelFetch(waterMask, finestCoords, 0).x == 1;
}

void main() {
  gl_Position = afterGridToClipcoords * afterGridcoords;
  gl_PointSize = 1.0;
  
  ivec2 here = (ivec2(afterGridcoords.xy) - ivec2(destinationOffset, destinationOffset)) * (1 << destinationLevel);
  bool water_here = texelFetch(waterMask, here, 0).x == 1;
  if (!water_here) {
    value = 0.0;
    return;
  }
  
  bool lumping = false;
  
  float result = 0.0;
  
  float lumping1 = 0.0;
  float lumping3 = 0.0;
  float lumping7 = 0.0;
  float lumping9 = 0.0;
  
  // do the corners
  if (!lumping || waterAtContributor(contributor1)) {
    result += texelFetch(source, ivec2(contributor1.xy), 0).x * contributor1.z;
  } else {
    lumping1 = contributor1.z;
  }
  if (!lumping || waterAtContributor(contributor3)) {
    result += texelFetch(source, ivec2(contributor3.xy), 0).x * contributor3.z;
  } else {
    lumping3 = contributor3.z;
  }
  if (!lumping || waterAtContributor(contributor7)) {
    result += texelFetch(source, ivec2(contributor7.xy), 0).x * contributor7.z;
  } else {
    lumping7 = contributor7.z;
  }
  if (!lumping || waterAtContributor(contributor9)) {
    result += texelFetch(source, ivec2(contributor9.xy), 0).x * contributor9.z;
  } else {
    lumping9 = contributor9.z;
  }
  
  float lumping2 = 0.0;
  float lumping4 = 0.0;
  float lumping6 = 0.0;
  float lumping8 = 0.0;
  
  // do the edges
  if (!lumping || waterAtContributor(contributor2)) {
    result += texelFetch(source, ivec2(contributor2.xy), 0).x * (lumping1 + lumping3 + contributor2.z);
    lumping1 = 0.0;
    lumping3 = 0.0;
  } else {
    lumping2 = contributor2.z;
  }
  if (!lumping || waterAtContributor(contributor4)) {
    result += texelFetch(source, ivec2(contributor4.xy), 0).x * (lumping1 + lumping7 + contributor4.z);
    lumping1 = 0.0;
    lumping7 = 0.0;
  } else {
    lumping4 = contributor4.z;
  }
  if (!lumping || waterAtContributor(contributor6)) {
    result += texelFetch(source, ivec2(contributor6.xy), 0).x * (lumping3 + lumping9 + contributor6.z);
    lumping3 = 0.0;
    lumping9 = 0.0;
  } else {
    lumping6 = contributor6.z;
  }
  if (!lumping || waterAtContributor(contributor8)) {
    result += texelFetch(source, ivec2(contributor8.xy), 0).x * (lumping7 + lumping9 + contributor8.z);
    lumping7 = 0.0;
    lumping9 = 0.0;
  } else {
    lumping8 = contributor8.z;
  }
  
  // finally do the center
  result += texelFetch(source, ivec2(contributor5.xy), 0).x * (contributor5.z + lumping1 + lumping2 +
  lumping3 + lumping4 + lumping6 + lumping7 + lumping8 + lumping9);
  
  value = result;
}
`;

const fragmentShaderSource = `
precision mediump float;

in float value;

out float Value;

void main() {
  Value = value;
}
`;
