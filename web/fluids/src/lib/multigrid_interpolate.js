// @flow

import {createProgram, loadShader} from "../gl_util";
import {toGridClipcoords, toGridTexcoords} from "./grids";
import {flatten} from "./utils";
import {TwoPhaseRenderTarget} from "./render_targets";
import type {GL, GLLocation, GLProgram, GLVAO} from "./gl_types";
import type {Correction} from "./types";
import type {FinestGrid, Multigrid, Solution} from "./types";

export class MultigridInterpolatePressure {
  gl: GL;
  nx: number;
  ny: number;
  multigrid: Solution & Multigrid;
  corrections: Correction & FinestGrid;
  correctionsMultigrid: Correction & Multigrid;
  waterMask: FinestGrid;

  program: GLProgram;
  vaos: Array<GLVAO>;
  coords: Array<Array<Array<number>>>;
  sourceOffsets: Array<number>;
  destinationOffsets: Array<number>;

  sourceLocation: GLLocation;
  waterMaskLocation: GLLocation;
  destinationLevelLocation: GLLocation;
  sourceOffsetLocation: GLLocation;
  destinationOffsetLocation: GLLocation;

  constructor(gl: GL,
              nx: number,
              ny: number,
              multigrid: Solution & Multigrid,
              corrections: Correction & FinestGrid,
              correctionsMultigrid: Correction & Multigrid,
              waterMask: FinestGrid) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    this.multigrid = multigrid;
    this.corrections = corrections;
    this.correctionsMultigrid = correctionsMultigrid;
    this.waterMask = waterMask;
    this.coords = [];
    this.vaos = [];
    this.sourceOffsets = [];
    this.destinationOffsets = [];
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
    this.sourceOffsetLocation = gl.getUniformLocation(this.program, "sourceOffset");
    this.destinationOffsetLocation = gl.getUniformLocation(this.program, "destinationOffset");

    this.setupPositions(gl, this.program);
  }

  setupPositions(gl: GL, program: GLProgram) {
    let targetLevel = 0;
    let targetLevelNx = this.nx;
    let targetLevelNy = this.ny;
    let targetOffset = 0;
    let sourceOffset = 0;
    this.destinationOffsets[0] = targetOffset;
    this.sourceOffsets[0] = sourceOffset;

    while (targetLevelNx > 2 && targetLevelNy > 2) {
      const levelCoords = [];
      if (targetLevel > 0) {
        sourceOffset += Math.max(Math.floor(targetLevelNx), Math.floor(targetLevelNy)) + 1;
      }
      if (targetLevel > 1) {
        targetOffset += Math.max(Math.floor(targetLevelNx * 2), Math.floor(targetLevelNy * 2)) + 1;
      }
      for (let i = 0; i < targetLevelNx; i++) {
        for (let j = 0; j < targetLevelNy; j++) {
          const vertex = [i + targetOffset, j + targetOffset];
          if (i % 2 === 0 && j % 2 === 0) {
            vertex.push(
                i / 2 + sourceOffset, j / 2 + sourceOffset, 1,
                0, 0, 0,
                0, 0, 0,
                0, 0, 0);
          } else if (i % 2 === 0 && j % 2 === 1) {
            vertex.push(
                i / 2 + sourceOffset, Math.floor(j / 2) + sourceOffset, 0.5,
                i / 2 + sourceOffset, Math.floor(j / 2) + 1 + sourceOffset, 0.5,
                0, 0, 0,
                0, 0, 0);
          } else if (i % 2 === 1 && j % 2 === 0) {
            vertex.push(
                Math.floor(i / 2) + sourceOffset, j / 2 + sourceOffset, 0.5,
                0, 0, 0,
                Math.floor(i / 2) + 1 + sourceOffset, j / 2 + sourceOffset, 0.5,
                0, 0, 0);
          } else {
            vertex.push(
                Math.floor(i / 2) + sourceOffset, Math.floor(j / 2) + sourceOffset, 0.25,
                Math.floor(i / 2) + sourceOffset, Math.floor(j / 2) + 1 + sourceOffset, 0.25,
                Math.floor(i / 2) + 1 + sourceOffset, Math.floor(j / 2) + sourceOffset, 0.25,
                Math.floor(i / 2) + 1 + sourceOffset, Math.floor(j / 2) + 1 + sourceOffset, 0.25);
          }
          levelCoords.push(vertex);
        }
      }

      this.coords[targetLevel] = levelCoords;
      this.sourceOffsets[targetLevel] = sourceOffset;
      this.destinationOffsets[targetLevel] = targetOffset;

      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      const data = flatten(levelCoords);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);

      const vao = gl.createVertexArray();
      this.vaos[targetLevel] = vao;
      gl.bindVertexArray(vao);

      const afterGridCoordLocation = gl.getAttribLocation(program, "afterGridcoords");
      gl.enableVertexAttribArray(afterGridCoordLocation);
      gl.vertexAttribPointer(
          afterGridCoordLocation, 2, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT, 0);
      const contributor1Location = gl.getAttribLocation(program, "contributor1");
      gl.enableVertexAttribArray(contributor1Location);
      gl.vertexAttribPointer(
          contributor1Location, 3, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT,
          2 * Float32Array.BYTES_PER_ELEMENT);
      const contributor2Location = gl.getAttribLocation(program, "contributor2");
      gl.enableVertexAttribArray(contributor2Location);
      gl.vertexAttribPointer(
          contributor2Location, 3, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT,
          5 * Float32Array.BYTES_PER_ELEMENT);
      const contributor3Location = gl.getAttribLocation(program, "contributor3");
      gl.enableVertexAttribArray(contributor3Location);
      gl.vertexAttribPointer(
          contributor3Location, 3, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT,
          8 * Float32Array.BYTES_PER_ELEMENT);
      const contributor4Location = gl.getAttribLocation(program, "contributor4");
      gl.enableVertexAttribArray(contributor4Location);
      gl.vertexAttribPointer(
          contributor4Location, 3, gl.FLOAT, false, 14 * Float32Array.BYTES_PER_ELEMENT,
          11 * Float32Array.BYTES_PER_ELEMENT);

      gl.bindVertexArray(null);

      targetLevel = targetLevel + 1;
      targetLevelNx = Math.floor(targetLevelNx / 2);
      targetLevelNy = Math.floor(targetLevelNy / 2);
    }
  }

  // interpolate from the given level to the level below
  interpolateTo(level: number) {
    this.gl.useProgram(this.program);
    // prepare to use the vertices referring to coordinates in the target level
    this.gl.uniform1i(this.destinationLevelLocation, level);
    this.gl.uniform1i(this.sourceOffsetLocation, this.sourceOffsets[level]);
    this.gl.uniform1i(this.destinationOffsetLocation, this.destinationOffsets[level]);

    this.multigrid.useAsTexture(this.sourceLocation);
    if (level === 0) {
      this.corrections.renderTo();
      this.gl.uniformMatrix4fv(
          this.gl.getUniformLocation(this.program, "afterGridToClipcoords"),
          false, toGridClipcoords(this.nx, this.ny));
    } else {
      this.correctionsMultigrid.renderTo();
      this.gl.uniformMatrix4fv(
          this.gl.getUniformLocation(this.program, "afterGridToClipcoords"),
          false, toGridClipcoords(this.multigrid.width, this.multigrid.height));
    }

    this.gl.bindVertexArray(this.vaos[level]);
    this.gl.drawArrays(this.gl.POINTS, 0, this.coords[level].length);
    this.gl.bindVertexArray(null);

    if (level === 0) {
      this.corrections.swap();
    } else {
      this.correctionsMultigrid.swap();
    }
  }
}

const vertexShaderSource = `
in vec4 afterGridcoords;

in vec4 contributor1;
in vec4 contributor2;
in vec4 contributor3;
in vec4 contributor4;

// we have to convert the afterGridcoords to clip space
uniform mat4 afterGridToClipcoords;
uniform mediump isampler2D waterMask;
uniform int destinationLevel;
uniform int sourceOffset;
uniform int destinationOffset;

uniform sampler2D source;

out float value;

bool waterAtContributor(vec4 contributor) {
  ivec2 finestCoords = (ivec2(contributor.xy) - ivec2(sourceOffset, sourceOffset)) * (1 << (destinationLevel + 1));
  return texelFetch(waterMask, finestCoords, 0).x == 1;
}

void main() {
  gl_Position = afterGridToClipcoords * afterGridcoords;
  gl_PointSize = 1.0;
  
  ivec2 here = (ivec2(afterGridcoords.xy) - ivec2(destinationOffset, destinationOffset)) * (1 << destinationLevel);
  bool water_here = texelFetch(waterMask, here, 0).x == 1;
  if (!water_here) {
    value = 0.0;
  }
  
  float result = 0.0;
  float lumping = 0.0;
  float foo = 0.0;
  if (waterAtContributor(contributor1)) {
    result += texelFetch(source, ivec2(contributor1.xy), 0).x * (contributor1.z + lumping);
    lumping = 0.0;
  } else {
    lumping += contributor1.z;
    foo += contributor1.z;
  }
  if (waterAtContributor(contributor2)) {
    result += texelFetch(source, ivec2(contributor2.xy), 0).x * (contributor2.z + lumping);
    lumping = 0.0;
  } else {
    lumping += contributor2.z;
    foo += contributor2.z;
  }
  if (waterAtContributor(contributor3)) {
    result += texelFetch(source, ivec2(contributor3.xy), 0).x * (contributor3.z + lumping);
    lumping = 0.0;
  } else {
    lumping += contributor3.z;
    foo += contributor3.z;
  }
  if (waterAtContributor(contributor4)) {
    result += texelFetch(source, ivec2(contributor4.xy), 0).x * (contributor4.z + lumping);
    lumping = 0.0;
  } else {
    lumping += contributor4.z;
    foo += contributor4.z;
  }
  
  value = result;
}
`;

const fragmentShaderSource = `
in float value;

out float Value;

void main() {
  Value = value;
}
`;
