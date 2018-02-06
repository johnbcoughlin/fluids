import ctypes
import sdl2
from OpenGL import GL
from OpenGL.GL import shaders
from OpenGL.arrays.vbo import VBO

import numpy as np

from time import sleep


def run():
    if sdl2.SDL_Init(sdl2.SDL_INIT_VIDEO) != 0:
        print(sdl2.SDL_GetError())
        return

    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_MAJOR_VERSION, 3)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_MINOR_VERSION, 3)
    sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_PROFILE_MASK, sdl2.SDL_GL_CONTEXT_PROFILE_CORE)

    window = sdl2.SDL_CreateWindow(
        b"Example 1",
        sdl2.SDL_WINDOWPOS_UNDEFINED, sdl2.SDL_WINDOWPOS_UNDEFINED, 640, 480,
        sdl2.SDL_WINDOW_OPENGL)

    context = sdl2.SDL_GL_CreateContext(window)
    draw()
    sdl2.SDL_GL_SwapWindow(window)

def draw():
    vao = GL.glGenVertexArrays(1)
    GL.glBindVertexArray(vao)

    vertices = np.array([ 0.0, 0.5, 0.5, -0.5, -0.5, -0.5 ], dtype='float32')

    vbo = GL.glGenBuffers(1)
    GL.glBindBuffer(GL.GL_ARRAY_BUFFER, vbo)
    GL.glBufferData(GL.GL_ARRAY_BUFFER, ctypes.sizeof(ctypes.c_float) * len(vertices), vertices, GL.GL_STATIC_DRAW)

    vertexShaderProgram = """#version 150
        in vec2 position;
        void main() {
            gl_Position = vec4(position.x, position.y, 0.0, 1.0);
        }"""
    vertexShader = GL.glCreateShader(GL.GL_VERTEX_SHADER)
    GL.glShaderSource(vertexShader, vertexShaderProgram)
    GL.glCompileShader(vertexShader)

    fragmentShaderProgram = """#version 150
        out vec4 outColor;
        void main() {
            outColor = vec4(1.0, 1.0, 1.0, 1.0);
        }"""
    fragmentShader = GL.glCreateShader(GL.GL_FRAGMENT_SHADER)
    GL.glShaderSource(fragmentShader, fragmentShaderProgram)
    GL.glCompileShader(fragmentShader)

    # shader program
    shaderProgram = GL.glCreateProgram()
    GL.glAttachShader(shaderProgram, vertexShader)
    GL.glAttachShader(shaderProgram, fragmentShader)

    GL.glBindFragDataLocation(shaderProgram, 0, b"outColor")

    # link the program
    GL.glLinkProgram(shaderProgram)
    # validate the program
    GL.glValidateProgram(shaderProgram)
    # activate the program
    GL.glUseProgram(shaderProgram)

    posAttrib = GL.glGetAttribLocation(shaderProgram, b"position")
    GL.glVertexAttribPointer(posAttrib, 2, GL.GL_FLOAT, False, 0, ctypes.c_voidp(0))
    GL.glEnableVertexAttribArray(posAttrib)

    GL.glClearColor(1.0, 0.5, 0.0, 1.0)
    GL.glClear(GL.GL_COLOR_BUFFER_BIT)
    GL.glDrawArrays(GL.GL_TRIANGLES, 0, 3)

    print(GL.glGetError())



def wait_for_close():
    event = sdl2.SDL_Event()
    while sdl2.SDL_WaitEvent(ctypes.byref(event)):
        if event.type == sdl2.SDL_QUIT:
            break



if __name__ == '__main__':
    run()
    wait_for_close()
