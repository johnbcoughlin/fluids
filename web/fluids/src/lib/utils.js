export const flatten = (a: Array) => {
  "use strict";

  const result = [];
  for (let i = 0; i < a.length; i++) {
    result.push(...a[i]);
  }
  return result;
};