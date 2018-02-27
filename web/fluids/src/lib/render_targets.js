import type {GL, GLFramebuffer, GLLocation, GLTexture, GLTextureUnit} from "./gl_types";

export interface RenderTarget {
  useAsTexture(uniformLocation: GLLocation): void;

  renderTo(): void;

  swap(): void;
}

export class TwoPhaseRenderTarget implements RenderTarget {
  // the WebGL2 Context
  gl: GL;
  name: string;
  textureUnit: GLTextureUnit;
  textureUnitInt: number;
  textureFactory: () => void;
  width: number;
  height: number;

  framebufferA: GLFramebuffer;
  textureA: GLTexture;
  framebufferB: GLFramebuffer;
  textureB: GLTextureUnit;

  swapped: boolean = true;

  currentRenderTarget: string = "B";
  usableTexture: string = "A";

  constructor(gl: GL,
              name: string,
              textureUnit: GLTextureUnit,
              textureUnitInt: number,
              textureFactory: () => void,
              width: number,
              height: number) {
    this.gl = gl;
    this.name = name;
    this.textureUnit = textureUnit;
    this.textureUnitInt = textureUnitInt;
    this.textureFactory = textureFactory;
    this.width = width;
    this.height = height;

    this.initialize(gl);
  }

  initialize(gl: GL) {
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

  useAsTexture(uniformLocation: GLLocation) {
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

export class FinestGrid extends TwoPhaseRenderTarget {
}

export class OnePhaseRenderTarget implements RenderTarget {
  gl: GL;
  name: string;
  textureUnit: GLTextureUnit;
  textureUnitInt: number;
  textureFactory: () => void;
  width: number;
  height: number;

  framebuffer: GLFramebuffer;
  texture: GLTexture;

  constructor(gl: GL,
              name: string,
              textureUnit: GLTextureUnit,
              textureUnitInt: number,
              textureFactory: () => void,
              width: number,
              height: number) {
    this.gl = gl;
    this.name = name;
    this.textureUnit = textureUnit;
    this.textureUnitInt = textureUnitInt;
    this.textureFactory = textureFactory;
    this.width = width;
    this.height = height;
    this.initialize(gl);
  }

  initialize(gl: GL) {
    gl.activeTexture(this.textureUnit);

    this.framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    this.textureFactory();
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  useAsTexture(uniformLocation: GLLocation) {
    this.gl.activeTexture(this.textureUnit);
    this.gl.uniform1i(uniformLocation, this.textureUnitInt);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
  }

  renderTo() {
    this.gl.viewport(0, 0, this.width, this.height);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
  }

  swap() {
    // no-op
  }
}