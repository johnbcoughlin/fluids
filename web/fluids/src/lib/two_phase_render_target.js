// @flow

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

  constructor(gl, name: string, textureUnit, textureUnitInt, textureFactory, width, height) {
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

  renderFromA(uniformLocation) {
    this.gl.activeTexture(this.textureUnit);
    this.gl.uniform1i(uniformLocation, this.textureUnitInt);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureA);
  }

  renderFromB(uniformLocation) {
    this.gl.activeTexture(this.textureUnit);
    this.gl.uniform1i(uniformLocation, this.textureUnitInt);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.textureB);
  }

  renderToA() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebufferA);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  renderToB() {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebufferB);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  swap() {
    let tmpFb = this.framebufferA;
    let tmpTex = this.textureA;
    this.framebufferA = this.framebufferB;
    this.textureA = this.textureB;
    this.framebufferB = tmpFb;
    this.textureB = tmpTex;
  }
}

