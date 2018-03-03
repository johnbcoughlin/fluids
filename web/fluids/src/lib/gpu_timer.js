// @flow

import type {GL} from "./gl_types";

export class GPUTimer {
  gl: GL;
  ext: any;

  queryPool: Array<any>;
  openQueries: Array<{key: string, query: any}>;

  statistics: Map<string, {count: number, sum: number, sumOfSquares: number}>;

  constructor(gl: GL) {
    this.gl = gl;
    this.ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
    this.queryPool = [];
    this.openQueries = [];
    this.statistics = new Map();
  }

  timeCall(key: string, callable: () => void) {
    if (this.queryPool.length === 0) {
      this.queryPool.push(this.gl.createQuery());
    }
    const query = this.queryPool.shift();
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, query);
    this.openQueries.push({key, query});
    callable();
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
  }

  collectResults(): void {
    const openQueryCount = this.openQueries.length;
    for (let i = 0; i < openQueryCount; i++) {
      const {key, query} = this.openQueries.shift();
      const available = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT_AVAILABLE);

      // not sure what this is doing
      const disjoint = this.gl.getParameter(this.ext.GPU_DISJOINT_EXT);

      if (available && !disjoint) {
        if (!this.statistics.has(key)) {
          this.statistics.set(key, {count: 0, sum: 0, sumOfSquares: 0});
        }
        const nanos = this.gl.getQueryParameter(query, this.gl.QUERY_RESULT);
        const micros = nanos / 1000;
        const {count, sum, sumOfSquares} = this.statistics.get(key);
        this.statistics.set(key, {
          count: count + 1,
          sum: sum + micros,
          sumOfSquares: sumOfSquares + micros * micros,
        });
        this.queryPool.push(query);
      } else {
        this.openQueries.push({key, query});
      }
    }
  }
}