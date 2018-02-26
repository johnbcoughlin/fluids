import {createProgram, loadShader} from "../gl_util";
import {
  toGridClipcoords, toGridTexcoords, toVelocityXClipcoords, toVelocityXTexcoords,
  toVelocityYClipcoords, toVelocityYTexcoords
} from "./grids";

export class AdvectionRender {
  gl;
  nx;
  dx;
  ny;
  dy;
  dt;
  velocityX;
  velocityY;
  dye;
  waterMask;

  program;
  velocityXVAO;
  velocityYVAO;
  dyeVAO;
  velocityXLocation;
  velocityYLocation;
  scalarFieldLocation;

  constructor(gl, nx, dx, ny, dy, dt, velocityX, velocityY, dye, waterMask) {
    this.gl = gl;
    this.nx = nx;
    this.dx = dx;
    this.ny = ny;
    this.dy = dy;
    this.dt = dt;
    this.velocityX = velocityX;
    this.velocityY = velocityY;
    this.dye = dye;
    this.waterMask = waterMask;
    this.initialize(gl);
  }

  initialize(gl) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    this.program = createProgram(gl, vertexShader, fragmentShader);

    // don't forget
    gl.useProgram(this.program);
    this.setupPositions(gl, this.program);

    this.velocityXLocation = gl.getUniformLocation(this.program, "velocityX");
    this.velocityYLocation = gl.getUniformLocation(this.program, "velocityY");
    this.scalarFieldLocation = gl.getUniformLocation(this.program, "scalarField");
    this.waterMaskLocation = gl.getUniformLocation(this.program, "waterMask");

    gl.uniform1f(gl.getUniformLocation(this.program, "dt"), this.dt);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toVelocityXTexcoords"),
        false, toVelocityXTexcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toVelocityYTexcoords"),
        false, toVelocityYTexcoords(this.nx, this.ny));
  }

  setupPositions(gl, program) {
    this.velocityXVAO = gl.createVertexArray();
    gl.bindVertexArray(this.velocityXVAO);
    let positionAttributeLocation = gl.getAttribLocation(program, "a_gridcoords");
    let positionBuffer = gl.createBuffer();
    this.positions = [];
    for (let i = 0; i < this.nx+1; i++) {
      for (let j = 0; j < this.ny; j++) {
        // staggered grid
        this.positions.push(i, j);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.velocityYVAO = gl.createVertexArray();
    gl.bindVertexArray(this.velocityYVAO);
    positionBuffer = gl.createBuffer();
    this.positions = [];
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny+1; j++) {
        // staggered grid
        this.positions.push(i, j);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.dyeVAO = gl.createVertexArray();
    gl.bindVertexArray(this.dyeVAO);
    positionBuffer = gl.createBuffer();
    this.positions = [];
    for (let i = 0; i < this.nx; i++) {
      for (let j = 0; j < this.ny; j++) {
        // staggered grid
        this.positions.push(i, j);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  advectX() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toClipcoords"),
        false, toVelocityXClipcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toScalarTexcoords"),
        false, toVelocityXTexcoords(this.nx, this.ny));
    this.waterMask.useAsTexture(this.waterMaskLocation);
    this.velocityX.useAsTexture(this.velocityXLocation);
    this.velocityX.useAsTexture(this.scalarFieldLocation);
    this.velocityY.useAsTexture(this.velocityYLocation);
    this.velocityX.renderTo();
    this.gl.bindVertexArray(this.velocityXVAO);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.positions.length / 2);
    this.gl.bindVertexArray(null);
    this.velocityX.swap();
  }

  advectY() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toClipcoords"),
        false, toVelocityYClipcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toScalarTexcoords"),
        false, toVelocityYTexcoords(this.nx, this.ny));
    this.waterMask.useAsTexture(this.waterMaskLocation);
    this.velocityX.useAsTexture(this.velocityXLocation);
    this.velocityY.useAsTexture(this.velocityYLocation);
    this.velocityY.useAsTexture(this.scalarFieldLocation);
    this.velocityY.renderTo();
    this.gl.bindVertexArray(this.velocityYVAO);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.positions.length / 2);
    this.gl.bindVertexArray(null);
    this.velocityY.swap();
  }

  advectDye() {
    const gl = this.gl;
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toClipcoords"),
        false, toGridClipcoords(this.nx, this.ny));
    gl.uniformMatrix4fv(
        gl.getUniformLocation(this.program, "toScalarTexcoords"),
        false, toGridTexcoords(this.nx, this.ny));
    this.waterMask.useAsTexture(this.waterMaskLocation);
    this.velocityX.useAsTexture(this.velocityXLocation);
    this.velocityY.useAsTexture(this.velocityYLocation);
    this.dye.useAsTexture(this.scalarFieldLocation);
    this.dye.renderTo();
    this.gl.bindVertexArray(this.dyeVAO);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.drawArrays(this.gl.POINTS, 0, this.positions.length / 2);
    this.gl.bindVertexArray(null);
    this.dye.swap();
  }
}

const vertexShaderSource = `
in vec4 a_gridcoords;

uniform sampler2D scalarField;
uniform sampler2D velocityX;
uniform sampler2D velocityY;
uniform mediump isampler2D waterMask;

uniform mat4 toClipcoords;
uniform mat4 toScalarTexcoords;
uniform mat4 toVelocityXTexcoords;
uniform mat4 toVelocityYTexcoords;
uniform float dt;

out float q;

void main() {
  gl_Position = toClipcoords * a_gridcoords;
  gl_PointSize = 1.0;
  
  ivec2 here = ivec2(a_gridcoords);
  float u_x = texture(velocityX, (toVelocityXTexcoords * a_gridcoords).xy).x;
  float u_y = texture(velocityY, (toVelocityYTexcoords * a_gridcoords).xy).x;
  
  vec2 there = a_gridcoords.xy - (dt * vec2(u_x, u_y));
  int water_there = texelFetch(waterMask, ivec2(there), 0).x;
  if (water_there == 0) {
    q = 0.0;
  } else {
    q = float(water_there) * texture(scalarField, (toScalarTexcoords * vec4(there, 0.0, 1.0)).xy).x;
  }
}
`;

const fragmentShaderSource = `
in float q;

out float Value;

void main() {
  Value = q;
}
`;
