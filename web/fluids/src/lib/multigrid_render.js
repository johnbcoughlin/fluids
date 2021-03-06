// @flow
import {gridPointVertices} from "./grids";
import {createProgram, loadShader} from "../gl_util";
import type {TwoPhaseRenderTarget} from "./render_targets";
import {flatten} from "./utils";
import type {GL, GLProgram, GLVAO} from "./gl_types";
import {GPUTimer} from "./gpu_timer";

export class MultigridRender {
  gl: GL;
  nx: number;
  ny: number;

  program: GLProgram;
  vaos: Array<GLVAO>;
  coords: Array<Array<Array<number>>>;

  timer: GPUTimer;
  timingName: string;

  constructor(gl: any,
              nx: number,
              ny: number,
              vertexShaderSource: string,
              fragmentShaderSource: string,
              timer: GPUTimer,
              timingName: string) {
    this.gl = gl;
    this.nx = nx;
    this.ny = ny;
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);
    this.timer = timer;
    this.timingName = timingName;
  }

  initialize(gl: GL) {
    gl.useProgram(this.program);
    this.vaos = [];
    this.coords = [];
    this.setupPositions(gl);
    this.bindPositions(gl);
    this.initializeUniforms(gl, this.program);
  }

  initializeUniforms(gl: GL, program: GLProgram) {
    throw new Error("Implement me");
  }

  setupPositions(gl: GL) {
    this.coords[0] = [];
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny; j++) {
        this.coords[0].push(this.vertexAttributeValues(0, i, j, 0));
      }
    }

    this.initializeLevel0();

    let level = 1;
    let levelNx = Math.floor(this.nx / 2);
    let levelNy = Math.floor(this.ny / 2);
    let offset = 0;

    while (levelNx > 2 && levelNy > 2) {
      const levelCoords = [];
      for (let i = 0; i < levelNx; i++) {
        for (let j = 0; j < levelNy; j++) {
          levelCoords.push(this.vertexAttributeValues(level, i, j, offset));
        }
      }
      this.coords[level] = levelCoords;

      this.initializeLevel(level, levelNx, levelNy, offset);

      offset += Math.max(levelNx, levelNy) + 1;
      levelNx = Math.floor(levelNx / 2);
      levelNy = Math.floor(levelNy / 2);
      level += 1;
    }
  }

  initializeLevel0() {

  }

  initializeLevel(level: number, levelNx: number, levelNy: number, offset: number) {
    throw new Error("Implement me");
  }

  vertexAttributeValues(level: number, i: number, j: number, offset: number) {
    return [i + offset, j + offset];
  }

  bindPositions(gl: GL) {
    gl.useProgram(this.program);
    for (let level = 0; level < this.coords.length; level++) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(flatten(this.coords[level])), gl.STATIC_DRAW);
      const vao = gl.createVertexArray();
      this.vaos.push(vao);
      gl.bindVertexArray(vao);
      this.bindCoordinateArrays(gl, this.program);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }
  }

  bindCoordinateArrays(gl: GL, program: GLProgram) {
    throw new Error("implement me");
  }

  doRender(level: number) {

  }

  render(level: number) {
    this.timer.timeCall(this.timingName + "-" + level, () => {
      this.doRender(level);
    });
  }
}