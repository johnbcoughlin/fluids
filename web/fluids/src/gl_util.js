//
// creates a shader of the given type, uploads the source and
// compiles it.
//
import type {GL, GLProgram, GLShader} from "./lib/gl_types";

export const loadShader = (gl, type, source): GLShader => {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, versionString + usefulFunctions + source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
};

export const createProgram = (gl: GL, vertexShader: GLShader, fragmentShader: GLShader): GLProgram => {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
};

export const renderToCanvas = (gl) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
};

export const renderToTopLeft = (gl) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, gl.canvas.height / 2, gl.canvas.width / 2, gl.canvas.height / 2);
};

export const renderToTopRight = (gl) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(gl.canvas.width / 2, gl.canvas.height / 2, gl.canvas.width / 2, gl.canvas.height / 2);
};

export const renderToBottomLeft = (gl) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, gl.canvas.width / 2, gl.canvas.height / 2);
};

export const renderToBottomRight = (gl) => {
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(gl.canvas.width / 2, 0, gl.canvas.width / 2, gl.canvas.height / 2);
};

export const checkFramebuffer = (gl) => {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  switch (status) {
    case gl.FRAMEBUFFER_COMPLETE:
      console.log("Framebuffer is ready to go");
      return;
    case gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT:
      console.log("gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT");
      return;
    case gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT:
      console.log("gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT");
      return;
    case gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS:
      console.log("gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS");
      return;
    case gl.FRAMEBUFFER_UNSUPPORTED:
      console.log("gl.FRAMEBUFFER_UNSUPPORTED");
      return;
    case gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE:
      console.log("gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE");
      return;
    case gl.RENDERBUFFER_SAMPLES:
      console.log("gl.RENDERBUFFER_SAMPLES");
      return;
    default:
      console.log("unknown enum value " + status);
  }
};

/**
 * Resize a canvas to match the size its displayed.
 * @param {HTMLCanvasElement} canvas The canvas to resize.
 * @param {number} [multiplier] amount to multiply by.
 *    Pass in window.devicePixelRatio for native pixels.
 * @return {boolean} true if the canvas was resized.
 * @memberOf module:webgl-utils
 */
export const resizeCanvasToDisplaySize = (canvas, multiplier) => {
  multiplier = multiplier || 1;
  var width  = canvas.clientWidth  * multiplier | 0;
  var height = canvas.clientHeight * multiplier | 0;
  if (canvas.width !== width ||  canvas.height !== height) {
    canvas.width  = width;
    canvas.height = height;
    return true;
  }
  return false;
};

const versionString: string = `#version 300 es
precision mediump float;

`;

const usefulFunctions: string = `
float max4(vec4 v) {
  return max (max (max (v.x, v.y), v.z), v.w);
}

float max8(vec4 v, vec4 u) {
  return max (max4(v), max4(u));
}

// the left face
ivec2 stagger_left(ivec2 here) {
  return here;
}

// the right face
ivec2 stagger_right(ivec2 here) {
  return here + ivec2(1, 0);
}

// the down face
ivec2 stagger_down(ivec2 here) {
  return here;
}

// the up face
ivec2 stagger_up(ivec2 here) {
  return here + ivec2(0, 1);
}

// the left neighbor
ivec2 left(ivec2 here) {
  return here - ivec2(1, 0);
}

// the right neighbor
ivec2 right(ivec2 here) {
  return here + ivec2(1, 0);
}

// the down neighbor
ivec2 down(ivec2 here) {
  return here - ivec2(0, 1);
}

// the up neighbor
ivec2 up(ivec2 here) {
  return here + ivec2(0, 1);
}

bool bitmask_left(isampler2D waterMask, ivec2 here) {
  return texelFetch(waterMask, here + ivec2(-1, 0), 0).x == 1;
}

bool bitmask_right(isampler2D waterMask, ivec2 here) {
  return texelFetch(waterMask, here + ivec2(1, 0), 0).x == 1;
}

bool bitmask_down(isampler2D waterMask, ivec2 here) {
  return texelFetch(waterMask, here + ivec2(0, -1), 0).x == 1;
}

bool bitmask_up(isampler2D waterMask, ivec2 here) {
  return texelFetch(waterMask, here + ivec2(0, 1), 0).x == 1;
}

`;
