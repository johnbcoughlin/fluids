// @flow
export const toGridClipcoords = (nx, ny) => {
  return [
    2 / nx, 0, 0, 0,
    0, 2 / ny, 0, 0,
    0, 0, 1, 0,
    -1, -1, 0, 1
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

export const toGridTexcoordsWithOffset = (nx, ny, offset) => {
  return [
    1 / nx, 0, 0, 0,
    0, 1 / ny, 0, 0,
    0, 0, 1, 0,
    (0.5 - offset) / nx, (0.5 - offset) / ny, 0, 1
  ]
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
  for (let i = 0; i < nx - 1; i++) {
    for (let j = 0; j < ny; j++) {
      // staggered grid
      positions.push(i, j, i + 1, j);
    }
  }
  return positions;
};

export const gridPointVertices = (nx, ny) => {
  const positions = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      // staggered grid
      positions.push([i, j]);
    }
  }
  return positions;
};

export const airDistances = (nx, ny) => {
  const result = [];
  const borderLeft = nx / 4 - 0.5;
  const borderRight = nx - nx / 4 - 0.5;
  const borderBottom = ny - ny / 4 - 0.5;
  // backwards iteration because texImage2D transposes.
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const point = [];
      if (i > borderLeft && i < borderRight && j > borderBottom) {
        point.push(0, 0, 0, 0);
      } else {
        // do the left
        point.push(i < borderLeft ? nx : (i < borderRight ? 0 : i - borderRight));
        // right
        point.push(i < borderLeft ? borderLeft - i : (i < borderRight ? 0 : nx));
        // bottom
        point.push(j < borderBottom ? ny : 0);
        // top
        point.push(j < borderBottom ? borderBottom - j : 0);
      }
      result.push(point);
    }
  }
  console.log(result);
  return result;
};

export const solidDistances = (nx, ny) => {
  const result = [];
  const borderLeftEnd = nx / 4 - 0.5;
  const borderRightStart = nx - nx / 4 - 0.5;
  const borderBottomEnd = ny / 4 - 0.5;
  // backwards iteration because texImage2D transposes.
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const point = [];
      if (i < borderLeftEnd || i > borderRightStart || j < borderBottomEnd) {
        point.push(0, 0, 0, 0);
      } else {
        point.push(i - borderLeftEnd, borderRightStart - i, j - borderBottomEnd, ny - j);
      }
      result.push(point);
    }
  }
  return result;
};
