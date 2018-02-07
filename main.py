from fluid import Simulation
from gl import FluidVis
import time
from time import sleep


sim = Simulation()
i = 0

def frame(vis):
    global i
    i += 1
    if i == 1:
        sleep(2)
    start_time = time.time()
    sim.step()
    time_elapsed = time.time() - start_time
    print("{} ms".format(time_elapsed * 1000))
    vis.drawParticles(sim.state.particles)


def runit():
    vis = FluidVis(Δx=sim.Δx, Δy=sim.Δx, m=sim.m, n=sim.n)
    vis.main_loop(lambda: frame(vis))

runit()
