import ctypes
import sdl2
from OpenGL import GL
from OpenGL.GL import shaders
from OpenGL.arrays.vbo import VBO

import numpy as np
from numpy.random import rand

from time import sleep

float_size = ctypes.sizeof(ctypes.c_float)

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
    prog = setupGL()
    drawGrid(prog)


def setupGL():
    vertexShaderProgram = """#version 150
        in vec2 position;
        in vec3 color;

        out vec3 Color;

        void main() {
            Color = color;
            gl_Position = vec4(position.x / 15.0 - 1.0, position.y / 15.0 - 1.0, 0.0, 1.0);
        }"""
    vertexShader = GL.glCreateShader(GL.GL_VERTEX_SHADER)
    GL.glShaderSource(vertexShader, vertexShaderProgram)
    GL.glCompileShader(vertexShader)

    fragmentShaderProgram = """#version 150
        in vec3 Color;

        out vec4 outColor;

        void main() {
            outColor = vec4(Color, 1.0);
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

    vao = GL.glGenVertexArrays(1)
    GL.glBindVertexArray(vao)

    return shaderProgram


def drawGrid(shaderProgram):
    Δx = 1.0
    n = 30
    m = 30
    grid_x = np.linspace(0, m-1, m) * Δx
    grid_y = np.linspace(0, n-1, n) * Δx
    stagger_x = np.linspace(-0.5, m-0.5, m+1)
    stagger_y = np.linspace(-0.5, n-0.5, n+1)

    grid = np.stack(np.meshgrid(grid_x, grid_y), axis=-1)
    grid = np.concatenate([grid, rand(n, m, 3)], axis=-1)

    grid = grid.astype('float32')
    print(grid)

    vbo = GL.glGenBuffers(1)
    GL.glBindBuffer(GL.GL_ARRAY_BUFFER, vbo)
    GL.glBufferData(GL.GL_ARRAY_BUFFER, float_size * grid.size, grid.flatten(), GL.GL_STATIC_DRAW)

    elements = []
    for i in range(n - 1):
        for j in range(m - 1):
            elements.append([i * m + j, i * m + j+1, (i+1) * m + j])
            elements.append([i * m + j+1, (i+1) * m + j, (i+1) * m + j+1])
    elements = np.array(elements)[17]
    print(elements)
    print(grid.flatten()[elements])

    ebo = GL.glGenBuffers(1)
    GL.glBindBuffer(GL.GL_ELEMENT_ARRAY_BUFFER, ebo)
    GL.glBufferData(GL.GL_ELEMENT_ARRAY_BUFFER, elements.size * float_size, elements, GL.GL_STATIC_DRAW)


    # bind input symbols
    posAttrib = GL.glGetAttribLocation(shaderProgram, b"position")
    GL.glEnableVertexAttribArray(posAttrib)
    GL.glVertexAttribPointer(posAttrib, 2, GL.GL_FLOAT, False, 5 * float_size, ctypes.c_voidp(0))

    colAttrib = GL.glGetAttribLocation(shaderProgram, b"color");
    GL.glEnableVertexAttribArray(colAttrib);
    GL.glVertexAttribPointer(colAttrib, 3, GL.GL_FLOAT, False, 5 * float_size, ctypes.c_voidp(2 * float_size))


    #GL.glClearColor(1.0, 0.5, 0.0, 1.0)
    GL.glClear(GL.GL_COLOR_BUFFER_BIT)
    #GL.glDrawElements(GL.GL_TRIANGLES, elements.size, GL.GL_UNSIGNED_INT, 0)
    GL.glDrawArrays(GL.GL_TRIANGLES, 0, 3)



def wait_for_close():
    event = sdl2.SDL_Event()
    while sdl2.SDL_WaitEvent(ctypes.byref(event)):
        if event.type == sdl2.SDL_QUIT:
            break



if __name__ == '__main__':
    run()
    wait_for_close()
