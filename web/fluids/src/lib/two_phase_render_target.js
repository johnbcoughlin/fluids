// @flow

import type {GL} from "./types";

export class TwoPhaseRenderTarget {
  // the WebGL2 Context
  gl;
  name: string;
  textureUnit;
  textureUnitInt;
  textureFactory;
  width;
  height;

  framebufferA = null;
  textureA = null;
  framebufferB = null;
  textureB = null;

  swapped: boolean = true;

  currentRenderTarget: string = "B";
  usableTexture: string = "A";

  constructor(gl: GL, name: string, textureUnit, textureUnitInt, textureFactory, width, height) {
    this.gl = gl;
    this.name = name;
    this.textureUnit = textureUnit;
    this.textureUnitInt = textureUnitInt;
    this.textureFactory = textureFactory;
    this.width = width;
    this.height = height;

    this.initialize(gl);
  }

  initialize(gl) {
    gl.activeTexture(this.textureUnit);

    this.framebufferA = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferA);
    this.textureA = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.textureA);
    this.textureFactory();
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textureA, 0);

    this.framebufferB = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebufferB);
    this.textureB = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.textureB);
    this.textureFactory();
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.textureB, 0);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  useAsTexture(uniformLocation) {
    if (!this.swapped) {
      throw new Error("render target cannot be used before being swapped");
    }
    this.gl.activeTexture(this.textureUnit);
    this.gl.uniform1i(uniformLocation, this.textureUnitInt);
    if (this.usableTexture === "A") {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureA);
    } else {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureB);
    }
  }

  renderTo() {
    this.swapped = false;
    this.gl.viewport(0, 0, this.width, this.height);
    if (this.currentRenderTarget === "A") {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebufferA);
    } else {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebufferB);
    }
  }


  swap() {
    this.swapped = true;
    this.currentRenderTarget = this.currentRenderTarget === "A" ? "B" : "A";
    this.usableTexture = this.usableTexture === "A" ? "B" : "A";
  }
}

