//
// creates a shader of the given type, uploads the source and
// compiles it.
//
export const loadShader = (gl, type, source) => {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

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

export const createProgram = (gl, vertexShader, fragmentShader) => {
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

export const checkFramebuffer = (gl) => {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  switch (status) {
    case gl.FRAMEBUFFER_INCOMPLETE:
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
  }
};
