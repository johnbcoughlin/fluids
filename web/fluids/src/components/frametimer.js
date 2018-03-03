// @flow

import React, {Component} from "react";

export type Props = {
  frameDuration: number;
}

export class FrameTimerComponent extends Component {
  props: Props;

  render() {
    return (<div>{this.props.frameDuration.toFixed(1)}</div>);
  }
}

export class FrameTimer {
  buffer: Array<number> = [];

  submitTiming(now: number): void {
    this.buffer.push(now);
    if (this.buffer.length > 10) {
      this.buffer.shift();
    }
  }

  averageTimePerFrame() {
    if (this.buffer.length === 0) {
      return 0.0;
    }
    const foo = this.buffer.reduce((accum: ?Array<number>, currentValue: number) => {
      if (accum.length === 0) {
        return [currentValue, 0, 0];
      } else {
        const [previousValue, count, sum] = accum;
        const thisFrame = currentValue - previousValue;
        return [currentValue, count + 1, sum + thisFrame];
      }
    }, []);

    const [_, count, sum] = foo;
    const result = count === 0 ? 0.0 : sum / count;
    return result;
  }
}