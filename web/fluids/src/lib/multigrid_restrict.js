class MultigridRestrictionRender {
  gridcoordsByLevel;
}

const vertexShaderSource = `#version 300 es
in ivec4 afterGridcoords;

// The grid coordinates of the center of the restriction kernel in before-space
in ivec4 contributor;

// the conversion for the level which is being restricted from
// we'll use this to query data points to combine in the restricted level
uniform mat4 beforeGridToTexcoords;

// we don't need a conversion from beforeGridcoords to afterGridcoords,
// because the restriction kernel is always [-1, +1] x [-1, +1] in gridcoords.

// we have to convert the afterGridcoords to clip space
uniform mat4 afterGridcoordsToClipcoords;

uniform sampler2D source;

// the value we pass directly to the fragment shader
out value;

void main() {
  gl_Position = afterGridcoordsToClipcoords * afterGridcoords;
  
  // the center of the kernel in before-space is just double the point.
  vec4 beforeGridcoords = vec4(afterGridcoords.xy * 2.0, 0.0, 1.0);
  
  vec2 xStep = vec2(1.0, 0.0);
  vec2 yStep = vec2(0.0, 1.0);
  
  vec2 topLeft = (beforeGridToTexcoords * (contributor.xy - xStep + yStep)).xy;
  vec2 top = (beforeGridToTexcoords * (contributor.xy + yStep)).xy;
  vec2 topRight = (beforeGridToTexcoords * (contributor.xy + xStep + yStep)).xy;
  
  vec2 left = (beforeGridToTexcoords * (contributor.xy - xStep)).xy;
  vec2 middle = (beforeGridToTexcoords * (contributor.xy)).xy;
  vec2 right = (beforeGridToTexcoords * (contributor.xy + xStep)).xy;
  
  vec2 bottomLeft = (beforeGridToTexcoords * (contributor.xy - xStep - yStep)).xy;
  vec2 bottom = (beforeGridToTexcoords * (contributor.xy - yStep)).xy;
  vec2 bottomRight = (beforeGridToTexcoords * (contributor.xy + xStep - yStep)).xy;
  
  value = 
      texture(source, topLeft).x / 16.0 +
      texture(source, top).x / 8.0 +
      texture(source, topRight).x / 16.0 +
      
      texture(source, left).x / 8.0 +
      texture(source, middle).x / 4.0 +
      texture(source, right).x / 8.0 +
      
      texture(source, bottomLeft).x / 16.0 +
      texture(source, bottom).x / 8.0 +
      texture(source, bottomRight).x / 16.0;
}
`;

const fragmentShaderSource = `#version 300 es
in float value;

out float Value;

void main() {
  Value = value;
}
`;
