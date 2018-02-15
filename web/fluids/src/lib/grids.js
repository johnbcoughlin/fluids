export const toGridClipcoords = (nx, ny) => {
  return [
    2 / nx, 0, 0, 0,
    0, 2 / ny, 0, 0,
    0, 0, 1, 0,
    -1 + 1 / nx, -1 + 1 / ny, 0, 1
  ];
};

export const toGridTexcoords = (nx, ny) => {
  return [
    1 / nx, 0, 0, 0,
    0, 1 / ny, 0, 0,
    0, 0, 1, 0,
    0.5 / nx, 0.5 / ny, 0, 1
  ];
};

export const toVelocityXClipcoords = (nx, ny) => {
  return toGridClipcoords(nx + 1, ny);
};

export const toVelocityXTexcoords = (nx, ny) => {
  return toGridTexcoords(nx + 1, ny);
};

export const toVelocityYClipcoords = (nx, ny) => {
  return toGridClipcoords(nx, ny + 1);
};

export const toVelocityYTexcoords = (nx, ny) => {
  return toGridTexcoords(nx, ny + 1);
};

export const gridTriangleStripVertices = (nx, ny) => {
  const positions = [];
  for (let i = 0; i < nx-1; i++) {
    for (let j = 0; j < ny; j++) {
      // staggered grid
      positions.push(i, j, i+1, j);
    }
  }
  return positions;
};
