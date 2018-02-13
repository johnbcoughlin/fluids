class TwoPhaseRenderTarget {
  gl;
  framebuffer;
  textureA;
  textureB;
  targetIsA;

  constructor(gl) {
    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    this.targetIsA = true;

    this.textureA = gl.createTexture();
    this.textureB = gl.createTexture();

    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT1, gl.TEXTURE_2D);
  }

  renderTarget() {
    return this.targetIsA ? this.textureA : this.textureB;
  }
}