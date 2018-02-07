import ctypes
import sdl2
from OpenGL import GL
from OpenGL.GL import shaders
from OpenGL.arrays.vbo import VBO

import numpy as np
from numpy.random import rand

from time import sleep

float_size = ctypes.sizeof(ctypes.c_float)
int_size = ctypes.sizeof(ctypes.c_int)

class FluidVis:
    def __init__(self, Δx=1.0, Δy=1.0, m=10, n=10):
        self.Δx = Δx
        self.Δy = Δy
        self.m = m
        self.n = n
        self.width = Δx * m
        self.height = Δy * n

        if sdl2.SDL_Init(sdl2.SDL_INIT_VIDEO) != 0:
            print(sdl2.SDL_GetError())
            return

        sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_MAJOR_VERSION, 3)
        sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_MINOR_VERSION, 3)
        sdl2.SDL_GL_SetAttribute(sdl2.SDL_GL_CONTEXT_PROFILE_MASK, sdl2.SDL_GL_CONTEXT_PROFILE_CORE)
        self.window = sdl2.SDL_CreateWindow(
            b"Example 1",
            sdl2.SDL_WINDOWPOS_UNDEFINED, sdl2.SDL_WINDOWPOS_UNDEFINED, 640, 480,
            sdl2.SDL_WINDOW_OPENGL | sdl2.SDL_WINDOW_ALWAYS_ON_TOP)
        sdl2.SDL_SetWindowInputFocus(self.window)
        self.context = sdl2.SDL_GL_CreateContext(self.window)
        self.setupGL()
        self.prepGrid()
        self.prepBuffers()
        sdl2.SDL_RaiseWindow(self.window)


    def setupGL(self):
        vertexShaderProgram = """#version 150
            uniform mat4 M;

            in vec2 position;
            in float scalarVal;

            out float ScalarVal;

            void main() {
                ScalarVal = scalarVal;
                gl_Position = M * vec4(position.x, position.y, 0.0, 1.0);
            }"""
        vertexShader = GL.glCreateShader(GL.GL_VERTEX_SHADER)
        GL.glShaderSource(vertexShader, vertexShaderProgram)
        GL.glCompileShader(vertexShader)

        fragmentShaderProgram = """#version 150
            uniform float scalarNormalizer;

            in float ScalarVal;

            out vec4 outColor;

            void main() {
                outColor = vec4(ScalarVal / scalarNormalizer, 0.0, 1.0 - ScalarVal / scalarNormalizer, 1.0);
            }"""
        fragmentShader = GL.glCreateShader(GL.GL_FRAGMENT_SHADER)
        GL.glShaderSource(fragmentShader, fragmentShaderProgram)
        GL.glCompileShader(fragmentShader)

        # shader program
        self.shaderProgram = GL.glCreateProgram()
        GL.glAttachShader(self.shaderProgram, vertexShader)
        GL.glAttachShader(self.shaderProgram, fragmentShader)

        GL.glBindFragDataLocation(self.shaderProgram, 0, b"outColor")

        # link the program
        GL.glLinkProgram(self.shaderProgram)
        # validate the program
        GL.glValidateProgram(self.shaderProgram)
        # activate the program
        GL.glUseProgram(self.shaderProgram)

        vao = GL.glGenVertexArrays(1)
        GL.glBindVertexArray(vao)

        # set up translation matrix
        m = np.array([
            [2.0 / self.width, 0.0, 0.0, -1.0],
            [0.0, -2.0 / self.height, 0.0, 1.0],
            [0.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 1.0]
        ], dtype='float32')
        M = GL.glGetUniformLocation(self.shaderProgram, "M")
        GL.glUniformMatrix4fv(M, 1, True, m)


    def prepGrid(self):
        grid_x = np.linspace(0, self.width-self.Δx, self.m) * self.Δx
        grid_y = np.linspace(0, self.height-self.Δy, self.n) * self.Δy

        grid = np.stack(np.meshgrid(grid_x, grid_y), axis=-1)

        grid = grid.astype('float32')

        elements = []
        for i in range(self.n - 1):
            for j in range(self.m - 1):
                elements.append([i * self.m + j, i * self.m + j+1, (i+1) * self.m + j])
                elements.append([i * self.m + j+1, (i+1) * self.m + j, (i+1) * self.m + j+1])

        self.elements = np.array(elements, dtype='uint32')

        ebo = GL.glGenBuffers(1)
        GL.glBindBuffer(GL.GL_ELEMENT_ARRAY_BUFFER, ebo)
        GL.glBufferData(GL.GL_ELEMENT_ARRAY_BUFFER, self.elements.size * int_size, self.elements, GL.GL_STATIC_DRAW)

        # get ready to bind data
        posAttrib = GL.glGetAttribLocation(self.shaderProgram, b"position")
        GL.glEnableVertexAttribArray(posAttrib)

        vertices = GL.glGenBuffers(1)
        GL.glBindBuffer(GL.GL_ARRAY_BUFFER, vertices)
        GL.glBufferData(GL.GL_ARRAY_BUFFER, float_size * grid.size, grid.flatten(), GL.GL_STATIC_DRAW)
        GL.glVertexAttribPointer(posAttrib, 2, GL.GL_FLOAT, False, 2 * float_size, ctypes.c_voidp(0))

    def prepBuffers(self):
        self.scalars = GL.glGenBuffers(1)
        self.particles = GL.glGenBuffers(1)

    def drawField(self, field):
        scalarAttrib = GL.glGetAttribLocation(self.shaderProgram, b"scalarVal")
        GL.glEnableVertexAttribArray(scalarAttrib)

        # do scalar value
        GL.glBindBuffer(GL.GL_ARRAY_BUFFER, self.scalars)
        GL.glBufferData(GL.GL_ARRAY_BUFFER, float_size * field.size, field.astype('float32'), GL.GL_STATIC_DRAW)
        GL.glVertexAttribPointer(scalarAttrib, 1, GL.GL_FLOAT, False, float_size, ctypes.c_voidp(0))

        # normalize scalar
        scalarNormalizer = GL.glGetUniformLocation(self.shaderProgram, b"scalarNormalizer")
        GL.glUniform1f(scalarNormalizer, np.max(field))

        GL.glClear(GL.GL_COLOR_BUFFER_BIT)
        GL.glDrawElements(GL.GL_TRIANGLES, self.elements.size, GL.GL_UNSIGNED_INT, ctypes.c_voidp(0))

        sdl2.SDL_GL_SwapWindow(self.window)

    def drawParticles(self, particles):
        # normalize scalar
        scalarNormalizer = GL.glGetUniformLocation(self.shaderProgram, b"scalarNormalizer")
        GL.glUniform1f(scalarNormalizer, 1.0)

        posAttrib = GL.glGetAttribLocation(self.shaderProgram, b"position")
        GL.glEnableVertexAttribArray(posAttrib)

        GL.glBindBuffer(GL.GL_ARRAY_BUFFER, self.particles)
        GL.glBufferData(GL.GL_ARRAY_BUFFER, float_size * particles.size, particles.astype('float32'), GL.GL_STATIC_DRAW)
        GL.glVertexAttribPointer(posAttrib, 2, GL.GL_FLOAT, False, 2 * float_size, ctypes.c_voidp(0))
        GL.glPointSize(3)

        GL.glClear(GL.GL_COLOR_BUFFER_BIT)
        GL.glDrawArrays(GL.GL_POINTS, 0, particles.size)

        sdl2.SDL_GL_SwapWindow(self.window)

    def main_loop(self, draw_frame):
        running = True
        event = sdl2.SDL_Event()
        while running:
            while sdl2.SDL_PollEvent(ctypes.byref(event)):
                if event.type == sdl2.SDL_QUIT:
                    running = False
            draw_frame()
            sdl2.SDL_Delay(160)

