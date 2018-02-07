from gl import FluidVis
import numpy as np
import array
from numpy import linalg as LA
import matplotlib.pyplot as plt
import scipy.sparse.linalg as linalg
from scipy import sparse as sp
from scipy.signal import convolve2d
from scipy.interpolate import RegularGridInterpolator

from collections import namedtuple

np.set_printoptions(threshold=10000)

plt.gca().invert_yaxis()


class StaggeredGrid(namedtuple('StaggeredGrid', ['x', 'y'])):
    def __add__(self, other):
        return StaggeredGrid(self.x + other.x, self.y + other.y)

    def __mul__(self, other):
        if isinstance(other, StaggeredGrid):
            return StaggeredGrid(self.x * other.x, self.y * other.y)
        else:
            return StaggeredGrid(self.x * other, self.y * other)

    def copy(self):
        return StaggeredGrid(x=np.copy(self.x), y=np.copy(self.y))


FluidState = namedtuple('State', ['u', 'p', 'particles'])


class Simulation:
    def __init__(self):
        self.m = 30
        self.n = 30
        # 0 where there is a solid body
        edge = np.atleast_2d(np.ones(self.n, dtype='int8')).T
        self.solid_mask = np.concatenate([edge, np.tri(self.n, self.n // 2 - 1, -(self.n // 2), dtype='int8'),
                                          np.fliplr(np.tri(self.n, self.n // 2 - 1, -(self.n // 2), dtype='int8')),
                                          edge], axis=1)
        self.air_mask = np.zeros((self.n, self.m), dtype='int8')
        self.air_mask[0, 1:self.m - 1] = 1

        self.water_mask = np.ones((self.n, self.m), dtype='int8') - self.solid_mask - self.air_mask

        p_grid = np.zeros((self.n, self.m))
        u_x_grid = np.zeros((self.n, self.m + 1))
        u_y_grid = np.zeros((self.n + 1, self.m))
        self.u_solid = 0

        # gravity
        g_x = np.zeros((self.n, self.m + 1))
        g_y = np.full((self.n + 1, self.m), 9.8)

        u_grid = StaggeredGrid(u_x_grid, u_y_grid)
        self.g = StaggeredGrid(g_x, g_y)

        self.Δt = 0.5
        self.Δx = 1.0
        self.ρ = 1.0



        # grid coordinates
        self.grid_x = np.linspace(0, self.m - 1, self.m) * self.Δx
        self.grid_y = np.linspace(0, self.n - 1, self.n) * self.Δx
        self.stagger_x = np.linspace(-0.5, self.m - 0.5, self.m + 1)
        self.stagger_y = np.linspace(-0.5, self.n - 0.5, self.n + 1)

        self.stagger_grid = StaggeredGrid(x=np.stack(np.meshgrid(self.stagger_x, self.grid_y), axis=-1),
                                          y=np.stack(np.meshgrid(self.grid_x, self.stagger_y), axis=-1))
        self.grid = np.meshgrid(self.grid_x, self.grid_y)

        water_left = np.concatenate([np.zeros((self.n, 1), dtype='int8'), self.water_mask], axis=1)
        water_right = np.concatenate([self.water_mask, np.zeros((self.n, 1), dtype='int8')], axis=1)
        water_up = np.concatenate([np.zeros((1, self.m), dtype='int8'), self.water_mask])
        water_down = np.concatenate([self.water_mask, np.zeros((1, self.m), dtype='int8')])
        air_left = np.concatenate([np.zeros((self.n, 1), dtype='int8'), self.air_mask], axis=1)
        air_right = np.concatenate([self.air_mask, np.zeros((self.n, 1), dtype='int8')], axis=1)
        air_up = np.concatenate([np.zeros((1, self.m), dtype='int8'), self.air_mask])
        air_down = np.concatenate([self.air_mask, np.zeros((1, self.m), dtype='int8')])
        solid_left = np.concatenate([np.zeros((self.n, 1), dtype='int8'), self.solid_mask], axis=1)
        solid_right = np.concatenate([self.solid_mask, np.zeros((self.n, 1), dtype='int8')], axis=1)
        solid_up = np.concatenate([np.zeros((1, self.m), dtype='int8'), self.solid_mask])
        solid_down = np.concatenate([self.solid_mask, np.zeros((1, self.m), dtype='int8')])

        self.water_boundary_mask = StaggeredGrid(x=np.logical_or(water_left, water_right) * 1,
                                                 y=np.logical_or(water_down, water_up) * 1)
        self.water_water_boundary_mask = StaggeredGrid(x=water_left * water_right,
                                                       y=water_down * water_up)
        self.water_solid_boundary_mask = StaggeredGrid(x=np.logical_or(water_left * solid_right,
                                                                       solid_left * water_right) * 1,
                                                       y=np.logical_or(water_down * solid_up,
                                                                       solid_down * water_up) * 1)

        self.water_water_or_air_boundary_mask = StaggeredGrid(
            x=np.clip(self.water_boundary_mask.x - self.water_solid_boundary_mask.x, 0, 1),
            y=np.clip(self.water_boundary_mask.y - self.water_solid_boundary_mask.y, 0, 1))

        self.water_cell_neighbors = water_left[:, :-1] + water_right[:, 1:] + water_down[1:, :] + water_up[:-1, :]
        self.water_or_air_cell_neighbors = self.water_cell_neighbors + air_left[:, :-1] + air_right[:, 1:] + air_down[
                                                                                                             1:,
                                                                                                             :] + air_up[
                                                                                                                  :-1,
                                                                                                                  :]

        particles = np.stack(self.grid, axis=-1)[self.water_mask == 1]

        """
        Initial state
        """
        self.state = FluidState(u=u_grid, p=p_grid, particles=particles)
        self.state.u.x[10,10:20] = -30

    def step(self):
        u = self.state.u.copy()
        u = self.apply_body_forces(u)
        new_state = self.correct_pressure(u, self.state.p)
        # all water cells should have zero divergence
        water_divergence = self.divergence(new_state.u)[self.water_mask == 1]
        if not np.allclose(water_divergence, np.zeros(water_divergence.shape)):
            print(self.divergence(new_state.u))
            raise AssertionError("non-zero divergence velocity field")
        self.state = new_state
        self.state = self.advect()

    # just gravity
    def apply_body_forces(self, u):
        return u + self.g * self.Δt * self.water_boundary_mask

    def smashed_coord(self, i, j):
        return self.m * i + j

    def unsmashed_coord(self, c):
        return c // self.m, c % self.m

    def divergence(self, u):
        # for the purposes of calculating divergence,
        # velocity across fluid-solid boundaries is u_solid
        adjusted_u = (u * self.water_water_or_air_boundary_mask) + self.water_solid_boundary_mask * self.u_solid

        # np.diff computes u[n+1] - u[n], and returns an array that is one smaller
        # in the given dimension.
        du_x = np.diff(adjusted_u.x, axis=1)
        du_y = np.diff(adjusted_u.y, axis=0)

        return (du_x + du_y) / self.Δx

    def pressure_gradient_update(self, u, p):
        # do water to water boundaries first
        p_up = np.concatenate([np.zeros((1, self.m)), p])
        p_down = np.concatenate([p, np.zeros((1, self.m))])
        p_left = np.concatenate([np.zeros((self.n, 1)), p], axis=1)
        p_right = np.concatenate([p, np.zeros((self.n, 1))], axis=1)
        p_grad = StaggeredGrid(x=p_left - p_right, y=p_up - p_down)
        u_x = np.copy(u.x)
        u_y = np.copy(u.y)
        u_x += self.water_water_or_air_boundary_mask.x * (self.Δt / self.ρ) * p_grad.x / self.Δx
        u_y += self.water_water_or_air_boundary_mask.y * (self.Δt / self.ρ) * p_grad.y / self.Δx

        u_x[self.water_solid_boundary_mask.x == 1] = self.u_solid
        u_y[self.water_solid_boundary_mask.y == 1] = self.u_solid

        return StaggeredGrid(x=u_x, y=u_y)

    def correct_pressure(self, u, p):
        div = self.divergence(u)

        print("completed calculating divergences")

        # construct a sparse matrix representing the system of equations relating pressure with divergence
        nrows = np.sum(self.water_mask)
        index = np.argwhere(self.water_mask)

        row_index = np.zeros(self.water_mask.shape, dtype='int32')
        row_index[self.water_mask == 1] = np.arange(0, nrows)

        rows = array.array('i')
        cols = array.array('i')
        data = array.array('i')

        for cell in range(nrows):
            i, j = index[cell]
            p_ij_coef = self.water_or_air_cell_neighbors[i, j]
            rows.append(cell)
            cols.append(cell)
            data.append(p_ij_coef)
            for (di, dj) in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                if self.water_mask[i + di, j + dj]:
                    neighboring_cell = row_index[i + di, j + dj]
                    rows.append(cell)
                    cols.append(neighboring_cell)
                    data.append(-self.water_mask[i + di, j + dj])

        rows = np.frombuffer(rows, dtype='int32')
        cols = np.frombuffer(cols, dtype='int32')
        data = np.frombuffer(data, dtype='int32')
        A = sp.coo_matrix((data, (rows, cols)), shape=(nrows, nrows))
        A = A.tocsc().multiply(self.Δt / (self.ρ * self.Δx ** 2))
        M = linalg.LinearOperator((nrows, nrows), linalg.spilu(A).solve)
        sol = linalg.cgs(A=A, b=-div[self.water_mask == 1], M=M, x0=np.zeros(nrows), tol=1.0e-20)

        new_p = np.copy(p)
        new_p[self.water_mask == 1] = sol[0]

        new_u = self.pressure_gradient_update(u.copy(), new_p)

        return FluidState(u=new_u, p=new_p, particles=self.state.particles)

    def advect(self):
        # advect particles
        particles = self.advectPoints(self.state.particles)
        # advect x and y components of velocity
        u_x = self.advectField(self.state.u.x, self.stagger_x, self.grid_y)
        u_y = self.advectField(self.state.u.y, self.grid_x, self.stagger_y)

        return FluidState(
            u=StaggeredGrid(x=u_x, y=u_y),
            p=self.state.p,
            particles=particles
        )

    '''
    Advect a scalar `field` which is defined at `x_coords` and `y_coords`
    Uses a simple semi-Lagrangian method
    '''

    def advectField(self, field, x_coords, y_coords):
        u_x_interpolator = RegularGridInterpolator((self.grid_y, self.stagger_x), self.state.u.x,
                                                   bounds_error=False, fill_value=None)
        u_y_interpolator = RegularGridInterpolator((self.stagger_y, self.grid_x), self.state.u.y,
                                                   bounds_error=False, fill_value=None)
        value_interpolator = RegularGridInterpolator((y_coords, x_coords), field,
                                                     # don't throw if the preimage is outside the grid, and interpolate it
                                                     bounds_error=False, fill_value=None)

        # array of [x, y] coordinates where the field is defined.
        xy_coords = np.stack(np.meshgrid(x_coords, y_coords), axis=-1)
        # array of [ux, uy] velocity vectors
        velocities = np.stack([u_x_interpolator(xy_coords), u_y_interpolator(xy_coords)], axis=-1)
        preimages = xy_coords - velocities * self.Δt

        return value_interpolator(preimages)

    '''
    Advect an array of points through the current velocity field
    Uses simple Forward Euler
    '''

    def advectPoints(self, xy_coords):
        u_x_interpolator = RegularGridInterpolator((self.grid_y, self.stagger_x), self.state.u.x,
                                                   bounds_error=False, fill_value=None)
        u_y_interpolator = RegularGridInterpolator((self.stagger_y, self.grid_x), self.state.u.y,
                                                   bounds_error=False, fill_value=None)
        # array of [ux, uy] velocity vectors
        velocities = np.stack([u_x_interpolator(xy_coords), u_y_interpolator(xy_coords)], axis=-1)
        return xy_coords + velocities * self.Δt


    def visualize(self):
        plt.quiver(*np.meshgrid(self.stagger_x, self.grid_y), self.state.u.x, np.zeros(self.state.u.x.shape))
        plt.quiver(*np.meshgrid(self.grid_x, self.stagger_y), np.zeros(self.state.u.y.shape), -self.state.u.y)
        plt.pcolor(*np.meshgrid(self.stagger_x, self.stagger_y), self.state.p, alpha=0.5, snap=True, edgecolor="black")

        plt.scatter(x=self.state.particles[:,0].ravel(), y=self.state.particles[:,1].ravel())

        plt.show()
